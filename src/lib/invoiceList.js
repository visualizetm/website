import { invoicesOf, invoiceStatus, markPaid as markLinePaid, replaceInvoice, uid } from './invoices.js';

/* The Invoices screen's pure logic (prompt 3 of 3, milestone 1). Invoices are a view over projects, deals and the Stripe rows that
 * exist: no collection of their own. `invoiceRows` reads every line the way its own screen does (invoicesOf, invoiceStatus), groups
 * them into the screen's sections and the chips filter them. `paidByHand` is the one Mark paid write of the list, and it writes
 * exactly what the Stripe webhook writes (api/_lib/stripe.js applyPayment): the line's status, ledgerId and paidAt, and the
 * ledger entry on the client; nothing else (invoices-test cuts that and watches the check fail). */
const DAY = 864e5;
const dayMs = (key) => { const m = String(key || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : NaN; };
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayKeyNow = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const INVOICE_SECTIONS = [
  { id: 'past-due', label: 'Past due' },
  { id: 'due-soon', label: 'Due soon' },
  { id: 'plans', label: 'Plans' },
  { id: 'retainers', label: 'Retainers' },
  { id: 'paid', label: 'Paid last 30 days' },
];
export const INVOICE_CHIPS = [
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'past-due', label: 'Past due' },
  { id: 'paid30', label: 'Paid 30 days' },
  { id: 'plans', label: 'Plans' },
];
export const CHIP_IDS = INVOICE_CHIPS.map(c => c.id);

/** Days past the due day (0 when not late). */
export const daysLate = (inv, now = Date.now()) => { const due = dayMs(inv?.dueAt); return Number.isNaN(due) ? 0 : Math.max(0, Math.round((startOfDay(now) - due) / DAY)); };
/** The line's place on its plan: { n, of, endsAt, stopsAfter } from "Month N of M" or the line's order, else null. */
export function planPlace(project, inv) {
  if (!project?.plan?.months) return null;
  const lines = invoicesOf(project).filter(s => !s.extra).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  const m = String(inv?.label || '').match(/Month (\d+)(?: of (\d+))?/i);
  const n = m ? Number(m[1]) : lines.findIndex(s => s.id === inv.id) + 1;
  const of = project.plan.months;
  const last = lines[lines.length - 1];
  return { n, of, endsAt: last?.dueAt || '', stopsAfter: of, cancelled: !!project.plan.stripeCancelled };
}

/** Every unpaid or recently paid line across projects and deals: { key, src, leadId, projectId, business, name, inv, st, late, kind, plan }. */
export function invoiceRows(leads = [], projects = [], now = Date.now()) {
  const byLead = new Map(leads.filter(l => !l.deleted).map(l => [String(l._id), l]));
  const out = [];
  const add = (src, lead, project, inv) => {
    if (!inv || inv.status === 'draft' && !inv.dueAt) return;
    const st = invoiceStatus(inv, now);
    if (st === 'draft') return; // a draft is not owed yet: the record's Money section holds it
    out.push({ key: `${src}:${project ? project._id : lead._id}:${inv.id}`, src, leadId: String(lead._id), projectId: project ? String(project._id) : '', business: lead.business || 'Unnamed', name: project ? project.name || '' : 'Deal', inv, st, late: st === 'past-due' ? daysLate(inv, now) : 0, kind: project?.kind === 'retainer' ? 'retainer' : project?.plan?.months ? 'plan' : inv.kind === 'plan' ? 'plan' : 'one', plan: project ? planPlace(project, inv) : null, byHand: st === 'paid' && !inv.paymentLinkId && !inv.ledgerId });
  };
  for (const p of projects) { if (p.archived) continue; const lead = byLead.get(String(p.leadId)); if (!lead) continue; for (const inv of invoicesOf(p)) add('project', lead, p, inv); }
  for (const l of leads) { if (l.deleted || !l.deal) continue; if (!['booked', 'deal'].includes(l.stage) && !(l.stage === undefined && l.callStatus === 'booked')) continue; for (const inv of invoicesOf(l.deal)) add('deal', l, null, inv); }
  return out;
}
const paidWithin = (r, days, now) => { const t = Date.parse(r.inv.paidAt || ''); return Number.isFinite(t) && now - t <= days * DAY && t <= now + DAY; };
export const isUnpaid = (r) => r.st !== 'paid';

