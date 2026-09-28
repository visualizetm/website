/* Dial lists (CRM revamp, step 3): the server side of the one system list,
 * "Callbacks due", whose members are every stage lead with a callback due
 * today or earlier, in callback order. Kept in step by the lists route on
 * every read, by the daily cron, and by the client's shared patch helper
 * on every write that touches a callback (src/lib/lists.js mirrors
 * callbacksDueIds). It cannot be deleted, renamed, or filled by hand. */
import { normalizeStage } from '../_semantics.js';

export const CALLBACKS_DUE_NAME = 'Callbacks due';
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };

/** Every stage lead with callStatus callback and a callbackAt today or earlier, sorted by callbackAt. */
export function callbacksDueIds(leads, now = Date.now()) {
  const today = dayKey(new Date(now));
  return (leads || [])
    .filter(l => !l.deleted && normalizeStage(l) === 'lead' && l.callStatus === 'callback' && l.callbackAt)
    .map(l => ({ id: String(l._id), at: new Date(l.callbackAt).getTime() || 0 }))
    .filter(x => x.at && dayKey(new Date(x.at)) <= today)
    .sort((a, b) => a.at - b.at)
    .map(x => x.id);
}
export const sameIds = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => String(x) === String(b[i]));

/** The system list, created on first sight, with its members recomputed. Returns the document. */
export async function syncCallbacksDue(db, now = Date.now()) {
  const col = db.collection('lists');
  const leads = await db.collection('call_leads').find({ deleted: { $ne: true }, callStatus: 'callback' }).project({ stage: 1, callStatus: 1, callbackAt: 1, deleted: 1 }).toArray();
  const leadIds = callbacksDueIds(leads, now);
  let doc = await col.findOne({ system: true, status: 'open' });
  if (!doc) {
    const item = { name: CALLBACKS_DUE_NAME, target: 500, window: 'any', leadIds, status: 'open', system: true, scheduledFor: '', createdAt: new Date(), updatedAt: new Date() };
    const r = await col.insertOne(item);
    return { ...item, _id: r.insertedId };
  }
  if (!sameIds(doc.leadIds, leadIds)) { await col.updateOne({ _id: doc._id }, { $set: { leadIds, updatedAt: new Date() } }); doc = { ...doc, leadIds }; }
  return doc;
}
