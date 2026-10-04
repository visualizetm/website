import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { SUGGESTION_STATUS_IDS } from '../_semantics.js';

/* Suggestions (the planner dashboard, Ideas): what a client asked for from
 * their planner page. The client writes one through api/planner.js (the
 * only public door, token required, rate limited); this is Rob's side.
 *
 *   GET    /api/admin/suggestions?leadId=<id>   { items } for one client, newest first
 *   GET    /api/admin/suggestions               { items } every client's, the inbox and the badge
 *   PATCH  { id, set }                          $set only status, note, postId, seenAt
 *
 * Nothing here creates one and nothing deletes one: a suggestion is the
 * client's record of what they asked for, and Rob answers it. */
const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };

function sanitize(b) {
  return {
    status: b.status !== undefined ? (SUGGESTION_STATUS_IDS.includes(b.status) ? b.status : 'new') : undefined,
    note: b.note !== undefined ? str(b.note, 500) : undefined,
    postId: b.postId !== undefined ? str(b.postId, 64) : undefined,
    seenAt: b.seenAt !== undefined ? str(b.seenAt, 40) : undefined,
  };
}

export async function handler(req, res) {
  const db = await getDb();
  const col = db.collection('suggestions');

  if (req.method === 'GET') {
    const q = { deleted: { $ne: true } };
    if (req.query?.leadId) q.leadId = String(req.query.leadId);
    if (req.query?.status && SUGGESTION_STATUS_IDS.includes(String(req.query.status))) q.status = String(req.query.status);
    const items = await col.find(q).sort({ createdAt: -1 }).limit(500).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'PATCH') {
    const { id, set } = req.body || {};
    const _id = oid(id);
    if (!_id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const clean = sanitize(set);
    const allowed = {};
    for (const key of Object.keys(clean)) if (key in set && clean[key] !== undefined) allowed[key] = clean[key];
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    allowed.updatedAt = new Date();
    await col.updateOne({ _id, deleted: { $ne: true } }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
}
