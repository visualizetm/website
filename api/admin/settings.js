import { getDb } from '../_lib/mongo.js';
import { requireAdmin, verifyAdminPassword, hashPassword } from '../_lib/auth.js';
import { sendPush } from '../_lib/notify.js';
import { stripeHealth } from '../_lib/stripe.js';

const DASHBOARD_DEFAULTS = { dailyCallTarget: 25, dashboardLayout: null };
// Prompt 9: the notifications document. readIds capped at 500 (oldest dropped).
const NOTIF_DEFAULTS = { readIds: [], lastSeenAt: null, snoozedUntil: {}, sentReminderKeys: [], reminders: { meetings: true, callbacks: true, bills: true, reviews: true } };
// Prompt 12: the profile document (greeting name, business hours for the best window).
const PROFILE_DEFAULTS = { name: 'Rob', businessHours: { start: '09:00', end: '17:00' } };
const hhmm = (v, d) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : d);
const profileShape = (d = {}) => ({ name: String(d.name || PROFILE_DEFAULTS.name).slice(0, 80), businessHours: { start: hhmm(d.businessHours?.start, '09:00'), end: hhmm(d.businessHours?.end, '17:00') } });
const strList = (v, max) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, 200)).slice(-max) : []);
const notifShape = (d = {}) => ({
  readIds: strList(d.readIds, 500),
  lastSeenAt: typeof d.lastSeenAt === 'string' ? d.lastSeenAt : null,
  snoozedUntil: d.snoozedUntil && typeof d.snoozedUntil === 'object' ? Object.fromEntries(Object.entries(d.snoozedUntil).filter(([, v]) => typeof v === 'string').slice(-200)) : {},
  reminders: { meetings: d.reminders?.meetings !== false, callbacks: d.reminders?.callbacks !== false, bills: d.reminders?.bills !== false, reviews: d.reminders?.reviews !== false },
});
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
    const [notif, profile, health] = await Promise.all([settings.findOne({ _id: 'notifications' }), settings.findOne({ _id: 'profile' }), settings.findOne({ _id: 'health' })]);
    let stripe = { configured: false, webhookConfigured: false, lastWebhookAt: null, unmatched: 0 };
    try { stripe = await stripeHealth(db); } catch { /* the card shows not connected */ }
    return res.status(200).json({
      notifications: notifShape(notif || NOTIF_DEFAULTS),
      profile: profileShape(profile || {}),
      health: health ? { enrichment: health.enrichment || null, scraper: health.scraper || null, crons: health.crons || {}, stripe: health.stripe || null, lastBackupAt: health.lastBackupAt ? new Date(health.lastBackupAt).toISOString() : null } : null,
      stripe,
      cron: { configured: !!process.env.CRON_SECRET },
      calendly: { configured: !!(process.env.CALENDLY_TOKEN || process.env.CALENDLY_PAT) },
      reminders: { configured: !!process.env.CRON_SECRET, push: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) },
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
    // Prompt 12: PATCH { set: { profile: { name?, businessHours? } } }
    if (set.profile && typeof set.profile === 'object') {
      const cur = (await settings.findOne({ _id: 'profile' })) || {};
      const next = profileShape({ ...cur, ...set.profile, businessHours: { ...(cur.businessHours || {}), ...(set.profile.businessHours || {}) } });
      await settings.updateOne({ _id: 'profile' }, { $set: { ...next, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      if (!Object.keys(allowed).length && !set.notifications) return res.status(200).json({ ok: true, profile: next });
    }
    // Prompt 9: PATCH { set: { notifications: { readIds?, lastSeenAt?, snoozedUntil?, reminders? } } }
    if (set.notifications && typeof set.notifications === 'object') {
      const n = set.notifications; const upd = {};
      if (n.readIds !== undefined) upd.readIds = strList(n.readIds, 500);
      if (n.lastSeenAt !== undefined) upd.lastSeenAt = typeof n.lastSeenAt === 'string' ? n.lastSeenAt : null;
      if (n.snoozedUntil !== undefined) upd.snoozedUntil = notifShape({ snoozedUntil: n.snoozedUntil }).snoozedUntil;
      if (n.reminders !== undefined) upd.reminders = notifShape({ reminders: n.reminders }).reminders;
      if (!Object.keys(upd).length) return res.status(400).json({ error: 'nothing to update' });
      await settings.updateOne({ _id: 'notifications' }, { $set: { ...upd, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      const doc = await settings.findOne({ _id: 'notifications' });
      return res.status(200).json({ ok: true, notifications: notifShape(doc || {}) });
    }
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

    if (b.action === 'test-push') {
      await sendPush(db, { title: 'Visualize test', body: 'Push reminders reach this device.', url: '/' });
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
