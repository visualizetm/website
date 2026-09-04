/* ONE source of truth for every enum the admin renders.
 *
 * Each entry: id, label, color token names (solid / soft / text), an
 * Untitled UI icon name, and sort order. Colors are CSS custom properties
 * declared on .lay-root (see docs/TOKENS.md), returned as var() strings so
 * they drop straight into style={{ '--sc': ... }} and color-mix().
 *
 * api/_semantics.js mirrors the ID LISTS below for the serverless
 * sanitizers (Vercel functions cannot import from src/). Keep both in sync.
 */

const tone = (name) => ({
  solid: `var(--v-status-${name}-solid)`,
  soft: `var(--v-status-${name}-soft)`,
  text: `var(--v-status-${name}-text)`,
  /* `color` is what existing screens feed into --sc: keep it the text tone */
  color: `var(--v-status-${name}-text)`,
});

/* ── Call outcome / status (call_leads.callStatus) ─────────────── */
export const CALL_STATUSES = [
  { id: 'not-called', label: 'Not called', icon: 'Phone',           order: 0, ...tone('neutral') },
  { id: 'callback',   label: 'Callback',   icon: 'PhoneIncoming01', order: 1, ...tone('callback') },
  { id: 'no-answer',  label: 'No answer',  icon: 'Voicemail',       order: 2, ...tone('new') },
  { id: 'booked',     label: 'Booked',     icon: 'Check',           order: 3, ...tone('booked') },
  { id: 'no',         label: 'Said no',    icon: 'PhoneHangUp',     order: 4, ...tone('danger') },
  /* Prompt 7: additive. Logging it also stamps phoneNote with the date. */
  { id: 'wrong-number', label: 'Wrong number', icon: 'PhoneX01',      order: 5, ...tone('danger') },
];
export const callStatusOf = (id) => CALL_STATUSES.find(s => s.id === id) || CALL_STATUSES[0];

/* The four outcomes on the console bar, in bar order, with key hints. */
export const OUTCOMES = [
  { ...callStatusOf('booked'),       key: '1' },
  { ...callStatusOf('callback'),     key: '2' },
  { ...callStatusOf('no-answer'),    key: '3' },
  { ...callStatusOf('no'),           key: '4' },
  { ...callStatusOf('wrong-number'), key: '5' },
];
/* Best-window buckets for bestWindow text (Prompt 7). */
export const WINDOWS = [
  { id: 'morning',   label: 'Morning',   icon: 'Sunrise', hours: [5, 11] },
  { id: 'midday',    label: 'Midday',    icon: 'Sun',     hours: [11, 14] },
  { id: 'afternoon', label: 'Afternoon', icon: 'Sun',     hours: [14, 17] },
  { id: 'evening',   label: 'Evening',   icon: 'Sunset',  hours: [17, 24] },
];
export const outcomeOf = (id) => OUTCOMES.find(o => o.id === id);

/* ── Priority (call_leads.priority) ────────────────────────────── */
export const PRIORITIES = [
  { id: 'hot',  label: 'Hot',  icon: 'Zap',      order: 0, ...tone('won') },
  { id: 'warm', label: 'Warm', icon: 'Sun',      order: 1, ...tone('new') },
  { id: 'cold', label: 'Cold', icon: 'Snowflake01', order: 2, ...tone('progress') },
];
export const priorityOf = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];

/* ── Pipeline stage (call_leads.stage) ─────────────────────────── */
export const STAGES = [
  { id: 'lead',   label: 'Lead',   icon: 'Users01',         order: 0, ...tone('neutral') },
  { id: 'booked', label: 'Booked', icon: 'CalendarCheck01', order: 1, ...tone('booked') },
  { id: 'won',    label: 'Won',    icon: 'Trophy01',        order: 2, ...tone('won') },
  { id: 'client', label: 'Client', icon: 'Briefcase01',     order: 3, ...tone('booked') },
  { id: 'lost',   label: 'Lost',   icon: 'XClose',          order: 4, ...tone('danger') },
];
export const STAGE_IDS = STAGES.map(s => s.id);
/** Stage as stored can be missing OR "" (the nightly enricher writes an
 *  empty string on 249 docs). Anything unknown reads as 'lead'; a legacy
 *  callStatus of 'booked' with no stage reads as 'booked'. */
