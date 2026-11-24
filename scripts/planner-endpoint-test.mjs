#!/usr/bin/env node
/* Node test for api/planner.js (Content Planner, prompt 1).
 *
 * The endpoint is a client facing door with a token for a lock, so what is
 * asserted here is mostly what it REFUSES: an unknown token, a switched off
 * planner, and somebody else's post all have to answer the same 404, and the
 * response body has to be the whitelist and nothing else, checked by key and
 * by value against a lead stuffed with private fields.
 *
 * No real MongoDB in this environment: copies api/ into a temp dir inside the
 * repo (so node_modules resolves) with _lib/mongo.js replaced by an in-memory
 * fake, then imports the real handlers unmodified.
 *   node scripts/planner-endpoint-test.mjs
 */
import { clientSignIn } from './client-signin.mjs';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'planner-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const THIS_MONTH = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
/* The preferred date of the idea under test is always ahead of the real clock (40 New York days out), so the check below does not rot as the calendar moves;
   the task is due 9:00 AM New York the day before, which is 13:00Z in daylight time and 14:00Z once it ends. */
const { zoneDayKey: __dayKey, zoneDateAt: __dateAt, keyAddDays: __addDays } = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'zone.js')).href);
const PREFERRED = __addDays(__dayKey(Date.now()), 40);
const PREFERRED_DUE = new Date(__dateAt(__addDays(PREFERRED, -1), 9, 0)).toISOString();
const ON_TOKEN = 'plnr_on_token_abcdefghijklmno';
const OFF_TOKEN = 'plnr_off_token_abcdefghijklmn';

/* ── Fixtures ─────────────────────────────────────────────────────────
 * Every private field the lead record can carry is present on purpose, so
 * the leak assertions have something to find. */
const PRIVATE_VALUES = ['555-0100', 'owner@kimscafe.example', 'Jamie the manager', 'internal only note', 'https://drive.example/secret'];
const enabledClient = {
  _id: '507f1f77bcf86cd799439031', business: 'Kims Cafe', industry: 'Coffee Shop',
  phone: '555-0100', email: 'owner@kimscafe.example', askFor: 'Jamie the manager',
  notes: 'internal only note', prepNotes: 'internal only note',
  stage: 'client', clientSince: '2026-01-01',
  links: { drive: 'https://drive.example/secret' },
  purchases: [{ label: 'Content Kit', amount: 400 }],
  callLog: [{ at: '2026-01-02T10:00:00Z', outcome: 'booked' }],
  reviews: { googleLink: 'https://g.page/r/kims/review', testimonials: [] },
  showcase: { published: true, slug: 'kims-cafe', displayName: 'Kims Cafe', brand: { logo: { dark: 'https://img.example/kims-logo.png', light: 'javascript:alert(1)' } } },
  planner: { enabled: true, token: ON_TOKEN, tokenCreatedAt: '2026-08-01T10:00:00Z', lastViewedAt: '', postsPerMonth: 12, welcome: 'Here is September.' },
  portal: { token: 'plnPORTALtoken0123456789abcdef' }, // the portal's back chip (prompt 3 fix): the door answers this lead's own path
};
const disabledClient = {
  _id: '507f1f77bcf86cd799439032', business: 'Switched Off Co',
  phone: '555-0200', email: 'owner@off.example',
  planner: { enabled: false, token: OFF_TOKEN, tokenCreatedAt: '2026-08-01T10:00:00Z', lastViewedAt: '', postsPerMonth: 8, welcome: '' },
};
const noPlannerClient = { _id: '507f1f77bcf86cd799439033', business: 'No Planner Co', phone: '555-0300' };

