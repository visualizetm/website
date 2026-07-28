import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';

// Saves the owner device's push subscription (called from /admin after permission).
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const sub = req.body?.subscription;
  if (!sub?.endpoint) return res.status(400).json({ error: 'subscription required' });

  const db = await getDb();
  await db.collection('push_subscriptions').updateOne(
    { 'subscription.endpoint': sub.endpoint },
    { $set: { subscription: sub, updatedAt: new Date() } },
    { upsert: true },
  );
  return res.status(200).json({ ok: true });
}
