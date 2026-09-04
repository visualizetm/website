/* Notifications (Prompt 9) built from the one event source in src/lib/events.js
 * plus two more: an enrichment summary for the last 24 hours and Calendly
 * bookings that arrived since lastSeenAt. Groups: overdue, today, upcoming
 * (next 7 days), new (leads created in the last 48h), system. */
import { normalizeStage } from '../shared/semantics';
import { buildEvents, sameDay } from '../lib/events';
import { projectsOf, scheduleStatus, localDate, money } from '../lib/projects';
import { reviewAskDue } from '../lib/reviews';

const H = 3600e3;
export const GROUP_LABELS = { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', new: 'New leads', system: 'System' };
export const GROUP_ORDER = ['overdue', 'today', 'upcoming', 'new', 'system'];
const ICON = { meeting: 'CalendarCheck01', callback: 'PhoneIncoming01', calendly: 'Calendar', scraper: 'Users01', bill: 'CurrencyDollar', planfinal: 'CreditCard01', payment: 'CreditCard01' };

/**
 * @param {Array} leads
 * @param {{ calendly?: Array, projects?: Array, lastSeenAt?: string|null, snoozedUntil?: object, now?: number }} opts
 */
export function buildNotifications(leads, opts = {}) {
  const now = opts.now || Date.now();
  const snoozed = opts.snoozedUntil || {};
  const items = [];
  const events = buildEvents(leads, opts.calendly || [], now, opts.projects || []);
  for (const e of events) {
    if (e.kind === 'scraper') continue;
    const s = snoozed[e.id]; if (s && new Date(s).getTime() > now) continue;
    let group;
    // Prompt 10: the final month of a payment plan is a System item for the 31 days before it.
    if (e.kind === 'planfinal') { if (e.at > now - 864e5 && e.at <= now + 31 * 864e5 && !e.project?.plan?.stripeCancelled) items.push({ id: e.id, kind: 'planfinal', group: 'system', tone: 'danger', icon: ICON.planfinal, title: `Final payment month: ${e.lead?.business || e.project?.name}`, detail: `${e.project?.name} ends ${new Date(e.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}. Cancel the Stripe subscription after it clears. Stripe does not stop it for you.`, at: e.at, lead: e.lead, event: e }); continue; }
    if (e.kind === 'bill' && e.at < now && !sameDay(e.at, now)) continue; // past bills are ledger history
    if (e.kind === 'callback' && e.overdue) group = 'overdue';
    else if (sameDay(e.at, now)) group = 'today';
    else if (e.at > now && e.at <= now + 7 * 864e5) group = 'upcoming';
    else if (e.at < now && e.kind === 'meeting') continue; // past meetings are history
    else if (e.at < now) group = 'overdue';
    else continue;
    const lastSeen = opts.lastSeenAt ? new Date(opts.lastSeenAt).getTime() : 0;
    if (e.kind === 'calendly' && !e.leadId && !(e.calendly?.createdAt ? new Date(e.calendly.createdAt).getTime() > lastSeen : true)) continue;
    items.push({ id: e.id, kind: e.kind, group, tone: e.tone, icon: ICON[e.kind] || 'Bell01', title: e.title, detail: e.kind === 'callback' || e.kind === 'meeting' || e.kind === 'calendly' ? `${new Date(e.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${e.subtitle ? `, ${e.subtitle}` : ''}` : e.subtitle, at: e.at, lead: e.lead, event: e });
  }
  // Past due schedule items on client projects (Prompt 10).
  for (const l of leads) {
    if (normalizeStage(l) !== 'client') continue;
    for (const p of projectsOf(opts.projects || [], l._id)) {
      for (const s of (p.schedule || [])) {
        if (scheduleStatus(s, now) !== 'past-due') continue;
        const id = `pay:${p._id}:${s.id}`; const sn = snoozed[id]; if (sn && new Date(sn).getTime() > now) continue;
        const at = localDate(s.dueAt)?.getTime() || now;
        items.push({ id, kind: 'payment', group: 'overdue', tone: 'danger', icon: ICON.payment, title: `Payment past due: ${l.business}`, detail: `${money(s.amount)} for ${p.name}, ${s.label || 'schedule item'}, was due ${new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' })}.`, at, lead: l });
      }
    }
  }
  // Prompt 11: ask for a review 3 days after a release with zero asks (System).
  for (const l of leads) {
    const due = reviewAskDue(l, opts.projects || [], now);
    if (!due) continue;
    const id = `review:${l._id}`; const sn = snoozed[id]; if (sn && new Date(sn).getTime() > now) continue;
    items.push({ id, kind: 'review', group: 'system', tone: 'won', icon: 'Star01', title: `Ask ${l.business} for a review`, detail: `${due.project.name} was released ${new Date(due.project.releasedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} and nobody has asked yet.`, at: due.at, lead: l });
  }
  // New leads in the last 48 hours.
  for (const l of leads) {
    if (normalizeStage(l) !== 'lead' || !l.createdAt) continue;
    const c = new Date(l.createdAt).getTime();
    if (c >= now - 48 * H && c <= now + H) items.push({ id: `new:${l._id}`, kind: 'new', group: 'new', tone: 'new', icon: 'Users01', title: `New lead: ${l.business}`, detail: [l.industry, l.area].filter(Boolean).join(', ') || (l.sourceId ? 'From the nightly scraper' : 'Added by hand'), at: c, lead: l });
  }
  // Enrichment summary for the last 24 hours (System).
  const scanned = leads.filter(l => l.enrichment?.lastScanAt && now - new Date(l.enrichment.lastScanAt).getTime() < 24 * H);
  if (scanned.length) {
    const fields = scanned.reduce((n, l) => n + ['descriptor', 'industry', 'phone', 'email', 'socials', 'intel'].filter(k => l[k] && (typeof l[k] !== 'object' || Object.values(l[k]).some(Boolean))).length, 0);
    const at = Math.max(...scanned.map(l => new Date(l.enrichment.lastScanAt).getTime()));
    items.push({ id: `scan:${new Date(at).toISOString().slice(0, 10)}`, kind: 'system', group: 'system', tone: 'progress', icon: 'RefreshCw01', title: `Scan filled ${fields} field${fields === 1 ? '' : 's'} on ${scanned.length} lead${scanned.length === 1 ? '' : 's'}`, detail: `Last scan ${new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, at });
  }
  const order = Object.fromEntries(GROUP_ORDER.map((g, i) => [g, i]));
  items.sort((a, b) => order[a.group] - order[b.group] || (a.group === 'new' || a.group === 'system' ? b.at - a.at : a.at - b.at));
  return items;
}
