/* Dial lists (CRM revamp, step 3): the server side of the one system list,
 * "Callbacks due", whose members are every stage lead with a callback due
 * today or earlier, in callback order. Kept in step by the lists route on
 * every read, by the daily cron, and by the client's shared patch helper
 * on every write that touches a callback (src/lib/lists.js mirrors
 * callbacksDueIds). It cannot be deleted, renamed, or filled by hand. */
import { ObjectId } from 'mongodb';
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

/* ── The list helpers the caller route writes through (Billy's Call Room) ──
 * The admin's side keeps a list's members and each lead's listId together in
 * the browser (AdminApp's listOps over src/lib/lists.js); the caller's writes
 * happen on the server, so the same rules live here: withLeads, withoutLead,
 * applyOutcome and outcomeRemoves mirror src/lib/lists.js (caller-test runs
 * both and requires the same answers), and the three database helpers below
 * move the two sides in one call. The system list is never touched by hand. */
export const MAX_LIST_LEADS = 500;
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
export const withLeads = (leadIds, ids) => [...new Set([...(leadIds || []).map(String), ...ids.map(String)])].slice(0, MAX_LIST_LEADS);
export const withoutLead = (leadIds, id) => (leadIds || []).map(String).filter(x => x !== String(id));
/** What an outcome does to a list's members: null when nothing changes. */
export function applyOutcome(leadIds, leadId, outcome) {
  const ids = (leadIds || []).map(String); const id = String(leadId);
  if (!ids.includes(id)) return null;
  if (['booked', 'no', 'wrong-number', 'declined', 'callback'].includes(outcome)) return ids.filter(x => x !== id);
  if (outcome === 'no-answer') return [...ids.filter(x => x !== id), id];
  return null;
}
export const outcomeRemoves = (outcome) => ['booked', 'no', 'wrong-number', 'declined', 'callback'].includes(outcome);

/** An open hand list by id, or null (a done list, the system list and a bad id are all null). */
export async function openHandList(db, listId) {
  const _id = oid(listId);
  if (!_id) return null;
  const list = await db.collection('lists').findOne({ _id });
  return list && list.status === 'open' && !list.system ? list : null;
}
/** Take leads off every open hand list they sit on. The caller of this clears or resets each lead's listId on its own write. */
export async function takeOffLists(db, ids, exceptListId = '') {
  const want = new Set(ids.map(String));
  const lists = await db.collection('lists').find({ status: 'open' }).toArray();
  for (const l of lists) {
    if (l.system || String(l._id) === String(exceptListId)) continue;
    const cur = (l.leadIds || []).map(String);
    const rest = cur.filter(x => !want.has(x));
    if (rest.length !== cur.length) await db.collection('lists').updateOne({ _id: l._id }, { $set: { leadIds: rest, updatedAt: new Date() } });
  }
}
/** Put leads on one open hand list: the list gains them (unique, capped), every other open hand list loses them, each lead's listId points at it. */
export async function putOnList(db, ids, list) {
  const want = [...new Set(ids.map(String))];
  const next = withLeads(list.leadIds, want);
  const landed = want.filter(x => next.includes(x));
  await db.collection('lists').updateOne({ _id: list._id }, { $set: { leadIds: next, updatedAt: new Date() } });
  await takeOffLists(db, landed, list._id);
  const oids = landed.map(oid).filter(Boolean);
  if (oids.length) await db.collection('call_leads').updateMany({ _id: { $in: oids } }, { $set: { listId: String(list._id), updatedAt: new Date() } });
  return { leadIds: next, added: landed.length };
}
/** The list rule of a call outcome, on the list the lead sits on: off it, or to the back of it. Returns whether the lead left. */
export async function listAfterOutcome(db, lead, outcome) {
  if (!lead?.listId) return false;
  const list = await openHandList(db, lead.listId);
  if (!list) return outcomeRemoves(outcome);
  const next = applyOutcome(list.leadIds, lead._id, outcome);
  if (next) await db.collection('lists').updateOne({ _id: list._id }, { $set: { leadIds: next, updatedAt: new Date() } });
  return outcomeRemoves(outcome);
}
