import { getDb } from '../_lib/mongo.js';

// Saves the owner device's push subscription (called from /admin after permission).
export async function handler(req, res) {
  const sub = req.body?.subscription;
  if (!sub?.endpoint) return res.status(400).json({ error: 'subscription required' });

  const db = await getDb();
  await db.collection('push_subscriptions').updateOne(
    { 'subscription.endpoint': sub.endpoint },
    { $set: { subscription: sub, updatedAt: new Date() } },
    { upsert: true },
  );
  // A device is saved again: the "subscribe again" flag a pruned last device set is done.
  await db.collection('settings').updateOne({ _id: 'notifications' }, { $set: { pushNeedsResubscribe: false }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return res.status(200).json({ ok: true });
}