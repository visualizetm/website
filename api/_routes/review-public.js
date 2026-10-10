import { getDb } from '../_lib/mongo.js';
import { route } from '../_lib/handler.js';
import { rateKey, rateState, rateHit } from '../_lib/limit.js';
import { sendPush } from '../_lib/notify.js';
import { addTask } from '../_lib/taskRules.js';
import { zoneDayKey, zoneDateAt } from '../_lib/zone.js';

/* The Visualize review link's public endpoint (review links job), served
 * by route from the existing public function: vercel.json rewrites
 * /api/review to /api/showcase?r=review and api/showcase.js hands the
 * request here, the same ride the concepts page takes, so the function
 * count stays at ten.
 *
 *   GET  /api/review?token=xxx
 *        Exactly { business, firstName, logoUrl, brandHex, googleReviewUrl }:
 *        the name to greet, the client's own logo and first brand colour
 *        for the small panel, the studio's Google link for the thank you.
 *        Counts a view at most once an hour per token (rate:rview).
 *   POST /api/review?token=xxx   { name, role, business, rating, text, consent, company }
 *        Stores one pending testimonial on the client's record, pushes
 *        "New review from <business>" and adds a Next up task due today.
 *        company is the honeypot: anything in it answers ok and stores
 *        nothing. One submission per token per ten minutes and five a day
 *        (rate:rsub10, rate:rsubday), 429 past either.
 *
 * The token is the whole credential: no token, a malformed one, an unknown
 * one, a regenerated one and a deleted record are the same 404 body. The
 * record's id, contact details and everything else never leave this file;
 * the projection is the second half of the whitelist. */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const notFound = (res) => res.status(404).json({ error: 'not found' });
const tokenStr = (v) => { const t = String(v ?? '').trim(); return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : ''; };
const plain = (v, max) => String(v ?? '').replace(/<\/?[a-z!][^>]*>/gi, '').replace(/\s+/g, ' ').trim().slice(0, max);
const hexOf = (v) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v ?? '').trim()); return m ? `#${(m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]).toLowerCase()}` : ''; };
const brandHexOf = (lead) => { const b = lead?.brand || {}; for (const c of [b.primary, ...(Array.isArray(b.colors) ? b.colors : [])]) { const h = hexOf(c && typeof c === 'object' ? c.hex : c); if (h) return h; } return ''; };
const PROJECTION = { business: 1, askFor: 1, 'showcase.displayName': 1, 'showcase.logoUrl': 1, 'showcase.brand.logo': 1, 'brand.primary': 1, 'brand.colors': 1, 'reviews.visualize': 1, 'reviews.testimonials': 1, checklists: 1 };
const TEXT_MIN = 20;
const TEXT_MAX = 800;
const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

async function clientFor(db, token) {
  if (!token) return null;
  return db.collection('call_leads').findOne({ 'reviews.visualize.token': token, deleted: { $ne: true } }, { projection: PROJECTION });
}
/** Exactly what the page may know. */
async function publicClient(db, lead) {
  const profile = await db.collection('settings').findOne({ _id: 'profile' });
  const sh = lead.showcase || {};
  return {
    business: sh.displayName || lead.business || '',
    firstName: String(lead.askFor || '').trim().split(/[\s,]+/)[0] || '',
    logoUrl: sh.brand?.logo?.dark || sh.brand?.logo?.light || sh.logoUrl || '',
    brandHex: brandHexOf(lead),
    googleReviewUrl: typeof profile?.googleReviewUrl === 'string' ? profile.googleReviewUrl : '',
  };
}

export async function handler(req, res) {
  const db = await getDb();
  const token = tokenStr(req.query?.token);
  const lead = await clientFor(db, token);
  if (!lead) return notFound(res);

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    /* One view an hour per token: the first read in an hour counts, the rest of the hour's reloads do not. */
    const key = rateKey('rview', token);
    const st = await rateState(db, key, { max: 1, windowMs: HOUR });
    if (!st.exceeded) {
      await rateHit(db, key, st.hits);
      const v = lead.reviews?.visualize || {};
      await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'reviews.visualize.views': (Number(v.views) || 0) + 1, 'reviews.visualize.lastViewedAt': new Date().toISOString() } });
    }
    return res.status(200).json(await publicClient(db, lead));
  }

  const b = req.body && typeof req.body === 'object' ? req.body : {};
  // The honeypot: a person never sees the field; anything in it is a bot and the answer is a quiet ok.
  if (String(b.company || '').trim()) return res.status(200).json({ ok: true });
  const rating = Number(b.rating);
  const text = plain(b.text, TEXT_MAX);
  const name = plain(b.name, 120);
  const business = plain(b.business, 120) || String(lead.showcase?.displayName || lead.business || '').slice(0, 120);
  const role = plain(b.role, 120);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1 to 5' });
  if (text.length < TEXT_MIN) return res.status(400).json({ error: `say a little more, ${TEXT_MIN} characters at least` });
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (typeof b.consent !== 'boolean') return res.status(400).json({ error: 'consent must be true or false' });

  const k10 = rateKey('rsub10', token); const kDay = rateKey('rsubday', token);
  const [s10, sDay] = await Promise.all([rateState(db, k10, { max: 1, windowMs: 10 * 60 * 1000 }), rateState(db, kDay, { max: 5, windowMs: DAY })]);
  if (s10.exceeded || sDay.exceeded) { res.setHeader('Retry-After', String(Math.max(s10.retryAfter, sDay.retryAfter))); return res.status(429).json({ error: 'too many submissions' }); }
  await Promise.all([rateHit(db, k10, s10.hits), rateHit(db, kDay, sDay.hits)]);

  const now = new Date().toISOString();
  const entry = { id: uid(), name, role, business, rating, text, consent: b.consent, status: 'pending', featured: false, pullQuote: '', createdAt: now, approvedAt: '', source: 'website', published: false, quote: '', author: name, order: 0, at: now };
  const list = [...(Array.isArray(lead.reviews?.testimonials) ? lead.reviews.testimonials : []), entry].slice(-100);
  const due = zoneDateAt(zoneDayKey(Date.now()), 17, 0);
  const lists = addTask(Array.isArray(lead.checklists) ? lead.checklists : [], (lead.checklists || []).find(l => l.name === 'Reviews')?.id || '', { text: `Review in from ${business}, approve or hide`, due: new Date(due).toISOString(), source: 'manual', listName: 'Reviews' });
  await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'reviews.testimonials': list, checklists: lists, updatedAt: new Date() } });
  try {
    const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
    await sendPush(db, { title: `New review from ${business}`, body: `${rating} stars from ${name}. Approve or hide it on Reviews.`, url: `${base}/reviews?open=${String(lead._id)}` });
  } catch { /* the review is stored; a push failure must not undo that */ }
  return res.status(200).json({ ok: true });
}

export default route(handler, { methods: ['GET', 'POST'], admin: false, maxBody: 16 * 1024 });
