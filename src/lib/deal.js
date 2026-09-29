/* The deal (CRM revamp, step 5): a booked lead's road from the meeting to
 * the first payment, as nine checkpoints on the lead's deal object.
 * Mirrored byte for byte in api/_lib/deal.js (below the header), so the
 * daily cron and the shared patch helper move a deal the same way. Self
 * contained: no imports, so plain Node loads it for scripts/deals-test.mjs.
 *
 *   deal { checkpoints { concepts, introSent, callDone, onboardingSent,
 *          formReceived, contractSent, contractAgreed, invoiceSent, paid }
 *          each { at ISO, by rob | auto } or null,
 *          packageId, addonIds[], plan { months, monthly } | null,
 *          invoices[] (src/lib/invoices.js), contractLink, metAt, stalledSince }
 *
 * concepts, callDone and formReceived tick on their own (a concept set
 * exists, a linked Calendly call is past or Rob taps Met them, a start
 * submission links); the rest are Rob's. A card sits in the column of its
 * newest tick. stalledSince is set when the newest tick is older than
 * seven days and cleared by the next tick. */
/* The meeting's instant (closeout): the browser reads its own zone; the
 * server mirror reads America/New_York (api/_lib/zone.js). Everything
 * below CHECKPOINTS is identical on both. */
const meetingMs = (lead) => { const m = lead?.meeting; if (!m?.date) return 0; const t = new Date(`${m.date}T${m.time || '09:00'}`).getTime(); return Number.isNaN(t) ? 0 : t; };
export const CHECKPOINTS = [
  { id: 'concepts',       label: 'Concepts built',   column: 'concepts',     auto: true },
  { id: 'introSent',      label: 'Intro sent',       column: 'introSent',    auto: false, send: true },
  { id: 'callDone',       label: 'Call done',        column: 'callDone',     auto: true, met: true },
  { id: 'onboardingSent', label: 'Onboarding sent',  column: 'callDone',     auto: false, send: true },
  { id: 'formReceived',   label: 'Form received',    column: 'formReceived', auto: true },
  { id: 'contractSent',   label: 'Contract sent',    column: 'contractSent', auto: false },
  { id: 'contractAgreed', label: 'Contract agreed',  column: 'contractSent', auto: false },
  { id: 'invoiceSent',    label: 'Invoice sent',     column: 'invoiceSent',  auto: false },
  { id: 'paid',           label: 'Paid',             column: 'invoiceSent',  auto: false },
];
export const CHECKPOINT_IDS = CHECKPOINTS.map(c => c.id);
export const checkpointOf = (id) => CHECKPOINTS.find(c => c.id === id) || null;
export const DEAL_COLUMNS = [
  { id: 'booked', label: 'Booked' }, { id: 'concepts', label: 'Concepts' }, { id: 'introSent', label: 'Intro sent' }, { id: 'callDone', label: 'Call done' },
  { id: 'formReceived', label: 'Form back' }, { id: 'contractSent', label: 'Contract sent' }, { id: 'invoiceSent', label: 'Invoice sent' },
];
const HOUR = 3600e3;
const DAY = 864e5;
export const STALL_DAYS = 7;
const iso = (t) => new Date(t).toISOString();
const ms = (v) => { if (!v) return 0; const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; };
const stageOf = (lead) => (lead?.stage === 'deal' ? 'deal' : lead?.stage === 'booked' || (!lead?.stage && lead?.callStatus === 'booked') ? 'booked' : lead?.stage || '');

/** A fresh deal object, the package from the recommended pricing option when there is one. */
export const emptyDeal = (packageId = '') => ({ checkpoints: Object.fromEntries(CHECKPOINT_IDS.map(id => [id, null])), packageId: packageId || '', addonIds: [], plan: null, invoices: [], contractLink: '', metAt: '', stalledSince: '' });
/** The lead's deal, or a fresh one when it has none. */
export const dealOf = (lead) => ({ ...emptyDeal(), ...(lead?.deal && typeof lead.deal === 'object' ? lead.deal : {}), checkpoints: { ...emptyDeal().checkpoints, ...(lead?.deal?.checkpoints || {}) } });
export const isTicked = (deal, id) => !!(deal?.checkpoints?.[id]?.at);
/** The newest tick: { id, at } or null. */
export function newestTick(deal) {
  let best = null;
  for (const id of CHECKPOINT_IDS) { const at = ms(deal?.checkpoints?.[id]?.at); if (at && (!best || at > best.at)) best = { id, at }; }
  return best;
}
/** The board column a deal sits in: its newest tick's column, Booked when none. */
export const columnOf = (deal) => { const n = newestTick(deal); return n ? checkpointOf(n.id).column : 'booked'; };
/** The moment the deal last moved: the newest tick, else Met them, else the meeting. */
export const lastMovedAt = (lead) => { const d = dealOf(lead); const n = newestTick(d); return n ? n.at : (ms(d.metAt) || meetingMs(lead) || ms(lead?.updatedAt) || 0); };
export const daysHere = (lead, now = Date.now()) => { const t = lastMovedAt(lead); return t ? Math.max(0, Math.floor((now - t) / DAY)) : 0; };
/** A booked lead whose meeting is at least an hour behind us is a deal. */
export const shouldBecomeDeal = (lead, now = Date.now()) => stageOf(lead) === 'booked' && !!meetingMs(lead) && meetingMs(lead) + HOUR <= now;

