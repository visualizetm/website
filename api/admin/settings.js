import { getDb } from '../_lib/mongo.js';
import { requireAdmin, verifyAdminPassword, hashPassword } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const settings = db.collection('settings');

  if (req.method === 'GET') {
    const [prefs, auth] = await Promise.all([
      settings.findOne({ _id: 'prefs' }),
      settings.findOne({ _id: 'auth' }),
    ]);
    return res.status(200).json({
      prefs: {
        pushEnabled: prefs?.pushEnabled !== false,
        emailEnabled: prefs?.emailEnabled !== false,
      },
      passwordOverridden: !!auth?.hash,
    });
  }

  if (req.method === 'POST') {
    const b = req.body || {};

    if (b.action === 'password') {
      const ok = await verifyAdminPassword(db, b.current);
      if (!ok) return res.status(401).json({ error: 'Current password is wrong' });
      const next = String(b.next || '');
      if (next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
      const { salt, hash } = hashPassword(next);
      await settings.updateOne(
        { _id: 'auth' },
        { $set: { salt, hash, changedAt: new Date() } },
        { upsert: true },
      );
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'prefs') {
      await settings.updateOne(
        { _id: 'prefs' },
        { $set: { pushEnabled: b.pushEnabled !== false, emailEnabled: b.emailEnabled !== false } },
        { upsert: true },
      );
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'purge') {
      const r = await db.collection('submissions').deleteMany({ deleted: true });
      return res.status(200).json({ ok: true, purged: r.deletedCount });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
