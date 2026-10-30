import { sendPush } from './notify.js';
import { calendlyToken } from './calendly.js';
import { invoicesOf, invoicesPastDue } from './invoices.js';
import { zoneDayKey, ZONE } from './zone.js';

/* The pushes the CRM promises beyond a reminder at its due time (finish notifications, milestone 3). Each one answers with the
 * counts it needs and never throws: a push is a convenience, and the work it reports on is already written.
 *
 *   paymentPush(db, row, lead)             Stripe webhook: "Paid: Client $1,200", once per payment however many events Stripe sends
 *   runOverdueInvoices(db, nowMs, gate)    the minute job, once a day from 9:00 New York: a line past due, once per invoice per day, three times at most
 *   runLeadSweep(db, nowMs, gate)          the minute job, every 15 minutes: leads the scraper wrote since the last look (the scraper is outside
 *                                          the repo; its rows carry sourceId, which a lead Rob adds by hand never does)
 *   runCalendlyPoll(db, nowMs, gate)       the minute job, every 15 minutes: a booking or a cancellation on Rob's Calendly, once per event id
 *
 * The three sweeps keep their state in the settings document cronGates (the gate patch they return is merged into it by the
 * caller), never in a new collection. Every push carries a category, which Settings turns on and off (src/shared/pushCategories.js). */

const adminBase = () => process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
export const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const list = (items, more = 5) => items.slice(0, more).join(', ') + (items.length > more ? `, +${items.length - more} more` : '');
const when = (isoOrMs) => new Date(isoOrMs).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: ZONE });
const NONE = { attempted: 0, delivered: 0, removed: 0, errors: ['push-error'] };
const send = async (db, message, nowMs = Date.now()) => { try { return await sendPush(db, { kind: 'event', ...message }, { now: nowMs }); } catch { return NONE; } };
/** A push is handled when a device took it, or when Settings has that category switched off (sendPush answers skipped): either way it is not retried. */
export const handled = (res) => !!res && (Number(res.delivered) > 0 || !!res.skipped);

/* ── Payments ───────────────────────────────────────────────────── */
export const PAYMENT_PUSH_WINDOW_MS = 30 * 60e3;

/** "Paid: Client $1,200" for a payment event the webhook just stored. Stripe sends a charge, a checkout session and an invoice event for
 * one payment, so a second event for the same client and amount inside half an hour is the same payment and pushes nothing (the row being
 * pushed has no pushedAt yet, so it never matches itself). */
export async function paymentPush(db, row, lead = null) {
  try {
    if (!row || !(Number(row.amount) > 0)) return { pushed: false, why: 'no-amount' };
    const col = db.collection('stripe_events');
    const who = String(lead?.business || row.customerName || row.customerEmail || 'a customer');
    const identity = lead ? { matchedLeadId: String(lead._id) } : row.customerEmail ? { customerEmail: row.customerEmail } : {};
    const same = await col.findOne({ amount: row.amount, pushedAt: { $gte: new Date(Date.now() - PAYMENT_PUSH_WINDOW_MS) }, ...identity });
    if (same) return { pushed: false, why: 'same-payment' };
    const res = await send(db, { title: `Paid: ${who} ${money(row.amount)}`, body: String(row.description || '').slice(0, 120), url: lead ? `${adminBase()}/clients/${encodeURIComponent(String(lead._id))}` : `${adminBase()}/settings`, category: 'payments' });
    if (handled(res)) await col.updateOne({ id: row.id }, { $set: { pushedAt: new Date() } });
    return { pushed: res.delivered > 0, why: handled(res) ? (res.skipped || '') : (res.errors[0] || 'not-delivered') };
  } catch { return { pushed: false, why: 'error' }; }
}

/* ── Invoices past due ──────────────────────────────────────────── */
export const OVERDUE_MAX_NUDGES = 3;
export const OVERDUE_MAX_TRIES = 3;
export const OVERDUE_AT = { h: 9, min: 0 }; // America/New_York: the daily job runs at 1 or 2 AM there, and a push then would wake the phone

/** Every invoice line past due, one entry per invoice id, from the projects and from the deals not yet converted. */
export async function pastDueLines(db, nowMs) {
  const lines = new Map();
  const owners = new Map((await db.collection('call_leads').find({ deleted: { $ne: true } }).project({ business: 1 }).toArray()).map(o => [String(o._id), o.business]));
  const projects = await db.collection('projects').find({ archived: { $ne: true } }).project({ leadId: 1, name: 1, invoices: 1, schedule: 1 }).toArray();
  for (const p of projects) for (const inv of invoicesPastDue(invoicesOf(p), nowMs)) if (inv?.id && !lines.has(inv.id)) lines.set(inv.id, { id: inv.id, label: inv.label || 'Invoice', amount: Number(inv.amount) || 0, dueAt: inv.dueAt, leadId: String(p.leadId), who: owners.get(String(p.leadId)) || p.name || 'A client' });
  const deals = await db.collection('call_leads').find({ deleted: { $ne: true }, 'deal.invoices': { $exists: true } }).project({ business: 1, deal: 1 }).toArray();
  for (const l of deals) for (const inv of invoicesPastDue(Array.isArray(l.deal?.invoices) ? l.deal.invoices : [], nowMs)) if (inv?.id && !lines.has(inv.id)) lines.set(inv.id, { id: inv.id, label: inv.label || 'Invoice', amount: Number(inv.amount) || 0, dueAt: inv.dueAt, leadId: String(l._id), who: l.business || 'A client' });
  return [...lines.values()];
}

