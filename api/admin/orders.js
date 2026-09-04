import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';
import { orderFromSubmission } from '../_lib/orders.js';
import { PRINT_ORDER_STATUS_IDS, ORDER_SOURCE_IDS } from '../_semantics.js';

/* Print orders (Prompt 11).
 *   GET   /api/admin/orders?status=<id>        { items, unimported }
 *         unimported = live shop-order submissions with no order (by submissionId)
 *   POST  { ...order }                          { ok, item }
 *   POST  { action: 'import-submissions' }      { ok, created }   backfill
 *   PATCH { id, set }                           $set only the keys sent
 * Every write goes through sanitize(); nothing is renamed or dropped. */

const str = (v, max = 400) => String(v ?? '').slice(0, max);
const num = (v, max = 1000000) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Number(v))) : 0);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };

function sanitize(b) {
  return {
    source: b.source !== undefined ? (ORDER_SOURCE_IDS.includes(b.source) ? b.source : 'walk-in') : undefined,
    status: b.status !== undefined ? (PRINT_ORDER_STATUS_IDS.includes(b.status) ? b.status : 'new') : undefined,
    leadId: b.leadId !== undefined ? str(b.leadId, 64) : undefined,
    projectId: b.projectId !== undefined ? str(b.projectId, 64) : undefined,
    submissionId: b.submissionId !== undefined ? str(b.submissionId, 64) : undefined,
    customer: b.customer && typeof b.customer === 'object' ? { name: str(b.customer.name, 200), email: str(b.customer.email, 200), phone: str(b.customer.phone, 60) } : undefined,
    items: Array.isArray(b.items)
      ? b.items.slice(0, 60).map(i => ({
          id: str(i?.id, 40), productId: str(i?.productId, 40), name: str(i?.name, 160), label: str(i?.label, 200),
          qty: Math.max(1, Math.min(100000, Math.round(num(i?.qty, 100000)) || 1)),
          options: i?.options && typeof i.options === 'object' ? Object.fromEntries(Object.entries(i.options).slice(0, 20).map(([k, v]) => [str(k, 40), str(v, 200)])) : {},
          artworkLink: str(i?.artworkLink, 400),
          priceTotal: i?.priceTotal === null || i?.priceTotal === undefined || i?.priceTotal === '' ? null : num(i.priceTotal),
          quote: !!i?.quote,
        })) : undefined,
    subtotal: b.subtotal !== undefined ? num(b.subtotal) : undefined,
    rush: b.rush !== undefined ? !!b.rush : undefined,
    dueAt: b.dueAt !== undefined ? str(b.dueAt, 10) : undefined,
    notes: b.notes !== undefined ? str(b.notes, 3000) : undefined,
    paid: b.paid && typeof b.paid === 'object' ? { at: str(b.paid.at, 40), ledgerId: str(b.paid.ledgerId, 40), amount: num(b.paid.amount) } : b.paid === null ? null : undefined,
    packaging: b.packaging && typeof b.packaging === 'object' ? { polyBag: !!b.packaging.polyBag, headerCard: !!b.packaging.headerCard, usageGuide: !!b.packaging.usageGuide } : undefined,
    importKey: b.importKey !== undefined ? str(b.importKey, 200) : undefined,
    archived: b.archived !== undefined ? !!b.archived : undefined,
  };
}
const compact = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

async function unimportedSubmissions(db, col) {
  const subs = await db.collection('submissions').find({ type: 'shop-order', deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(500).toArray();
  const have = new Set((await col.find({ submissionId: { $exists: true, $ne: '' } }, { projection: { submissionId: 1 } }).toArray()).map(o => o.submissionId));
  return subs.filter(s => !have.has(String(s._id)));
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('orders');

  if (req.method === 'GET') {
    const q = { archived: { $ne: true } };
    if (req.query?.status && PRINT_ORDER_STATUS_IDS.includes(req.query.status)) q.status = req.query.status;
    const [items, missing] = await Promise.all([col.find(q).sort({ createdAt: -1 }).limit(1000).toArray(), unimportedSubmissions(db, col)]);
    return res.status(200).json({ items, unimported: missing.length });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (b.action === 'import-submissions') {
      const missing = await unimportedSubmissions(db, col);
      const docs = missing.map(orderFromSubmission);
      if (docs.length) await col.insertMany(docs);
      return res.status(200).json({ ok: true, created: docs.length });
    }
    const doc = compact(sanitize(b));
    if (!doc.customer?.name && !doc.leadId) return res.status(400).json({ error: 'customer name or leadId required' });
    const now = new Date();
    const item = { source: 'walk-in', status: 'new', items: [], subtotal: 0, rush: false, notes: '', paid: null, ...doc, createdAt: now, updatedAt: now };
    const r = await col.insertOne(item);
    return res.status(200).json({ ok: true, item: { ...item, _id: r.insertedId } });
  }

  if (req.method === 'PATCH') {
    const { id, set } = req.body || {};
    const _id = oid(id);
    if (!_id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const clean = sanitize(set);
    const allowed = {};
    for (const key of Object.keys(clean)) if (key in set && clean[key] !== undefined) allowed[key] = clean[key];
    delete allowed.submissionId;
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    allowed.updatedAt = new Date();
    await col.updateOne({ _id }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
}
