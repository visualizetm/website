/* Dial lists (CRM revamp, step 3), the pure logic. A list is a named set of
 * leads to call in order; one system list, Callbacks due, fills itself.
 * The outcome rules here are what the Call Console applies on the same
 * write as the call log. api/_lib/lists.js mirrors callbacksDueIds. */
import { normalizeStage } from '../shared/semantics.js';
import { dayKey } from '../shared/dates.js';

export const CALLBACKS_DUE_NAME = 'Callbacks due';
export const MAX_LIST_LEADS = 500;

export const isOpen = (l) => !!l && l.status !== 'done';
export const openLists = (lists) => (lists || []).filter(isOpen);
export const handLists = (lists) => openLists(lists).filter(l => !l.system);
export const systemList = (lists) => openLists(lists).find(l => l.system) || null;
export const listCount = (l) => (Array.isArray(l?.leadIds) ? l.leadIds.length : 0);
export const isFull = (l) => !!l && !l.system && listCount(l) >= (Number(l.target) || 0);
/** The Lists badge: open lists at or above their target. */
export const listsBadge = (lists) => handLists(lists).filter(isFull).length;
/** Every lead id on any open list, so a fill never doubles someone up. */
export const onAnyOpenList = (lists) => new Set(openLists(lists).flatMap(l => (l.leadIds || []).map(String)));

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

/** What an outcome does to a list's members: null when nothing changes. */
export function applyOutcome(leadIds, leadId, outcome) {
  const ids = (leadIds || []).map(String); const id = String(leadId);
  if (!ids.includes(id)) return null;
  if (['booked', 'no', 'wrong-number', 'declined', 'callback'].includes(outcome)) return ids.filter(x => x !== id);
  if (outcome === 'no-answer') return [...ids.filter(x => x !== id), id];
  return null;
}
/** Does the outcome take the lead off the list (so its listId clears)? */
export const outcomeRemoves = (outcome) => ['booked', 'no', 'wrong-number', 'declined', 'callback'].includes(outcome);

/** The members after adding leads: unique, capped, in the order given. */
export const withLeads = (leadIds, ids) => [...new Set([...(leadIds || []).map(String), ...ids.map(String)])].slice(0, MAX_LIST_LEADS);
export const withoutLead = (leadIds, id) => (leadIds || []).map(String).filter(x => x !== String(id));
export const WINDOWS = [
  { id: 'any', label: 'Any time' }, { id: 'morning', label: 'Morning' }, { id: 'midday', label: 'Midday' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Evening' },
];
export const windowLabel = (id) => (WINDOWS.find(w => w.id === id) || WINDOWS[0]).label;
export const tomorrowKey = (now = Date.now()) => dayKey(new Date(now + 864e5));
