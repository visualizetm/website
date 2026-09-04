import { getDb } from '../_lib/mongo.js';
import { requireAdmin, verifyAdminPassword, hashPassword } from '../_lib/auth.js';

const DASHBOARD_DEFAULTS = { dailyCallTarget: 25, dashboardLayout: null };
const clampTarget = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : DASHBOARD_DEFAULTS.dailyCallTarget;
};

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const settings = db.collection('settings');

  if (req.method === 'GET') {
    const [prefs, auth] = await Promise.all([
      settings.findOne({ _id: 'prefs' }),
      settings.findOne({ _id: 'auth' }),
    ]);
    // Dashboard document, created lazily on first read (Prompt 5).
    const dash = await settings.findOneAndUpdate(
      { _id: 'dashboard' },
      { $setOnInsert: { ...DASHBOARD_DEFAULTS, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' },
    );
    const dashDoc = dash?.value || dash || {};
    return res.status(200).json({
      prefs: {
        pushEnabled: prefs?.pushEnabled !== false,
        emailEnabled: prefs?.emailEnabled !== false,
      },
      passwordOverridden: !!auth?.hash,
      dashboard: {
        dailyCallTarget: clampTarget(dashDoc.dailyCallTarget),
        dashboardLayout: dashDoc.dashboardLayout && typeof dashDoc.dashboardLayout === 'object' ? dashDoc.dashboardLayout : null,
      },
    });
  }

  // PATCH { set: { dailyCallTarget?, dashboardLayout? } }: $set only the keys sent,
  // same pattern as call-leads. Unknown keys are ignored.
  if (req.method === 'PATCH') {
    const set = (req.body && typeof req.body.set === 'object' && req.body.set) || req.body || {};
    const allowed = {};
    if (set.dailyCallTarget !== undefined) allowed.dailyCallTarget = clampTarget(set.dailyCallTarget);
    if (set.dashboardLayout !== undefined) allowed.dashboardLayout = set.dashboardLayout && typeof set.dashboardLayout === 'object' ? set.dashboardLayout : null;
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    await settings.updateOne({ _id: 'dashboard' }, { $set: { ...allowed, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return res.status(200).json({ ok: true, dashboard: allowed });
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

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
}
