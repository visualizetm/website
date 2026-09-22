import { ObjectId } from 'mongodb';
import { randomBytes } from 'node:crypto';
import { getDb } from '../_lib/mongo.js';
import { safeUrl } from '../_lib/url.js';
import { CONCEPT_SET_STATUS_IDS, CONCEPT_ITEM_KIND_IDS, CONCEPT_FEEDBACK_ACTION_IDS } from '../_semantics.js';

/* Concept sets: one document per presentation Rob sends a client
 * (docs/CONCEPTS-AUDIT.md). A set belongs to a lead at any stage, holds
 * one to six directions of up to twelve items each, and carries the
 * client's feedback and their approval. The client reaches it through
 * api/planner.js?r=concepts with the set's token.
 *
 *   GET    /api/admin/concept-sets?leadId=<id>   { items } for one lead, newest round first
 *   GET    /api/admin/concept-sets              { items } every live set
 *   POST   { leadId, title, round, ... }         { ok, item }  the token is minted here
 *   PATCH  { id, set }                           $set only the keys sent (sanitized)
 *   DELETE { id }                                the tombstone every collection uses
 *
 * The token mirrors the planner's exactly: minted server side only
 * (randomBytes(24) as base64url), never accepted from a request, carried
 * forward on every PATCH, and regenerated only by { regenerate: true },
 * which is how a link is revoked. A draft never resolves publicly whatever
 * the token, so "draft" is the second lock. Moving draft to sent stamps
 * sentAt. Nothing here writes feedback or an approval: those come only
 * through the public endpoint, from the client. */

const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const uid = () => Math.random().toString(36).slice(2, 10);
const mint = () => randomBytes(24).toString('base64url');
export const MAX_DIRECTIONS = 6;
export const MAX_ITEMS = 12;

const sanitizeItem = (it, i) => ({
  id: str(it?.id, 40) || uid(),
  kind: CONCEPT_ITEM_KIND_IDS.includes(it?.kind) ? it.kind : 'other',
  image: safeUrl(it?.image, 600),
  caption: str(it?.caption, 200),
  order: Number.isFinite(Number(it?.order)) ? Number(it.order) : i,
});
const sanitizeDirection = (d, i) => ({
  id: str(d?.id, 40) || uid(),
  name: str(d?.name, 80),
  rationale: str(d?.rationale, 600),
  items: Array.isArray(d?.items) ? d.items.slice(0, MAX_ITEMS).map(sanitizeItem) : [],
  order: Number.isFinite(Number(d?.order)) ? Number(d.order) : i,
});
/* Feedback is sanitized for shape only when it arrives from the admin
 * (a migration, a repair); the public endpoint appends its own entries. */
const sanitizeFeedback = (f) => ({
  id: str(f?.id, 40) || uid(),
  at: str(f?.at, 40),
  directionId: f?.directionId ? str(f.directionId, 40) : null,
  action: CONCEPT_FEEDBACK_ACTION_IDS.includes(f?.action) ? f.action : 'note',
  note: str(f?.note, 1000),
  name: str(f?.name, 80),
});

export function sanitize(b) {
  return {
    leadId: b.leadId !== undefined ? str(b.leadId, 64) : undefined,
    title: b.title !== undefined ? str(b.title, 120) : undefined,
    round: b.round !== undefined ? Math.max(1, Math.min(99, Math.round(Number(b.round)) || 1)) : undefined,
    intro: b.intro !== undefined ? str(b.intro, 600) : undefined,
    status: b.status !== undefined ? (CONCEPT_SET_STATUS_IDS.includes(b.status) ? b.status : 'draft') : undefined,
    directions: Array.isArray(b.directions) ? b.directions.slice(0, MAX_DIRECTIONS).map(sanitizeDirection) : undefined,
    feedback: Array.isArray(b.feedback) ? b.feedback.slice(-200).map(sanitizeFeedback) : undefined,
    approvedDirectionId: b.approvedDirectionId !== undefined ? (b.approvedDirectionId ? str(b.approvedDirectionId, 40) : '') : undefined,
    approvedAt: b.approvedAt !== undefined ? str(b.approvedAt, 40) : undefined,
    projectId: b.projectId !== undefined ? str(b.projectId, 64) : undefined,
    archived: b.archived !== undefined ? !!b.archived : undefined,
    /* Not writable from a request: token, tokenCreatedAt, lastViewedAt,
       sentAt. They are set by this file (the stamps) or never (the token,
       except by minting). Listed here so a reader sees the whole shape. */
  };
}
const compact = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

export async function handler(req, res) {
  const db = await getDb();
  const col = db.collection('concept_sets');

  if (req.method === 'GET') {
    const q = { deleted: { $ne: true } };
    if (req.query?.leadId) q.leadId = String(req.query.leadId);
    const items = await col.find(q).sort({ updatedAt: -1 }).limit(500).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const doc = compact(sanitize(req.body || {}));
    if (!doc.leadId) return res.status(400).json({ error: 'leadId required' });
    const now = new Date();
    const item = {
      title: 'Brand directions', round: 1, intro: '', status: 'draft', directions: [], feedback: [],
      approvedDirectionId: '', approvedAt: '', projectId: '', archived: false,
      ...doc,
      status: 'draft', feedback: [], approvedDirectionId: '', approvedAt: '',
      token: mint(), tokenCreatedAt: now.toISOString(), lastViewedAt: '', sentAt: '',
      createdAt: now, updatedAt: now,
    };
    const r = await col.insertOne(item);
    return res.status(200).json({ ok: true, item: { ...item, _id: r.insertedId } });
  }

  if (req.method === 'PATCH') {
    const { id, set } = req.body || {};
    const _id = oid(id);
    if (!_id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const clean = sanitize(set);
    const allowed = {};
    for (const key of Object.keys(clean)) if (key in set && clean[key] !== undefined) allowed[key] = clean[key];
    const regenerate = set.regenerate === true;
    if (!Object.keys(allowed).length && !regenerate) return res.status(400).json({ error: 'nothing to update' });
    const before = await col.findOne({ _id, deleted: { $ne: true } }, { projection: { status: 1, sentAt: 1 } });
    if (!before) return res.status(404).json({ error: 'not found' });
    if (regenerate) { allowed.token = mint(); allowed.tokenCreatedAt = new Date().toISOString(); }
    /* The stamp: the first time a set leaves draft for sent. Moving it back
       to draft (to rework it before the client has looked) keeps sentAt as
       history and stamps again next time. */
    if (allowed.status === 'sent' && before.status !== 'sent') allowed.sentAt = new Date().toISOString();
    allowed.updatedAt = new Date();
    await col.updateOne({ _id, deleted: { $ne: true } }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const _id = oid(req.query?.id || req.body?.id);
    if (!_id) return res.status(400).json({ error: 'id required' });
    await col.updateOne({ _id }, { $set: { deleted: true, deletedAt: new Date(), updatedAt: new Date() } });
    return res.status(200).json({ ok: true, deleted: 1 });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
