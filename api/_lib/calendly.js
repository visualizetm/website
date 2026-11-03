import { rateKey } from './limit.js';

/* Calendly, read only (client portal, prompt 3): the next booked call for
 * one client, matched by the invitee's email, through the same token the
 * Calendar screen reads (CALENDLY_TOKEN, CALENDLY_PAT accepted). The
 * answer is cached for fifteen minutes per client in settings under the
 * rate: key pattern, so the portal never calls Calendly on every load.
 * No token, no match, a refusal or a thrown fetch all answer null, and a
 * miss is cached too. Only { at, end, title, join } ever leaves. */

const BASE = 'https://api.calendly.com';
export const MEETING_CACHE_MS = 15 * 60e3;
const LOOKAHEAD_MS = 60 * 864e5;
export const calendlyToken = () => process.env.CALENDLY_TOKEN || process.env.CALENDLY_PAT || '';
const shape = (ev) => ({ at: String(ev.start_time || '').slice(0, 40), end: String(ev.end_time || '').slice(0, 40), title: String(ev.name || 'Call with Rob').slice(0, 120), join: /^https:\/\//i.test(String(ev.location?.join_url || '')) ? String(ev.location.join_url).slice(0, 400) : '' });

/** The soonest active event in the next sixty days with an invitee whose email matches, or null. Never throws. */
export async function fetchNextMeeting(email) {
  const token = calendlyToken();
  const mail = String(email || '').trim().toLowerCase();
  if (!token || !mail) return null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const meRes = await fetch(`${BASE}/users/me`, { headers, signal: AbortSignal.timeout(8000) });
    if (!meRes.ok) return null;
    const { resource: user } = await meRes.json();
    const params = new URLSearchParams({ user: user.uri, status: 'active', sort: 'start_time:asc', min_start_time: new Date().toISOString(), max_start_time: new Date(Date.now() + LOOKAHEAD_MS).toISOString(), count: '50' });
    const evRes = await fetch(`${BASE}/scheduled_events?${params}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!evRes.ok) return null;
    const { collection = [] } = await evRes.json();
    /* Soonest first (the API sorts, and so does this, in case): the first event with a matching invitee wins, two matches or not. */
    const sorted = [...collection].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    for (const ev of sorted) {
      const id = String(ev.uri || '').split('/').pop();
      if (!id) continue;
      const r = await fetch(`${BASE}/scheduled_events/${id}/invitees?count=10`, { headers, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const invitees = (await r.json()).collection || [];
      if (invitees.some(inv => String(inv?.email || '').trim().toLowerCase() === mail)) return shape(ev);
    }
    return null;
  } catch { return null; }
}

/** The cached answer for one client: a hit within fifteen minutes is returned as stored, else Calendly is asked and the answer (null too) stored. */
export async function nextMeetingFor(db, leadId, email) {
  if (!calendlyToken()) return null;
  const key = rateKey('pcal', String(leadId));
  let doc = null;
  try { doc = await db.collection('settings').findOne({ _id: key }); } catch { doc = null; }
  if (doc && Number.isFinite(Number(doc.at)) && Date.now() - Number(doc.at) < MEETING_CACHE_MS) return doc.data || null;
  const data = await fetchNextMeeting(email);
  try { await db.collection('settings').updateOne({ _id: key }, { $set: { at: Date.now(), data } }, { upsert: true }); } catch { /* best effort */ }
  return data;
}

/* The next open slots (prompt 2 of 3, the call stepper's "two times"): the meeting event type (the one whose scheduling link is the
   studio's meeting link, else the first active one), its available times over the next seven days, the first n start times as ISO.
   Anything slow or off answers [] and the stepper falls back to its default times; every call is capped at timeoutMs in total. */
export async function nextOpenSlots({ n = 2, timeoutMs = 3500, meetingLink = '' } = {}) {
  const token = calendlyToken();
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const deadline = Date.now() + timeoutMs;
  const left = () => Math.max(250, deadline - Date.now());
  try {
    const meRes = await fetch(`${BASE}/users/me`, { headers, signal: AbortSignal.timeout(left()) });
    if (!meRes.ok) return [];
    const { resource: user } = await meRes.json();
    const etRes = await fetch(`${BASE}/event_types?${new URLSearchParams({ user: user.uri, active: 'true', count: '20' })}`, { headers, signal: AbortSignal.timeout(left()) });
    if (!etRes.ok) return [];
    const types = (await etRes.json()).collection || [];
    const want = String(meetingLink || '').replace(/\/+$/, '').toLowerCase();
    const type = types.find(t => want && String(t.scheduling_url || '').replace(/\/+$/, '').toLowerCase() === want) || types[0];
    if (!type?.uri) return [];
    const start = new Date(Date.now() + 3600e3); const end = new Date(Date.now() + 7 * 864e5);
    const avRes = await fetch(`${BASE}/event_type_available_times?${new URLSearchParams({ event_type: type.uri, start_time: start.toISOString(), end_time: end.toISOString() })}`, { headers, signal: AbortSignal.timeout(left()) });
    if (!avRes.ok) return [];
    const times = ((await avRes.json()).collection || []).filter(t => t.status === 'available' && t.start_time).map(t => String(t.start_time)).sort();
    return times.slice(0, n);
  } catch { return []; }
}