const posts = [
  { _id: '607f1f77bcf86cd799439001', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-24`, time: '09:00', platforms: ['instagram', 'facebook'], platform: 'instagram', format: 'portrait', hashtags: '#one #two', imageUrl: 'https://img.example/a.jpg', caption: 'Peach dumplings', status: 'review', note: 'Let me know', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false },
  // A story, and a record written before platforms/format existed.
  { _id: '607f1f77bcf86cd799439007', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-26`, time: '', platforms: ['instagram'], platform: 'instagram', format: 'story', hashtags: '', imageUrl: 'https://img.example/s.jpg', caption: '', status: 'approved', note: '', clientNote: '', clientNoteAt: '', approvedAt: '2026-09-01T10:00:00Z', postedAt: '', order: 0, archived: false },
  { _id: '607f1f77bcf86cd799439008', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-27`, time: '', platform: 'tiktok', imageUrl: 'https://img.example/l.jpg', caption: 'Legacy', status: 'posted', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false },
  { _id: '607f1f77bcf86cd799439002', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-02`, time: '17:30', platform: 'tiktok', imageUrl: '', caption: 'Behind the counter', status: 'approved', note: '', clientNote: '', clientNoteAt: '', approvedAt: '2026-09-01T10:00:00Z', postedAt: '', order: 0, archived: false },
  { _id: '607f1f77bcf86cd799439003', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-10`, time: '', platform: 'instagram', imageUrl: '', caption: '', status: 'making', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false },
  { _id: '607f1f77bcf86cd799439004', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-11`, time: '', platform: 'instagram', imageUrl: '', caption: 'Deleted one', status: 'review', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false, deleted: true },
  { _id: '607f1f77bcf86cd799439005', leadId: enabledClient._id, month: '2026-01', date: '2026-01-05', time: '', platform: 'instagram', imageUrl: '', caption: 'Another month', status: 'review', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false },
  /* An ad (the planner dashboard): the budget is hidden until Rob shows it, the results only once entered. And a planned video with no file. */
  { _id: '607f1f77bcf86cd799439009', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-12`, time: '', kind: 'ad', platforms: ['instagram', 'facebook'], platform: 'instagram', format: 'portrait', hashtags: '', imageUrl: 'https://img.example/ad.jpg', caption: 'Half off ceramic coating this month', status: 'live', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false, allowDownload: false,
    ad: { name: 'Coating offer', goal: 'offer', audience: 'People within 10 miles of Oxford, 25 to 55', placements: ['feed', 'reels'], buttonText: 'Book now', link: 'https://example.com/book', startDate: `${THIS_MONTH}-12`, endDate: `${THIS_MONTH}-26`, budget: 300, showBudget: false, results: { reach: 1240, clicks: 38, messages: '', spend: 120 } } },
  { _id: '607f1f77bcf86cd799439010', leadId: enabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-28`, time: '', kind: 'ad', platforms: ['instagram'], platform: 'instagram', format: 'video', hashtags: '', imageUrl: '', caption: '', status: 'review', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false,
    concept: 'A quick walk around a freshly coated truck', video: { url: '', durationSec: 15, poster: '' }, ad: { name: 'Truck walkaround', goal: 'calls', audience: 'Truck owners nearby', placements: ['reels'], buttonText: 'Call', link: '', startDate: '', endDate: '', budget: 150, showBudget: true, results: { reach: '', clicks: '', messages: '', spend: '' } } },
  // Somebody else's post, in review, with a real id: the cross client check.
  { _id: '607f1f77bcf86cd799439006', leadId: disabledClient._id, month: THIS_MONTH, date: `${THIS_MONTH}-15`, time: '', platform: 'instagram', imageUrl: '', caption: 'Not yours', status: 'review', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false },
];

/* ── The in-memory mongo fake ────────────────────────────────────────── */
function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, v]) => {
    const actual = getPath(doc, k);
    if (v && typeof v === 'object' && '$ne' in v) return String(actual) !== String(v.$ne);
    if (v && typeof v === 'object' && '$in' in v) return v.$in.some(x => String(x) === String(actual));
    return (k === '_id') ? String(actual) === String(v) : actual === v;
  });
}
function getPath(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, key, value) {
  const parts = key.split('.'); let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]]; }
  cur[parts[parts.length - 1]] = value;
}
/* global postsStore, settingsStore, leadsStore, suggestionsStore */ // defined in the fake module this function is serialized into
function collection(name) {
  const list = name === 'posts' ? postsStore : name === 'settings' ? settingsStore : name === 'suggestions' ? suggestionsStore : leadsStore;
  return {
    async findOne(filter) { return list.find(d => matches(d, filter)) || null; },
    find(filter) {
      let items = list.filter(d => matches(d, filter));
      const api = {
        sort(spec) {
          const keys = Object.keys(spec || {});
          items = [...items].sort((a, b) => {
            for (const k of keys) { const x = String(a[k] ?? ''); const y = String(b[k] ?? ''); if (x !== y) return (x < y ? -1 : 1) * (spec[k] < 0 ? -1 : 1); }
            return 0;
          });
          return api;
        },
        limit(n) { items = items.slice(0, n); return api; },
        async toArray() { return items; },
      };
      return api;
    },
    async updateOne(filter, update, opts) {
      let doc = list.find(d => matches(d, filter));
      if (!doc && opts?.upsert) { doc = { _id: filter._id }; list.push(doc); }
      if (!doc) return { matchedCount: 0 };
      if (update.$set) for (const [k, v] of Object.entries(update.$set)) setPath(doc, k, v);
      if (update.$push) for (const [k, v] of Object.entries(update.$push)) {
        const cur = Array.isArray(getPath(doc, k)) ? getPath(doc, k) : [];
        let next = [...cur, ...(v && v.$each ? v.$each : [v])];
        if (v && typeof v.$slice === 'number') next = v.$slice < 0 ? next.slice(v.$slice) : next.slice(0, v.$slice);
        setPath(doc, k, next);
      }
      return { matchedCount: 1 };
    },
    async insertOne(doc) { const d = { _id: doc._id || `${name}-${list.length + 1}-${Math.random().toString(36).slice(2, 10)}`, ...doc }; list.push(d); return { insertedId: d._id }; },
  };
}
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), `
const leadsStore = ${JSON.stringify([enabledClient, disabledClient, noPlannerClient])};
const postsStore = ${JSON.stringify(posts)};
const settingsStore = [];
const suggestionsStore = [{ _id: 'sg-theirs', leadId: '${disabledClient._id}', kind: 'post', subject: 'Not your idea', goal: 'other', details: 'private', status: 'new', note: 'rob private', createdAt: '2026-09-01T10:00:00.000Z' }];
${matches.toString()}
${getPath.toString()}
${setPath.toString()}
${collection.toString()}
export async function getDb() { return { collection }; }
export const _stores = { leadsStore, postsStore, settingsStore, suggestionsStore };
export const _pushes = [];
`);

fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), "import { _pushes } from './mongo.js';\nexport async function sendPush(db, p) { _pushes.push(p); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }\nexport async function sendClientPush() {}\n");
const plannerUrl = pathToFileURL(path.join(apiDst, 'planner.js')).href;
const { default: plannerHandler } = await import(plannerUrl);
const { handler: postsHandler } = await import(pathToFileURL(path.join(apiDst, '_routes', 'posts.js')).href);
const { _stores, _pushes } = await import(pathToFileURL(path.join(apiDst, '_lib', 'mongo.js')).href);
process.env.SESSION_SECRET = 'test-not-real';

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader(k, v) { this._headers[k] = v; } });
async function callPosts(method, body) {
  const res = fakeRes();
  await postsHandler({ method, query: {}, body, headers: {}, url: '/api/admin/posts', socket: {} }, res);
  return res;
}
/* The client app (client app job): the door reads the client from the vz_client cookie, so a call with a token signs that
 * client in first (scripts/client-signin.mjs, through the real code door) and sends the cookie; { bare: true } sends the
 * token alone, the way a link with no session would. */
const signIn = clientSignIn({ load: (rel) => import(pathToFileURL(path.join(apiDst, rel)).href), stores: { get call_leads() { return _stores.leadsStore; } } });
async function call(method, query = {}, body = undefined, { bare = false } = {}) {
  const cookie = !bare && typeof query.token === 'string' ? await signIn(query.token) : '';
  const req = { method, query, body, headers: cookie ? { cookie } : {}, url: '/api/planner', socket: {} };
  const res = fakeRes();
  await plannerHandler(req, res);
  return res;
}

/* ── GET: the whitelist ──────────────────────────────────────────────── */
{
  const res = await call('GET', { token: ON_TOKEN });
  ok(res._status === 200, `a live token and an enabled planner answer 200 (got ${res._status})`);
  const body = res._json || {};
  ok(Object.keys(body).sort().join(',') === 'back,client,month,posts,suggestions', `the response is exactly client, month, posts, suggestions, back (got ${Object.keys(body).sort().join(',')})`);
  ok(body.back === 'https://app.visualizeclients.com/' && !body.back.includes('plnPORTALtoken'), `back is the owning client's panel on the app host, no token, resolved here and never in the URL (${body.back})`);
  ok(Object.keys(body.client).sort().join(',') === 'alerts,displayName,firstName,logoUrl,postsPerMonth,welcome', `client is exactly displayName, welcome, postsPerMonth, logoUrl, firstName and alerts (got ${Object.keys(body.client).sort().join(',')})`);
  ok(JSON.stringify(body.client.alerts) === '{"review":true,"today":true,"ideas":true}', `alerts are all on by default, three booleans (got ${JSON.stringify(body.client.alerts)})`);
  ok(body.client.displayName === 'Kims Cafe' && body.client.postsPerMonth === 12 && body.client.welcome === 'Here is September.', 'client carries the showcase display name, the welcome, and postsPerMonth');
  ok(body.client.firstName === 'Jamie', `firstName is the first word of the contact, never the business (got ${JSON.stringify(body.client.firstName)})`);
  ok(body.client.logoUrl === 'https://img.example/kims-logo.png', `logoUrl is the showcase logo (got ${JSON.stringify(body.client.logoUrl)})`);
  ok(body.month === THIS_MONTH, `month defaults to the current one (got ${body.month})`);

  const WANT = ['id', 'kind', 'date', 'time', 'platforms', 'format', 'hashtags', 'imageUrl', 'caption', 'status', 'note', 'clientNote', 'allowDownload', 'video', 'ad', 'postedAt', 'postedBy', 'changeReason', 'previous'].sort().join(',');
  ok(body.posts.every(p => Object.keys(p).sort().join(',') === WANT), `every post is exactly the nineteen whitelisted keys (got ${Object.keys(body.posts[0] || {}).sort().join(',')})`);
  ok(body.posts.every(p => p.previous === null && p.postedBy === '' && p.changeReason === ''), 'a post with no versions reads previous null, and an empty postedBy and changeReason');
  ok(body.posts.length === 7, `only this month's live posts come back, deleted excluded (got ${body.posts.length})`);
  ok(body.posts.map(p => p.date).join(' ') === [`${THIS_MONTH}-02`, `${THIS_MONTH}-10`, `${THIS_MONTH}-12`, `${THIS_MONTH}-24`, `${THIS_MONTH}-26`, `${THIS_MONTH}-27`, `${THIS_MONTH}-28`].join(' '), 'posts are sorted by date');
  ok(!body.posts.some(p => p.caption === 'Deleted one'), 'a soft deleted post never reaches the client');
  ok(!body.posts.some(p => p.caption === 'Not yours'), "another client's post never reaches this client");

  /* The three shapes, read back. */
  const byId = Object.fromEntries(body.posts.map(p => [p.id, p]));
  const multi = byId['607f1f77bcf86cd799439001'];
  const story = byId['607f1f77bcf86cd799439007'];
  const legacy = byId['607f1f77bcf86cd799439008'];
  ok(Array.isArray(multi.platforms) && multi.platforms.join(',') === 'instagram,facebook', `platforms comes back as an array in order (got ${JSON.stringify(multi.platforms)})`);
  ok(multi.format === 'portrait' && multi.hashtags === '#one #two', 'a portrait post carries its format and its hashtags');
  ok(story.format === 'story' && story.caption === '' && story.hashtags === '', 'a story comes back with no caption and no hashtags, and says it is a story');
  ok(Array.isArray(legacy.platforms) && legacy.platforms.length === 1 && legacy.platforms[0] === 'tiktok',
    `a legacy single-platform post comes back as a one item array (got ${JSON.stringify(legacy.platforms)})`);
  ok(legacy.format === 'portrait', 'a record with no format reads as a portrait post');
  ok(legacy.hashtags === '', 'a record with no hashtags reads as an empty string, never undefined');
  ok(!JSON.stringify(body.posts).includes('"platform"'), 'the singular platform field is not in the public shape');
  /* The planner dashboard: kinds, ads, video, download. */
  const ad = byId['607f1f77bcf86cd799439009'];
  const vid = byId['607f1f77bcf86cd799439010'];
  ok(legacy.kind === 'post' && legacy.allowDownload === true && legacy.video === null && legacy.ad === null, 'a row written before kinds reads as a post, downloadable, with no video and no ad');
  ok(ad.kind === 'ad' && ad.status === 'live' && ad.allowDownload === false, 'an ad carries its kind, its ad status and the download switch');
  ok(ad.ad && Object.keys(ad.ad).sort().join(',') === 'audience,buttonText,endDate,goal,link,name,placements,results,startDate', `the ad shape is the public one, no budget while showBudget is off (got ${Object.keys(ad.ad || {}).sort().join(',')})`);
  ok(!JSON.stringify(ad).includes('300') && !JSON.stringify(ad).includes('"budget"') && !JSON.stringify(ad).includes('showBudget'), 'the hidden budget never leaks, not even as a number');
  ok(ad.ad.results.reach === 1240 && ad.ad.results.clicks === 38 && ad.ad.results.messages === 0 && ad.ad.results.spend === 120, 'entered results come through, an empty one reads as zero');
  ok(vid.format === 'video' && vid.video && vid.video.url === '' && vid.video.durationSec === 15 && vid.video.concept === 'A quick walk around a freshly coated truck', 'a planned video with no file carries its concept and length');
  ok(vid.ad.budget === 150 && !('results' in vid.ad), 'budget shows when Rob chose to show it; no results until any is entered');
  ok(Array.isArray(body.suggestions) && body.suggestions.length === 0, 'this client has no ideas yet, and sees none of anybody else\'s');
  ok(!JSON.stringify(body).includes('Not your idea') && !JSON.stringify(body).includes('rob private'), "another client's idea never reaches this client");

  const dump = JSON.stringify(body);
  for (const key of ['versions', 'decidedAt', 'reviewAt', 'approvedAt', 'clientNoteAt', 'seenAt', 'postId', 'details', 'phone', 'email', 'askFor', 'purchases', 'callLog', 'notes', 'prepNotes', 'links', 'reviews', 'token', 'planner', 'leadId', '_id', 'stage', 'clientSince']) {
    ok(!dump.includes(`"${key}"`), `private key "${key}" is nowhere in the response`);
  }
  for (const v of PRIVATE_VALUES) ok(!dump.includes(v), `private value "${v.slice(0, 28)}" never leaks`);
  ok(!dump.includes(ON_TOKEN) && !dump.includes(OFF_TOKEN), 'the token itself is never echoed back');
}

