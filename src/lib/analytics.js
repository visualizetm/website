/* Analytics (the nav revamp, milestone 6): every number on the Analytics
 * home, from the records already in the database. Mirrored byte for byte in
 * api/_lib/analytics.js below ANALYTICS_RANGES (scripts/analytics-test.mjs
 * asserts it), so the route and the client cannot disagree.
 *
 *   Income          purchases[].amount on every lead, by its `at` day: the
 *                   ledger every Mark paid, Stripe event and hand entry writes
 *   Outstanding     the sent, due and past due invoices on projects and deals
 *                   (invoicesOf semantics, drafts excluded), not time bound
 *   Clients gained  clientSince in the period
 *   Tasks completed checklists[].items[].doneAt on leads and projects, plus a
 *                   legacy nextAction.doneAt; "Tracking since" is the earliest
 *                   doneAt anywhere, because older tasks carry none
 *   Leads added     createdAt in the period
 *   MRR             retainer.amount of every client on an active or ending
 *                   retainer, today (no previous period)
 *   Funnel          the Pipeline dashboard's six steps, today
 *   Income by package  purchases[].projectId to the project's packageId
 *                   (retainer, custom or unlinked otherwise)
 *   Meetings        lead.meeting dates held in the period and the next 7 days
 *
 * Ranges: month (the last 30 days), 90 (the last 90 days), year (the last
 * 12 calendar months). The previous period is the same length before. */
import { normalizeStage } from '../shared/semantics.js';
/* The clock: the three things that depend on a zone. The browser is Rob's
 * zone; the server mirror reads America/New_York through api/_lib/zone.js.
 * Everything below ANALYTICS_RANGES is identical on both. */
const padZ = (n) => String(n).padStart(2, '0');
const CLOCK = {
  parts: (ms) => { const x = new Date(ms); return { y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate() }; },
  dayMs: (key) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || '').slice(0, 10))) return NaN; const [y, m, d] = String(key).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).getTime(); },
  monthStartMs: (y, m) => new Date(y, m - 1, 1).getTime(),
};
export const ANALYTICS_RANGES = ['month', '90', 'year'];
const DAY = 864e5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKeyOf = (ms) => { const p = CLOCK.parts(ms); return `${p.y}-${padZ(p.m)}-${padZ(p.d)}`; };
const startOfDay = (ms) => CLOCK.dayMs(dayKeyOf(ms));
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** A stored date to ms: a day key is that day in the clock's zone, anything else is parsed as written. */
export const whenMs = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 0 : v.getTime();
  const s = String(v);
  if (DATE_ONLY.test(s)) { const t = CLOCK.dayMs(s); return Number.isNaN(t) ? 0 : t; }
  const t = Date.parse(s); return Number.isNaN(t) ? 0 : t;
};
export const rangeOf = (v) => (ANALYTICS_RANGES.includes(String(v)) ? String(v) : 'month');

/** The period and its buckets: weekly for 30 and 90 days, monthly for the year. */
export function periodFor(range, now = Date.now()) {
  const r = rangeOf(range);
  const today = startOfDay(now);
  if (r === 'year') {
    const p = CLOCK.parts(now);
    const monthAt = (offset) => { const idx = (p.m - 1) + offset; const yy = p.y + Math.floor(idx / 12); const mm = (((idx % 12) + 12) % 12) + 1; return { yy, mm }; };
    const buckets = [];
    for (let i = -11; i <= 0; i++) { const { yy, mm } = monthAt(i); buckets.push({ at: CLOCK.monthStartMs(yy, mm), label: `${MONTHS[mm - 1]}${mm === 1 || i === -11 ? ` ${String(yy).slice(2)}` : ''}` }); }
    const s = monthAt(-11); const start = CLOCK.monthStartMs(s.yy, s.mm);
    const ps = monthAt(-23); const prevStart = CLOCK.monthStartMs(ps.yy, ps.mm);
    return { range: r, from: start, to: now, prevFrom: prevStart, prevTo: start, buckets, unit: 'month' };
  }
  const days = r === '90' ? 90 : 30;
  const from = today - (days - 1) * DAY;
  const buckets = [];
  for (let at = from; at <= today; at += 7 * DAY) { const p = CLOCK.parts(at); buckets.push({ at, label: `${MONTHS[p.m - 1]} ${p.d}` }); }
  return { range: r, from, to: now, prevFrom: from - days * DAY, prevTo: from, buckets, unit: 'week' };
}
const bucketIndex = (P, t) => { let i = -1; for (let k = 0; k < P.buckets.length; k++) if (t >= P.buckets[k].at) i = k; return i; };
const inPeriod = (P, t) => t >= P.from && t <= P.to;
const inPrev = (P, t) => t >= P.prevFrom && t < P.prevTo;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const invoiceOpen = (inv) => inv && inv.status !== 'paid' && !inv.ledgerId && inv.status !== 'draft';
const invoicesOfRecord = (r) => (Array.isArray(r?.invoices) ? r.invoices : Array.isArray(r?.schedule) ? r.schedule.map(s => ({ ...s, status: s?.status === 'paid' ? 'paid' : 'sent' })) : []);

