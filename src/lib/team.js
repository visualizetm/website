/* Billy on Rob's side of the app (Billy's Call Room, part 1): the pure half. What the record's Booked by Billy card
 * shows, the tag on the home's rows, and how Billy's day reads (the chips, a row's words, the day's numbers).
 * No fetch and no React; scripts/team-test.mjs reads it. The name is the one constant here: the lead only carries who. */
import { normalizeStage, CALL_STATUSES, DECLINE_REASONS } from '../shared/semantics.js';

export const CALLER_ID = 'billy';
export const CALLER_NAME = 'Billy';
const ms = (v) => { const t = new Date(v || '').getTime(); return Number.isFinite(t) ? t : 0; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ── The record ──────────────────────────────────────────────────────── */
/** His calls on a lead, oldest first: the log entries stamped by: billy. */
export const billyCalls = (lead) => (Array.isArray(lead?.callLog) ? lead.callLog : []).filter(e => e && e.by === CALLER_ID);
/** The Booked by Billy card: when he booked it, his notes from that call, his calls on the lead; null when he did not book it. */
export function bookedByBilly(lead) {
  if (lead?.bookedBy?.who !== CALLER_ID) return null;
  const calls = billyCalls(lead);
  const booking = [...calls].reverse().find(e => e.outcome === 'booked') || null;
  return {
    name: CALLER_NAME,
    at: String(lead.bookedBy.at || ''),
    notes: String(booking?.note || '').trim(),
    calls: calls.map(e => ({ at: String(e.at || ''), outcome: String(e.outcome || ''), label: CALL_STATUSES.find(s => s.id === e.outcome)?.label || 'Call', note: String(e.note || '').trim() })),
  };
}
/** The tag a home row wears while the booking is still ahead: "Booked by Billy", else ''. */
export const bookedTag = (lead) => (lead?.bookedBy?.who === CALLER_ID && normalizeStage(lead) === 'booked' ? `Booked by ${CALLER_NAME}` : '');

/* ── Billy's day ─────────────────────────────────────────────────────── */
export const DAY_RANGES = [{ id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'week', label: 'Week' }];
export const DAY_CHIPS = [{ id: 'all', label: 'All' }, { id: 'calls', label: 'Calls' }, { id: 'booked', label: 'Booked' }, { id: 'sorting', label: 'Sorting' }];
/** Which chip a row belongs under: a call, a booking, or sorting (triage, lists, the contact fix). A finished session shows under All only. */
export const rowChip = (row) => (row?.kind === 'call' ? 'calls' : row?.kind === 'booked' ? 'booked' : row?.kind === 'sort' || row?.kind === 'contact' ? 'sorting' : 'all');
export const dayRows = (rows, chip = 'all') => [...(rows || [])].filter(r => chip === 'all' || rowChip(r) === chip).sort((a, b) => ms(b.at) - ms(a.at));
export const chipCounts = (rows) => Object.fromEntries(DAY_CHIPS.map(c => [c.id, c.id === 'all' ? (rows || []).length : (rows || []).filter(r => rowChip(r) === c.id).length]));
const OUTCOME = { 'no-answer': 'No answer', callback: 'Call back set', no: 'Not interested', 'wrong-number': 'Wrong number', booked: 'Booked' };
const reasonLabel = (id) => DECLINE_REASONS.find(r => r.id === id)?.label || '';
/** A row in Rob's words: { title, detail }. The title names the business (or the batch); the detail is what happened. */
export function rowWords(row) {
  const d = row?.detail || {}; const biz = row?.business || 'A lead'; const n = (row?.leadIds || []).length;
  if (row?.kind === 'booked') return { title: `Booked ${biz}`, detail: d.note || '' };
  if (row?.kind === 'call') return { title: `${OUTCOME[d.outcome] || 'Call'}: ${biz}`, detail: [d.outcome === 'no' ? reasonLabel(d.reason) : '', d.note].filter(Boolean).join('. ') };
  if (row?.kind === 'contact') return { title: `Fixed the ${(d.fields || []).join(' and ') || 'contact'}: ${biz}`, detail: '' };
  if (row?.kind === 'session') return { title: `Finished a session${d.list ? `: ${d.list}` : ''}`, detail: `${plural(d.calls || 0, 'call')}, ${d.talked || 0} talked, ${d.booked || 0} booked` };
  if (row?.kind === 'sort') {
    if (d.op === 'accept') return { title: `Accepted ${biz}`, detail: d.list ? `Onto ${d.list}` : 'Straight to Leads' };
    if (d.op === 'decline') return { title: `Declined ${n > 1 ? plural(n, 'lead') : biz}`, detail: [reasonLabel(d.reason), d.note].filter(Boolean).join('. ') };
    if (d.op === 'snooze') return { title: `Not now: ${biz}`, detail: 'Sent to the back of Triage' };
    if (d.op === 'list') return { title: `${n > 1 ? plural(n, 'lead') : biz} onto ${d.list || 'a list'}`, detail: '' };
    if (d.op === 'new-list') return { title: `New list: ${d.list || biz}`, detail: `${plural(d.added || 0, 'lead')}, ${d.calls === 'rob' ? 'Rob calls it' : `${CALLER_NAME} calls it`}` };
    if (d.op === 'rename') return { title: `Renamed a list to ${d.list || biz}`, detail: d.was ? `It was ${d.was}` : '' };
    if (d.op === 'skip') return { title: `Skipped ${biz} for now`, detail: d.list ? `On ${d.list}` : '' };
  }
  return { title: biz, detail: '' };
}
/** A batch row (a decline of one or more leads) opens its leads, each with Undo unless it was put back already. */
export const isBatch = (row) => (row?.kind === 'sort' && row?.detail?.op === 'decline') || (row?.kind === 'call' && row?.detail?.outcome === 'no');
export const batchLeads = (row) => (Array.isArray(row?.detail?.before) ? row.detail.before : []).map(b => ({ id: String(b.id), business: String(b.business || 'A lead'), stage: String(b.stage || 'lead'), undone: (row.undone || []).map(String).includes(String(b.id)) }));
/** The one lead a row opens, or '' (a batch opens its sheet; a session and a list row open nothing). */
export const rowLeadId = (row) => (!isBatch(row) && (row?.leadIds || []).length === 1 && ['call', 'booked', 'contact', 'sort'].includes(row?.kind) && !['new-list', 'rename'].includes(row?.detail?.op) ? String(row.leadIds[0]) : '');
/** "2:14 PM" today and yesterday, "Thu 2:14 PM" in the week view (New York). */
export function rowTime(at, range = 'today') {
  const t = ms(at); if (!t) return '';
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(t));
  return range === 'week' ? `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(t))} ${time}` : time;
}
/** "Seen 5 minutes ago", "Seen today at 2:14 PM", "Seen Nov 12", or "Has not signed in yet". */
export function lastSeenLine(iso, now = Date.now()) {
  const t = ms(iso); if (!t) return 'Has not signed in yet';
  const mins = Math.max(0, Math.round((now - t) / 60e3));
  if (mins < 2) return 'Seen just now';
  if (mins < 60) return `Seen ${mins} minutes ago`;
  const day = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(x));
  if (day(t) === day(now)) return `Seen today at ${rowTime(iso)}`;
  return `Seen ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(new Date(t))}`;
}
