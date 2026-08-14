import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';

// Lead pipeline + shop-order pipeline share one status field; the UI shows the
// set that matches the record's type.
const STATUSES = [
  'new', 'contacted', 'replied', 'landed', 'denied',            // submissions
  'paid', 'in-production', 'packaged', 'delivered',             // orders
];

const PURGE_DAYS = 30;
const SOCIAL_KEYS = ['website', 'instagram', 'facebook', 'tiktok', 'google', 'yelp', 'linkedin', 'x', 'youtube'];
const TLDS = ['com','net','org','co','io','us','de','biz','app','shop','site','store','me','tv','xyz','info'];
function normalizeSocial(key, raw) {
  let v = String(raw ?? '').trim().replace(/^[<"'\s]+|[>"'\s]+$/g, '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return 'https://' + v;
  const firstSeg = v.split('/')[0];
  const dot = firstSeg.lastIndexOf('.');
  const isDomain = dot >= 0 && TLDS.includes(firstSeg.slice(dot + 1).toLowerCase());
  if (v.includes('/') || isDomain) return 'https://' + v.replace(/^\/+/, '');
  const h = v.replace(/^@+/, '').replace(/^\/+/, '');
  const M = {
    website: 'https://' + h, instagram: `https://instagram.com/${h}`, facebook: `https://facebook.com/${h}`,
    tiktok: `https://tiktok.com/@${h}`, yelp: `https://yelp.com/biz/${h}`, linkedin: `https://linkedin.com/company/${h}`,
    x: `https://x.com/${h}`, youtube: /^uc[\w-]{20,}$/i.test(h) ? `https://youtube.com/channel/${h}` : `https://youtube.com/@${h}`,
    google: `https://www.google.com/maps/search/${encodeURIComponent(h)}`,
  };
  return M[key] || ('https://' + h);
}
function normalizeSocials(obj) {
  const out = {};
  if (obj && typeof obj === 'object') for (const k of SOCIAL_KEYS) { const u = normalizeSocial(k, obj[k]); if (u) out[k] = u; }
  return out;
}

const toIds = (v) => {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return arr.map(s => String(s).trim()).filter(Boolean).map(s => new ObjectId(s));
};

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('submissions');

  if (req.method === 'GET') {
    const { q, status, type, days, id, deleted } = req.query || {};

    // Lazy purge: anything soft-deleted more than PURGE_DAYS ago is gone for good.
    await col.deleteMany({ deleted: true, deletedAt: { $lt: new Date(Date.now() - PURGE_DAYS * 86400000) } });

    if (id) {
      const doc = await col.findOne({ _id: new ObjectId(String(id)) });
      return res.status(200).json({ submission: doc });
    }

    // Recently-deleted view
    if (deleted === '1') {
      const items = await col.find({ deleted: true }).sort({ deletedAt: -1 }).limit(200).toArray();
      return res.status(200).json({ items });
    }

    const alive = { deleted: { $ne: true } };
    const filter = { ...alive };
    if (status && status !== 'all') filter.status = String(status);
    if (type && type !== 'all') filter.type = String(type);
    if (days && Number(days) > 0) {
      filter.createdAt = { $gte: new Date(Date.now() - Number(days) * 86400000) };
    }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { business: rx }, { email: rx }];
    }

    const WEEKS = 8;
    const since = new Date(Date.now() - WEEKS * 7 * 86400000);
    const [items, counts, typeCounts, recentDates, unread, total, deletedCount] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).limit(300).toArray(),
      col.aggregate([{ $match: alive }, { $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
      col.aggregate([{ $match: alive }, { $group: { _id: '$type', n: { $sum: 1 } } }]).toArray(),
      col.find({ ...alive, createdAt: { $gte: since } }, { projection: { createdAt: 1, status: 1, type: 1 } }).toArray(),
      col.countDocuments({ ...alive, read: false }),
      col.countDocuments(alive),
      col.countDocuments({ deleted: true }),
    ]);

    // Bucket the last 8 weeks in JS (small dataset; avoids timezone edge cases).
    const weekMs = 7 * 86400000;
    const buckets = Array.from({ length: WEEKS }, () => ({ total: 0, landed: 0 }));
    for (const d of recentDates) {
      const idx = Math.min(WEEKS - 1, Math.floor((new Date(d.createdAt).getTime() - since.getTime()) / weekMs));
      if (idx < 0) continue;
      buckets[idx].total += 1;
      if (d.status === 'landed') buckets[idx].landed += 1;
    }

    return res.status(200).json({
      items,
      unread,
      total,
      deletedCount,
      counts: Object.fromEntries(counts.map(c => [c._id, c.n])),
      typeCounts: Object.fromEntries(typeCounts.map(c => [c._id, c.n])),
      series: buckets,
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};

    // Bulk restore from Recently deleted
    if (body.action === 'restore') {
      const ids = toIds(body.ids);
      if (!ids.length) return res.status(400).json({ error: 'ids required' });
      await col.updateMany({ _id: { $in: ids } }, { $set: { deleted: false }, $unset: { deletedAt: '' } });
      return res.status(200).json({ ok: true, restored: ids.length });
    }

    const { id, set } = body;
    if (!id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const allowed = {};
    if (STATUSES.includes(set.status)) allowed.status = set.status;
    if (typeof set.read === 'boolean') allowed.read = set.read;
    if (typeof set.notes === 'string') allowed.notes = set.notes.slice(0, 5000);
    if (set.socials && typeof set.socials === 'object') allowed.socials = normalizeSocials(set.socials);
    // Link a submission to a lead/client ('' unlinks). Additive field.
    if (typeof set.linkedLeadId === 'string') allowed.linkedLeadId = set.linkedLeadId.slice(0, 64);
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    await col.updateOne({ _id: new ObjectId(String(id)) }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  // Soft delete — single or bulk. ?ids=a,b,c (query) or {ids:[...]} (body).
  if (req.method === 'DELETE') {
    const ids = toIds(req.query?.ids || req.body?.ids);
    if (!ids.length) return res.status(400).json({ error: 'ids required' });
    await col.updateMany({ _id: { $in: ids } }, { $set: { deleted: true, deletedAt: new Date() } });
    return res.status(200).json({ ok: true, deleted: ids.length });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