/* ── GET: months ─────────────────────────────────────────────────────── */
{
  const jan = await call('GET', { token: ON_TOKEN, month: '2026-01' });
  ok(jan._status === 200 && jan._json.posts.length === 1 && jan._json.month === '2026-01', 'an explicit month returns that month');
  const empty = await call('GET', { token: ON_TOKEN, month: '2030-07' });
  ok(empty._status === 200 && empty._json.posts.length === 0, 'a month with nothing in it is an empty array, not a 404');
  const junk = await call('GET', { token: ON_TOKEN, month: 'not-a-month' });
  ok(junk._status === 200 && junk._json.month === THIS_MONTH, 'a malformed month falls back to the current one');
}

/* ── The 401s and the 404: every wrong door looks identical ──────────── */
/* The client app: a request with no session is 401 { error: 'sign in' } whatever token it carries (none, unknown, shaped
 * wrong, empty, or a live one alone); a signed in client whose planner is switched off is the 404 it always was. */
{
  const cases = [
    ['no token at all', {}],
    ['an unknown token', { token: 'plnr_nope_nope_nope_nope_nope' }],
    ['a token shaped wrong', { token: '../../etc/passwd' }],
    ['an empty token', { token: '' }],
  ];
  const bodies = [];
  for (const [label, query] of cases) {
    const res = await call('GET', query);
    bodies.push(JSON.stringify(res._json));
    ok(res._status === 401 && res._json?.error === 'sign in', `${label} answers 401 { error: 'sign in' }`);
  }
  const disabled = await call('GET', { token: OFF_TOKEN });
  ok(disabled._status === 404 && disabled._json?.error === 'not found', "a signed in client whose planner is disabled answers 404 { error: 'not found' }");
  ok(new Set(bodies).size === 1, 'every 401 body is byte for byte identical, so a wrong token cannot detect a right one');
  const alone = await call('GET', { token: ON_TOKEN }, undefined, { bare: true });
  ok(alone._status === 401 && JSON.stringify(alone._json) === bodies[0], 'a live token with no session is the same 401 and reads nothing');
  const aloneWrite = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439001', action: 'approve' }, { bare: true });
  ok(aloneWrite._status === 401 && _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439001').status === 'review', 'a live token with no session cannot write either');
}

/* ── POST: approve ───────────────────────────────────────────────────── */
{
  const res = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439001', action: 'approve' });
  ok(res._status === 200 && res._json.status === 'approved', `approve moves review to approved (got ${res._status})`);
  const doc = _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439001');
  ok(doc.status === 'approved' && !!doc.approvedAt, 'approvedAt is stamped');

  const again = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439001', action: 'approve' });
  ok(again._status === 409, `approving something already approved is a 409 (got ${again._status})`);
  ok(typeof again._json.error === 'string' && again._json.error.length > 10, 'the 409 says something a person can read');

  const making = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439003', action: 'approve' });
  ok(making._status === 409, 'approving a post that is still being made is a 409');
}

/* ── POST: request a change ──────────────────────────────────────────── */
{
  const res = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'approve' });
  ok(res._status === 409, 'an already approved post cannot be approved twice');

  // Put one back into review to exercise the change path.
  _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002').status = 'review';
  const change = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'request-change', note: '  Can we use the other photo?  ' });
  ok(change._status === 200 && change._json.status === 'making', 'request-change moves review back to making');
  const doc = _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002');
  ok(doc.clientNote === 'Can we use the other photo?', `the note is trimmed and stored (got ${JSON.stringify(doc.clientNote)})`);
  ok(!!doc.clientNoteAt, 'clientNoteAt is stamped');

  _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002').status = 'review';
  const empty = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'request-change', note: '   ' });
  ok(empty._status === 400, 'a change request with no note is a 400, not a silent status change');

  _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002').status = 'review';
  const long = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'request-change', note: 'x'.repeat(900) });
  ok(long._status === 200 && _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002').clientNote.length === 500, 'a long note is capped at 500');
}