export function normalizeStage(lead) {
  const s = lead?.stage;
  if (s && STAGE_IDS.includes(s)) return s;
  return lead?.callStatus === 'booked' ? 'booked' : 'lead';
}

/* ── Site submissions (submissions.status) ─────────────────────── */
export const LEAD_STATUSES = [
  { id: 'new',       label: 'New',       icon: 'Bell01',    order: 0, ...tone('new') },
  { id: 'contacted', label: 'Contacted', icon: 'Mail01',    order: 1, ...tone('progress') },
  { id: 'replied',   label: 'Replied',   icon: 'MessageCircle01', order: 2, ...tone('callback') },
  { id: 'landed',    label: 'Landed',    icon: 'Check',     order: 3, ...tone('booked') },
  { id: 'denied',    label: 'Denied',    icon: 'XClose',    order: 4, ...tone('danger') },
];
export const ORDER_STATUSES = [
  { id: 'new',           label: 'New',           icon: 'Bell01',   order: 0, ...tone('new') },
  { id: 'paid',          label: 'Paid',          icon: 'CurrencyDollar', order: 1, ...tone('progress') },
  { id: 'in-production', label: 'In Production', icon: 'Package',  order: 2, ...tone('callback') },
  { id: 'packaged',      label: 'Packaged',      icon: 'Package',  order: 3, ...tone('booked') },
  { id: 'delivered',     label: 'Delivered',     icon: 'Check',    order: 4, ...tone('booked') },
];

/* ── Manual contact log (call_leads.contactLog[].type) ─────────── */
export const CONTACT_TYPES = [
  { id: 'call',    label: 'Call',    icon: 'Phone',           order: 0 },
  { id: 'meeting', label: 'Meeting', icon: 'Calendar',        order: 1 },
  { id: 'email',   label: 'Email',   icon: 'Mail01',          order: 2 },
  { id: 'text',    label: 'Text',    icon: 'MessageCircle01', order: 3 },
  { id: 'other',   label: 'Contact', icon: 'User01',          order: 4 },
];
export const contactTypeLabel = (id) => (CONTACT_TYPES.find(t => t.id === id) || CONTACT_TYPES[4]).label;

/* ── Booked workspace enums ────────────────────────────────────── */
export const MEETING_TYPES = [
  { id: 'call',      label: 'Call',      order: 0 },
  { id: 'video',     label: 'Video',     order: 1 },
  { id: 'in-person', label: 'In person', order: 2 },
];
export const PLANS = [
  { id: 'full', label: 'Paid in full',  order: 0 },
  { id: '6mo',  label: '6-month plan',  months: 6,  order: 1 },
  { id: '12mo', label: '12-month plan', months: 12, order: 2 },
];
export const CONCEPT_STATUSES = [
  { id: 'planned',    label: 'Planned',    order: 0, ...tone('neutral') },
  { id: 'generating', label: 'Generating', order: 1, ...tone('progress') },
  { id: 'ready',      label: 'Ready',      order: 2, ...tone('booked') },
  { id: 'shown',      label: 'Shown',      order: 3, ...tone('won') },
];
export const CONCEPT_STATUS_IDS = CONCEPT_STATUSES.map(c => c.id);
export const CONCEPT_PRESETS = ['Logo directions', 'Brand board', 'Social grid', 'Website demo', 'Drive folder'];
export const PREP_STATUSES = [
  { id: 'soon',       label: 'Meeting soon',   order: 0, ...tone('new') },
  { id: 'ready',      label: 'Concepts ready', order: 1, ...tone('booked') },
  { id: 'needs-prep', label: 'Needs prep',     order: 2, ...tone('neutral') },
];
export const prepStatusOf = (id) => PREP_STATUSES.find(p => p.id === id) || PREP_STATUSES[2];

