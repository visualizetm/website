import { ObjectId } from 'mongodb';
import { randomBytes } from 'node:crypto';
import { getDb } from '../_lib/mongo.js';
import { tickCheckpoint } from '../_lib/deal-tick.js';
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
 * through the public endpoint, from the client.
 *
 * Approval mode (Review each): approvalMode is pick (the default, every
 * older document) or review; allowPass turns on "Not this one"; a direction
 * carries needsDecision (false is For reference). A review set the client
 * has submitted is locked: the mode, allowPass, which directions need an
 * answer and the set of directions cannot change until { reopen: true },
 * which clears the answers off the directions (the submissions[] history
 * keeps them) and puts the set back to sent. A direction's decision is the
 * client's and is never written from here; a PATCH that rewrites
 * directions[] carries each stored decision across by id. A review set with
 * nothing that needs an answer cannot be sent. */

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
  needsDecision: d?.needsDecision !== false,
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
    approvalMode: b.approvalMode !== undefined ? (b.approvalMode === 'review' ? 'review' : 'pick') : undefined,
    allowPass: b.allowPass !== undefined ? b.allowPass === true : undefined,
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
/* What a review set is locked on once the client has sent their answers. */
const lockedChange = (before, set) => {
  if ('approvalMode' in set && (set.approvalMode === 'review' ? 'review' : 'pick') !== (before.approvalMode === 'review' ? 'review' : 'pick')) return true;
  if ('allowPass' in set && (set.allowPass === true) !== (before.allowPass === true)) return true;
  if (Array.isArray(set.directions)) {
    const was = Array.isArray(before.directions) ? before.directions : [];
    if (set.directions.length !== was.length) return true;
    return set.directions.some(d => { const old = was.find(x => x.id === d?.id); return !old || (d?.needsDecision !== false) !== (old.needsDecision !== false); });
  }
  return false;
};
const needCount = (dirs) => (Array.isArray(dirs) ? dirs : []).filter(d => d?.needsDecision !== false).length;
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
      title: 'Brand directions', round: 1, intro: '', directions: [], projectId: '', archived: false, approvalMode: 'pick', allowPass: false,
      ...doc,
      status: 'draft', feedback: [], approvedDirectionId: '', approvedAt: '', submissions: [], submittedAt: '',
      token: mint(), tokenCreatedAt: now.toISOString(), lastViewedAt: '', sentAt: '',
      createdAt: now, updatedAt: now,
    };
    const r = await col.insertOne(item);
    // CRM revamp, step 5: a set for a booked or deal record ticks its Concepts checkpoint.
    await tickCheckpoint(db.collection('call_leads'), item.leadId, 'concepts');
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
    if (!Object.keys(allowed).length && !regenerate && set.reopen !== true) return res.status(400).json({ error: 'nothing to update' });
    const before = await col.findOne({ _id, deleted: { $ne: true } }, { projection: { status: 1, sentAt: 1, approvalMode: 1, allowPass: 1, submittedAt: 1, directions: 1 } });
    if (!before) return res.status(404).json({ error: 'not found' });
    const reopen = set.reopen === true;
    if (before.submittedAt && !reopen && lockedChange(before, set)) return res.status(409).json({ error: 'Reopen for review first. The client has sent their answers.' });
    if (reopen && !before.submittedAt) return res.status(409).json({ error: 'Nothing to reopen.' });
    /* The client's answers are not ours to write: a rewritten directions[] keeps each stored decision (a direction that still needs one). */
    if (allowed.directions) {
      allowed.directions = allowed.directions.map(d => { const old = (before.directions || []).find(x => x.id === d.id); return old?.decision && d.needsDecision !== false ? { ...d, decision: old.decision } : d; });
    }
    if (reopen) {
      const dirs = allowed.directions || before.directions || [];
      allowed.directions = dirs.map(({ decision, ...d }) => d);
      allowed.submittedAt = ''; allowed.status = 'sent'; allowed.reopenedAt = new Date().toISOString();
    }
    if (regenerate) { allowed.token = mint(); allowed.tokenCreatedAt = new Date().toISOString(); }
    /* A review set with nothing to decide has nothing to send. */
    const modeAfter = 'approvalMode' in allowed ? allowed.approvalMode : before.approvalMode;
    if (allowed.status === 'sent' && modeAfter === 'review' && !needCount(allowed.directions || before.directions)) return res.status(400).json({ error: 'Mark at least one item as Needs a decision first.' });
    /* The stamp: the first time a set leaves draft for sent. Moving it back
       to draft (to rework it before the client has looked) keeps sentAt as
       history and stamps again next time. */
    if (allowed.status === 'sent' && before.status !== 'sent') allowed.sentAt = new Date().toISOString();
    allowed.updatedAt = new Date();
    await col.updateOne({ _id, deleted: { $ne: true } }, { $set: allowed });
    /* The stored document comes back, so the shell takes what the server wrote (a stamp, a minted token, a reopen that cleared the answers). */
    return res.status(200).json({ ok: true, item: await col.findOne({ _id, deleted: { $ne: true } }) });
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
