import { getDb } from '../../_lib/mongo.js';
import { stripeGet, stripeConfigured, normalizeEvent, ALL_TYPES, PAYMENT_TYPES } from '../../_lib/stripe.js';
import { route } from '../../_lib/handler.js';

/* GET /api/admin/stripe/events?days=30        recent events straight from Stripe (5 minute cache)
 * GET /api/admin/stripe/events?stored=1       the stripe_events rows the webhook stored (?unmatched=1 filters)
 * Missing STRIPE_SECRET_KEY answers { configured: false, events: [] } with 200. */
async function handler(req, res) {
  const db = await getDb();
  if (req.query?.stored === '1') {
    const q = req.query.unmatched === '1' ? { type: { $in: PAYMENT_TYPES }, matchedLeadId: '' } : {};
    const items = await db.collection('stripe_events').find(q, { projection: { raw: 0 } }).sort({ at: -1 }).limit(200).toArray();
    return res.status(200).json({ configured: stripeConfigured(), items });
  }
  if (!stripeConfigured()) return res.status(200).json({ configured: false, events: [] });
  const days = Math.max(1, Math.min(90, Number(req.query?.days) || 30));
  const r = await stripeGet('/events', { types: ALL_TYPES, 'created[gte]': Math.floor(Date.now() / 1000) - days * 86400, limit: 100 });
  if (r.error) return res.status(502).json({ configured: true, error: r.error, events: [] });
  const stored = new Map((await db.collection('stripe_events').find({}, { projection: { id: 1, matchedLeadId: 1, ledgerId: 1 } }).toArray()).map(x => [x.id, x]));
  const events = (r.data || []).map(ev => { const n = normalizeEvent(ev); delete n.raw; const s = stored.get(n.id); return { ...n, stored: !!s, matchedLeadId: s?.matchedLeadId || '', ledgerId: s?.ledgerId || '' }; });
  return res.status(200).json({ configured: true, cached: !!r.cached, events });
}
export default route(handler, { methods: ['GET'] });