/* ── POST: the cross client check, and the writes that are not possible ─ */
{
  const other = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439006', action: 'approve' });
  ok(other._status === 404, "a valid token cannot touch another client's post (404, not 403)");
  ok(_stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439006').status === 'review', "the other client's post is untouched");

  const madeUp = await call('POST', { token: ON_TOKEN }, { postId: 'not-an-object-id', action: 'approve' });
  ok(madeUp._status === 404, 'a made up post id is the same 404');

  const disabled = await call('POST', { token: OFF_TOKEN }, { postId: '607f1f77bcf86cd799439006', action: 'approve' });
  ok(disabled._status === 404, 'a switched off planner cannot act either');

  _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002').status = 'review';
  const bogus = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'delete', caption: 'rewritten', date: '2030-01-01' });
  ok(bogus._status === 400, 'an unknown action is a 400');
  const untouched = _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002');
  ok(untouched.caption === 'Behind the counter' && untouched.date === `${THIS_MONTH}-02`, 'a caption or a date sent alongside an action is never written');
}

/* ── POST: suggest (the Ideas tab) ───────────────────────────────────── */
{
  const good = { action: 'suggest', kind: 'ad', subject: '  Half off coating in October  ', goal: 'offer', details: 'Ten percent off for the month, mention the free pickup', preferredDate: PREFERRED, link: 'https://example.com/offer', photos: ['https://res.cloudinary.com/testcloud/image/upload/v1/a.jpg', 'https://evil.example/x.jpg', 'http://res.cloudinary.com/testcloud/b.jpg'] };
  process.env.VITE_CLOUDINARY_CLOUD_NAME = '';
  const res = await call('POST', { token: ON_TOKEN }, good);
  ok(res._status === 200 && res._json.ok && res._json.suggestion && res._json.suggestion.status === 'new', `suggest writes an idea and answers it (got ${res._status} ${JSON.stringify(res._json).slice(0, 120)})`);
  const doc = _stores.suggestionsStore.find(s => s.leadId === enabledClient._id);
  ok(!!doc && doc.subject === 'Half off coating in October' && doc.kind === 'ad' && doc.goal === 'offer' && doc.preferredDate === PREFERRED && doc.link === 'https://example.com/offer', 'the idea is stored trimmed with its kind, goal, date and link');
  ok(doc.photos.length === 1 && doc.photos[0].startsWith('https://res.cloudinary.com/'), `only an https photo on res.cloudinary.com is kept (got ${JSON.stringify(doc.photos)})`);
  ok(Object.keys(res._json.suggestion).sort().join(',') === 'createdAt,goal,id,kind,made,note,seen,status,subject', `the public idea shape (got ${Object.keys(res._json.suggestion).sort().join(',')})`);
  ok(res._json.suggestion.seen === false && res._json.suggestion.made === false, 'a new idea is not seen and not made');
  ok(_pushes.length === 1 && /^New idea from Kims Cafe/.test(_pushes[0].title) && /Half off coating/.test(_pushes[0].body) && /\/planner\?ideas=1$/.test(_pushes[0].url), `Rob gets one push naming the client (got ${JSON.stringify(_pushes[0])})`);
  const leadDoc = _stores.leadsStore.find(l => l._id === enabledClient._id);
  const ideasList = (leadDoc.checklists || []).find(l => l.name === 'Ideas');
  ok(!!ideasList && ideasList.items.length === 1 && ideasList.items[0].text === 'New idea: Half off coating in October' && ideasList.items[0].source === 'suggestion' && ideasList.items[0].suggestionId === String(doc._id) && ideasList.items[0].due === PREFERRED_DUE, `the New idea task lands on the client's Ideas checklist, due the day before the preferred date (got ${JSON.stringify(ideasList?.items?.[0])})`);
  const mine = await call('GET', { token: ON_TOKEN });
  ok(mine._json.suggestions.length === 1 && mine._json.suggestions[0].subject === 'Half off coating in October' && mine._json.suggestions[0].note === '', 'the client reads their own idea back, with no note while it is new');
  ok(!JSON.stringify(mine._json.suggestions).includes('Ten percent'), 'the details are not echoed back (they are for Rob)');

  const quick = await call('POST', { token: ON_TOKEN }, { ...good, subject: 'Another one' });
  ok(quick._status === 429 && quick._headers['Retry-After'], `a second idea inside twenty seconds is a 429 (got ${quick._status})`);
  ok(_stores.suggestionsStore.filter(s => s.leadId === enabledClient._id).length === 1, 'the refused idea is not written');
  // Lift the gap, then: an empty subject, a bad enum, oversize fields, a javascript: link.
  const lift = () => { for (const s of _stores.settingsStore) if (/^rate:suggest-(gap|day)/.test(String(s._id))) s.hits = []; };
  lift();
  const empty = await call('POST', { token: ON_TOKEN }, { action: 'suggest', kind: 'post', subject: '   ' });
  ok(empty._status === 400, 'no subject is a 400');
  lift();
  const bad = await call('POST', { token: ON_TOKEN }, { action: 'suggest', kind: 'billboard', subject: 'x'.repeat(500), goal: 'world domination', details: 'y'.repeat(5000), preferredDate: 'next tuesday', link: 'javascript:alert(1)', photos: ['https://res.cloudinary.com/testcloud/1.jpg', 'https://res.cloudinary.com/testcloud/2.jpg', 'https://res.cloudinary.com/testcloud/3.jpg', 'https://res.cloudinary.com/testcloud/4.jpg'] });
  const badDoc = _stores.suggestionsStore.filter(s => s.leadId === enabledClient._id)[1];
  ok(bad._status === 200 && badDoc.kind === 'post' && badDoc.goal === 'other' && badDoc.subject.length === 120 && badDoc.details.length === 1000 && badDoc.preferredDate === '' && badDoc.link === '' && badDoc.photos.length === 3, `a bad enum reads as the default, every field is capped, a bad date is empty, a javascript: link is empty, photos stop at three (got ${JSON.stringify({ k: badDoc.kind, g: badDoc.goal, s: badDoc.subject.length, d: badDoc.details.length, p: badDoc.preferredDate, l: badDoc.link, n: badDoc.photos.length })})`);
  process.env.VITE_CLOUDINARY_CLOUD_NAME = 'mycloud';
  lift();
  await call('POST', { token: ON_TOKEN }, { action: 'suggest', kind: 'post', subject: 'cloud check', photos: ['https://res.cloudinary.com/testcloud/1.jpg', 'https://res.cloudinary.com/mycloud/2.jpg'] });
  const cloudDoc = _stores.suggestionsStore.filter(s => s.leadId === enabledClient._id)[2];
  ok(cloudDoc.photos.length === 1 && cloudDoc.photos[0].includes('/mycloud/'), 'with the cloud name known, only our own cloud is kept');
  process.env.VITE_CLOUDINARY_CLOUD_NAME = '';
  lift();
  for (const s of _stores.settingsStore) if (/^rate:suggest-day/.test(String(s._id))) s.hits = Array.from({ length: 15 }, () => Date.now() - 1000);
  const dayCap = await call('POST', { token: ON_TOKEN }, { action: 'suggest', kind: 'post', subject: 'one too many' });
  ok(dayCap._status === 429, 'the sixteenth idea in a day is a 429');
  const offIdea = await call('POST', { token: OFF_TOKEN }, { action: 'suggest', kind: 'post', subject: 'nope' });
  ok(offIdea._status === 404, 'a switched off planner cannot suggest');
  // The Client ideas toggle off: the idea is kept, nothing is pushed.
  _pushes.length = 0; lift();
  _stores.settingsStore.push({ _id: 'notifications', reminders: { ideas: false } });
  await call('POST', { token: ON_TOKEN }, { action: 'suggest', kind: 'post', subject: 'quiet one' });
  ok(_pushes.length === 0 && _stores.suggestionsStore.some(s => s.subject === 'quiet one'), 'with Client ideas off the idea is saved and nothing is pushed');
  _stores.settingsStore.splice(_stores.settingsStore.findIndex(s => s._id === 'notifications'), 1);
}

