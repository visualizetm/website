/* Clients module rules (Prompt 10). Pure functions only: nothing here writes.
 *
 * A client IS the call_leads document with stage 'client'. Projects live in
 * the projects collection and reference the lead by leadId. Money stays on
 * the lead's purchases[] ledger; a project's schedule items point at ledger
 * entries by ledgerId, so nothing is counted twice.
 *
 * Rules enforced here (each cited in reports/PROMPT-10-REPORT.md section 5):
 *   - two revision rounds per package (REVISION_ROUNDS); extra rounds cost
 *     EXTRA_ROUND.design (50) or EXTRA_ROUND.web (75) and land on the schedule
 *   - files release only at full payment (releaseBlockReason)
 *   - a project cannot reach Delivered until every schedule item is paid
 *   - payment plans remind from month 5 of 6 (or 11 of 12) to cancel Stripe
 *   - cancelling a retainer gives 30 days notice (CANCEL_NOTICE_DAYS)
 */
import { PACKAGES, RETAINERS, ADDONS, REVISION_ROUNDS, planFor, packageOf, retainerOf, extraRoundFee } from '../shared/pricing';
import { normalizeStage } from '../shared/semantics';
import { parseDate, dayKey as dayKeyOf } from '../shared/dates';

export const CANCEL_NOTICE_DAYS = 30;
export const FOLLOW_UP_DAYS = 3;
export const DAY = 864e5;
export const uid = () => Math.random().toString(36).slice(2, 10);

