/* Invoices (CRM revamp, step 5): the one shape a deal and a project share,
 * entered and marked by hand (there is no payment integration). Mirrored
 * byte for byte in api/_lib/invoices.js, so the routes, the cron and the
 * screens read a line the same way. Self contained: no imports, so plain
 * Node loads it for the tests.
 *
 *   { id (40), label (120), amount 0..100000, dueAt YYYY-MM-DD,
 *     status draft | sent | paid, sentAt ISO, paidAt ISO, note (300) }
 *   plus the additive ledgerId (the purchases entry a paid line points at)
 *   and extra (an extra revision round) that project lines carried before.
 *
 * The status a screen shows is computed on read (invoiceStatus): paid stays
 * paid; a sent line past its day is past-due, within seven days is due;
 * otherwise the stored status (draft or sent). Nothing derives and stores
 * that. Older projects carry schedule[] with upcoming | due | past-due |
 * paid; invoicesOf() reads either until scripts/migrate-invoices.mjs has
 * run, mapping paid to paid and everything else to sent. */
/* The clock (closeout): the three things that depend on a zone. The
 * browser is Rob's zone; the server mirror reads America/New_York through
 * api/_lib/zone.js. Everything below this line is identical on both. */
const padZ = (n) => String(n).padStart(2, '0');
const CLOCK = {
  dayKey: (ms = Date.now()) => { const x = new Date(ms); return `${x.getFullYear()}-${padZ(x.getMonth() + 1)}-${padZ(x.getDate())}`; },
  dayMs: (key) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || '').slice(0, 10))) return NaN; const [y, m, d] = String(key).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).getTime(); },
  startOfDay: (ms = Date.now()) => { const s = new Date(ms); s.setHours(0, 0, 0, 0); return s.getTime(); },
};
export const INVOICE_STATUS_IDS = ['draft', 'sent', 'paid'];
const DAY = 864e5;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');
export const invDayKey = (d = new Date()) => CLOCK.dayKey(d instanceof Date ? d.getTime() : new Date(d).getTime());
export const uid = () => Math.random().toString(36).slice(2, 10);
const num = (v, max = 100000) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Number(v))) : 0);
const str = (v, max) => String(v ?? '').slice(0, max);

/** The stored shape, from any input: the whitelist the routes apply and the shape the screens write. */
export function sanitizeInvoice(s) {
  return {
    id: str(s?.id, 40) || uid(), label: str(s?.label, 120), amount: num(s?.amount), dueAt: DATE_ONLY.test(String(s?.dueAt || '')) ? String(s.dueAt) : '',
    status: INVOICE_STATUS_IDS.includes(s?.status) ? s.status : 'draft', sentAt: str(s?.sentAt, 40), paidAt: str(s?.paidAt, 40), note: str(s?.note, 300),
    ...(s?.ledgerId ? { ledgerId: str(s.ledgerId, 40) } : {}), ...(s?.extra ? { extra: true } : {}),
  };
}
export const sanitizeInvoices = (list) => (Array.isArray(list) ? list.slice(0, 120).map(sanitizeInvoice) : undefined);

/** A schedule item from before step 5 as an invoice: paid stays paid, everything else was sent with its old due date. */
export function legacyToInvoice(s) {
  const paid = s?.status === 'paid' || !!s?.ledgerId;
  return sanitizeInvoice({ ...s, status: paid ? 'paid' : 'sent', sentAt: paid ? '' : (s?.sentAt || ''), paidAt: s?.paidAt || '', note: s?.note || '' });
}
/** The lines a project (or a deal) carries: invoices[], else its old schedule[] read as invoices. */
export function invoicesOf(record) {
  if (Array.isArray(record?.invoices)) return record.invoices;
  if (Array.isArray(record?.schedule)) return record.schedule.map(legacyToInvoice);
  return [];
}
/** The status a screen shows: paid, past-due, due (within 7 days), else the stored one. */
export function invoiceStatus(inv, now = Date.now()) {
  if (!inv) return 'draft';
  if (inv.status === 'paid' || inv.ledgerId) return 'paid';
  if (inv.status === 'draft') return 'draft';
  // sent, and the shapes from before step 5 (upcoming, due, past-due, or no status at all): the day decides.
  const due = CLOCK.dayMs(inv.dueAt); if (Number.isNaN(due)) return 'sent';
  if (due < CLOCK.startOfDay(now)) return 'past-due';
  if (due <= now + 7 * DAY) return 'due';
  return 'sent';
}
export const INVOICE_STATUS_LABELS = { draft: 'Draft', sent: 'Sent', due: 'Due', 'past-due': 'Past due', paid: 'Paid' };
export const invoicesTotal = (list) => (list || []).reduce((n, s) => n + (Number(s.amount) || 0), 0);
export const invoicesPaid = (list, now = Date.now()) => (list || []).filter(s => invoiceStatus(s, now) === 'paid').reduce((n, s) => n + (Number(s.amount) || 0), 0);
export const invoicesOwed = (list, now = Date.now()) => Math.max(0, invoicesTotal(list) - invoicesPaid(list, now));
export const invoicesAllPaid = (list, now = Date.now()) => (list || []).length > 0 && (list || []).every(s => invoiceStatus(s, now) === 'paid');
export const invoicesPastDue = (list, now = Date.now()) => (list || []).filter(s => invoiceStatus(s, now) === 'past-due');
export const nextUnpaidInvoice = (list, now = Date.now()) => (list || []).filter(s => invoiceStatus(s, now) !== 'paid').sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0] || null;
/** A fresh line. Due in seven days unless told otherwise. */
export const newInvoice = ({ label = '', amount = 0, dueAt = '', status = 'draft', note = '', now = Date.now() } = {}) => sanitizeInvoice({ id: uid(), label, amount, dueAt: dueAt || invDayKey(new Date(now + 7 * DAY)), status, sentAt: status === 'sent' ? new Date(now).toISOString() : '', paidAt: '', note });
/** The line marked sent, marked paid (with the day and a note), or edited. */
export const markSent = (inv, now = Date.now()) => ({ ...inv, status: 'sent', sentAt: inv.sentAt || new Date(now).toISOString() });
export const markPaid = (inv, { paidAt = '', note = '', ledgerId = '' } = {}, now = Date.now()) => ({ ...inv, status: 'paid', paidAt: paidAt || new Date(now).toISOString(), sentAt: inv.sentAt || new Date(now).toISOString(), note: note !== '' ? str(note, 300) : inv.note || '', ...(ledgerId ? { ledgerId } : {}) });
export const replaceInvoice = (list, next) => (list || []).map(s => (s.id === next.id ? next : s));
export const withoutInvoice = (list, id) => (list || []).filter(s => s.id !== id);
/** "Month N of M" lines exist for these months (the cron drafts the missing one on its bill day). */
export const monthLineLabel = (n, m) => (m ? `Month ${n} of ${m}` : `Month ${n}`);
export const hasMonthLine = (list, n, m) => (list || []).some(s => s.label === monthLineLabel(n, m));
/** Same day of month `n` months after a YYYY-MM-DD key, clamped to the month's length. Calendar arithmetic on the key, no zone. */
export function addMonthsKey(dateStr, n, dayOfMonth) {
  const key = DATE_ONLY.test(String(dateStr || '').slice(0, 10)) ? String(dateStr).slice(0, 10) : CLOCK.dayKey();
  const [y, m, d] = key.split('-').map(Number);
  const want = dayOfMonth || d;
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m - 1 + n, Math.min(want, last)));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
