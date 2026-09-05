import { getDb } from '../_lib/mongo.js';

/* GET /api/admin/backup: every collection as one JSON download named
 * visualize-backup-YYYY-MM-DD.json. push_subscriptions and raw Stripe payloads
 * are left out. Restore is out of scope (the file is for safekeeping). */
const COLLECTIONS = ['call_leads', 'submissions', 'projects', 'orders', 'concept_packs', 'settings', 'stripe_events'];

export async function handler(req, res) {
  const db = await getDb();
  const out = { app: 'visualize-admin', version: 1, createdAt: new Date().toISOString(), collections: {} };
  for (const name of COLLECTIONS) {
    const rows = await db.collection(name).find({}).limit(20000).toArray();
    out.collections[name] = name === 'stripe_events' ? rows.map(r => { const { raw, ...rest } = r; return rest; }) : name === 'settings' ? rows.map(r => (r._id === 'auth' ? { _id: 'auth', changedAt: r.changedAt || null } : r)) : rows;
  }
  await db.collection('settings').updateOne({ _id: 'health' }, { $set: { lastBackupAt: new Date(), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  const stamp = out.createdAt.slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="visualize-backup-${stamp}.json"`);
  return res.status(200).send(JSON.stringify(out));
}