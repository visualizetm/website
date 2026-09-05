import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { stripeHealth } from '../_lib/stripe.js';

/* Vercel cron, once a day at 06:00 UTC (vercel.json). CRON_SECRET guarded.
 *  1. Retainers: roll retainer.nextBillAt forward once a bill date passes,
 *     extend the retainer project's schedule so six future months exist
 *     (the same rule Mark paid applies), and move ending retainers whose
 *     cancelAt has passed to cancelled.
 *  2. Task health: write the settings 'health' document (enrichment, scraper,
 *     crons, stripe) the Integrations cards and the drawer read. */
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const addMonths = (dateStr, n, dayOfMonth) => { const [y, m, d] = String(dateStr).split('-').map(Number); const want = dayOfMonth || d; const last = new Date(y, m - 1 + n + 1, 0).getDate(); return dayKey(new Date(y, m - 1 + n, Math.min(want, last))); };
const uid = () => Math.random().toString(36).slice(2, 10);

export async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-cron-secret'] || '');
  if (!secret || given !== secret) return res.status(401).json({ error: 'unauthorized' });
  const db = await getDb();
  const leads = db.collection('call_leads');
  const projects = db.collection('projects');
  const settings = db.collection('settings');
  const today = dayKey(new Date());
  const nowIso = new Date().toISOString();
  let rolled = 0; let cancelled = 0; let extended = 0;

  // 1. Retainers.
  const clients = await leads.find({ deleted: { $ne: true }, 'retainer.status': { $in: ['active', 'ending', 'paused'] } }).toArray();
  for (const l of clients) {
    const r = l.retainer;
    if (r.status === 'ending' && r.cancelAt && new Date(r.cancelAt).getTime() <= Date.now()) {
      await leads.updateOne({ _id: l._id }, { $set: { 'retainer.status': 'cancelled', 'retainer.nextBillAt': '', updatedAt: new Date() } }); cancelled++; continue;
    }
    if (r.status === 'paused') continue;
    const pid = r.projectId && ObjectId.isValid(r.projectId) ? new ObjectId(r.projectId) : null;
    const p = pid ? await projects.findOne({ _id: pid }) : null;
    if (p) {
      let schedule = p.schedule || [];
      const unpaidFuture = schedule.filter(s => s.status !== 'paid' && !s.ledgerId && String(s.dueAt) >= today);
      if (unpaidFuture.length < 6 && schedule.length) {
        const last = schedule[schedule.length - 1];
        const amount = Number(r.amount) || Number(last.amount) || 0;
        const more = Array.from({ length: 6 - unpaidFuture.length }, (_, i) => ({ id: uid(), amount, dueAt: addMonths(last.dueAt, i + 1, r.billDay), status: 'upcoming', ledgerId: '', label: `Month ${schedule.length + i + 1}` }));
        schedule = [...schedule, ...more];
        await projects.updateOne({ _id: p._id }, { $set: { schedule, updatedAt: new Date() } }); extended++;
      }
      const next = schedule.filter(s => s.status !== 'paid' && !s.ledgerId && String(s.dueAt) >= today).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0];
      const target = next?.dueAt || '';
      if (target && target !== r.nextBillAt && (!r.nextBillAt || String(r.nextBillAt) < today)) { await leads.updateOne({ _id: l._id }, { $set: { 'retainer.nextBillAt': target, updatedAt: new Date() } }); rolled++; }
    } else if (r.nextBillAt && String(r.nextBillAt) < today) {
      await leads.updateOne({ _id: l._id }, { $set: { 'retainer.nextBillAt': addMonths(String(r.nextBillAt).slice(0, 10), 1, r.billDay), updatedAt: new Date() } }); rolled++;
    }
  }

  // 2. Health.
  const since24 = new Date(Date.now() - 24 * 3600e3); const since7 = new Date(Date.now() - 7 * 864e5);
  const scanned = await leads.find({ deleted: { $ne: true }, 'enrichment.lastScanAt': { $exists: true, $ne: '' } }).project({ enrichment: 1, descriptor: 1, industry: 1, phone: 1, email: 1, socials: 1, intel: 1 }).toArray();
  const lastScan = scanned.reduce((m, l) => { const t = new Date(l.enrichment.lastScanAt).getTime(); return t > m ? t : m; }, 0);
  const scanned24 = scanned.filter(l => new Date(l.enrichment.lastScanAt) >= since24);
  const fields24 = scanned24.reduce((n, l) => n + ['descriptor', 'industry', 'phone', 'email', 'socials', 'intel'].filter(k => l[k] && (typeof l[k] !== 'object' || Object.values(l[k]).some(Boolean))).length, 0);
  const [lastInsert, inserted24, inserted7] = await Promise.all([
    leads.find({ sourceId: { $exists: true, $ne: '' } }).sort({ createdAt: -1 }).limit(1).project({ createdAt: 1 }).toArray(),
    leads.countDocuments({ sourceId: { $exists: true, $ne: '' }, createdAt: { $gte: since24 } }),
    leads.countDocuments({ sourceId: { $exists: true, $ne: '' }, createdAt: { $gte: since7 } }),
  ]);
  const prev = (await settings.findOne({ _id: 'health' })) || {};
  const stripe = await stripeHealth(db);
  const health = {
    enrichment: { lastScanAt: lastScan ? new Date(lastScan).toISOString() : null, leadsScannedLast24h: scanned24.length, fieldsFilledLast24h: fields24 },
    scraper: { lastInsertAt: lastInsert[0]?.createdAt ? new Date(lastInsert[0].createdAt).toISOString() : null, insertedLast24h: inserted24, insertedLast7d: inserted7 },
    crons: { ...(prev.crons || {}), daily: { lastRunAt: nowIso, rolled, cancelled, extended } },
    stripe: { lastWebhookAt: stripe.lastWebhookAt || prev.stripe?.lastWebhookAt || null, unmatched: stripe.unmatched },
    updatedAt: new Date(),
  };
  await settings.updateOne({ _id: 'health' }, { $set: health, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return res.status(200).json({ ok: true, rolled, cancelled, extended, health });
}