/* The review links checks (review links job), as one function over an api/ tree so
 * scripts/review-link-test.mjs runs them on the real source and
 * scripts/review-guard-proof.mjs runs them on a copy with one guard cut out.
 * Every check carries the guard it proves, or null for a plain assertion. */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[String(k).toLowerCase()] = v; }, end() { this.headersSent = true; } });
const LEAD = '507f1f77bcf86cd799439051';
const OTHER = '507f1f77bcf86cd799439052';
const PRIVATE = ['555-0199', 'owner@sharpless.example', 'internal only note', 'https://drive.example/private', LEAD];

export async function runReview(apiSrc = path.join(repoRoot, 'api')) {
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'review-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(apiSrc, apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-not-real'; delete process.env.VERCEL; delete process.env.VAPID_PRIVATE_KEY;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const showcase = (await load('showcase.js')).default;
  const adminIndex = (await load('admin/index.js')).default;
  const { signSession } = await load('_lib/auth.js');
  const rules = await load('_lib/reviewPublic.js');
  const taskRules = await load('_lib/taskRules.js');
  const results = [];
  const ok = (c, m, guard = null) => { results.push({ ok: !!c, msg: m, guard }); };
  const cookie = `vz_admin=${signSession()}`;
  const admin = async (body) => { const req = { method: 'PATCH', query: { r: 'call-leads' }, body, headers: { cookie, 'x-forwarded-for': '203.0.113.9' }, url: '/api/admin/index', socket: {} }; const res = fakeRes(); try { await adminIndex(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; } return res; };
  const pub = async (method, query = {}, body, headers = {}) => { const req = { method, query: { r: 'review', ...query }, body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, url: '/api/review', socket: {} }; const res = fakeRes(); try { await showcase(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; } return res; };
  const site = async (query = {}) => { const req = { method: 'GET', query, headers: {}, url: '/api/showcase', socket: {} }; const res = fakeRes(); try { await showcase(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; } return res; };
  const lead = () => _stores.call_leads.find(l => String(l._id) === LEAD);
  const seed = () => {
    _reset();
    _stores.call_leads = [
      { _id: LEAD, business: 'Sharpless Detailing', stage: 'client', askFor: 'Dan the owner', phone: '555-0199', email: 'owner@sharpless.example', notes: 'internal only note', links: { drive: 'https://drive.example/private' }, brand: { primary: '#1d4ed8', colors: ['#fff'] }, showcase: { published: true, slug: 'sharpless-detailing', displayName: 'Sharpless Detailing', logoUrl: 'https://img.example/sharpless.png' }, reviews: { nfcCard: false, nfcGivenAt: '', googleLink: '', baseline: null, latest: null, asks: [], testimonials: [] }, checklists: [] },
      { _id: OTHER, business: 'SS Guns and Ammo', stage: 'client', showcase: { published: false, slug: '' }, reviews: { testimonials: [] }, checklists: [] },
    ];
    _stores.projects = []; _stores.settings = [{ _id: 'profile', name: 'Rob', googleReviewUrl: 'https://g.page/r/visualize/review' }, { _id: 'landing', stats: { toggles: {}, overrides: { averageRating: 5 } } }];
  };
  const body = (p) => fs.readFileSync(path.join(p), 'utf8').split('export const REVIEW_PULL_MAX')[1];

  /* 1. the mirror */
  ok(body(path.join(repoRoot, 'src', 'lib', 'reviewPublic.js')) === body(path.join(apiSrc, '_lib', 'reviewPublic.js')), 'api/_lib/reviewPublic.js is src/lib/reviewPublic.js below REVIEW_PULL_MAX');
  ok(taskRules.CHECKLIST_TEMPLATES.some(t => t.id === 'delivery' && t.tasks.some(([text]) => text === 'Send review link')), 'the Delivery template carries Send review link', 'delivery-template');

  /* 2. the token: minted on the first ask, 24 characters, carried forward, regenerated on request, the old link dead */
  seed();
  let r = await admin({ id: LEAD, set: { reviews: { ...lead().reviews, visualize: {} } } });
  const t1 = lead().reviews?.visualize?.token;
  ok(r._status === 200 && typeof t1 === 'string' && t1.length === 24 && /^[A-Za-z0-9_-]+$/.test(t1), `Generate review link mints a 24 character URL safe token (${r._status}, ${t1})`, 'mint');
  ok(lead().reviews.visualize.views === 0 && lead().reviews.visualize.createdAt && lead().reviews.visualize.regeneratedAt === '', 'views start at 0, createdAt is stamped, regeneratedAt empty');
  r = await admin({ id: LEAD, set: { reviews: { ...lead().reviews, visualize: { token: 'attacker-chosen-token-123456', views: 99, lastViewedAt: '2020-01-01' }, asks: [] } } });
  ok(lead().reviews.visualize.token === t1 && lead().reviews.visualize.views === 0 && !lead().reviews.visualize.lastViewedAt, 'a later reviews write carries the token forward and never takes the token, views or lastViewedAt from the request', 'carry-forward');
  r = await admin({ id: LEAD, set: { reviews: { ...lead().reviews, visualize: { regenerate: true } } } });
  const t2 = lead().reviews.visualize.token;
  ok(t2 && t2 !== t1 && t2.length === 24 && lead().reviews.visualize.regeneratedAt, 'Regenerate mints a new token and stamps regeneratedAt', 'regenerate');
  let dead = await pub('GET', { token: t1 });
  let live = await pub('GET', { token: t2 });
  ok(dead._status === 404 && live._status === 200, `the old token is dead (${dead._status}) and the new one resolves (${live._status})`, 'token-dead');
  const none = await pub('GET', {}); const mal = await pub('GET', { token: 'short' }); const unknown = await pub('GET', { token: 'unknown_token_abcdefghijklmnop' });
  ok([none, mal, unknown, dead].every(x => `${x._status} ${JSON.stringify(x._json)}` === '404 {"error":"not found"}'), 'no token, a malformed one, an unknown one and a dead one are the same 404 bytes', 'token-required');

  /* 3. GET resolves exactly the whitelist */
  const keys = Object.keys(live._json || {}).sort().join(',');
  ok(keys === 'brandHex,business,firstName,googleReviewUrl,logoUrl', `GET answers exactly { business, firstName, logoUrl, brandHex, googleReviewUrl } (${keys})`, 'get-whitelist');
  ok(live._json.business === 'Sharpless Detailing' && live._json.firstName === 'Dan' && live._json.logoUrl === 'https://img.example/sharpless.png' && live._json.brandHex === '#1d4ed8' && live._json.googleReviewUrl === 'https://g.page/r/visualize/review', `the values are the business, the first name, the logo, the first brand colour and the studio link (${JSON.stringify(live._json)})`);
  const flat = JSON.stringify(live._json);
  ok(PRIVATE.every(v => !flat.includes(v)), 'no private value (phone, email, notes, drive link, the record id) leaks through GET', 'get-whitelist');
  ok(lead().reviews.visualize.views === 1 && lead().reviews.visualize.lastViewedAt, 'the first GET counts one view and stamps lastViewedAt', 'view-count');
  await pub('GET', { token: t2 }); await pub('GET', { token: t2 });
  ok(lead().reviews.visualize.views === 1, 'two more reads in the same hour do not count again (rate:rview)', 'view-debounce');

  /* 4. POST validates everything, stores pending, adds the task */
  const good = { name: 'Dan', role: 'Owner', business: 'Sharpless Detailing', rating: 5, text: 'Rob made the whole thing easy and the site looks sharp.', consent: true };
  const bad = async (over, why, guard) => { const res = await pub('POST', { token: t2 }, { ...good, ...over }); ok(res._status === 400 && lead().reviews.testimonials.length === 0, `${why} is refused with 400 and nothing is stored (${res._status})`, guard); };
  await bad({ rating: 6 }, 'rating 6', 'rating-range'); await bad({ rating: 0 }, 'rating 0', 'rating-range'); await bad({ rating: 4.5 }, 'rating 4.5', 'rating-range'); await bad({ rating: '5; drop' }, 'a rating that is not a number', 'rating-range');
  await bad({ text: 'Too short.' }, 'text under 20 characters', 'text-min');
  await bad({ consent: 'yes' }, 'consent as a string', 'consent-bool'); await bad({ consent: undefined }, 'consent missing', 'consent-bool');
  await bad({ name: '' }, 'an empty name', 'name-required');
  let trap = await pub('POST', { token: t2 }, { ...good, company: 'bot inc' });
  ok(trap._status === 200 && lead().reviews.testimonials.length === 0, 'the honeypot answers ok and stores nothing', 'honeypot');
  trap = await pub('POST', { token: t1 }, good);
  ok(trap._status === 404 && lead().reviews.testimonials.length === 0, 'a POST on the dead token is the same 404', 'token-dead');
  let post = await pub('POST', { token: t2 }, { ...good, text: `<script>alert(1)</script>${good.text}<b>bold</b>`, name: 'Dan<img src=x>' });
  const stored = lead().reviews.testimonials[0];
  ok(post._status === 200 && stored && stored.status === 'pending' && stored.consent === true && stored.rating === 5 && !/<|>/.test(stored.text + stored.name) && stored.text.includes('Rob made the whole thing easy') && stored.createdAt && stored.featured === false, `a good POST stores one pending, consented testimonial with the HTML stripped (${JSON.stringify(stored)})`, 'strip-html');
  const task = (lead().checklists || []).flatMap(l => l.items || []).find(it => /Review in from Sharpless Detailing, approve or hide/.test(it.text));
  ok(task && task.due && !task.done, 'a Next up task "Review in from <business>, approve or hide" is added, due today', 'task');
  const again = await pub('POST', { token: t2 }, good);
  ok(again._status === 429 && again._headers['retry-after'], `a second submission inside ten minutes is 429 with Retry-After (${again._status})`, 'rate-10');
  /* five a day: clear the ten minute window five times and watch the sixth */
  const tenKey = (await load('_lib/limit.js')).rateKey('rsub10', t2);
  let okCount = 1;
  for (let i = 0; i < 5; i++) { _stores.settings = _stores.settings.filter(d => d._id !== tenKey); const res = await pub('POST', { token: t2 }, { ...good, text: `${good.text} ${i}` }); if (res._status === 200) okCount++; }
  ok(okCount === 5 && lead().reviews.testimonials.length === 5, `five submissions a day are stored and the sixth is refused (${okCount} stored)`, 'rate-day');

  /* 5. approve needs consent; approving stamps approvedAt; hide and feature */
  seed();
  await admin({ id: LEAD, set: { reviews: { ...lead().reviews, visualize: {} } } });
  const tok = lead().reviews.visualize.token;
  await pub('POST', { token: tok }, { ...good, consent: false, text: 'Great work, but keep this between us please, thanks a lot.' });
  const noConsent = lead().reviews.testimonials[0];
  r = await admin({ id: LEAD, set: { reviews: { ...lead().reviews, testimonials: lead().reviews.testimonials.map(t => ({ ...t, status: 'approved', featured: true })) } } });
  ok(lead().reviews.testimonials[0]?.status === 'pending' && lead().reviews.testimonials[0]?.consent === false, 'a submission without consent cannot be approved: the write stores pending', 'consent-gate');
  ok(rules.canApprove(noConsent) === false && rules.isPublicTestimonial(lead().reviews.testimonials[0]) === false, 'the rule says the same: not approvable, not public');
  let s = await site({ slug: 'sharpless-detailing' });
  ok(s._status === 200 && s._json.testimonials.length === 0, 'the showcase shows nothing from it', 'public-only');
  _stores.settings = _stores.settings.filter(d => !String(d._id).startsWith('rate:'));
  await pub('POST', { token: tok }, { ...good, name: 'Maya', text: 'Fast, friendly and the logo is exactly what I wanted for the shop.' });
  const withConsent = lead().reviews.testimonials[1] || {};
  r = await admin({ id: LEAD, set: { reviews: { ...lead().reviews, testimonials: lead().reviews.testimonials.map(t => (t.id === withConsent.id ? { ...t, status: 'approved', featured: true, pullQuote: 'Exactly what I wanted for the shop.' } : t)) } } });
  const approved = lead().reviews.testimonials.find(t => t.id === withConsent?.id);
  ok(approved?.status === 'approved' && approved.approvedAt && approved.featured === true && approved.text === withConsent.text, 'with consent the approval sticks, approvedAt is stamped, the text is untouched', 'consent-gate');
  s = await site({ slug: 'sharpless-detailing' });
  const card = s._json?.testimonials?.[0] || {};
  ok(s._json.testimonials.length === 1 && card.quote === 'Exactly what I wanted for the shop.' && card.author === 'Maya' && card.rating === 5 && Object.keys(card).sort().join(',') === 'at,author,featured,id,quote,rating,role,source', `the showcase block shows the approved card with the pull quote and nothing private (${JSON.stringify(card)})`, 'public-only');
  s = await site();
  const land = s._json.landing.testimonials;
  ok(land.length === 1 && land[0].business === 'Sharpless Detailing' && land[0].slug === 'sharpless-detailing' && land[0].logo === 'https://img.example/sharpless.png' && land[0].brandHex === '#1d4ed8', `the landing carries the featured card with the business, the slug, the logo and the brand hex (${JSON.stringify(land[0])})`, 'featured-only');
  r = await admin({ id: LEAD, set: { reviews: { ...lead().reviews, testimonials: lead().reviews.testimonials.map(t => (t.id === withConsent.id ? { ...t, featured: false } : t)) } } });
  s = await site();
  ok(s._json.landing.testimonials.length === 0, 'unfeatured, the landing section has nothing to render', 'featured-only');
  r = await admin({ id: LEAD, set: { reviews: { ...lead().reviews, testimonials: lead().reviews.testimonials.map(t => (t.id === withConsent.id ? { ...t, status: 'hidden', featured: true } : t)) } } });
  s = await site({ slug: 'sharpless-detailing' }); let s2 = await site();
  ok(s._json.testimonials.length === 0 && s2._json.landing.testimonials.length === 0, 'hidden is out of the showcase block and the landing, featured or not', 'public-only');
  const unpub = await admin({ id: OTHER, set: { reviews: { testimonials: [{ id: 'u1', name: 'Pat', business: 'SS Guns and Ammo', rating: 4, text: 'Solid work on the brand and the stickers look great in person.', consent: true, status: 'approved', featured: true, createdAt: '2026-10-01T10:00:00Z' }] } } });
  s2 = await site();
  ok(unpub._status === 200 && s2._json.landing.testimonials.length === 1 && s2._json.landing.testimonials[0].slug === '' && s2._json.landing.testimonials[0].business === 'SS Guns and Ammo', 'a featured review from a client without a published showcase shows on the landing with no link', 'landing-unpublished');

  /* 6. the average rating: the override until three public ratings exist */
  seed();
  const mk = (i, rating, consent = true, status = 'approved') => ({ id: `t${i}`, name: `R${i}`, business: 'Sharpless Detailing', rating, text: 'A review long enough to count for the test here.', consent, status, featured: false, createdAt: `2026-10-0${i}T10:00:00Z` });
  await admin({ id: LEAD, set: { reviews: { ...lead().reviews, testimonials: [mk(1, 5), mk(2, 4)] } } });
  s = await site();
  ok(s._json.landing.stats.averageRating === 5, `two approved ratings keep the typed override (5) (got ${s._json.landing.stats.averageRating})`, 'min-ratings');
  ok(rules.averageRatingStat([mk(1, 5), mk(2, 4)], 5).source === 'override', 'the rule names the override as the source at two');
  await admin({ id: LEAD, set: { reviews: { ...lead().reviews, testimonials: [mk(1, 5), mk(2, 4), mk(3, 4), mk(4, 5, false), mk(5, 1, true, 'hidden')] } } });
  s = await site();
  ok(s._json.landing.stats.averageRating === 4.3, `three approved ratings make the stat real, to one decimal, the unconsented and the hidden left out (got ${s._json.landing.stats.averageRating})`, 'min-ratings');
  _stores.settings = _stores.settings.map(d => (d._id === 'landing' ? { ...d, stats: { toggles: { averageRating: false }, overrides: { averageRating: 5 } } } : d));
  s = await site();
  ok(!('averageRating' in s._json.landing.stats), 'the toggle off still hides the stat');

  fs.rmSync(tmp, { recursive: true, force: true });
  return results;
}
