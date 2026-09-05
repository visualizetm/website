import { ObjectId } from 'mongodb';
import { getDb } from '../../_lib/mongo.js';
import { applyPayment } from '../../_lib/stripe.js';
import { route } from '../../_lib/handler.js';

/* POST /api/admin/stripe/reconcile { eventId, leadId }: link an unmatched
 * stripe_events row to a client and run the same ledger append the webhook does. */
async function handler(req, res) {
  const { eventId, leadId } = req.body || {};
  let _id; try { _id = new ObjectId(String(leadId)); } catch { return res.status(400).json({ error: 'leadId required' }); }
  const db = await getDb();
  const row = await db.collection('stripe_events').findOne({ id: String(eventId || '') });
  if (!row) return res.status(404).json({ error: 'event not found' });
  const lead = await db.collection('call_leads').findOne({ _id });
  if (!lead) return res.status(404).json({ error: 'lead not found' });
  const r = await applyPayment(db, row, lead);
  await db.collection('stripe_events').updateOne({ id: row.id }, { $set: { matchedLeadId: String(lead._id), ledgerId: r.ledgerId, reconciledAt: new Date() } });
  return res.status(200).json({ ok: true, ledgerId: r.ledgerId, already: !!r.already });
}
export default route(handler, { methods: ['POST'], maxBody: 4 * 1024 });
