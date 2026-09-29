/* The follow up rules (CRM revamp, step 7), run by the daily cron. Each
 * rule is pure: run(record, ctx, now) answers { key, set } or null. The
 * key names the condition it fired for (a timestamp, a month, an invoice
 * id), and the cron stores it on the record as cronRules[rule], so the
 * same condition never fires twice and a new condition (a fresh intro, a
 * later no-answer, the next month) fires again. ctx: { lead (for a
 * project), posts (the client's planner posts), retainer }. Every date
 * reads America/New_York through api/_lib/zone.js, whatever the server's
 * own zone. */
import { invoicesOf, invoiceStatus } from './invoices.js';
import { zoneTomorrowAt, zoneMonthKey, zoneDayOfMonth, zoneDateAt } from './zone.js';

const DAY = 864e5;
const iso = (t) => new Date(t).toISOString();
const ms = (v) => { const t = v ? new Date(v).getTime() : 0; return Number.isNaN(t) ? 0 : t; };
const custom = (label, dueAt) => ({ kind: 'custom', label, dueAt: iso(dueAt), auto: false, doneAt: '' });
const stageOf = (l) => (l?.stage === 'deal' ? 'deal' : l?.stage === 'booked' || (!l?.stage && l?.callStatus === 'booked') ? 'booked' : l?.stage || (l?.callStatus === 'not-called' && !(l?.callLog || []).length ? 'triage' : 'lead'));

/** Tomorrow at 10:00 local. */
export const tomorrowAt10 = (now) => new Date(zoneTomorrowAt(now, 10)).toISOString();
export const NURTURE_STALLED_DAYS = 90;

export const LEAD_RULES = [
  /* The intro went out three days ago, nothing got booked and no call is logged: a callback tomorrow at ten. */
  { id: 'introNoBooking', run(l, ctx, now) {
    if (!['booked', 'deal'].includes(stageOf(l))) return null;
    const intro = l.deal?.checkpoints?.introSent?.at; if (!intro) return null;
    if (ms(intro) + 3 * DAY > now || l.calendlyEventUri || l.deal?.checkpoints?.callDone?.at) return null;
    return { key: intro, set: { callStatus: 'callback', callbackAt: tomorrowAt10(now), callLog: [...(l.callLog || []), { at: iso(now), outcome: 'callback', note: 'Intro sent, no booking', meeting: '', email: '' }] } };
  } },
  /* Two no-answers in a row on an open lead: cold, and off every list. */
  { id: 'twoNoAnswers', run(l) {
    if (stageOf(l) !== 'lead') return null;
    const log = Array.isArray(l.callLog) ? l.callLog : [];
    if (log.length < 2) return null;
    const [a, b] = log.slice(-2);
    if (a?.outcome !== 'no-answer' || b?.outcome !== 'no-answer') return null;
    return { key: b.at || String(log.length), set: { priority: 'cold', listId: '' }, lists: 'remove' };
  } },
  /* A warm or hot lead nobody touched in thirty days goes back to triage. */
  { id: 'wentQuiet', run(l, ctx, now) {
    if (stageOf(l) !== 'lead' || !['warm', 'hot'].includes(l.priority || 'warm')) return null;
    const last = Math.max(ms(l.createdAt), ...(l.callLog || []).map(e => ms(e?.at)), ...(l.contactLog || []).map(e => ms(e?.at)));
    if (!last || last + 30 * DAY > now) return null;
    return { key: iso(last), set: { stage: 'triage', notes: ['Went quiet 30 days', String(l.notes || '').trim()].filter(Boolean).join('\n'), nextAction: null, listId: '' }, lists: 'remove' };
  } },
  /* A deal stalled for thirty days asks the question. Rob's answer on the Next up row parks it. */
  { id: 'stalledDeal', run(l, ctx, now) {
    if (stageOf(l) !== 'deal') return null;
    const since = l.deal?.stalledSince; if (!since || ms(since) + 30 * DAY > now) return null;
    return { key: since, set: { nextAction: custom('Move to nurture?', now) } };
  } },
  /* Seven days after the first chase: a second, and a call. */
  { id: 'secondChase', run(l, ctx, now) { return secondChase(l, invoicesOf(l.deal || {}), now); } },
];
function secondChase(record, lines, now) {
  const a = record.nextAction;
  if (!a || a.kind !== 'chase-invoice' || a.label === 'Second chase, then call' || a.doneAt) return null;
  if (!a.dueAt || ms(a.dueAt) + 7 * DAY > now) return null;
  if (!lines.some(s => invoiceStatus(s, now) === 'past-due')) return null;
  return { key: a.dueAt, set: { nextAction: { kind: 'chase-invoice', label: 'Second chase, then call', dueAt: iso(now), auto: false, doneAt: '' } } };
}
export const PROJECT_RULES = [
  { id: 'secondChase', run(p, ctx, now) { return secondChase(p, invoicesOf(p), now); } },
  /* A retainer month with nothing delivered by the twentieth (or nothing approved or posted, when the planner is on). */
  { id: 'retainerKit', run(p, ctx, now) {
    if (p.kind !== 'retainer' || p.archived) return null;
    const lead = ctx.lead; if (!lead || !['active', 'ending'].includes(lead.retainer?.status)) return null;
    if (zoneDayOfMonth(now) < 20) return null;
    const month = zoneMonthKey(now);
    const plannerOn = !!lead.planner?.enabled;
    const delivered = plannerOn
      ? (ctx.posts || []).filter(x => String(x.leadId) === String(lead._id) && x.month === month && !x.deleted && !x.archived && ['approved', 'posted'].includes(x.status)).length
      : Number((p.monthly || []).find(m => m.month === month)?.delivered || 0);
    if (delivered > 0) return null;
    return { key: month, set: { nextAction: custom("Deliver this month's kit", now) } };
  } },
  /* A payment plan on its last month: collect it and release the files. */
  { id: 'lastPayment', run(p, ctx, now) {
    if (!p.plan?.months || p.archived) return null;
    const lines = invoicesOf(p).filter(s => !s.extra).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
    const last = lines[lines.length - 1]; if (!last || lines.length < p.plan.months) return null;
    if (last.status !== 'sent' || invoiceStatus(last, now) === 'paid') return null;
    const due = last.dueAt ? zoneDateAt(last.dueAt, 9, 0) : now;
    return { key: last.id, set: { nextAction: custom('Collect the last payment and release the files', due) } };
  } },
];
/** Run one rule set over a record: the first rule per id whose key is new. Returns [{ id, key, set, lists }]. */
export function dueRules(rules, record, ctx, now) {
  const out = [];
  for (const r of rules) {
    const res = r.run(record, ctx, now);
    if (!res) continue;
    if (record.cronRules && record.cronRules[r.id] === res.key) continue;
    out.push({ id: r.id, ...res });
  }
  return out;
}
export const RULE_IDS = [...new Set([...LEAD_RULES, ...PROJECT_RULES].map(r => r.id))];