/** The sections of the screen, in order, each oldest first (past due: the longest late first). */
export function invoiceSections(rows, now = Date.now()) {
  const dueSoonEnd = now + 7 * DAY;
  const byDue = (a, b) => String(a.inv.dueAt || '9999').localeCompare(String(b.inv.dueAt || '9999'));
  const open = rows.filter(isUnpaid);
  const used = new Set();
  const take = (list) => { list.forEach(r => used.add(r.key)); return list; };
  const pastDue = take(open.filter(r => r.st === 'past-due').sort(byDue));
  const soon = take(open.filter(r => !used.has(r.key) && r.kind === 'one' && (r.st === 'due' || dayMs(r.inv.dueAt) <= dueSoonEnd)).sort(byDue));
  const plans = take(open.filter(r => !used.has(r.key) && r.kind === 'plan').sort(byDue));
  const retainers = take(open.filter(r => !used.has(r.key) && r.kind === 'retainer').sort(byDue));
  const rest = take(open.filter(r => !used.has(r.key)).sort(byDue));
  const paid = rows.filter(r => !isUnpaid(r) && paidWithin(r, 30, now)).sort((a, b) => String(b.inv.paidAt).localeCompare(String(a.inv.paidAt)));
  return [
    { id: 'past-due', label: 'Past due', rows: pastDue },
    { id: 'due-soon', label: 'Due soon', rows: [...soon, ...rest] },
    { id: 'plans', label: 'Plans', rows: plans },
    { id: 'retainers', label: 'Retainers', rows: retainers },
    { id: 'paid', label: 'Paid last 30 days', rows: paid },
  ];
}
/** The chips: Unpaid (everything owed), Past due, Paid 30 days, Plans (every plan line, paid or not). */
export function chipRows(rows, chip, now = Date.now()) {
  if (chip === 'past-due') return rows.filter(r => r.st === 'past-due');
  if (chip === 'paid30') return rows.filter(r => !isUnpaid(r) && paidWithin(r, 30, now));
  if (chip === 'plans') return rows.filter(r => r.kind === 'plan' || r.kind === 'retainer');
  return rows.filter(isUnpaid);
}
export const chipCount = (rows, chip, now = Date.now()) => chipRows(rows, chip, now).length;
export const owedTotal = (rows) => rows.filter(isUnpaid).reduce((n, r) => n + (Number(r.inv.amount) || 0), 0);

/** Mark paid from the list: the same fields the Stripe webhook writes. A project line only: a deal's first Mark paid is the one
 * conversion to client and project (src/lib/dealConvert.js) and needs its confirm, so a deal row opens the deal instead.
 *   projectSet  { invoices }   the line status paid, ledgerId, paidAt
 *   leadSet     { purchases }  the ledger entry (id, label, amount, at, notes, projectId, source)
 * paidAt is an ISO instant, at the day key the entry carries. */
export function paidByHand(lead, project, inv, { paidAt = '' } = {}, now = Date.now()) {
  if (!project || !inv) return null;
  const ledgerId = uid();
  const iso = paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : new Date(now).toISOString();
  const day = paidAt || dayKeyNow(now);
  const line = { ...inv, status: 'paid', ledgerId, paidAt: iso };
  const entry = { id: ledgerId, label: `${project.name}: ${inv.label || 'payment'}`, amount: Number(inv.amount) || 0, at: day, notes: '', source: 'hand', projectId: String(project._id) };
  return { ledgerId, line, entry, projectSet: { invoices: replaceInvoice(invoicesOf(project), line) }, leadSet: { purchases: [...(lead?.purchases || []), entry] } };
}
export { markLinePaid };
