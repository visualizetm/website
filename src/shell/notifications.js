/* Notifications (Prompt 9) built from the one event source in src/lib/events.js
 * plus an enrichment summary for the last 24 hours, Calendly bookings that
 * arrived since lastSeenAt, and what clients did in their Content Planner. Groups: overdue, today, upcoming
 * (next 7 days), new (leads created in the last 48h), system. */
import { normalizeStage } from '../shared/semantics';
import { buildEvents, sameDay } from '../lib/events';
import { recentClientActions, itemLabel, postDateLabel, kindOf } from '../lib/posts';
import { healItems } from '../lib/heals';
import { recentConceptActions, directionLabel } from '../lib/concepts';
import { nextUpItems } from '../lib/nextAction';

const H = 3600e3;
export const GROUP_LABELS = { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', new: 'New leads', system: 'System' };
export const GROUP_ORDER = ['overdue', 'today', 'upcoming', 'new', 'system'];
const ICON = { meeting: 'CalendarCheck01', callback: 'PhoneIncoming01', calendly: 'Calendar', scraper: 'Users01', bill: 'CurrencyDollar', planfinal: 'CreditCard01', payment: 'CreditCard01' };

/**
 * @param {Array} leads
 * @param {{ calendly?: Array, projects?: Array, posts?: Array, sets?: Array, health?: object, lastSeenAt?: string|null, snoozedUntil?: object, now?: number }} opts
 */
export function buildNotifications(leads, opts = {}) {
  const now = opts.now || Date.now();
  const snoozed = opts.snoozedUntil || {};
  const items = [];
  const events = buildEvents(leads, opts.calendly || [], now, opts.projects || []);
  for (const e of events) {
    // Callbacks and meetings are next actions now (CRM revamp, step 2): one source below.
    if (e.kind === 'scraper' || e.kind === 'callback' || e.kind === 'meeting') continue;
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
  /* Next up (CRM revamp, step 2): every lead and project next action is a
   * row here too, the one source the drawer, the badge and the first
   * screen share. Overdue is the Overdue group, today is Today, the next
   * seven days are Upcoming; a snooze here hides the row, a snooze on Next
   * up moves the action. The old callback, meeting, payment and review
   * items were this list under four names. */
  for (const it of nextUpItems(leads, opts.projects || [], opts.sets || [], now).all) {
    const id = `next:${it.id}`; const sn = snoozed[id]; if (sn && new Date(sn).getTime() > now) continue;
    const k = it.action.kind;
    const intent = k === 'log-outcome' ? 'outcome' : k === 'chase-invoice' ? 'payments' : undefined;
    const tone = it.bucket === 'overdue' ? 'danger' : it.tone;
    items.push({ id, kind: 'next', group: it.bucket === 'overdue' ? 'overdue' : it.bucket === 'today' ? 'today' : 'upcoming', tone, icon: it.icon, openNext: true, intent,
      title: `${it.action.label}: ${it.lead.business}`,
      detail: `${it.project ? `${it.project.name}, ` : ''}${it.bucket === 'overdue' ? 'was due ' : 'due '}${new Date(it.due).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`,
      at: it.due, lead: it.lead });
  }
  /* Content Planner (planner prompt 1, part 4): what a client did in their
   * planner in the last 48 hours, computed from the posts themselves rather
   * than from a separate log. An approval is good news and reads as such; a
   * change request is the one that needs Rob to do something, so it carries
   * their words as the detail line and the danger tone. Both open the
   * client's planner editor. */
  for (const a of recentClientActions(opts.posts || [], leads, 48, now)) {
    const sn = snoozed[a.id]; if (sn && new Date(sn).getTime() > now) continue;
    const who = a.lead.showcase?.displayName || a.lead.business;
    if (a.kind === 'approved') {
      items.push({ id: a.id, kind: 'post-approved', group: 'system', tone: 'booked', icon: 'Check', openPlanner: true,
        title: `${who} approved the ${itemLabel(a.post)}`,
        detail: kindOf(a.post) === 'ad' ? `${postDateLabel(a.post.ad?.startDate || a.post.date) || 'No date yet'}, ready to run.` : `${postDateLabel(a.post.date) || 'No date yet'}, ready to schedule.`, at: a.at, lead: a.lead });
    } else {
      items.push({ id: a.id, kind: 'post-change', group: 'system', tone: 'danger', icon: 'Edit02', openPlanner: true,
        title: `${who} asked for a change on the ${kindOf(a.post) === 'ad' ? itemLabel(a.post) : `${postDateLabel(a.post.date) || 'untitled'} post`}`,
        detail: a.post.clientNote, at: a.at, lead: a.lead });
    }
  }
  /* Concepts (Concepts rebuild, Part 6): what a client did with a concept
   * set in the last 48 hours, computed from the sets themselves. Opening is
   * neutral news, a pick is good news, a change request is the one that
   * needs Rob and carries their words. All three open the editor. */
  const leadOf = new Map(leads.map(l => [String(l._id), l]));
  for (const a of recentConceptActions(opts.sets || [], { now })) {
    const lead = leadOf.get(String(a.set.leadId)); if (!lead) continue;
    const id = a.kind === 'changes' ? `concepts:change:${a.set._id}:${a.at}` : `concepts:${a.kind}:${a.set._id}`;
    const sn = snoozed[id]; if (sn && new Date(sn).getTime() > now) continue;
    const who = lead.showcase?.displayName || lead.business;
    const at = new Date(a.at).getTime();
    if (a.kind === 'opened') items.push({ id, kind: 'concepts-opened', group: 'system', tone: 'neutral', icon: 'Eye', openConcepts: true, setId: a.set._id, title: `${who} opened your concepts`, detail: `${a.set.title || 'Concepts'}, round ${a.set.round || 1}. No answer yet.`, at, lead });
    else if (a.kind === 'picked') items.push({ id, kind: 'concepts-picked', group: 'system', tone: 'booked', icon: 'Check', openConcepts: true, setId: a.set._id, title: `${who} picked ${directionLabel(a.set, a.directionId, false)}`, detail: `${directionLabel(a.set, a.directionId)}${a.name ? `, by ${a.name}` : ''}. Rob takes it from here.`, at, lead });
    else items.push({ id, kind: 'concepts-change', group: 'system', tone: 'danger', icon: 'Edit02', openConcepts: true, setId: a.set._id, title: `${who} asked for changes on ${directionLabel(a.set, a.directionId, false)}`, detail: a.note || directionLabel(a.set, a.directionId), at, lead });
  }

  // Prompt 12: task health. The enrichment scan or the scraper going quiet for 36 hours is a System item.
  const h = opts.health;
  if (h) {
    const stale = (at) => !at || now - new Date(at).getTime() > 36 * H;
    const staleMsg = (at) => (at ? `Last ran ${new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' })}.` : 'No run recorded yet.');
    if (h.enrichment && stale(h.enrichment.lastScanAt)) { const id = 'health:enrichment'; const sn = snoozed[id]; if (!(sn && new Date(sn).getTime() > now)) items.push({ id, kind: 'health', group: 'system', tone: 'danger', icon: 'AlertTriangle', title: 'The enrichment scan has not run in 36 hours', detail: `${staleMsg(h.enrichment.lastScanAt)} Check the nightly job.`, at: now }); }
    if (h.scraper && stale(h.scraper.lastInsertAt)) { const id = 'health:scraper'; const sn = snoozed[id]; if (!(sn && new Date(sn).getTime() > now)) items.push({ id, kind: 'health', group: 'system', tone: 'danger', icon: 'AlertTriangle', title: 'The scraper has not added a lead in 36 hours', detail: `${staleMsg(h.scraper.lastInsertAt)} Check the nightly job.`, at: now }); }
  }
  // Stage heals (the daily cron put a client's wiped stage back): named, so it is visible rather than silent.
  items.push(...healItems(h?.crons?.daily?.healedRecords, leads, snoozed, now));
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
