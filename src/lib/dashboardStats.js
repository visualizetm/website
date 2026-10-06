/* The Pipeline numbers (Prompt 5, moved out of the Next up screen by the nav
 * revamp): calls today, this week and month, the connect rate, callbacks,
 * new leads, the funnel, revenue and MRR, from the leads list. Formulas in
 * reports/PROMPT-05-REPORT.md section 3. Read by the Pipeline dashboard. */
import { normalizeStage } from '../shared/semantics.js';
import { toMs } from '../shared/dates.js';

const DAY = 864e5;

export function periods(now = new Date()) {
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart); weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7)); // Monday
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { now: now.getTime(), dayStart: +dayStart, weekStart: +weekStart, lastWeekStart: +lastWeekStart, monthStart: +monthStart, lastMonthStart: +lastMonthStart };
}

/** Every number, from the leads list. */
export function computeDashboard(leads, subs, orders, P = periods()) {
  const s = {
    callsToday: 0, callsWeek: 0, callsLastWeek: 0, callsMonth: 0, callsLastMonth: 0,
    logMonth: 0, logMonthConnected: 0, logLastMonth: 0, logLastMonthConnected: 0,
    notCalled: 0, booked: 0, callbacks: 0, newLeads48h: 0,
    funnel: { leads: 0, contacted: 0, booked: 0, clients: 0 },
    revenue: 0, revenueMonth: 0, retainerClients: 0, clients: 0, mrr: 0,
  };
  const bump = (t) => {
    if (!t) return;
    if (t >= P.dayStart) s.callsToday++;
    if (t >= P.weekStart) s.callsWeek++; else if (t >= P.lastWeekStart) s.callsLastWeek++;
    if (t >= P.monthStart) s.callsMonth++; else if (t >= P.lastMonthStart) s.callsLastMonth++;
  };
  for (const l of leads) {
    const stage = normalizeStage(l);
    const created = new Date(l.createdAt || 0).getTime();
    for (const e of (l.callLog || [])) {
      const t = new Date(e.at).getTime();
      bump(t);
      if (t >= P.monthStart) { s.logMonth++; if (e.outcome !== 'no-answer') s.logMonthConnected++; }
      else if (t >= P.lastMonthStart) { s.logLastMonth++; if (e.outcome !== 'no-answer') s.logLastMonthConnected++; }
    }
    for (const e of (l.contactLog || [])) if (e.type === 'call' || e.type === 'meeting') bump(new Date(e.at).getTime());
    if (stage !== 'lost' && stage !== 'declined' && stage !== 'triage') {
      s.funnel.leads++;
      if ((l.callLog || []).length > 0 || (l.callStatus && l.callStatus !== 'not-called')) s.funnel.contacted++;
      if (stage === 'booked' || stage === 'deal' || stage === 'won' || stage === 'client') s.funnel.booked++;
      if (stage === 'won' || stage === 'client') s.funnel.clients++;
    }
    if (stage === 'lead' && (l.callStatus || 'not-called') === 'not-called') s.notCalled++;
    if (stage === 'booked') s.booked++;
    if (l.callStatus === 'callback' && stage !== 'lost' && stage !== 'declined') s.callbacks++;
    if (created >= P.now - 2 * DAY) s.newLeads48h++;
    for (const p of (l.purchases || [])) {
      const amt = Number(p.amount) || 0;
      s.revenue += amt;
      const t = toMs(p.at);
      if (t && t >= P.monthStart) s.revenueMonth += amt;
    }
    const onRetainer = stage === 'client' && ['active', 'ending'].includes(l.retainer?.status);
    if (stage === 'client') { s.clients++; if (onRetainer) { s.retainerClients++; s.mrr += Number(l.retainer.amount) || 0; } }
  }
  s.connectRate = s.logMonth ? Math.round((s.logMonthConnected / s.logMonth) * 100) : null;
  s.connectRateLast = s.logLastMonth ? Math.round((s.logLastMonthConnected / s.logLastMonth) * 100) : null;
  return s;
}
