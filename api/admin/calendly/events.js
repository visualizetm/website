import { route } from '../../_lib/handler.js';

// GET /api/admin/calendly/events?from=ISO&to=ISO  (Prompt 9)
// Reads the connected user's scheduled events through the Calendly API using
// CALENDLY_TOKEN (CALENDLY_PAT is accepted for the existing deployment). Responses
// are cached in memory for 5 minutes per range. Missing token: { configured: false }.
const CALENDLY_BASE = 'https://api.calendly.com';
const cache = new Map(); // key -> { at, data }
const TTL = 5 * 60e3;

const phoneOf = (inv) => {
  const q = (inv?.questions_and_answers || []).find(x => /phone|number|cell/i.test(x.question || ''));
  return q?.answer || inv?.text_reminder_number || '';
};

async function handler(req, res) {
  const token = process.env.CALENDLY_TOKEN || process.env.CALENDLY_PAT;
  if (!token) return res.status(200).json({ configured: false, events: [] });
  const from = new Date(req.query?.from || Date.now() - 7 * 864e5);
  const to = new Date(req.query?.to || Date.now() + 30 * 864e5);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return res.status(400).json({ error: 'bad range' });
  const key = `${from.toISOString().slice(0, 13)}|${to.toISOString().slice(0, 13)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return res.status(200).json({ configured: true, cached: true, events: hit.data });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const meRes = await fetch(`${CALENDLY_BASE}/users/me`, { headers });
    if (!meRes.ok) return res.status(502).json({ configured: true, error: 'Calendly rejected the token', events: [] });
    const { resource: user } = await meRes.json();
    const params = new URLSearchParams({ user: user.uri, status: 'active', sort: 'start_time:asc', min_start_time: from.toISOString(), max_start_time: to.toISOString(), count: '100' });
    const evRes = await fetch(`${CALENDLY_BASE}/scheduled_events?${params}`, { headers });
    if (!evRes.ok) return res.status(502).json({ configured: true, error: 'Could not read Calendly events', events: [] });
    const { collection = [] } = await evRes.json();
    const events = await Promise.all(collection.map(async (ev) => {
      let inv = null;
      try { const r = await fetch(`${CALENDLY_BASE}/scheduled_events/${ev.uri.split('/').pop()}/invitees?count=1`, { headers }); if (r.ok) inv = (await r.json()).collection?.[0] || null; } catch { /* keep going */ }
      return { uri: ev.uri, at: ev.start_time, end: ev.end_time, name: inv?.name || '', email: inv?.email || '', phone: phoneOf(inv), eventType: ev.name || '', join: ev.location?.join_url || ev.location?.location || '' };
    }));
    cache.set(key, { at: Date.now(), data: events });
    return res.status(200).json({ configured: true, cached: false, events });
  } catch (e) {
    return res.status(502).json({ configured: true, error: 'Calendly request failed', events: [] });
  }
}
export default route(handler, { methods: ['GET'] });
