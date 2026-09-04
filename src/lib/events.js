/* ONE event source for the Calendar, the notifications drawer, and the
 * Dashboard. buildEvents(leads, extras, now, projects) returns normalized events:
 *   { id, kind, at, end, title, subtitle, tone, leadId, link, source, overdue, allDay }
 * kinds: meeting, callback, scraper, calendly, bill (retainer bill dates and
 * month starts), planfinal (a payment plan's final month, Prompt 10).
 * Rules in reports/PROMPT-09-REPORT.md and PROMPT-10-REPORT.md section 6. */
import { normalizeStage } from '../shared/semantics';
import { meetingDate } from './booked';
import { parseDate } from '../shared/dates';
import { last10 } from '../shared/phone';
import { normName } from './leads';
import { retainerBills, planFinalItem, localDate, isOnRetainer } from './projects';
import { retainerOf } from '../shared/pricing';

const MIN = 60e3;
export const MEETING_MIN = 45;
export const CALLBACK_MIN = 15;
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const sameDay = (a, b) => dayKey(a) === dayKey(b);
const TYPE_LABEL = { call: 'Call', video: 'Video', 'in-person': 'In person' };

/** Match a Calendly event to a lead: uri, then phone, then email, then normalized name. */
export function matchCalendly(ev, leads) {
  if (!ev) return null;
  const byUri = leads.find(l => l.calendlyEventUri && l.calendlyEventUri === ev.uri);
  if (byUri) return byUri;
  const p = last10(ev.phone);
  if (p) { const m = leads.find(l => last10(l.phone) === p); if (m) return m; }
  const e = String(ev.email || '').trim().toLowerCase();
  if (e) { const m = leads.find(l => String(l.email || l.afterCall?.email || '').trim().toLowerCase() === e); if (m) return m; }
  const n = normName(ev.name);
  if (n) { const m = leads.find(l => normName(l.business) === n || normName(l.askFor) === n); if (m) return m; }
  return null;
}

export function buildEvents(leads = [], extras = [], now = Date.now(), projects = []) {
  const out = [];
  const scraperDays = new Map();
  const byId = new Map(leads.map(l => [String(l._id), l]));
  for (const l of leads) {
    const stage = normalizeStage(l);
    if (stage === 'lost') continue;
    // Retainer bill dates: the next bill and the two after it, all day, tone won. A bill day is also the retainer month start.
    if (isOnRetainer(l)) {
      const plan = retainerOf(l.retainer.planId);
      for (const b of retainerBills(l, 3, now)) {
        const at = localDate(b.dueAt)?.getTime(); if (!at) continue;
        out.push({ id: `bill:${l._id}:${b.dueAt}`, kind: 'bill', at, end: at + 864e5, allDay: true, title: `Bill ${l.business} $${Number(b.amount || 0).toLocaleString()}`, subtitle: `${plan?.label || 'Retainer'} month starts${l.retainer.status === 'ending' ? ', retainer ending' : ''}`, tone: 'won', leadId: l._id, lead: l, source: 'crm', overdue: at < now - 864e5 });
      }
    }
    const md = (stage === 'booked' || stage === 'won' || stage === 'client') ? meetingDate(l) : null;
    if (md) {
      out.push({ id: `mt:${l._id}:${l.meeting.date}:${l.meeting.time || ''}`, kind: 'meeting', at: md.getTime(), end: md.getTime() + MEETING_MIN * MIN, title: `Meeting: ${l.business}`, subtitle: [TYPE_LABEL[l.meeting?.type] || 'Call', l.meeting?.location, l.askFor && `ask for ${l.askFor.replace(/^Ask for /i, '')}`].filter(Boolean).join(', '), tone: 'booked', leadId: l._id, lead: l, source: 'crm' });
    }
    if (l.callStatus === 'callback') {
      const at = l.callbackAt ? parseDate(l.callbackAt)?.getTime() : null;
      const last = (l.callLog || []).filter(e => e.outcome === 'callback').slice(-1)[0];
      const when = at || (last?.at ? new Date(last.at).getTime() : new Date(l.updatedAt || l.createdAt || now).getTime());
      const overdue = at ? at < now : !sameDay(when, now);
      out.push({ id: `cb:${l._id}:${l.callbackAt || last?.at || ''}`, kind: 'callback', at: when, end: when + CALLBACK_MIN * MIN, title: `${overdue ? 'Overdue callback' : 'Callback'}: ${l.business}`, subtitle: last?.note || (l.bestWindow ? `Best window ${l.bestWindow}` : 'They asked you to call back.'), tone: overdue ? 'danger' : 'callback', leadId: l._id, lead: l, source: 'crm', overdue, dated: !!at });
    }
    if (l.sourceId && l.createdAt) { const k = dayKey(l.createdAt); scraperDays.set(k, (scraperDays.get(k) || 0) + 1); }
  }
  for (const [k, n] of scraperDays) {
    const at = new Date(`${k}T00:00`).getTime();
    out.push({ id: `scrape:${k}`, kind: 'scraper', at, end: at + 864e5, allDay: true, title: `${n} new lead${n === 1 ? '' : 's'} from the scraper`, subtitle: 'Overnight batch', tone: 'new', source: 'crm', count: n });
  }
  // Payment plan final month: an all day marker on the last scheduled payment (Prompt 10).
  for (const p of projects) {
    if (p.archived || !p.plan?.months) continue;
    const fin = planFinalItem(p); const at = fin ? localDate(fin.dueAt)?.getTime() : null; if (!at) continue;
    const lead = byId.get(String(p.leadId));
    out.push({ id: `planfinal:${p._id}`, kind: 'planfinal', at, end: at + 864e5, allDay: true, title: `Final payment: ${lead?.business || p.name}`, subtitle: p.plan.stripeCancelled ? `${p.name}, month ${p.plan.months} of ${p.plan.months}. Stripe subscription cancelled.` : `${p.name}, month ${p.plan.months} of ${p.plan.months}. Cancel the Stripe subscription after it clears.`, tone: p.plan.stripeCancelled ? 'booked' : 'danger', leadId: lead?._id, lead, source: 'crm', project: p });
  }
  for (const ev of extras) {
    const lead = matchCalendly(ev, leads);
    const at = new Date(ev.at).getTime(); const end = ev.end ? new Date(ev.end).getTime() : at + 30 * MIN;
    if (!at) continue;
    out.push({ id: `cal:${ev.uri}`, kind: 'calendly', at, end, title: lead ? `Meeting: ${lead.business}` : `Calendly: ${ev.name || 'booking'}`, subtitle: [ev.eventType, ev.email, ev.phone].filter(Boolean).join(', '), tone: lead ? 'booked' : 'neutral', leadId: lead?._id, lead, link: ev.join, source: 'calendly', calendly: ev });
  }
  return out.sort((a, b) => a.at - b.at);
}

export const eventsOn = (events, day) => events.filter(e => sameDay(e.at, day));
export const KIND_LABEL = { meeting: 'Meetings', callback: 'Callbacks', calendly: 'Calendly', scraper: 'New leads', bill: 'Bills', planfinal: 'Final payments' };
