import { getDb } from '../_lib/mongo.js';
import { route } from '../_lib/handler.js';

// Saves the owner device's push subscription (called from /admin after permission).
async function handler(req, res) {
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
export default route(handler, { methods: ['POST'], maxBody: 8 * 1024 });
