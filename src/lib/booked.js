/* Booked-pipeline helpers: stage derivation, the Visualize services catalog,
 * pricing rules, and meeting/prep-status utilities. Pure functions only —
 * no data mutation here.
 */

/**
 * A lead's pipeline stage. Older records have no `stage` field — a lead whose
 * callStatus is 'booked' is treated as booked so pre-existing bookings appear
 * in the workspace without any data migration.
 */
export function effectiveStage(lead) {
  if (lead?.stage && ['lead', 'booked', 'won', 'lost', 'client'].includes(lead.stage)) return lead.stage;
  return lead?.callStatus === 'booked' ? 'booked' : 'lead';
}

/** Most recent contact across the manual contactLog AND console callLog.
 *  Returns { date, days } or null if never contacted. */
export function lastContact(lead, now = Date.now()) {
  let best = 0;
  for (const e of (lead?.contactLog || [])) {
    const t = new Date(e.at).getTime();
    if (t && t > best) best = t;
  }
  for (const e of (lead?.callLog || [])) {
    const t = new Date(e.at).getTime();
    if (t && t > best) best = t;
  }
  if (!best) return null;
  return { date: new Date(best), days: Math.max(0, Math.floor((now - best) / 864e5)) };
}

/**
 * Delete safety rule: a lead is deletable only if it has never been worked —
 * empty call log AND still in the open-lead stage. Returns null when
 * deletable, otherwise a short human reason to show beside the disabled
 * control. (Clients added directly are managed from the Clients page.)
 */
export function deleteBlockReason(lead) {
  if ((lead?.callLog || []).length > 0) return "Has call history — can't delete";
  const s = effectiveStage(lead);
  if (s === 'booked') return "Booked — can't delete";
  if (s === 'won' || s === 'client') return "Won/client — can't delete";
  return null;
}

/** Sum of the purchases ledger. */
export const totalPaid = (lead) => (lead?.purchases || []).reduce((n, p) => n + (Number(p.amount) || 0), 0);

/** Total / done across all of a lead's checklists — for n/m badges. */
export function checklistProgress(lead) {
  const lists = lead?.checklists || [];
  let total = 0; let done = 0;
  for (const l of lists) for (const i of (l.items || [])) { total++; if (i.done) done++; }
  return { total, done, lists: lists.length };
}

export const MEETING_TYPES = [
  { id: 'call', label: 'Call' },
  { id: 'video', label: 'Video' },
  { id: 'in-person', label: 'In person' },
];

/* The services Rob pitches — the meeting game plan checklist. */
export const SERVICES = [
  { id: 'logo', label: 'Logo design', group: 'Brand' },
  { id: 'brand-kit', label: 'Brand identity kit', group: 'Brand' },
  { id: 'social-kit', label: 'Social media kit', group: 'Brand' },
  { id: 'site-onepager', label: 'One-page website', group: 'Web' },
  { id: 'site-full', label: 'Full website', group: 'Web' },
  { id: 'site-shop', label: 'Online shop', group: 'Web' },
  { id: 'google-business', label: 'Google Business setup', group: 'Web' },
  { id: 'stickers', label: 'Stickers', group: 'Print' },
  { id: 'business-cards', label: 'Business cards', group: 'Print' },
  { id: 'nfc-cards', label: 'NFC cards', group: 'Print' },
  { id: 'vinyl', label: 'Vinyl decals', group: 'Print' },
  { id: 'bulk-custom', label: 'Bulk custom products', group: 'Print' },
];
export const serviceLabel = (id) => SERVICES.find(s => s.id === id)?.label || id;

/* Pricing rules: anything above the single-project cap is offered as a
 * 6 or 12-month plan, and every option carries a retainer pitch. */
export const PROJECT_CAP = 750;
export const PLANS = [
  { id: 'full', label: 'Paid in full' },
  { id: '6mo', label: '6-month plan', months: 6 },
  { id: '12mo', label: '12-month plan', months: 12 },
];
export const planLabel = (id) => PLANS.find(p => p.id === id)?.label || id;
export function monthlyOf(price, planId) {
  const p = PLANS.find(x => x.id === planId);
  if (!p?.months || !(price > 0)) return null;
  return Math.ceil(price / p.months);
}

/** Meeting Date object from the additive meeting {date,time} fields. */
export function meetingDate(lead) {
  const m = lead?.meeting;
  if (!m?.date) return null;
  const d = new Date(`${m.date}T${m.time || '09:00'}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "today" / "in 2 days" / "3 days ago" — quick glance countdown. */
export function meetingCountdown(lead, now = Date.now()) {
  const d = meetingDate(lead);
  if (!d) return null;
  const days = Math.round((d.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return 'yesterday';
  return `${-days} days ago`;
}

/**
 * Prep indicator for the list view:
 * 'soon' (meeting inside 48h) > 'ready' (concepts done or demo link saved)
 * > 'needs-prep'.
 */
export function prepStatus(lead, now = Date.now()) {
  const d = meetingDate(lead);
  if (d && d.getTime() - now < 48 * 3600e3 && d.getTime() - now > -24 * 3600e3) return 'soon';
  const t = lead?.conceptsTracker;
  const itemsDone = t?.items?.length > 0 && t.items.every(i => i.done);
  if (itemsDone || t?.demoUrl) return 'ready';
  return 'needs-prep';
}
export const PREP_META = {
  'soon': { label: 'Meeting soon', color: '#f59e0b' },
  'ready': { label: 'Concepts ready', color: '#22c55e' },
  'needs-prep': { label: 'Needs prep', color: '#8a8a8a' },
};

/** Google Calendar link for the meeting (30-minute block). */
export function calendarUrl(lead) {
  const d = meetingDate(lead);
  if (!d) return null;
  const start = new Date(`${lead.meeting.date}T${lead.meeting.time || '09:00'}`);
  const end = new Date(start.getTime() + 30 * 60e3);
  const fmt = (x) => x.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Meeting — ${lead.business}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [lead.askFor && `Ask for ${lead.askFor.replace(/^Ask for /i, '')}`, lead.phone && `Phone: ${lead.phone}`]
      .filter(Boolean).join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
