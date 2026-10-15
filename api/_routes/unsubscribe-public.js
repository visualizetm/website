import { getDb } from '../_lib/mongo.js';
import { route } from '../_lib/handler.js';
import { rateKey, rateState, rateHit } from '../_lib/limit.js';

/* The opt out door (the email system, milestone 2), served by route from the
 * existing public function: vercel.json rewrites /api/unsubscribe to
 * /api/showcase?r=unsubscribe and api/showcase.js hands the request here,
 * the ride the planner, the concepts, the review link and the portal take.
 *
 *   GET  /api/unsubscribe?token=xxx          { business, firstName, optedOut }
 *   POST /api/unsubscribe?token=xxx          { action: 'out' | 'undo' } from the page at /u/<token>, or the one click
 *                                            form a mail client posts (List-Unsubscribe=One-Click), which opts out
 *
 * The token is the record's emailToken, minted on the first marketing send
 * and never accepted from a request. No token, a malformed one, an unknown
 * one and a deleted record are the same 404 body. Marketing sends read
 * emailOptOut and refuse; transactional emails never carry the header and
 * still send. Thirty actions an hour per token (rate:eopt). */
const notFound = (res) => res.status(404).json({ error: 'not found' });
const tokenStr = (v) => { const t = String(v ?? '').trim(); return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : ''; };
const MAX = 30; const WINDOW = 60 * 60 * 1000;

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = await getDb();
  const token = tokenStr(req.query?.token);
  const leads = db.collection('call_leads');
  const lead = token ? await leads.findOne({ emailToken: token, deleted: { $ne: true } }, { projection: { business: 1, askFor: 1, emailOptOut: 1 } }) : null;
  if (!lead) return notFound(res);
  const shape = (l) => ({ business: String(l.business || '').slice(0, 160), firstName: String(l.askFor || '').trim().split(/[\s,]+/)[0] || '', optedOut: !!l.emailOptOut });
  if (req.method === 'GET') return res.status(200).json(shape(lead));
  const key = rateKey('eopt', token);
  const limit = await rateState(db, key, { max: MAX, windowMs: WINDOW });
  if (limit.exceeded) { res.setHeader('Retry-After', String(limit.retryAfter)); return res.status(429).json({ error: 'Give it a little while and try again.' }); }
  await rateHit(db, key, limit.hits);
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  /* A mail client's one click POST is a form body carrying List-Unsubscribe=One-Click; the page sends { action }. */
  const oneClick = String(b['List-Unsubscribe'] || '').trim() === 'One-Click';
  const action = oneClick ? 'out' : (b.action === 'undo' ? 'undo' : b.action === 'out' ? 'out' : '');
  if (!action) return res.status(400).json({ error: 'action must be out or undo' });
  const out = action === 'out';
  await leads.updateOne({ _id: lead._id }, { $set: { emailOptOut: out, emailOptOutAt: out ? new Date().toISOString() : '', updatedAt: new Date() } });
  return res.status(200).json({ ok: true, optedOut: out });
}
export default route(handler, { methods: ['GET', 'POST'], admin: false, maxBody: 8 * 1024 });