/* ── Clients module enums (Prompt 10) ─────────────────────────── */
export const PROJECT_KINDS = [
  { id: 'brand',    label: 'Brand',    icon: 'Palette',     order: 0, ...tone('callback') },
  { id: 'web',      label: 'Web',      icon: 'Globe01',     order: 1, ...tone('progress') },
  { id: 'combined', label: 'Combined', icon: 'Zap',         order: 2, ...tone('won') },
  { id: 'print',    label: 'Print',    icon: 'Package',     order: 3, ...tone('new') },
  { id: 'retainer', label: 'Retainer', icon: 'RefreshCw01', order: 4, ...tone('booked') },
];
export const projectKindOf = (id) => PROJECT_KINDS.find(k => k.id === id) || PROJECT_KINDS[0];
export const PROJECT_STAGES = [
  { id: 'kickoff',   label: 'Kickoff',   icon: 'Play',       order: 0, ...tone('neutral') },
  { id: 'design',    label: 'Design',    icon: 'Palette',    order: 1, ...tone('progress') },
  { id: 'revisions', label: 'Revisions', icon: 'Edit02',     order: 2, ...tone('callback') },
  { id: 'build',     label: 'Build',     icon: 'Columns03',  order: 3, ...tone('progress') },
  { id: 'delivery',  label: 'Delivery',  icon: 'Package',    order: 4, ...tone('new') },
  { id: 'delivered', label: 'Delivered', icon: 'Check',      order: 5, ...tone('booked') },
];
export const projectStageOf = (id) => PROJECT_STAGES.find(s => s.id === id) || PROJECT_STAGES[0];
export const SCHEDULE_STATUSES = [
  { id: 'paid',     label: 'Paid',     icon: 'Check',          order: 0, ...tone('booked') },
  { id: 'due',      label: 'Due',      icon: 'Clock',          order: 1, ...tone('new') },
  { id: 'past-due', label: 'Past due', icon: 'ClockRewind',    order: 2, ...tone('danger') },
  { id: 'upcoming', label: 'Upcoming', icon: 'Calendar',       order: 3, ...tone('neutral') },
];
export const RETAINER_STATUSES = [
  { id: 'active',    label: 'Active',    icon: 'RefreshCw01', order: 0, ...tone('booked') },
  { id: 'paused',    label: 'Paused',    icon: 'Clock',       order: 1, ...tone('new') },
  { id: 'ending',    label: 'Ending',    icon: 'ClockRewind', order: 2, ...tone('callback') },
  { id: 'cancelled', label: 'Cancelled', icon: 'XClose',      order: 3, ...tone('neutral') },
];
export const CLIENT_STATUSES = [
  { id: 'active',    label: 'Active',    icon: 'Zap',        order: 0, ...tone('progress') },
  { id: 'paused',    label: 'Paused',    icon: 'Clock',      order: 1, ...tone('new') },
  { id: 'delivered', label: 'Delivered', icon: 'Check',      order: 2, ...tone('booked') },
];
export const PROJECT_KIND_IDS = PROJECT_KINDS.map(k => k.id);
export const PROJECT_STAGE_IDS = PROJECT_STAGES.map(s => s.id);
export const SCHEDULE_STATUS_IDS = SCHEDULE_STATUSES.map(s => s.id);
export const RETAINER_STATUS_IDS = RETAINER_STATUSES.map(s => s.id);
export const CLIENT_STATUS_IDS = CLIENT_STATUSES.map(s => s.id);

