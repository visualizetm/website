/* Rob's open times (Billy's Call Room, part 1): what the booking screen offers for the next 14 days.
 *   the source   the Calendly event type Rob picked in Settings > Team > Billy (its available times, read only, through the
 *                token the Calendar screen reads), or his weekly hours in 30 minute slots. Calendly with no token, no event
 *                type, a refusal or a thrown fetch falls back to the weekly hours.
 *   the cache    Calendly's answer is kept for five minutes in settings under the rate: key pattern (the key carries a hash of
 *                the event type, so picking another one starts clean). The weekly hours are computed, never stored.
 *   minus        the meetings the CRM already holds: a slot is gone when a meeting starts within 30 minutes of it. This part is
 *                read fresh on every call, so a slot Billy just booked is gone on the next read and at the next write.
 * Nothing here writes to Calendly. Times are instants; the weekly hours are America/New_York wall clock. */
import { calendlyToken } from './calendly.js';
import { rateKey } from './limit.js';
import { zoneDayKey, keyAddDays, zoneDateAt, zoneMeetingMs } from './zone.js';
import { sanitizeOpenTimes } from './team.js';
import { normalizeStage } from '../_semantics.js';

export const OPEN_DAYS = 14;
export const SLOT_MIN = 30;
export const OPEN_CACHE_MS = 5 * 60e3;
export const OPEN_LEAD_MS = 60 * 60e3; // nothing sooner than an hour from now
const BASE = 'https://api.calendly.com';
const DAY = 864e5;

/** Weekly hours as slots: every 30 minutes from start to end, on the days Rob works, for the next 14 days. */
export function hoursSlots(hours, now = Date.now()) {
  const h = sanitizeOpenTimes({ hours }).hours;
  const [sh, sm] = h.start.split(':').map(Number);
  const [eh, em] = h.end.split(':').map(Number);
  const out = [];
  const today = zoneDayKey(now);
  for (let i = 0; i <= OPEN_DAYS; i++) {
    const key = keyAddDays(today, i);
    if (!h.days.includes(new Date(`${key}T12:00:00Z`).getUTCDay())) continue; // the weekday of a day key needs no zone
    for (let m = sh * 60 + sm; m + SLOT_MIN <= eh * 60 + em; m += SLOT_MIN) out.push(zoneDateAt(key, Math.floor(m / 60), m % 60));
  }
  return out;
}

/** The event type's available start times for the next 14 days (Calendly answers a week at a time), or null when it cannot say. */
export async function calendlySlots(eventType, now = Date.now(), timeoutMs = 4000) {
  const token = calendlyToken();
  if (!token || !eventType) return null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const out = [];
  try {
    for (let w = 0; w < OPEN_DAYS / 7; w++) {
      const start = new Date(now + (w ? w * 7 * DAY : 2 * 60e3));
      const end = new Date(now + (w + 1) * 7 * DAY - 1000);
      const r = await fetch(`${BASE}/event_type_available_times?${new URLSearchParams({ event_type: eventType, start_time: start.toISOString(), end_time: end.toISOString() })}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) return null;
      for (const t of (await r.json()).collection || []) { const ms = new Date(String(t?.start_time || '')).getTime(); if (t?.status === 'available' && Number.isFinite(ms)) out.push(ms); }
    }
    return out;
  } catch { return null; }
}

/** The source's own slots as instants: { source, slots }. Calendly's answer is cached five minutes; the hours are the fallback. */
export async function sourceSlots(db, openTimes, now = Date.now()) {
  const ot = sanitizeOpenTimes(openTimes);
  if (ot.source === 'calendly' && ot.eventType && calendlyToken()) {
    const key = rateKey('open', ot.eventType);
    let doc = null;
    try { doc = await db.collection('settings').findOne({ _id: key }); } catch { doc = null; }
    if (doc && Number.isFinite(Number(doc.at)) && now - Number(doc.at) < OPEN_CACHE_MS && Array.isArray(doc.slots)) return { source: 'calendly', slots: doc.slots.map(Number).filter(Number.isFinite) };
    const got = await calendlySlots(ot.eventType, now);
    if (got) {
      try { await db.collection('settings').updateOne({ _id: key }, { $set: { at: now, slots: got } }, { upsert: true }); } catch { /* the answer still stands for this request */ }
      return { source: 'calendly', slots: got };
    }
  }
  return { source: 'hours', slots: hoursSlots(ot.hours, now) };
}

/** When the CRM already has Rob in a meeting, from today on. */
export async function crmMeetings(db, now = Date.now()) {
  const today = zoneDayKey(now);
  const rows = await db.collection('call_leads').find({ deleted: { $ne: true }, 'meeting.date': { $gte: today } }).project({ meeting: 1, stage: 1 }).toArray();
  return rows.filter(l => l?.meeting?.date && String(l.meeting.date) >= today && normalizeStage(l) !== 'declined').map(l => zoneMeetingMs(l.meeting.date, l.meeting.time || '09:00')).filter(Number.isFinite);
}
export const slotFree = (slot, meetings) => !meetings.some(m => Math.abs(slot - m) < SLOT_MIN * 60e3);

/** Rob's open times: the source minus the CRM's meetings, an hour from now to 14 days out, soonest first, as ISO strings. */
export async function openTimes(db, team, now = Date.now()) {
  const src = await sourceSlots(db, team?.openTimes, now);
  const meetings = await crmMeetings(db, now);
  const slots = [...new Set(src.slots)].filter(t => t >= now + OPEN_LEAD_MS && t <= now + OPEN_DAYS * DAY && slotFree(t, meetings)).sort((a, b) => a - b).map(t => new Date(t).toISOString());
  return { source: src.source, slots };
}

/** The event types Rob can pick from (Settings > Team > Billy): { configured, items: [{ uri, name, duration }] }. Never throws. */
export async function eventTypes(timeoutMs = 4000) {
  const token = calendlyToken();
  if (!token) return { configured: false, items: [] };
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const me = await fetch(`${BASE}/users/me`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!me.ok) return { configured: true, items: [], error: 'Calendly did not answer.' };
    const { resource: user } = await me.json();
    const r = await fetch(`${BASE}/event_types?${new URLSearchParams({ user: user.uri, active: 'true', count: '50' })}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return { configured: true, items: [], error: 'Calendly did not answer.' };
    const items = ((await r.json()).collection || []).filter(t => /^https:\/\/api\.calendly\.com\/event_types\/[A-Za-z0-9-]{1,80}$/.test(String(t?.uri || ''))).map(t => ({ uri: String(t.uri), name: String(t.name || 'Event').slice(0, 120), duration: Math.max(0, Math.round(Number(t.duration)) || 0) }));
    return { configured: true, items };
  } catch { return { configured: true, items: [], error: 'Calendly did not answer.' }; }
}
