import { requireAdmin } from '../../_lib/auth.js';
import { stripeGet, stripeConfigured } from '../../_lib/stripe.js';

/* GET /api/admin/stripe/subscriptions: active (active, trialing, past_due) and
 * ending (cancel_at_period_end) subscriptions, 5 minute cache. */
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method not allowed' }); }
  if (!stripeConfigured()) return res.status(200).json({ configured: false, items: [] });
  const r = await stripeGet('/subscriptions', { status: 'all', limit: 100, expand: ['data.customer'] });
  if (r.error) return res.status(502).json({ configured: true, error: r.error, items: [] });
  const items = (r.data || []).filter(s => ['active', 'trialing', 'past_due'].includes(s.status)).map(s => ({
    id: s.id, status: s.cancel_at_period_end ? 'ending' : s.status,
    customerEmail: String(s.customer?.email || '').toLowerCase(), customerName: String(s.customer?.name || ''),
    amount: Math.round(Number(s.items?.data?.[0]?.price?.unit_amount) || 0) / 100, interval: s.items?.data?.[0]?.price?.recurring?.interval || 'month',
    nickname: s.items?.data?.[0]?.price?.nickname || s.items?.data?.[0]?.plan?.nickname || '',
    currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
    cancelAt: s.cancel_at ? new Date(s.cancel_at * 1000).toISOString() : null, startedAt: s.start_date ? new Date(s.start_date * 1000).toISOString() : null,
  }));
  return res.status(200).json({ configured: true, cached: !!r.cached, items });
}