/** Once a day (the caller gates it to 9:00 New York): one push for the lines past due that have been told fewer than three times and not today.
 * gate.overdueNudges is { invoiceId: { n, day } }; a push no device took is tried again on the next run, three times, then dropped for the day. */
export async function runOverdueInvoices(db, nowMs, gate = {}) {
  const today = zoneDayKey(nowMs);
  const out = { overdue: 0, eligible: 0, pushed: 0, patch: {} };
  if (gate.overdueDay === today) return out;
  try {
    const lines = await pastDueLines(db, nowMs);
    out.overdue = lines.length;
    const nudges = {};
    for (const l of lines) if (gate.overdueNudges?.[l.id]) nudges[l.id] = gate.overdueNudges[l.id]; // paid or gone lines drop out
    const eligible = lines.filter(l => (Number(nudges[l.id]?.n) || 0) < OVERDUE_MAX_NUDGES && nudges[l.id]?.day !== today);
    out.eligible = eligible.length;
    if (!eligible.length) { out.patch = { overdueNudges: nudges, overdueDay: today, overdueTries: null }; return out; }
    eligible.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
    const one = eligible.length === 1 ? eligible[0] : null;
    const res = await send(db, one
      ? { title: `Overdue: ${one.who} ${money(one.amount)}`, body: `${one.label}, due ${one.dueAt}.`, url: `${adminBase()}/clients/${encodeURIComponent(one.leadId)}`, category: 'payments' }
      : { title: `${plural(eligible.length, 'invoice')} overdue`, body: list(eligible.map(l => `${l.who} ${money(l.amount)}`)), url: `${adminBase()}/clients`, category: 'payments' }, nowMs);
    if (handled(res)) {
      for (const l of eligible) nudges[l.id] = { n: (Number(nudges[l.id]?.n) || 0) + 1, day: today };
      out.pushed = eligible.length;
      out.patch = { overdueNudges: nudges, overdueDay: today, overdueTries: null };
    } else {
      const tries = (gate.overdueTries?.day === today ? Number(gate.overdueTries.n) || 0 : 0) + 1;
      out.patch = tries >= OVERDUE_MAX_TRIES ? { overdueNudges: nudges, overdueDay: today, overdueTries: null } : { overdueTries: { day: today, n: tries } };
    }
  } catch { /* the next run tries again */ }
  return out;
}

/* ── Leads the scraper wrote ────────────────────────────────────── */
export const LEAD_SWEEP_GAP_MS = 15 * 60e3;
export const LEAD_SWEEP_LOOKBACK_MS = 2 * 3600e3; // a lead older than this is not news, however long the push took to get through

/** New scraped leads since the last look. The first look only sets the mark (nothing already in the CRM is news). A push no device took
 * leaves the mark where it was, so the next look tells Rob, within the lookback. */
export async function runLeadSweep(db, nowMs, gate = {}) {
  const out = { found: 0, pushed: false, patch: {} };
  if (gate.leadSweepAt && nowMs - Date.parse(gate.leadSweepAt) < LEAD_SWEEP_GAP_MS) return out;
  const stamp = new Date(nowMs).toISOString();
  try {
    if (!gate.leadSweepMark) { out.patch = { leadSweepAt: stamp, leadSweepMark: nowMs }; return out; }
    const since = Math.max(Number(gate.leadSweepMark) || 0, nowMs - LEAD_SWEEP_LOOKBACK_MS);
    const fresh = await db.collection('call_leads').find({ deleted: { $ne: true }, sourceId: { $exists: true, $ne: '' }, createdAt: { $gt: new Date(since) } }).project({ business: 1, createdAt: 1 }).toArray();
    out.found = fresh.length;
    out.patch = { leadSweepAt: stamp };
    if (!fresh.length) { out.patch.leadSweepMark = Math.max(since, Number(gate.leadSweepMark) || 0); return out; }
    const newest = fresh.reduce((m, l) => Math.max(m, new Date(l.createdAt).getTime() || 0), 0);
    const res = await send(db, fresh.length === 1
      ? { title: `New lead: ${fresh[0].business || 'a business'}`, body: 'Waiting in Triage.', url: `${adminBase()}/leads?open=${String(fresh[0]._id)}`, category: 'leads' }
      : { title: `${plural(fresh.length, 'new lead')}`, body: list(fresh.map(l => l.business || 'a business')), url: `${adminBase()}/leads`, category: 'leads' }, nowMs);
    if (handled(res)) { out.pushed = res.delivered > 0; out.patch.leadSweepMark = newest; }
  } catch { out.patch = { leadSweepAt: stamp }; }
  return out;
}

