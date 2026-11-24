import { getDb } from '../_lib/mongo.js';
import { route, clientIp } from '../_lib/handler.js';
import { rateKey, rateState, rateHit } from '../_lib/limit.js';
import { sendPush } from '../_lib/notify.js';
import { codeShape, isWeakCode, identifierOf, phoneKey, emailKey } from '../_lib/clientCode.js';
import { signClient, clientCookie, verifyClient, sessionLead, hashCode, codeMatches, SOFT_LOCK_AT, SOFT_LOCK_MS, HARD_LOCK_AT } from '../_lib/clientSession.js';

/* The client app's code door (client app job), served by route from the public function: vercel.json rewrites
 * /api/app/:action to /api/showcase?r=app&a=:action, the ride the portal and the concepts take.
 *
 *   GET  /api/app/me                 { signedIn, portal, planner, firstName } for this device's vz_client cookie, else { signedIn: false }
 *   GET  /api/app/token?token=x      { step: 'set' | 'signin', lock: { hard, minutes } | null } for a portal or planner setup link; an unknown,
 *                                    malformed or switched off token is the same 404. Nothing about the client is in it.
 *   POST /api/app/set     { token, code, again }   the first code for that client: four digits twice, never a weak one
 *                                    (api/_lib/clientCode.js); a client who has one is 409. Signs this device in.
 *   POST /api/app/signin  { token, code } or { identifier, code }   a phone (last ten digits) or an email among the leads
 *                                    with a link and a code; no match, two matches and a wrong code are one answer,
 *                                    401 { error: 'did not match' }, after the same scrypt. Five wrong in a row lock the
 *                                    code fifteen minutes, ten lock it until Rob resets it (and push Rob once). The lock is
 *                                    told (423) only to the holder of the link or of the right code.
 *   POST /api/app/signout             clears the cookie on this device.
 *
 * Twenty tries an hour per IP on set and on signin (rate:appset, rate:appsign), so nobody sprays codes across phones.
 * No response carries any part of portal.code. */

const HOUR = 60 * 60 * 1000;
const TRIES_PER_HOUR = 20;
const tokenStr = (v) => { const t = String(v ?? '').trim(); return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : ''; };
const PROJECTION = { business: 1, askFor: 1, phone: 1, email: 1, 'showcase.displayName': 1, 'portal.token': 1, 'portal.code': 1, 'planner.token': 1, 'planner.enabled': 1 };
/* The phone and email lookup reads whole top level fields, so the shape is the same under every driver. */
const LOOKUP_PROJECTION = { business: 1, askFor: 1, phone: 1, email: 1, showcase: 1, portal: 1, planner: 1 };
const notFound = (res) => res.status(404).json({ error: 'not found' });
const noMatch = (res) => res.status(401).json({ error: 'did not match' });
const hasPortal = (lead) => !!tokenStr(lead?.portal?.token);
const hasPlanner = (lead) => !!(lead?.planner?.enabled && tokenStr(lead?.planner?.token));
const homeOf = (lead) => (hasPortal(lead) ? 'portal' : 'planner');
const firstNameOf = (lead) => String(lead?.askFor || '').trim().split(/\s+/)[0].slice(0, 40);
const minutesLeft = (until, now) => Math.max(1, Math.ceil((until - now) / 60000));

/** The lead behind a setup link: a portal token, or a planner token whose planner is on. */
async function tokenLead(db, token) {
  if (!token) return null;
  const col = db.collection('call_leads');
  const byPortal = await col.findOne({ 'portal.token': token, deleted: { $ne: true } }, { projection: PROJECTION });
  if (byPortal) return byPortal;
  const byPlanner = await col.findOne({ 'planner.token': token, deleted: { $ne: true } }, { projection: PROJECTION });
  return byPlanner && hasPlanner(byPlanner) ? byPlanner : null;
}
/** The one lead a phone or an email names, among the leads that have a link and a code; none or two is null. */
async function identifierLead(db, raw) {
  const id = identifierOf(raw);
  if (!id) return null;
  const rows = await db.collection('call_leads').find({ deleted: { $ne: true }, 'portal.code.hash': { $exists: true } }).project(LOOKUP_PROJECTION).limit(5000).toArray();
  const hits = rows.filter(l => l?.portal?.code?.hash && (hasPortal(l) || hasPlanner(l)) && (id.kind === 'phone' ? phoneKey(l.phone) === id.key : emailKey(l.email) === id.key));
  return hits.length === 1 ? hits[0] : null;
}
function lockOf(code, now) {
  if (code?.locked) return { hard: true, minutes: 0 };
  const until = Date.parse(code?.lockedUntil || '') || 0;
  return until > now ? { hard: false, minutes: minutesLeft(until, now) } : null;
}
const lockedAnswer = (res, lock) => res.status(423).json({ error: 'locked', hard: lock.hard, minutes: lock.minutes });
function signIn(res, lead, version) {
  res.setHeader('Set-Cookie', clientCookie(signClient(String(lead._id), version)));
  return res.status(200).json({ ok: true, home: homeOf(lead), portal: hasPortal(lead), planner: hasPlanner(lead) });
}
async function limited(db, req, res, scope) {
  const key = rateKey(scope, clientIp(req));
  const st = await rateState(db, key, { max: TRIES_PER_HOUR, windowMs: HOUR });
  if (st.exceeded) { res.setHeader('Retry-After', String(st.retryAfter)); res.status(429).json({ error: 'That is a lot of tries. Give it an hour.' }); return true; }
  await rateHit(db, key, st.hits);
  return false;
}

