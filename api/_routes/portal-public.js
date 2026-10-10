import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getDb } from '../_lib/mongo.js';
import { route } from '../_lib/handler.js';
import { rateKey, rateState, rateHit, rateClear } from '../_lib/limit.js';
import { sessionSecret, meetingLink } from '../_lib/config.js';
import { portalCards, portalClient } from '../_lib/portalModules.js';

/* The client portal's public endpoint (client portal, prompt 1), served by
 * route from the existing public function: vercel.json rewrites /api/portal
 * to /api/showcase?r=portal and api/showcase.js hands the request here, the
 * ride the planner, the concepts and the review link take.
 *
 *   GET  /api/portal?token=xxx[&unlock=yyy]
 *        Exactly { client: { firstName, business, logoUrl, brandHex },
 *        cards: [...] }: the cards the registry resolves for this client
 *        (api/_lib/portalModules.js), each stripped to its module's fields.
 *        A sensitive card comes locked unless `unlock` verifies. Counts a
 *        view at most once an hour per token (rate:pview).
 *   POST /api/portal?token=xxx   { action: 'pin', pin }
 *        Checks the four digits against the stored hash, five tries per
 *        fifteen minutes per token (rate:ppin), and answers { unlock }, a
 *        signed token the device keeps for thirty days and sends back as
 *        ?unlock= on GET. A client without a PIN answers { unlock: '' }.
 *
 * The token is the whole credential: no token, a malformed one, an unknown
 * one, a regenerated one and a deleted record are the same 404 body. The
 * page never receives a raw record: only what portalCards and portalClient
 * hand over leaves this file. */

const HOUR = 60 * 60 * 1000;
const UNLOCK_DAYS = 30;
const PIN_TRIES = 5;
const PIN_WINDOW = 15 * 60 * 1000;
const notFound = (res) => res.status(404).json({ error: 'not found' });
const tokenStr = (v) => { const t = String(v ?? '').trim(); return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : ''; };
const PROJECTION = { business: 1, askFor: 1, 'showcase.displayName': 1, 'showcase.logoUrl': 1, 'showcase.brand.logo': 1, 'showcase.published': 1, 'showcase.slug': 1, 'brand.primary': 1, 'brand.colors': 1, portal: 1 };
const PROJECT_PROJECTION = { leadId: 1, name: 1, kind: 1, stage: 1, archived: 1, createdAt: 1 };
/* The PIN hash, the same salt and digest as api/_routes/call-leads.js hashPin. */
const hashPin = (pin) => createHash('sha256').update(`${sessionSecret()}:${pin}`).digest('base64url');
const hmac = (v) => createHmac('sha256', sessionSecret()).update(String(v)).digest('base64url');
/** An unlock token: the portal token and an expiry, signed; worthless after a regenerate because the token changes. */
const mintUnlock = (token) => { const exp = String(Date.now() + UNLOCK_DAYS * 86400000); return `${exp}.${hmac(`${token}:${exp}`)}`; };
const unlockOk = (token, v) => { const [exp, sig] = String(v || '').split('.'); if (!exp || !sig || !(Number(exp) > Date.now())) return false; const a = Buffer.from(sig); const b = Buffer.from(hmac(`${token}:${exp}`)); return a.length === b.length && timingSafeEqual(a, b); };

async function clientFor(db, token) {
  if (!token) return null;
  return db.collection('call_leads').findOne({ 'portal.token': token, deleted: { $ne: true } }, { projection: PROJECTION });
}

export async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = await getDb();
  const token = tokenStr(req.query?.token);
  const lead = await clientFor(db, token);
  if (!lead) return notFound(res);

  if (req.method === 'GET') {
    const [profile, projects] = await Promise.all([
      db.collection('settings').findOne({ _id: 'profile' }),
      db.collection('projects').find({ leadId: String(lead._id) }).project(PROJECT_PROJECTION).limit(50).toArray(),
    ]);
    const key = rateKey('pview', token);
    const st = await rateState(db, key, { max: 1, windowMs: HOUR });
    if (!st.exceeded) {
      await rateHit(db, key, st.hits);
      await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'portal.views': (Number(lead.portal?.views) || 0) + 1, 'portal.lastViewedAt': new Date().toISOString() } });
    }
    const unlocked = !lead.portal?.pin || unlockOk(token, req.query?.unlock);
    const settings = { profile: profile || {}, meetingLink: meetingLink() };
    return res.status(200).json({ client: portalClient(lead), cards: portalCards(lead, projects, settings, { unlocked }), pinned: !!lead.portal?.pin, unlocked });
  }

  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (b.action !== 'pin') return res.status(400).json({ error: 'unknown action' });
  if (!lead.portal?.pin) return res.status(200).json({ unlock: '' });
  const key = rateKey('ppin', token);
  const st = await rateState(db, key, { max: PIN_TRIES, windowMs: PIN_WINDOW });
  if (st.exceeded) { res.setHeader('Retry-After', String(st.retryAfter)); return res.status(429).json({ error: 'That is a few tries. Give it fifteen minutes.' }); }
  const pin = String(b.pin ?? '').trim();
  const a = Buffer.from(/^\d{4}$/.test(pin) ? hashPin(pin) : 'x'); const want = Buffer.from(lead.portal.pin);
  if (a.length !== want.length || !timingSafeEqual(a, want)) { await rateHit(db, key, st.hits); return res.status(401).json({ error: 'That PIN is not it.' }); }
  await rateClear(db, key);
  return res.status(200).json({ unlock: mintUnlock(token) });
}

export default route(handler, { methods: ['GET', 'POST'], admin: false, maxBody: 4 * 1024 });
