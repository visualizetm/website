import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { LIST_WINDOW_IDS, LIST_STATUS_IDS } from '../_semantics.js';
import { syncCallbacksDue, CALLBACKS_DUE_NAME } from '../_lib/lists.js';

/* Dial lists (CRM revamp, step 3): a named set of leads to call, built by
 * hand or from the Call Console's filters, run as a session.
 *
 *   GET    /api/admin/lists            { items }: every open list plus the
 *                                      done ones from the last seven days;
 *                                      the system list is created here on
 *                                      first sight and its members refreshed
 *   POST   { name, target, window, leadIds, scheduledFor }   { ok, item }
 *   PATCH  { id, set, sync? }          $set only the keys sent (sanitized).
 *                                      The system list takes leadIds only
 *                                      from a sync (the client helper and the
 *                                      cron), never a name, a target, a
 *                                      status or a hand-picked member
 *   DELETE ?id                         soft: status done. The system list
 *                                      answers 409
 *
 * A lead carries listId, the one open list it is on; the client's shared
 * helper keeps the two sides in step. */

const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const DAY = 864e5;
const MAX_LEADS = 500;

function sanitize(b) {
  return {
    name: b.name !== undefined ? str(b.name, 80) : undefined,
    target: b.target !== undefined ? (Number.isFinite(Number(b.target)) ? Math.max(1, Math.min(500, Math.round(Number(b.target)))) : 25) : undefined,
    window: b.window !== undefined ? (LIST_WINDOW_IDS.includes(b.window) ? b.window : 'any') : undefined,
    leadIds: Array.isArray(b.leadIds) ? [...new Set(b.leadIds.filter(x => typeof x === 'string' || typeof x === 'number').map(x => str(x, 64)).filter(Boolean))].slice(0, MAX_LEADS) : undefined,
    status: b.status !== undefined ? (LIST_STATUS_IDS.includes(b.status) ? b.status : 'open') : undefined,
    scheduledFor: b.scheduledFor !== undefined ? (/^\d{4}-\d{2}-\d{2}$/.test(String(b.scheduledFor)) ? String(b.scheduledFor) : '') : undefined,
  };
}
const compact = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

export async function handler(req, res) {
  const db = await getDb();
  const col = db.collection('lists');

  if (req.method === 'GET') {
    const system = await syncCallbacksDue(db);
    const since = new Date(Date.now() - 7 * DAY);
    const items = await col.find({ $or: [{ status: 'open' }, { status: 'done', updatedAt: { $gte: since } }] }).sort({ createdAt: -1 }).limit(200).toArray();
    if (!items.some(i => String(i._id) === String(system._id))) items.unshift(system);
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const doc = compact(sanitize(req.body || {}));
    if (!doc.name) return res.status(400).json({ error: 'name required' });
    if (doc.name.toLowerCase() === CALLBACKS_DUE_NAME.toLowerCase()) return res.status(400).json({ error: 'That name is the system list. Pick another.' });
    const now = new Date();
    const item = { target: 25, window: 'any', leadIds: [], status: 'open', scheduledFor: '', ...doc, system: false, createdAt: now, updatedAt: now };
    const r = await col.insertOne(item);
    return res.status(200).json({ ok: true, item: { ...item, _id: r.insertedId } });
  }

  if (req.method === 'PATCH') {
    const _id = oid(req.body?.id);
    const set = req.body?.set && typeof req.body.set === 'object' ? req.body.set : null;
    if (!_id || !set) return res.status(400).json({ error: 'id and set required' });
    const before = await col.findOne({ _id });
    if (!before) return res.status(404).json({ error: 'not found' });
    const clean = sanitize(set);
    const allowed = {};
    for (const key of Object.keys(clean)) if (key in set && clean[key] !== undefined) allowed[key] = clean[key];
    if (before.system) {
      /* The system list is what the callbacks say it is: no rename, no
         target, no status, and members only from a sync. */
      const hand = Object.keys(allowed).filter(k => !(k === 'leadIds' && req.body?.sync === true));
      if (hand.length) return res.status(400).json({ error: 'Callbacks due fills itself. It cannot be renamed, resized, finished or filled by hand.' });
    }
    if (allowed.name && allowed.name.toLowerCase() === CALLBACKS_DUE_NAME.toLowerCase()) return res.status(400).json({ error: 'That name is the system list. Pick another.' });
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    allowed.updatedAt = new Date();
    await col.updateOne({ _id }, { $set: allowed });
    const item = await col.findOne({ _id });
    return res.status(200).json({ ok: true, item });
  }

  if (req.method === 'DELETE') {
    const _id = oid(req.query?.id);
    if (!_id) return res.status(400).json({ error: 'id required' });
    const before = await col.findOne({ _id });
    if (!before) return res.status(404).json({ error: 'not found' });
    if (before.system) return res.status(409).json({ error: 'Callbacks due cannot be deleted.' });
    await col.updateOne({ _id }, { $set: { status: 'done', updatedAt: new Date() } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