/** The $set that ticks one checkpoint (by rob unless told otherwise); Met them also stamps metAt. A tick clears the stall. */
export function tickPatch(lead, id, by = 'rob', now = Date.now()) {
  const d = dealOf(lead);
  const at = iso(now);
  const deal = { ...d, checkpoints: { ...d.checkpoints, [id]: { at, by } }, stalledSince: '' };
  if (id === 'callDone' && !deal.metAt) deal.metAt = at;
  return { deal };
}
export function untickPatch(lead, id) {
  const d = dealOf(lead);
  const deal = { ...d, checkpoints: { ...d.checkpoints, [id]: null } };
  if (id === 'callDone') deal.metAt = '';
  return { deal };
}
/** Met them: stage deal, callDone ticked, metAt stamped. */
export const metPatch = (lead, now = Date.now()) => ({ ...tickPatch(lead, 'callDone', 'rob', now), stage: 'deal' });

/* What moves on its own, for the cron and the shared patch helper:
 *   - a booked lead past its meeting by an hour becomes stage deal
 *   - concepts ticks once a concept set exists for the lead
 *   - callDone ticks once a linked Calendly call is an hour behind us
 *   - stalledSince is set when the newest tick is older than seven days,
 *     cleared when the deal moved inside the week
 * Returns the $set, or null when nothing changes. ctx: { sets } (live, not
 * archived concept sets). */
export function dealAutoPatch(lead, ctx = {}, now = Date.now()) {
  const stage = stageOf(lead);
  if (stage !== 'booked' && stage !== 'deal') return null;
  const set = {};
  let deal = dealOf(lead);
  let touched = false;
  if (shouldBecomeDeal(lead, now)) { set.stage = 'deal'; touched = true; }
  const nextStage = set.stage || stage;
  const hasSet = (ctx.sets || []).some(s => !s.deleted && !s.archived && String(s.leadId) === String(lead._id));
  if (hasSet && !isTicked(deal, 'concepts')) { deal = { ...deal, checkpoints: { ...deal.checkpoints, concepts: { at: iso(now), by: 'auto' } }, stalledSince: '' }; touched = true; }
  if (!isTicked(deal, 'callDone') && lead.calendlyEventUri && meetingMs(lead) && meetingMs(lead) + HOUR <= now) { deal = { ...deal, checkpoints: { ...deal.checkpoints, callDone: { at: iso(meetingMs(lead) + HOUR), by: 'auto' } }, stalledSince: '', metAt: deal.metAt || iso(meetingMs(lead) + HOUR) }; touched = true; }
  if (nextStage === 'deal') {
    const moved = lastMovedAt({ ...lead, deal });
    const stale = !!moved && now - moved >= STALL_DAYS * DAY;
    if (stale && !deal.stalledSince) { deal = { ...deal, stalledSince: iso(now) }; touched = true; }
    if (!stale && deal.stalledSince) { deal = { ...deal, stalledSince: '' }; touched = true; }
  }
  if (!touched) return null;
  const had = lead.deal && typeof lead.deal === 'object';
  if (!had || JSON.stringify(deal) !== JSON.stringify(dealOf(lead))) set.deal = deal;
  if (!Object.keys(set).length) return null;
  return set;
}
export const DEAL_KEYS = ['stage', 'meeting', 'deal', 'calendlyEventUri', 'callStatus'];
/** The set a write should carry: the caller's set plus whatever moved on its own once it lands. */
export function withDeal(record, set, ctx = {}, now = Date.now()) {
  if (!record || !set || !Object.keys(set).some(k => DEAL_KEYS.includes(k))) return set;
  const merged = { ...record, ...set };
  const auto = dealAutoPatch(merged, ctx, now);
  if (!auto) return set;
  return { ...set, ...auto, ...(auto.deal && set.deal ? { deal: { ...set.deal, ...auto.deal, checkpoints: { ...set.deal.checkpoints, ...auto.deal.checkpoints } } } : {}) };
}
export const isStalled = (lead) => !!lead?.deal?.stalledSince;
