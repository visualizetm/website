import { getDb } from '../_lib/mongo.js';
import { verifyStripeSignature, ingestEvent, ALL_TYPES } from '../_lib/stripe.js';
import { route } from '../_lib/handler.js';

/* POST /api/stripe/webhook (Prompt 12). Verifies STRIPE_WEBHOOK_SECRET against
 * the raw body, stores every handled event once (unique on id), matches a
 * client, appends to the ledger, and marks schedule items paid. A missing
 * secret answers 503 so Stripe retries later instead of dropping the event. */
export const config = { api: { bodyParser: false } };

const readRaw = (req) => new Promise((resolve, reject) => {
  if (typeof req.body === 'string') return resolve(req.body);
  if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
  const chunks = [];
  req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

async function handler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET is not set' });
  const raw = await readRaw(req);
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'], secret)) return res.status(400).json({ error: 'bad signature' });
  let ev;
  try { ev = JSON.parse(raw); } catch { return res.status(400).json({ error: 'bad json' }); }
  if (!ev?.id || !ev?.type) return res.status(400).json({ error: 'not an event' });
  if (!ALL_TYPES.includes(ev.type)) return res.status(200).json({ ok: true, ignored: ev.type });
  const db = await getDb();
  const { row, duplicate } = await ingestEvent(db, ev);
  await db.collection('settings').updateOne({ _id: 'health' }, { $set: { 'stripe.lastWebhookAt': new Date(), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return res.status(200).json({ ok: true, duplicate: !!duplicate, matched: !!row?.matchedLeadId });
}
export default route(handler, { methods: ['POST'], admin: false, csrf: false, maxBody: 1024 * 1024 });