/* ── Dates (YYYY-MM-DD, local) ─────────────────────────────────── */
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => dayKeyOf(d);
export const monthKey = (d = new Date()) => { const x = d instanceof Date ? d : new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`; };
export const today = () => dayKey(new Date());
/** A date-only string as local midnight (avoids the UTC-midnight bug in fmtDate). */
export const localDate = (s) => parseDate(s); // date-only strings parse as local midnight since Prompt 12
/** Same day-of-month `n` months later, clamped to the month's length. */
export function addMonths(dateStr, n, dayOfMonth) {
  const d = localDate(dateStr) || new Date();
  const y = d.getFullYear(); const m = d.getMonth() + n;
  const want = dayOfMonth || d.getDate();
  const last = new Date(y, m + 1, 0).getDate();
  return dayKey(new Date(y, m, Math.min(want, last)));
}
export const monthLabel = (key) => { const [y, m] = String(key).split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' }); };

/* ── Stages ─────────────────────────────────────────────────────── */
/** Web kinds include Build; brand and print kinds skip it; retainers have no stepper. */
export function stagesFor(kind) {
  if (kind === 'retainer') return ['kickoff', 'delivered'];
  if (kind === 'web' || kind === 'combined') return ['kickoff', 'design', 'revisions', 'build', 'delivery', 'delivered'];
  return ['kickoff', 'design', 'revisions', 'delivery', 'delivered'];
}
export const nextStage = (p) => { const s = p.stages?.length ? p.stages : stagesFor(p.kind); const i = s.indexOf(p.stage); return i >= 0 && i < s.length - 1 ? s[i + 1] : null; };
export const kindOfPackage = (pkg) => (pkg?.kind === 'web' ? (['launch-plan', 'build-plan'].includes(pkg.id) ? 'combined' : 'web') : 'brand');

/* ── Schedule ───────────────────────────────────────────────────── */
/** One payment under the cap; the plan's monthly payments over it, the first one starting the project. */
export function scheduleFor(total, packageId, startDate = today(), planOverride) {
  const plan = planOverride || planFor(total, packageId);
  if (!plan) return { plan: null, items: [{ id: uid(), amount: total, dueAt: startDate, status: 'upcoming', ledgerId: '', label: 'Full payment' }] };
  const items = [];
  let left = total;
  for (let i = 0; i < plan.months; i++) {
    const amount = i === plan.months - 1 ? left : Math.min(plan.monthly, left);
    left -= amount;
    items.push({ id: uid(), amount, dueAt: addMonths(startDate, i), status: 'upcoming', ledgerId: '', label: `Month ${i + 1} of ${plan.months}` });
  }
  return { plan: { months: plan.months, monthly: plan.monthly, stripeCancelled: false }, items };
}
/** Open ended monthly schedule for a retainer: `months` items ahead, on the bill day. */
export function retainerSchedule(amount, startDate, billDay, months = 12, from = 0) {
  const first = localDate(startDate) || new Date();
  const anchor = dayKey(new Date(first.getFullYear(), first.getMonth(), 1));
  const out = [];
  for (let i = from; i < from + months; i++) {
    const due = addMonths(anchor, i, billDay);
    const dueAt = i === 0 && due < startDate ? startDate : due;
    out.push({ id: uid(), amount, dueAt, status: 'upcoming', ledgerId: '', label: `Month ${i + 1}` });
  }
  return out;
}
/** Display status: paid stays paid; otherwise past due, due (within 7 days), or upcoming. */
export function scheduleStatus(item, now = Date.now()) {
  if (item.status === 'paid' || item.ledgerId) return 'paid';
  const t = localDate(item.dueAt)?.getTime();
  if (!t) return 'upcoming';
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  if (t < startOfToday.getTime()) return 'past-due';
  if (t <= now + 7 * DAY) return 'due';
  return 'upcoming';
}
export const scheduleTotal = (p) => (p.schedule || []).reduce((n, s) => n + (Number(s.amount) || 0), 0);
export const paidTotal = (p) => (p.schedule || []).filter(s => scheduleStatus(s) === 'paid').reduce((n, s) => n + (Number(s.amount) || 0), 0);
export const owedTotal = (p) => Math.max(0, scheduleTotal(p) - paidTotal(p));
export const isFullyPaid = (p) => (p.schedule || []).length > 0 && (p.schedule || []).every(s => scheduleStatus(s) === 'paid');
export const hasPastDue = (p, now = Date.now()) => !p.archived && (p.schedule || []).some(s => scheduleStatus(s, now) === 'past-due');
export const nextUnpaid = (p, now = Date.now()) => (p.schedule || []).filter(s => scheduleStatus(s, now) !== 'paid').sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0] || null;
export const paidPct = (p) => { const t = scheduleTotal(p); return t ? Math.round((paidTotal(p) / t) * 100) : 0; };

/* ── Payment plans ──────────────────────────────────────────────── */
/** "Month 3 of 6": the month whose payment is in progress (paid count plus one, clamped). */
export function planMonth(p, now = Date.now()) {
  if (!p.plan?.months) return null;
  const items = (p.schedule || []).filter(s => !s.extra);
  const paid = items.filter(s => scheduleStatus(s, now) === 'paid').length;
  const started = items.filter(s => (localDate(s.dueAt)?.getTime() || 0) <= now).length;
  return Math.max(1, Math.min(p.plan.months, Math.max(paid + 1, started)));
}
export const planRemaining = (p) => (p.schedule || []).filter(s => !s.extra && scheduleStatus(s) !== 'paid').reduce((n, s) => n + (Number(s.amount) || 0), 0);
/** The hard Stripe reminder shows from month 5 of 6, or month 11 of 12. */
export const planReminderDue = (p, now = Date.now()) => { const m = planMonth(p, now); return !!p.plan?.months && m != null && m >= p.plan.months - 1 && !p.plan.stripeCancelled; };
export const planFinalItem = (p) => { const items = (p.schedule || []).filter(s => !s.extra); return p.plan?.months ? items[items.length - 1] || null : null; };

/* ── Revisions ──────────────────────────────────────────────────── */
export const revisionsUsed = (p) => (p.revisions?.log || []).filter(r => !r.extra).length;
export const extraRounds = (p) => (p.revisions?.log || []).filter(r => r.extra).length;
export const revisionsMax = (p) => p.revisions?.max || REVISION_ROUNDS;
/** True once the two included rounds are used: the next one must be logged as an extra round. */
export const revisionsExhausted = (p) => revisionsUsed(p) >= revisionsMax(p);
export const extraRoundFeeFor = (p) => extraRoundFee(p.kind);

/* ── Delivery gate ──────────────────────────────────────────────── */
export function deliverBlockReason(p) {
  if (!(p.schedule || []).length) return null;
  const owed = owedTotal(p);
  if (owed > 0) { const n = (p.schedule || []).filter(s => scheduleStatus(s) !== 'paid').length; return `${money(owed)} is still owed across ${n} schedule item${n === 1 ? '' : 's'}. Files release only at full payment, so Delivered waits until the last payment lands.`; }
  return null;
}
export const releaseBlockReason = (p) => (isFullyPaid(p) ? null : `Files release only at full payment. ${money(owedTotal(p))} is still owed.`);
export const readyToDeliver = (p) => !p.archived && p.kind !== 'retainer' && p.stage === 'delivery' && isFullyPaid(p);
export const isActiveProject = (p) => !p.archived && p.kind !== 'retainer' && p.stage !== 'delivered';

/* ── Deliverables (mirrors the Drive folder structure) ──────────── */
export const DELIVERABLE_GROUPS = [
  { id: '01', label: '01 Brand Files', kinds: ['brand', 'combined'], items: ['Logo PNG', 'Logo SVG', 'Logo JPG', 'Colors and fonts', 'Guidelines'] },
  { id: '02', label: '02 Web Files', kinds: ['web', 'combined'], items: ['Access and credentials', 'Walkthrough video'] },
  { id: '03', label: '03 Print Files', kinds: ['print', 'brand', 'combined'], items: ['Business cards', 'Stickers and vinyl'] },
  { id: '04', label: '04 Source Files', kinds: ['brand', 'web', 'combined', 'print'], items: ['Source files'] },
];
export const deliverablesFor = (kind) => DELIVERABLE_GROUPS.filter(g => g.kinds.includes(kind)).flatMap(g => g.items.map(label => ({ id: uid(), group: g.id, label, done: false, link: '' })));
export const DELIVERY_STEPS = [
  { id: 'driveShared', label: 'Drive folder shared as Viewer' },
  { id: 'emailSent', label: 'Delivery email sent' },
  { id: 'pitchSent', label: 'Retainer pitch sent' },
  { id: 'followUp', label: `Follow up scheduled in ${FOLLOW_UP_DAYS} days` },
];

/* ── Retainers ──────────────────────────────────────────────────── */
export const retainerMonthly = (planId) => retainerOf(planId)?.monthly || { count: 0, unit: 'items', label: '' };
export const isOnRetainer = (lead) => ['active', 'ending'].includes(lead?.retainer?.status);
export const cancelAtFor = (now = Date.now()) => new Date(now + CANCEL_NOTICE_DAYS * DAY).toISOString();
/** Upcoming bill dates for a retainer: the next bill and `count` monthly ones after it. */
export function retainerBills(lead, count = 3, now = Date.now()) {
  const r = lead?.retainer;
  if (!r || !isOnRetainer(lead) || !r.nextBillAt) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const dueAt = i === 0 ? dayKey(localDate(r.nextBillAt) || new Date(now)) : addMonths(dayKey(localDate(r.nextBillAt) || new Date(now)), i, r.billDay);
    if (r.cancelAt && localDate(dayKey(new Date(r.cancelAt))) < localDate(dueAt)) break;
    out.push({ dueAt, amount: Number(r.amount) || 0, month: i });
  }
  return out;
}
/** The month record for `key`, or a virtual one from the plan's included count. */
export const monthRecord = (p, key) => (p.monthly || []).find(m => m.month === key) || { month: key, included: retainerMonthly(p.retainer?.planId || p.packageId).count, delivered: 0, log: [] };

/* ── Client level ───────────────────────────────────────────────── */
export const lifetimeValue = (lead) => (lead?.purchases || []).reduce((n, p) => n + (Number(p.amount) || 0), 0);
export const isClientLead = (lead) => { const s = normalizeStage(lead); return s === 'client' || s === 'won'; };
export const projectsOf = (projects, leadId) => (projects || []).filter(p => String(p.leadId) === String(leadId) && !p.archived).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
export const activeProject = (projects, leadId) => projectsOf(projects, leadId).find(isActiveProject) || projectsOf(projects, leadId).find(p => p.kind !== 'retainer') || null;
/** Stored clientStatus wins; otherwise derived from the projects. */
export function clientStatusOf(lead, projects) {
  if (lead?.clientStatus) return lead.clientStatus;
  const mine = projectsOf(projects, lead?._id);
  if (mine.some(isActiveProject)) return 'active';
  if (mine.some(p => p.kind !== 'retainer' && p.stage === 'delivered')) return 'delivered';
  return 'active';
}
export const CLIENT_FILTERS = [
  ['all', 'All'], ['active', 'Active project'], ['retainer', 'On retainer'], ['delivered', 'Delivered'], ['paused', 'Paused'], ['owes', 'Owes a payment'], ['ready', 'Ready to deliver'],
];
export function clientPasses(lead, projects, filter, now = Date.now()) {
  const mine = projectsOf(projects, lead._id);
  switch (filter) {
    case 'active': return mine.some(isActiveProject);
    case 'retainer': return isOnRetainer(lead);
    case 'delivered': return clientStatusOf(lead, projects) === 'delivered';
    case 'paused': return clientStatusOf(lead, projects) === 'paused' || lead.retainer?.status === 'paused';
    case 'owes': return mine.some(p => hasPastDue(p, now));
    case 'ready': return mine.some(readyToDeliver);
    default: return true;
  }
}
/** The next dated thing for a client: a retainer bill or the next unpaid schedule item. */
export function nextDateFor(lead, projects, now = Date.now()) {
  const bills = retainerBills(lead, 1, now);
  const items = projectsOf(projects, lead._id).map(p => nextUnpaid(p, now)).filter(Boolean).map(s => ({ dueAt: s.dueAt, amount: s.amount, kind: 'payment' }));
  const all = [...bills.map(b => ({ ...b, kind: 'bill' })), ...items].sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  return all[0] || null;
}

/* ── Brand block text (what the image prompt skills read) ───────── */
export function brandText(lead) {
  const b = lead?.brand || {};
  const lines = [
    `Brand: ${lead?.business || ''}`,
    b.primary && `Primary color: ${b.primary}`,
    (b.colors || []).filter(Boolean).length && `Secondary colors: ${(b.colors || []).filter(Boolean).join(', ')}`,
    b.fontDisplay && `Display font: ${b.fontDisplay}`,
    b.fontBody && `Body font: ${b.fontBody}`,
    b.logoLink && `Logo: ${b.logoLink}`,
    b.notes && `Notes: ${b.notes}`,
  ].filter(Boolean);
  return lines.join('\n');
}
export const isHex = (v) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || '').trim());

/* ── New project builder ────────────────────────────────────────── */
/** Everything the New project Sheet needs to POST. `pick` is { packageId } | { retainerId } | { addonIds[] } | { custom: { name, total } }. */
export function buildProject(leadId, pick, opts = {}) {
  const start = opts.startDate || today();
  let name = ''; let kind = 'brand'; let total = 0; let packageId = ''; let custom;
  if (pick.packageId) { const pkg = packageOf(pick.packageId); name = pkg.label; kind = kindOfPackage(pkg); total = pkg.price; packageId = pkg.id; }
  else if (pick.addonIds?.length) { const list = pick.addonIds.map(id => ADDONS.find(a => a.id === id)).filter(Boolean); name = list.map(a => a.label).join(', '); kind = 'print'; total = list.reduce((n, a) => n + a.price, 0); packageId = ''; }
  else if (pick.custom) { name = pick.custom.name; total = Number(pick.custom.total) || 0; kind = pick.custom.kind || 'brand'; custom = { name, total }; }
  const { plan, items } = scheduleFor(total, packageId, start);
  return {
    leadId, name, kind, packageId, custom, stage: 'kickoff', stages: stagesFor(kind), total, schedule: items,
    revisions: { max: REVISION_ROUNDS, used: 0, log: [] }, plan, links: { drive: opts.drive || '', clickup: opts.clickup || '' },
    deliverables: deliverablesFor(kind), delivery: { driveShared: false, emailSent: false, pitchSent: false, followUpLeadCallbackAt: '' }, monthly: [], archived: false,
  };
}
export function buildRetainerProject(leadId, planId, startDate, billDay) {
  const r = retainerOf(planId);
  return {
    leadId, name: `${r.label} retainer`, kind: 'retainer', packageId: r.id, stage: 'kickoff', stages: stagesFor('retainer'), total: 0,
    schedule: retainerSchedule(r.price, startDate, billDay), revisions: { max: REVISION_ROUNDS, used: 0, log: [] }, plan: null, links: { drive: '', clickup: '' },
    deliverables: [], delivery: { driveShared: false, emailSent: false, pitchSent: false, followUpLeadCallbackAt: '' }, monthly: [], archived: false,
    retainer: { planId: r.id, billDay, startedAt: startDate },
  };
}
export const money = (n) => `$${Number(n || 0).toLocaleString()}`;
export { PACKAGES, RETAINERS, ADDONS };