export async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = String(req.query?.a || '');
  const db = await getDb();

  if (req.method === 'GET') {
    if (a === 'me') {
      const lead = verifyClient(req) ? await sessionLead(db, req, PROJECTION) : null;
      if (!lead) return res.status(200).json({ signedIn: false });
      return res.status(200).json({ signedIn: true, portal: hasPortal(lead), planner: hasPlanner(lead), home: homeOf(lead), firstName: firstNameOf(lead) });
    }
    if (a === 'token') {
      const lead = await tokenLead(db, tokenStr(req.query?.token));
      if (!lead) return notFound(res);
      const code = lead.portal?.code;
      const lock = code?.hash ? lockOf(code, Date.now()) : null;
      return res.status(200).json({ step: code?.hash ? 'signin' : 'set', lock: lock ? { hard: lock.hard, minutes: lock.minutes } : null });
    }
    return notFound(res);
  }

  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (a === 'signout') {
    res.setHeader('Set-Cookie', clientCookie('', 0));
    return res.status(200).json({ ok: true });
  }

  if (a === 'set') {
    if (await limited(db, req, res, 'appset')) return undefined;
    const lead = await tokenLead(db, tokenStr(b.token));
    if (!lead) return notFound(res);
    if (lead.portal?.code?.hash) return res.status(409).json({ error: 'already set' });
    const code = codeShape(b.code);
    if (!code) return res.status(400).json({ error: 'four digits' });
    if (String(b.again ?? '') !== code) return res.status(400).json({ error: 'mismatch' });
    if (isWeakCode(code)) return res.status(400).json({ error: 'weak' });
    const version = (Math.round(Number(lead.portal?.code?.version)) || 0) + 1;
    const { hash, salt } = hashCode(code);
    await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'portal.code': { hash, salt, setAt: new Date().toISOString(), version, fails: 0, lockedUntil: '', locked: false }, updatedAt: new Date() } });
    return signIn(res, lead, version);
  }

  if (a === 'signin') {
    if (await limited(db, req, res, 'appsign')) return undefined;
    const viaToken = !!tokenStr(b.token);
    const lead = viaToken ? await tokenLead(db, tokenStr(b.token)) : await identifierLead(db, b.identifier);
    const given = codeShape(b.code);
    const code = lead?.portal?.code;
    const right = codeMatches(code, given || 'none'); // one scrypt whether or not there is a lead
    if (!lead || !code?.hash) return noMatch(res);
    const now = Date.now();
    const lock = lockOf(code, now);
    if (lock) return viaToken || right ? lockedAnswer(res, lock) : noMatch(res); // a try during a lock is not counted
    const col = db.collection('call_leads');
    if (right) {
      await col.updateOne({ _id: lead._id }, { $set: { 'portal.code.fails': 0, 'portal.code.lockedUntil': '', 'portal.code.lastSignInAt': new Date(now).toISOString() } });
      return signIn(res, lead, code.version);
    }
    await col.updateOne({ _id: lead._id }, { $inc: { 'portal.code.fails': 1 } });
    const after = await col.findOne({ _id: lead._id }, { projection: { 'portal.code.fails': 1 } });
    const fails = Math.round(Number(after?.portal?.code?.fails)) || 0;
    let started = null;
    if (fails >= HARD_LOCK_AT) {
      await col.updateOne({ _id: lead._id }, { $set: { 'portal.code.locked': true, 'portal.code.lockedUntil': '' } });
      started = { hard: true, minutes: 0 };
      if (fails === HARD_LOCK_AT) {
        try {
          const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
          const name = String(lead.showcase?.displayName || lead.business || 'A client').slice(0, 120);
          await sendPush(db, { title: `${name}: their code is locked`, body: '10 wrong tries in a row. Reset the code from their record when they ask.', url: `${base}/clients/${encodeURIComponent(String(lead._id))}`, category: 'client', tag: `client-code-locked-${String(lead._id)}` });
        } catch { /* the lock holds; the push is a convenience */ }
      }
    } else if (fails % SOFT_LOCK_AT === 0) {
      await col.updateOne({ _id: lead._id }, { $set: { 'portal.code.lockedUntil': new Date(now + SOFT_LOCK_MS).toISOString() } });
      started = { hard: false, minutes: Math.round(SOFT_LOCK_MS / 60000) };
    }
    return viaToken && started ? lockedAnswer(res, started) : noMatch(res);
  }

  return notFound(res);
}

export default route(handler, { methods: ['GET', 'POST'], admin: false, maxBody: 2 * 1024 });