/* ── Calendly bookings ──────────────────────────────────────────── */
export const CALENDLY_POLL_GAP_MS = 15 * 60e3;
const CALENDLY = 'https://api.calendly.com';
const LOOKAHEAD_MS = 60 * 864e5;
const SEEN_CAP = 150;
const NAME_LOOKUPS = 5; // invitee reads per poll: a flood of bookings (the first poll aside, which pushes nothing) names the first few
const idOf = (ev) => String(ev?.uri || '').split('/').pop();

async function getJson(url, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Object.assign(new Error('calendly'), { code: `http-${r.status}` });
  return r.json();
}

/** Rob's active and canceled Calendly events in the next sixty days, compared with the ids seen at the last poll (gate.calendlySeen,
 * { id: { at, name } }). New ids are bookings, ids that were seen and are now canceled are cancellations, each pushed once. The first
 * poll only records what is there. Uses the token the Calendar screen reads (CALENDLY_TOKEN or CALENDLY_PAT); without it nothing runs.
 * A failed poll keeps the state and records the code in calendlyError; a push no device took keeps its ids unannounced for the next poll. */
export async function runCalendlyPoll(db, nowMs, gate = {}) {
  const out = { polled: false, booked: 0, canceled: 0, patch: {} };
  const token = calendlyToken();
  if (!token) return out;
  if (gate.calendlyPollAt && nowMs - Date.parse(gate.calendlyPollAt) < CALENDLY_POLL_GAP_MS) return out;
  out.polled = true;
  const patch = { calendlyPollAt: new Date(nowMs).toISOString() };
  out.patch = patch;
  try {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    let user = gate.calendlyUser;
    if (!user) { user = (await getJson(`${CALENDLY}/users/me`, headers))?.resource?.uri; if (!user) throw Object.assign(new Error('calendly'), { code: 'no-user' }); patch.calendlyUser = user; }
    const events = async (status) => {
      const q = new URLSearchParams({ user, status, sort: 'start_time:asc', min_start_time: new Date(nowMs).toISOString(), max_start_time: new Date(nowMs + LOOKAHEAD_MS).toISOString(), count: '100' });
      return ((await getJson(`${CALENDLY}/scheduled_events?${q}`, headers)).collection || []).filter(e => idOf(e));
    };
    const active = await events('active');
    const canceled = await events('canceled');
    const first = !gate.calendlySeen || typeof gate.calendlySeen !== 'object';
    const seen = first ? {} : { ...gate.calendlySeen };
    const activeIds = new Set(active.map(idOf));
    const nameOf = async (ev) => {
      try { const inv = (await getJson(`${CALENDLY}/scheduled_events/${idOf(ev)}/invitees?count=1`, headers)).collection?.[0]; return String(inv?.name || '').slice(0, 80); } catch { return ''; }
    };

    if (first) {
      for (const ev of active) seen[idOf(ev)] = { at: String(ev.start_time || ''), name: '' };
      patch.calendlySeen = trimSeen(seen); patch.calendlyError = '';
      return out;
    }

    const fresh = active.filter(ev => !seen[idOf(ev)]);
    let looked = 0;
    const booked = [];
    for (const ev of fresh) { const name = looked++ < NAME_LOOKUPS ? await nameOf(ev) : ''; booked.push({ id: idOf(ev), at: String(ev.start_time || ''), name: name || String(ev.name || 'A call') }); }
    const gone = [];
    for (const ev of canceled) {
      const was = seen[idOf(ev)]; if (!was) continue;
      const name = was.name || (looked++ < NAME_LOOKUPS ? await nameOf(ev) : '') || String(ev.name || 'A call'); // the first poll recorded no names
      gone.push({ id: idOf(ev), at: String(ev.start_time || ''), name });
    }

    const message = (items, noun) => (items.length === 1
      ? { title: `${noun}: ${items[0].name}`, body: when(items[0].at), url: `${adminBase()}/calendar`, category: 'meetings' }
      : { title: `${plural(items.length, noun === 'Booked' ? 'new booking' : 'cancellation')}`, body: list(items.map(i => `${i.name}, ${when(i.at)}`), 4), url: `${adminBase()}/calendar`, category: 'meetings' });
    let announced = [];
    if (booked.length && handled(await send(db, message(booked, 'Booked'), nowMs))) { announced = booked; out.booked = booked.length; }
    let released = [];
    if (gone.length && handled(await send(db, message(gone, 'Canceled'), nowMs))) { released = gone; out.canceled = gone.length; }

    /* The ids the next poll compares against: still active, plus the bookings just announced, plus a cancellation not yet announced. */
    const next = {};
    for (const [id, v] of Object.entries(seen)) if (activeIds.has(id) || (gone.some(g => g.id === id) && !released.some(g => g.id === id))) next[id] = v;
    for (const b of announced) next[b.id] = { at: b.at, name: b.name };
    patch.calendlySeen = trimSeen(next); patch.calendlyError = '';
  } catch (e) { patch.calendlyError = String(e?.code || 'network'); }
  return out;
}
const trimSeen = (seen) => Object.fromEntries(Object.entries(seen).sort((a, b) => String(a[1]?.at).localeCompare(String(b[1]?.at))).slice(0, SEEN_CAP));
