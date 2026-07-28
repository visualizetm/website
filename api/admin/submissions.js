import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('submissions');

  if (req.method === 'GET') {
    const { q, status, type, days, id } = req.query || {};

    if (id) {
      const doc = await col.findOne({ _id: new ObjectId(String(id)) });
      return res.status(200).json({ submission: doc });
    }

    const filter = {};
    if (status && status !== 'all') filter.status = String(status);
    if (type && type !== 'all') filter.type = String(type);
    if (days && Number(days) > 0) {
      filter.createdAt = { $gte: new Date(Date.now() - Number(days) * 86400000) };
    }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { business: rx }, { email: rx }];
    }

    const [items, counts] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).limit(300).toArray(),
      col.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    ]);
    const unread = await col.countDocuments({ read: false });

    return res.status(200).json({
      items,
      unread,
      counts: Object.fromEntries(counts.map(c => [c._id, c.n])),
      total: await col.estimatedDocumentCount(),
    });
  }

  if (req.method === 'PATCH') {
    const { id, set } = req.body || {};
    if (!id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const allowed = {};
    if (['new', 'contacted', 'replied', 'landed', 'denied'].includes(set.status)) allowed.status = set.status;
    if (typeof set.read === 'boolean') allowed.read = set.read;
    if (typeof set.notes === 'string') allowed.notes = set.notes.slice(0, 5000);
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    await col.updateOne({ _id: new ObjectId(String(id)) }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
}