/** The whole payload. leads and projects are the stored records; now is the clock. */
export function computeAnalytics(leads = [], projects = [], { range = 'month', now = Date.now() } = {}) {
  const P = periodFor(range, now);
  const zeros = () => P.buckets.map(() => 0);
  const series = { labels: P.buckets.map(b => b.label), income: zeros(), clients: zeros(), tasks: zeros() };
  const k = { income: 0, incomePrev: 0, outstanding: 0, clientsGained: 0, clientsGainedPrev: 0, tasksCompleted: 0, tasksCompletedPrev: 0, leadsAdded: 0, leadsAddedPrev: 0, mrr: 0 };
  let trackingSince = 0;
  const funnel = { triage: 0, leads: 0, contacted: 0, booked: 0, deals: 0, clients: 0 };
  const byPackage = new Map();
  const meetings = { held: 0, heldPrev: 0, upcoming: 0, next: '' };
  const projectById = new Map((projects || []).filter(p => p && typeof p === 'object').map(p => [String(p._id), p]));
  const addBucket = (key, t, amount = 1) => { const i = bucketIndex(P, t); if (i >= 0 && t <= P.to) series[key][i] += amount; };
  const task = (t) => {
    if (!t) return;
    if (!trackingSince || t < trackingSince) trackingSince = t;
    if (inPeriod(P, t)) { k.tasksCompleted++; addBucket('tasks', t); } else if (inPrev(P, t)) k.tasksCompletedPrev++;
  };
  const list = (v) => (Array.isArray(v) ? v : []);
  const tasksOf = (r) => { for (const c of list(r?.checklists)) for (const it of list(c?.items)) if (it?.done || it?.doneAt) task(whenMs(it.doneAt)); if (r?.nextAction?.doneAt) task(whenMs(r.nextAction.doneAt)); };
  for (const l of leads || []) {
    if (!l || l.deleted) continue;
    const stage = normalizeStage(l);
    if (stage === 'triage') funnel.triage++;
    if (stage !== 'lost' && stage !== 'declined' && stage !== 'triage') {
      funnel.leads++;
      if (list(l.callLog).length > 0 || (l.callStatus && l.callStatus !== 'not-called')) funnel.contacted++;
      if (stage === 'booked' || stage === 'deal' || stage === 'won' || stage === 'client') funnel.booked++;
      if (stage === 'deal' || stage === 'won' || stage === 'client') funnel.deals++;
      if (stage === 'won' || stage === 'client') funnel.clients++;
    }
    const created = whenMs(l.createdAt);
    if (inPeriod(P, created)) k.leadsAdded++; else if (inPrev(P, created)) k.leadsAddedPrev++;
    const since = whenMs(l.clientSince);
    if (since && (stage === 'client' || stage === 'won')) { if (inPeriod(P, since)) { k.clientsGained++; addBucket('clients', since); } else if (inPrev(P, since)) k.clientsGainedPrev++; }
    if (stage === 'client' && ['active', 'ending'].includes(l.retainer?.status)) k.mrr += num(l.retainer.amount);
    for (const pu of list(l.purchases)) {
      const amt = num(pu?.amount); const t = whenMs(pu?.at);
      if (inPeriod(P, t)) {
        k.income += amt; addBucket('income', t, amt);
        const pr = pu.projectId ? projectById.get(String(pu.projectId)) : null;
        const id = pr ? (pr.packageId || (pr.kind === 'retainer' ? 'retainer' : 'custom')) : 'unlinked';
        byPackage.set(id, (byPackage.get(id) || 0) + amt);
      } else if (inPrev(P, t)) k.incomePrev += amt;
    }
    for (const inv of invoicesOfRecord(l.deal)) if (invoiceOpen(inv)) k.outstanding += num(inv.amount);
    tasksOf(l);
    const mt = l.meeting?.date ? whenMs(l.meeting.date) : 0;
    if (mt) {
      if (inPeriod(P, mt) && mt <= now) meetings.held++; else if (inPrev(P, mt)) meetings.heldPrev++;
      if (mt >= startOfDay(now) && mt <= now + 7 * DAY) { meetings.upcoming++; if (!meetings.next || mt < whenMs(meetings.next)) meetings.next = `${l.meeting.date}${l.meeting.time ? `T${l.meeting.time}` : ''}`; }
    }
  }
  for (const p of projects || []) {
    if (!p || p.archived) continue;
    for (const inv of invoicesOfRecord(p)) if (invoiceOpen(inv)) k.outstanding += num(inv.amount);
    tasksOf(p);
  }
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const kpi = (value, prev) => ({ value, prev, delta: pct(value, prev) });
  return {
    range: P.range, from: new Date(P.from).toISOString(), to: new Date(P.to).toISOString(), prevFrom: new Date(P.prevFrom).toISOString(), unit: P.unit,
    trackingSince: trackingSince ? new Date(trackingSince).toISOString() : '',
    kpis: {
      income: kpi(k.income, k.incomePrev), outstanding: { value: k.outstanding },
      clientsGained: kpi(k.clientsGained, k.clientsGainedPrev), tasksCompleted: kpi(k.tasksCompleted, k.tasksCompletedPrev),
      leadsAdded: kpi(k.leadsAdded, k.leadsAddedPrev), mrr: { value: k.mrr },
    },
    series, funnel,
    byPackage: [...byPackage.entries()].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount),
    meetings,
  };
}