/* ── Studio enums (Prompt 11): print orders, concept packs, reviews ── */
export const PRINT_ORDER_STATUSES = [
  { id: 'new',       label: 'New',       icon: 'Bell01',    order: 0, ...tone('new') },
  { id: 'designed',  label: 'Designed',  icon: 'Palette',   order: 1, ...tone('progress') },
  { id: 'cut',       label: 'Cut',       icon: 'Scissors01', order: 2, ...tone('callback') },
  { id: 'packed',    label: 'Packed',    icon: 'Package',   order: 3, ...tone('booked') },
  { id: 'delivered', label: 'Delivered', icon: 'Check',     order: 4, ...tone('booked') },
  { id: 'cancelled', label: 'Cancelled', icon: 'XClose',    order: 5, ...tone('neutral') },
];
export const PRINT_ORDER_STATUS_IDS = PRINT_ORDER_STATUSES.map(s => s.id);
export const printOrderStatusOf = (id) => PRINT_ORDER_STATUSES.find(s => s.id === id) || PRINT_ORDER_STATUSES[0];
export const ORDER_SOURCES = [
  { id: 'shop',    label: 'Shop',    icon: 'Package',      order: 0, ...tone('progress') },
  { id: 'client',  label: 'Client',  icon: 'Briefcase01',  order: 1, ...tone('booked') },
  { id: 'walk-in', label: 'Walk in', icon: 'User01',       order: 2, ...tone('neutral') },
  { id: 'import',  label: 'Import',  icon: 'Download01',   order: 3, ...tone('neutral') },
];
export const ORDER_SOURCE_IDS = ORDER_SOURCES.map(s => s.id);
export const CONCEPT_KINDS = [
  { id: 'logo',        label: 'Logo',        icon: 'Palette',    order: 0, ...tone('won') },
  { id: 'brand-board', label: 'Brand board', icon: 'Colors',     order: 1, ...tone('callback') },
  { id: 'social',      label: 'Social',      icon: 'Camera01',   order: 2, ...tone('progress') },
  { id: 'website',     label: 'Website',     icon: 'Globe01',    order: 3, ...tone('progress') },
  { id: 'signage',     label: 'Signage',     icon: 'MarkerPin01', order: 4, ...tone('new') },
  { id: 'apparel',     label: 'Apparel',     icon: 'User01',     order: 5, ...tone('new') },
  { id: 'vehicle',     label: 'Vehicle',     icon: 'Package',    order: 6, ...tone('neutral') },
  { id: 'packaging',   label: 'Packaging',   icon: 'Package',    order: 7, ...tone('neutral') },
  { id: 'ads',         label: 'Ads',         icon: 'Zap',        order: 8, ...tone('booked') },
  { id: 'other',       label: 'Other',       icon: 'Image01',    order: 9, ...tone('neutral') },
];
export const CONCEPT_KIND_IDS = CONCEPT_KINDS.map(k => k.id);
export const REVIEW_CHANNELS = [
  { id: 'nfc',       label: 'NFC card',  icon: 'CreditCard01',    order: 0 },
  { id: 'text',      label: 'Text',      icon: 'MessageCircle01', order: 1 },
  { id: 'email',     label: 'Email',     icon: 'Mail01',          order: 2 },
  { id: 'in-person', label: 'In person', icon: 'User01',          order: 3 },
];
export const REVIEW_CHANNEL_IDS = REVIEW_CHANNELS.map(c => c.id);
export const REVIEW_RESULTS = [
  { id: 'asked',    label: 'Asked',    icon: 'Send01',  order: 0, ...tone('progress') },
  { id: 'left',     label: 'Left',     icon: 'Star01',  order: 1, ...tone('booked') },
  { id: 'declined', label: 'Declined', icon: 'XClose',  order: 2, ...tone('neutral') },
];
export const REVIEW_RESULT_IDS = REVIEW_RESULTS.map(r => r.id);

/* ── Submission types (Prompt 12) ──────────────────────────────── */
export const SUBMISSION_TYPES = [
  { id: 'start',      label: 'Brief',     icon: 'Inbox01',   order: 0, ...tone('progress') },
  { id: 'contact',    label: 'Contact',   icon: 'Mail01',    order: 1, ...tone('callback') },
  { id: 'review',     label: 'Review',    icon: 'Star01',    order: 2, ...tone('won') },
  { id: 'shop-order', label: 'Shop order', icon: 'Package',  order: 3, ...tone('booked') },
  { id: 'other',      label: 'Other',     icon: 'File06',    order: 4, ...tone('neutral') },
];
export const SUBMISSION_TYPE_IDS = SUBMISSION_TYPES.map(t => t.id);
export const submissionTypeOf = (id) => SUBMISSION_TYPES.find(t => t.id === id) || SUBMISSION_TYPES[4];

/* ── Industry normalization ────────────────────────────────────── */
/** The nightly enricher writes lowercase industries ("food & beverage")
 *  while spreadsheet imports keep Title Case. Compare and group on this
 *  key; display with displayIndustry(). Behavior-preserving today: callers
 *  still show the raw value until Prompt 5 adopts it. */
export const industryKey = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const displayIndustry = (v) => industryKey(v).replace(/\b\w/g, c => c.toUpperCase());

/* ── Legacy enum ID lists for anything that only needs the ids ─── */
export const CALL_STATUS_IDS = CALL_STATUSES.map(s => s.id);
export const PRIORITY_IDS = PRIORITIES.map(p => p.id);
export const CONTACT_TYPE_IDS = CONTACT_TYPES.map(t => t.id);
export const MEETING_TYPE_IDS = MEETING_TYPES.map(t => t.id);
export const PLAN_IDS = PLANS.map(p => p.id);