/* ── POST: approve an ad ─────────────────────────────────────────────── */
{
  const res = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439010', action: 'approve' });
  ok(res._status === 200 && _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439010').status === 'approved', 'an ad in review can be approved like a post');
}

/* ── The rate limit ──────────────────────────────────────────────────── */
{
  let last = null;
  for (let i = 0; i < 40; i++) {
    _stores.postsStore.find(p => p._id === '607f1f77bcf86cd799439002').status = 'review';
    last = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'approve' });
    if (last._status === 429) break;
  }
  ok(last._status === 429, `the token is cut off at 30 actions in an hour (got ${last._status})`);
  const stillReads = await call('GET', { token: ON_TOKEN });
  ok(stillReads._status === 200, 'the limit is on actions only: they can still read their planner');
}

/* ── Planner v2: posted, reasons, decidedAt, reviewAt, versions, seen and made ── */
{
  for (const s of _stores.settingsStore) if (/^rate:planner/.test(String(s._id))) s.hits = [];
  const P = (id) => _stores.postsStore.find(p => p._id === id);
  // posted on an approved post of kind post
  P('607f1f77bcf86cd799439007').status = 'approved';
  _pushes.length = 0;
  const posted = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439007', action: 'posted' });
  const d7 = P('607f1f77bcf86cd799439007');
  ok(posted._status === 200 && posted._json.status === 'posted' && d7.status === 'posted' && d7.postedBy === 'client' && !!d7.postedAt && !!d7.decidedAt, `posted moves an approved post to posted, stamps postedAt, postedBy client and decidedAt (got ${posted._status} ${JSON.stringify({ s: d7.status, b: d7.postedBy })})`);
  ok(_pushes.length === 1 && _pushes[0].category === 'client' && /^Kims Cafe posted the \w{3} 26 post$/.test(_pushes[0].title) && _pushes[0].url.endsWith(`/clients/${enabledClient._id}/planner`), `Rob gets one push, category client, naming the day and linking the planner (got ${JSON.stringify(_pushes[0])})`);
  ok(!JSON.stringify(_pushes).includes(d7.caption || 'Peach') , 'the push never carries the caption');
  const again = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439007', action: 'posted' });
  const reviewOne = (() => { P('607f1f77bcf86cd799439002').status = 'review'; return null; })();
  const onReview = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'posted' });
  P('607f1f77bcf86cd799439009').status = 'approved';
  const onAd = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439009', action: 'posted' });
  P('607f1f77bcf86cd799439006').status = 'approved';
  const theirs = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439006', action: 'posted' });
  const nf = JSON.stringify({ error: 'not found' });
  ok(again._status === 404 && JSON.stringify(again._json) === nf, 'posted twice is the same 404');
  ok(onReview._status === 404 && JSON.stringify(onReview._json) === nf && P('607f1f77bcf86cd799439002').status === 'review', 'posted on a post still in review is the same 404 and changes nothing');
  ok(onAd._status === 404 && JSON.stringify(onAd._json) === nf && P('607f1f77bcf86cd799439009').status === 'approved', 'posted on an ad is the same 404 and changes nothing');
  ok(theirs._status === 404 && JSON.stringify(theirs._json) === nf && P('607f1f77bcf86cd799439006').status === 'approved', "posted on another client's post is the same 404 and changes nothing");
  void reviewOne;

  // approve stamps decidedAt
  P('607f1f77bcf86cd799439001').status = 'review'; P('607f1f77bcf86cd799439001').decidedAt = '';
  await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439001', action: 'approve' });
  ok(!!P('607f1f77bcf86cd799439001').decidedAt, 'approve stamps decidedAt');

  // request-change with a reason, and with an unknown one
  P('607f1f77bcf86cd799439002').decidedAt = '';
  const why = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'request-change', note: 'A brighter photo please', reason: 'photo' });
  ok(why._status === 200 && P('607f1f77bcf86cd799439002').changeReason === 'photo' && P('607f1f77bcf86cd799439002').clientNote === 'A brighter photo please', 'request-change keeps the reason as changeReason next to clientNote');
  ok(!!P('607f1f77bcf86cd799439002').decidedAt, 'request-change stamps decidedAt');
  P('607f1f77bcf86cd799439002').status = 'review';
  const odd = await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'request-change', note: 'Different words', reason: 'make it pop' });
  ok(odd._status === 200 && P('607f1f77bcf86cd799439002').changeReason === '', `an unknown reason is dropped, not an error (got ${odd._status} ${JSON.stringify(P('607f1f77bcf86cd799439002').changeReason)})`);
  P('607f1f77bcf86cd799439002').status = 'review';
  await call('POST', { token: ON_TOKEN }, { postId: '607f1f77bcf86cd799439002', action: 'request-change', note: 'Use the latte photo', reason: 'words' });

  // Rob's side: reviewAt on a move into review, versions on a caption change after a change request
  const d2 = P('607f1f77bcf86cd799439002');
  const capBefore = d2.caption;
  const r1 = await callPosts('PATCH', { id: d2._id, set: { caption: 'Behind the counter, take two' } });
  ok(r1._status === 200 && Array.isArray(d2.versions) && d2.versions.length === 1 && d2.versions[0].caption === capBefore && d2.versions[0].note === 'Use the latte photo' && !!d2.versions[0].at, `a caption change after a change request pushes the old pair with the client's note (got ${JSON.stringify(d2.versions)})`);
  await callPosts('PATCH', { id: d2._id, set: { caption: 'Behind the counter, take two!' } });
  ok(d2.versions.length === 1, 'the autosave\'s next keystroke does not push a second copy for the same request');
  const read = await call('GET', { token: ON_TOKEN });
  const rp = read._json.posts.find(p => p.id === d2._id);
  ok(rp.previous && Object.keys(rp.previous).sort().join(',') === 'caption,imageUrl,note' && rp.previous.caption === capBefore && rp.previous.note === 'Use the latte photo', `the read carries previous as the newest version only, three keys (got ${JSON.stringify(rp.previous)})`);
  ok(rp.changeReason === 'words', 'the read carries the change reason');
  ok(!JSON.stringify(read._json).includes('"versions"') && !JSON.stringify(read._json).includes('"at"'), 'the versions list itself never leaves the server');
  d2.status = 'making'; d2.reviewAt = '';
  await callPosts('PATCH', { id: d2._id, set: { status: 'review' } });
  ok(!!d2.reviewAt, 'a PATCH that sets status review stamps reviewAt');
  const firstStamp = d2.reviewAt; d2.reviewAt = 'kept';
  await callPosts('PATCH', { id: d2._id, set: { status: 'review' } });
  ok(d2.reviewAt === 'kept' && !!firstStamp, 'saving a post already in review does not restamp it');
  // capped at five: six more change requests, each answered with a new picture
  for (let i = 0; i < 6; i++) {
    d2.clientNote = `note ${i}`; d2.clientNoteAt = new Date(Date.now() + (i + 1) * 1000).toISOString();
    await callPosts('PATCH', { id: d2._id, set: { imageUrl: `https://img.example/v${i}.jpg` } });
  }
  ok(d2.versions.length === 5 && d2.versions[4].note === 'note 5' && d2.versions[0].note === 'note 1', `versions are capped at the newest five (got ${d2.versions.length}: ${d2.versions.map(v => v.note).join(', ')})`);
  const r2 = await callPosts('PATCH', { id: d2._id, set: { versions: Array.from({ length: 9 }, (_, i) => ({ imageUrl: 'javascript:alert(1)', caption: 'c', note: 'n'.repeat(400), at: String(i), extra: 'x' })), postedBy: 'hacker', changeReason: 'nope', decidedAt: 'x', reviewAt: 'y' } });
  ok(r2._status === 200 && d2.versions.length === 5 && d2.versions.every(v => v.imageUrl === '' && v.note.length === 300 && Object.keys(v).sort().join(',') === 'at,caption,imageUrl,note'), 'a versions list sent whole is sanitized: five at most, links through safeUrl, notes capped at 300, no stray keys');
  ok(d2.postedBy === '' && d2.changeReason === '', 'postedBy and changeReason accept only their own words');
  const r3 = await callPosts('PATCH', { id: d2._id, set: { postedBy: 'rob' } });
  ok(r3._status === 200 && d2.postedBy === 'rob', 'postedBy rob is whitelisted');
  const made = await callPosts('POST', { leadId: enabledClient._id, month: THIS_MONTH, status: 'review' });
  ok(made._status === 200 && !!made._json.item.reviewAt, 'a post created straight into review is stamped reviewAt');

  // seen and made on an idea
  const idea = _stores.suggestionsStore.find(s => s.leadId === enabledClient._id);
  idea.seenAt = new Date().toISOString(); idea.postId = '607f1f77bcf86cd799439001'; idea.status = 'planned';
  const other = _stores.suggestionsStore.find(s => s.leadId === enabledClient._id && s !== idea);
  other.postId = '607f1f77bcf86cd799439006'; // another client's approved post: never counts
  const g = await call('GET', { token: ON_TOKEN });
  const gi = g._json.suggestions.find(s => s.id === String(idea._id));
  const go = g._json.suggestions.find(s => s.id === String(other._id));
  ok(gi.seen === true && gi.made === true, `an idea Rob opened reads seen, and made once its post is approved (got ${JSON.stringify(gi)})`);
  ok(go.seen === false && go.made === false, "an idea pointing at another client's post never reads made");
  P('607f1f77bcf86cd799439001').status = 'review';
  const g2 = await call('GET', { token: ON_TOKEN });
  ok(g2._json.suggestions.find(s => s.id === String(idea._id)).made === false, 'an idea whose post is back in review is not made');
  ok(g2._json.suggestions.every(s => Object.keys(s).sort().join(',') === 'createdAt,goal,id,kind,made,note,seen,status,subject'), 'every idea is exactly the nine whitelisted keys');
}

/* ── lastViewedAt ────────────────────────────────────────────────────── */
{
  const lead = _stores.leadsStore.find(l => l._id === enabledClient._id);
  ok(!!lead.planner.lastViewedAt, 'the first view stamps planner.lastViewedAt');
  const stamped = lead.planner.lastViewedAt;
  await call('GET', { token: ON_TOKEN });
  ok(lead.planner.lastViewedAt === stamped, 'a refresh inside the hour does not write again');
  lead.planner.lastViewedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await call('GET', { token: ON_TOKEN });
  ok(lead.planner.lastViewedAt !== stamped && Date.now() - Date.parse(lead.planner.lastViewedAt) < 5000, 'a view an hour later stamps again');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing.` : '\nAll planner endpoint tests pass.');
process.exit(fails ? 1 : 0);
