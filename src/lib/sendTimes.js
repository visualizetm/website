/* The send sheet's pure half (email safety, prompt 1 of 3): when "Later" can send, the links that hand a message to Mail or
 * Messages, and the one line that says why a draft exists. No React, no clock of its own: every function takes now.
 *
 *   scheduleOptions(now)   -> [{ id, label, at (ISO) }]: Tonight 6pm (while it is still ahead), Tomorrow 9am, Monday 9am
 *   mailtoHref(to, subject, text), smsHref(phone, text)
 *   whyLine(row)           -> 'Form nudge rule, three days with no form' and the like
 *   firstLines(text, n)    -> the row's two line peek
 *   recipientOf(row)       -> the address or the phone a row goes to */
const pad = (n) => String(n).padStart(2, '0');
const at = (d, h) => { const t = new Date(d); t.setHours(h, 0, 0, 0); return t; };
export function scheduleOptions(now = new Date()) {
  const n = new Date(now);
  const out = [];
  const tonight = at(n, 18);
  if (tonight.getTime() > n.getTime() + 60e3) out.push({ id: 'tonight', label: 'Tonight 6pm', at: tonight.toISOString() });
  const tomorrow = at(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), 9);
  out.push({ id: 'tomorrow', label: 'Tomorrow 9am', at: tomorrow.toISOString() });
  const dow = n.getDay(); // 0 Sunday
  let days = (8 - dow) % 7; if (days === 0) days = 7; // the next Monday, never today
  const monday = at(new Date(n.getFullYear(), n.getMonth(), n.getDate() + days), 9);
  if (monday.getTime() !== tomorrow.getTime()) out.push({ id: 'monday', label: 'Monday 9am', at: monday.toISOString() });
  return out;
}
/** A datetime-local value for an instant, in the device's zone (the picker's own format). */
export const toLocalInput = (d = new Date()) => { const t = new Date(d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`; };
export const fromLocalInput = (v) => { const t = new Date(String(v || '')); return Number.isNaN(t.getTime()) ? '' : t.toISOString(); };

const enc = (s) => encodeURIComponent(String(s || ''));
export const mailtoHref = (to = [], subject = '', text = '') => `mailto:${(Array.isArray(to) ? to : [to]).filter(Boolean).join(',')}?subject=${enc(subject)}&body=${enc(text)}`;
/* sms: with ?&body= opens Messages with the text filled on iPhone and Android alike. */
export const smsHref = (phone = '', text = '') => `sms:${String(phone || '').replace(/[^0-9+]/g, '')}?&body=${enc(text)}`;

const NAMES = { stepper: 'the deal stepper', invoice: 'the invoice', delivery: 'the delivery', rule: 'a rule' };
export function whyLine(row, templateLabel = '') {
  if (!row) return '';
  const tpl = templateLabel || 'Email';
  if (row.channel === 'text') return row.reason || 'A text to send from Messages';
  if (row.reason) return row.auto ? `${tpl} rule: ${row.reason.charAt(0).toLowerCase()}${row.reason.slice(1)}` : row.reason;
  if (row.auto) return `${tpl} rule`;
  if (row.status === 'failed') return `Did not go: ${row.error || 'the send failed'}`;
  return NAMES[row.source] || 'Written in Compose';
}
export const firstLines = (text = '', n = 2) => String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, n).join(' ').slice(0, 160);
export const recipientOf = (row) => (row?.channel === 'text' ? (row.phone || 'No phone on the record') : (Array.isArray(row?.to) && row.to.length ? row.to.join(', ') : 'No address yet'));
/** The Drafts screen's chips: what a row is for each. */
export const DRAFT_CHIPS = [{ id: 'all', label: 'All' }, { id: 'email', label: 'Email' }, { id: 'text', label: 'Text' }, { id: 'sent', label: 'Sent' }];
export const waiting = (row) => row && (row.status === 'draft' || row.status === 'queued');
export function filterDrafts(rows = [], chip = 'all') {
  if (chip === 'sent') return rows.filter(r => !waiting(r));
  const open = rows.filter(waiting);
  if (chip === 'email') return open.filter(r => r.channel !== 'text');
  if (chip === 'text') return open.filter(r => r.channel === 'text');
  return open;
}

/** The draft that needs Rob first (prompt 3 of 3, the Home card): a failed one, then the queued one that goes soonest, then the oldest draft. */
export function urgentDraft(rows = []) {
  const open = (rows || []).filter(waiting);
  if (!open.length) return null;
  const failed = (rows || []).filter(r => r.status === 'failed');
  if (failed.length) return failed[0];
  const queued = open.filter(r => r.status === 'queued' && r.sendAt).sort((a, b) => String(a.sendAt).localeCompare(String(b.sendAt)));
  if (queued.length) return queued[0];
  return [...open].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))[0];
}
