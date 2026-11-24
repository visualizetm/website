#!/usr/bin/env node
/* Planner v2, part 3: the client's alerts, against the real handlers on the shared in-memory Mongo (scripts/fake-mongo.js).
 *
 *   3.1  the planner's push_on and push_off reuse the portal's toggle (api/_lib/clientDevices.js): role client, this client's id,
 *        one row per endpoint, ten a day per token under the planner's own key, the device count on planner.pushDevices; a device
 *        turned on in the portal is the same row. The alerts action takes three booleans and nothing else; the read carries them;
 *        an admin save of the planner never takes alerts, pushSeen or the push stamps from a request.
 *
 *   node scripts/planner-alerts-test.mjs
 */
import { clientSignIn } from './client-signin.mjs';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'alerts-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(process.env.API_SRC || path.join(repoRoot, 'api'), apiDst, { recursive: true }); // API_SRC: a cut copy, for scripts/planner-alerts-guard-proof.mjs
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
/* Every push is recorded, never sent: Rob's through sendPush, a client's through sendClientPush. */
fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), `export const _sent = { rob: [], client: [] };
export async function sendPush(db, m, o) { _sent.rob.push({ ...m, now: o?.now }); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }
export async function sendClientPush(db, leadId, m) { _sent.client.push({ leadId: String(leadId), ...m }); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }
export const ownerSubs = (db) => db.collection('push_subscriptions').find({ role: { $ne: 'client' } }).toArray();
export const clientSubs = (db, leadId) => db.collection('push_subscriptions').find({ role: 'client', leadId: String(leadId) }).toArray();
`);

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log('ok   ' + m); } else { fails++; console.log('FAIL ' + m); } };
process.env.SESSION_SECRET = 'test-secret-not-real';
delete process.env.VERCEL;

const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const planner = (await load('planner.js')).default;
const portal = (await load('_routes/portal-public.js'));
const callLeads = (await load('_routes/call-leads.js')).handler;

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { return this; } });
/* The client app (client app job): the planner's and the portal's doors read the client from the vz_client cookie, so a call
 * with a token signs that client in first (scripts/client-signin.mjs, through the real code door) and sends the cookie. */
const signIn = clientSignIn({ load, stores: _stores });
async function call(fn, method, { query = {}, body, bare = false } = {}) {
  const res = fakeRes();
  const cookie = !bare && (fn === planner || fn === portal.handler || fn === portal.default) && typeof query.token === 'string' ? await signIn(query.token) : '';
  try { await fn({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.9', ...(cookie ? { cookie } : {}) }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.stack || e) }; }
  return res;
}
const TOKEN = 'plnr_alerts_token_abcdefghijk';
const PORTAL = 'prtl_alerts_token_abcdefghijk';
const LEAD = '507f1f77bcf86cd799439041', OTHER = '507f1f77bcf86cd799439042';
const sub = (n) => ({ endpoint: `https://push.example/device-${n}-abcdefghij`, expirationTime: null, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } });
function seed() {
  _reset();
  _stores.call_leads = [
    { _id: LEAD, business: 'Kims Cafe', askFor: 'Kim Lee', stage: 'client', clientSince: '2026-01-01T00:00:00Z', callStatus: 'booked', showcase: { displayName: 'Kims Cafe' },
      planner: { enabled: true, token: TOKEN, tokenCreatedAt: '2026-08-01T10:00:00Z', lastViewedAt: '', postsPerMonth: 8, welcome: 'Hi' }, portal: { token: PORTAL } },
    { _id: OTHER, business: 'Other Co', stage: 'client', planner: { enabled: true, token: 'plnr_other_token_abcdefghijkl', postsPerMonth: 8 } },
  ];
  _stores.posts = [];
  _stores.suggestions = [];
  _stores.push_subscriptions = [];
  _stores.settings = [];
}
const P = (body) => call(planner, 'POST', { query: { token: TOKEN }, body });
const lead = () => _stores.call_leads.find(l => String(l._id) === LEAD);

/* ── 3.1: the device toggle from the planner ── */
seed();
{
  const on = await P({ action: 'push_on', subscription: sub(1) });
  const rows = _stores.push_subscriptions;
  ok(on._status === 200 && on._json.on === true && on._json.devices === 1, `push_on answers on with one device (got ${on._status} ${JSON.stringify(on._json)})`);
  ok(rows.length === 1 && rows[0].role === 'client' && rows[0].leadId === LEAD && rows[0].subscription.endpoint === sub(1).endpoint, 'the device is saved with role client and this client\'s id');
  ok(lead().planner.pushDevices === 1 && !!lead().planner.pushAt, 'the record counts the device on planner.pushDevices and stamps pushAt');
  const again = await P({ action: 'push_on', subscription: sub(1) });
  ok(again._json.devices === 1 && _stores.push_subscriptions.length === 1, 'the same device twice is one row');
  /* A device the client turned on in the portal is the same collection and the same row. */
  const fromPortal = await call(portal.handler || portal.default, 'POST', { query: { token: PORTAL }, body: { action: 'push_on', subscription: sub(2) } });
  ok(fromPortal._status === 200 && _stores.push_subscriptions.filter(r => r.leadId === LEAD).length === 2, `a device turned on in the portal is one more of the same client's rows (got ${fromPortal._status} ${JSON.stringify(fromPortal._json).slice(0, 100)})`);
  const limitKeys = _stores.settings.map(s => String(s._id)).filter(k => k.startsWith('rate:'));
  ok(limitKeys.some(k => k.startsWith('rate:plpsh:')) && limitKeys.some(k => k.startsWith('rate:ppsh:')), `the planner counts under its own key, the portal under its (got ${limitKeys.join(', ')})`);
  ok(!limitKeys.some(k => k.includes(TOKEN)), 'the token itself is never a limiter key');
  const bad = await P({ action: 'push_on', subscription: { endpoint: 'http://not-https.example/x', keys: { p256dh: 'a', auth: 'b' } } });
  const noKeys = await P({ action: 'push_on', subscription: { endpoint: sub(3).endpoint } });
  ok(bad._status === 400 && noKeys._status === 400, 'an endpoint that is not https, or no keys, is a 400');
  /* Another client cannot switch this client's device off. */
  const theirs = await call(planner, 'POST', { query: { token: 'plnr_other_token_abcdefghijkl' }, body: { action: 'push_off', endpoint: sub(1).endpoint } });
  ok(theirs._status === 200 && _stores.push_subscriptions.some(r => r.subscription.endpoint === sub(1).endpoint), 'another client\'s push_off leaves this client\'s device alone');
  const off = await P({ action: 'push_off', endpoint: sub(1).endpoint });
  ok(off._status === 200 && off._json.on === false && off._json.devices === 1 && !_stores.push_subscriptions.some(r => r.subscription.endpoint === sub(1).endpoint), 'push_off removes this device and the count follows');
  ok(lead().planner.pushDevices === 1, 'planner.pushDevices follows');
  for (const r of _stores.settings) if (String(r._id).startsWith('rate:plpsh')) r.hits = Array.from({ length: 10 }, () => Date.now() - 1000);
  const cut = await P({ action: 'push_on', subscription: sub(4) });
  ok(cut._status === 429 && !!cut._headers['Retry-After'], 'the eleventh toggle in a day is a 429');
  const dead = await call(planner, 'POST', { query: { token: 'plnr_nobody_token_abcdefghijk' }, body: { action: 'push_on', subscription: sub(5) } });
  ok(dead._status === 401 && dead._json?.error === 'sign in' && !_stores.push_subscriptions.some(r => r.subscription.endpoint === sub(5).endpoint), 'an unknown token signs no one in: the 401 sign in, and nothing is saved');
  const bare = await call(planner, 'POST', { query: { token: TOKEN }, body: { action: 'push_on', subscription: sub(6) }, bare: true });
  const bareAlerts = await call(planner, 'POST', { query: { token: TOKEN }, body: { action: 'alerts', alerts: { review: false } }, bare: true });
  ok(bare._status === 401 && bareAlerts._status === 401 && !_stores.push_subscriptions.some(r => r.subscription.endpoint === sub(6).endpoint) && lead().planner.alerts?.review !== false, 'a live token alone, no session: the push and alerts doors are 401 and write nothing');
}

/* ── 3.1: the alerts action ── */
seed();
{
  const r = await P({ action: 'alerts', alerts: { today: false } });
  ok(r._status === 200 && JSON.stringify(r._json.alerts) === '{"review":true,"today":false,"ideas":true}', `one switch off, the others stay on (got ${JSON.stringify(r._json)})`);
  ok(lead().planner.alerts.today === false && !('review' in (lead().planner.alerts || {})), 'only the switch sent is written');
  const read = await call(planner, 'GET', { query: { token: TOKEN } });
  ok(JSON.stringify(read._json.client.alerts) === '{"review":true,"today":false,"ideas":true}', 'the read carries the three switches');
  const cases = [
    ['a string', { today: 'false' }], ['a number', { review: 0 }], ['null', { ideas: null }], ['an unknown key', { review: true, budget: true }],
    ['an operator', { review: { $ne: true } }], ['nothing', {}], ['a list', [true]], ['no object', undefined],
  ];
  const before = JSON.stringify(lead().planner);
  for (const [what, alerts] of cases) {
    const x = await P({ action: 'alerts', alerts });
    ok(x._status === 400, `alerts with ${what} is a 400 (got ${x._status})`);
  }
  ok(JSON.stringify(lead().planner) === before, 'a refused alerts call writes nothing');
  await P({ action: 'alerts', alerts: { review: false, today: true, ideas: false } });
  ok(JSON.stringify(lead().planner.alerts) === '{"today":true,"review":false,"ideas":false}', 'all three at once');
}

/* ── 3.1: an admin save of the planner carries the client's own fields ── */
seed();
{
  Object.assign(lead().planner, { alerts: { review: false, today: true, ideas: true }, pushDevices: 2, pushAt: '2026-11-01T10:00:00Z', pushSeen: ['rev:a'], todayPushedOn: '2026-11-20', approvedMonths: ['2026-11'] });
  const r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { planner: { enabled: true, postsPerMonth: 9, welcome: 'Hello', alerts: { review: true, today: true, ideas: true }, pushSeen: [], pushDevices: 0, todayPushedOn: '', approvedMonths: [] } } } });
  const pl = lead().planner;
  ok(r._status === 200 && pl.postsPerMonth === 9, `the save lands (got ${r._status})`);
  ok(pl.alerts.review === false && pl.pushDevices === 2 && pl.pushAt === '2026-11-01T10:00:00Z' && pl.pushSeen.join() === 'rev:a' && pl.todayPushedOn === '2026-11-20' && pl.approvedMonths.join() === '2026-11', `alerts, the device count, the pushes seen and the stamps are carried, never taken from the save (got ${JSON.stringify(pl)})`);
}

/* ── 3.2: the pushes ── */
const push = await load('_lib/plannerPush.js');
const { _sent } = await load('_lib/notify.js');
const posts = (await load('_routes/posts.js')).handler;
const suggestions = (await load('_routes/suggestions.js')).handler;
const clear = () => { _sent.rob.length = 0; _sent.client.length = 0; };
const PID = (n) => `607f1f77bcf86cd7994391${String(n).padStart(2, '0')}`;
const CAPTION = 'Secret caption words that must never ride in a push';
const mk = (n, over = {}) => ({ _id: PID(n), leadId: LEAD, month: '2026-12', date: `2026-12-${String(n).padStart(2, '0')}`, kind: 'post', status: 'making', imageUrl: 'https://img.example/a.jpg', caption: CAPTION, ...over });
function seedPush() {
  seed();
  _stores.push_subscriptions = [{ _id: 'dev1', role: 'client', leadId: LEAD, subscription: { endpoint: sub(1).endpoint, keys: sub(1).keys } }];
  lead().planner.pushDevices = 1;
}
const noCaption = () => !JSON.stringify([_sent.client, _sent.rob]).includes('Secret caption');
const DAY_NY = Date.parse('2026-12-16T17:00:00Z'); // noon in New York, outside quiet hours
push.clock.now = () => DAY_NY; // the route hooks read this clock

seedPush();
{
  _stores.posts = [mk(1), mk(2), mk(3, { caption: '' })];
  clear();
  const r = await call(posts, 'POST', { body: { action: 'send-review', leadId: LEAD, ids: [PID(1), PID(2), PID(3)] } });
  ok(r._json.ids.length === 2 && _sent.client.length === 1, `a batch send of two is one push (got ${_sent.client.length})`);
  const m = _sent.client[0] || {};
  ok(m.title === 'Rob sent you 2 posts to review' && m.leadId === LEAD, `it says how many (got ${JSON.stringify(m.title)})`);
  ok(m.url === 'https://app.visualizeclients.com/planner?review=1' && !m.url.includes(TOKEN), `it opens the planner on Review mode on the app host, no token (got ${m.url})`);
  ok(noCaption(), 'the push never carries a caption');
  ok((lead().planner.pushSeen || []).join() === `rev:${PID(1)},rev:${PID(2)}`, 'a key per post lands in planner.pushSeen');
  /* A resend of the same post never pushes twice. */
  clear();
  await call(posts, 'PATCH', { body: { id: PID(1), set: { status: 'making' } } });
  await call(posts, 'PATCH', { body: { id: PID(1), set: { status: 'review' } } });
  ok(_sent.client.length === 0, 'a post sent back and sent again does not push again');
  /* A single send pushes one. */
  _stores.posts.push(mk(4));
  await call(posts, 'PATCH', { body: { id: PID(4), set: { status: 'review' } } });
  ok(_sent.client.length === 1 && _sent.client[0].title === 'Rob sent you 1 post to review', `a single send is one push, said in the singular (got ${JSON.stringify(_sent.client.map(x => x.title))})`);
  /* The switch, the devices, quiet hours. */
  clear(); _stores.posts.push(mk(5)); lead().planner.alerts = { review: false };
  await call(posts, 'PATCH', { body: { id: PID(5), set: { status: 'review' } } });
  ok(_sent.client.length === 0 && !(lead().planner.pushSeen || []).includes(`rev:${PID(5)}`), 'with New posts to review off: no push, nothing stamped');
  lead().planner.alerts = {}; _stores.push_subscriptions = [];
  const none = await push.reviewPushTick(await (await load('_lib/mongo.js')).getDb(), LEAD, { now: DAY_NY });
  ok(none.sent === false && none.reason === 'no devices', `no device: nothing sent (got ${JSON.stringify(none)})`);
  _stores.push_subscriptions = [{ _id: 'dev1', role: 'client', leadId: LEAD, subscription: { endpoint: sub(1).endpoint, keys: sub(1).keys } }];
  const db = await (await load('_lib/mongo.js')).getDb();
  const night = await push.reviewPushTick(db, LEAD, { now: Date.parse('2026-12-17T03:30:00Z') }); // 10:30 PM New York
  ok(night.sent === false && night.reason === 'quiet' && !(lead().planner.pushSeen || []).includes(`rev:${PID(5)}`), 'at 10:30 PM New York it is quiet: not sent and not stamped');
  clear();
  const day = await push.reviewPushTick(db, LEAD, { now: DAY_NY });
  ok(day.sent === true && _sent.client[0]?.title === 'Rob sent you 1 post to review', 'the next send in the day carries what quiet hours held');
  const off = await push.reviewPushTick(db, '507f1f77bcf86cd799439099', { now: DAY_NY });
  ok(off.sent === false, 'a lead with no planner gets nothing');
}

/* Post today: 9:00 AM New York, once a day, through api/_lib/zone.js, across both clock changes. */
seedPush();
{
  const db = await (await load('_lib/mongo.js')).getDb();
  const at = (iso, dates) => { _stores.posts = dates.map((d, i) => mk(10 + i, { status: 'approved', date: d })); lead().planner.todayPushedOn = ''; clear(); return push.todayPushSweep(db, Date.parse(iso)); };
  /* Winter: 9:00 AM EST is 14:00Z. The day after the November change. */
  let r = await at('2026-11-02T13:59:00Z', ['2026-11-02']);
  ok(r.sent === 0 && _sent.client.length === 0 && lead().planner.todayPushedOn === '', '8:59 AM New York in November (13:59Z): nothing yet, nothing stamped');
  r = await push.todayPushSweep(db, Date.parse('2026-11-02T14:00:00Z'));
  ok(r.sent === 1 && _sent.client[0]?.title === 'Your post goes up today' && _sent.client[0]?.url.endsWith(`?post=${PID(10)}`), `9:00 AM New York in November is 14:00Z: one push, opening that post (got ${JSON.stringify(_sent.client[0])})`);
  ok(lead().planner.todayPushedOn === '2026-11-02', 'the New York day is stamped');
  r = await push.todayPushSweep(db, Date.parse('2026-11-02T15:00:00Z'));
  ok(r.sent === 0 && _sent.client.length === 1, 'the minute cron later the same day sends nothing more');
  ok(noCaption(), 'Post today never carries a caption');
  /* Summer: 9:00 AM EDT is 13:00Z. The day after the March change. */
  r = await at('2027-03-15T12:59:00Z', ['2027-03-15']);
  ok(r.sent === 0, '8:59 AM New York after the March change (12:59Z): nothing');
  r = await push.todayPushSweep(db, Date.parse('2027-03-15T13:00:00Z'));
  ok(r.sent === 1, '9:00 AM New York after the March change is 13:00Z: the push');
  /* Two posts today: one push. */
  r = await at('2026-12-16T14:05:00Z', ['2026-12-16', '2026-12-16']);
  ok(r.sent === 1 && _sent.client.length === 1 && _sent.client[0].title === '2 posts go up today' && !_sent.client[0].url.includes('?post='), `two posts today: one push, "2 posts go up today", opening the planner (got ${JSON.stringify(_sent.client.map(x => x.title))})`);
  /* An evening post in New York that is already tomorrow in UTC is not today. */
  r = await at('2026-12-16T14:05:00Z', ['2026-12-17']);
  ok(r.sent === 0 && lead().planner.todayPushedOn === '2026-12-16', 'a post dated tomorrow is not Post today; the day is still stamped');
  /* Posted, in review, an ad: never Post today. */
  _stores.posts = [mk(20, { status: 'posted', date: '2026-12-16' }), mk(21, { status: 'review', date: '2026-12-16' }), mk(22, { status: 'approved', kind: 'ad', date: '2026-12-16' })];
  lead().planner.todayPushedOn = ''; clear();
  r = await push.todayPushSweep(db, Date.parse('2026-12-16T14:05:00Z'));
  ok(r.sent === 0 && _sent.client.length === 0, 'a posted post, one in review and an ad are never Post today');
  /* The switch off, and a cron that missed the morning. */
  r = await at('2026-12-16T14:05:00Z', ['2026-12-16']); clear(); lead().planner.todayPushedOn = ''; lead().planner.alerts = { today: false };
  r = await push.todayPushSweep(db, Date.parse('2026-12-16T14:10:00Z'));
  ok(r.sent === 0 && _sent.client.length === 0 && lead().planner.todayPushedOn === '2026-12-16', 'with Post today off: no push, and the day is stamped');
  lead().planner.alerts = {}; lead().planner.todayPushedOn = ''; clear();
  r = await push.todayPushSweep(db, Date.parse('2026-12-16T18:00:00Z')); // 1 PM New York
  ok(r.sent === 0 && _sent.client.length === 0 && lead().planner.todayPushedOn === '2026-12-16', 'past noon New York the day is stamped and nothing is sent');
  ok(/todayPushSweep\(db, nowMs\)/.test(fs.readFileSync(path.join(repoRoot, 'api', '_routes', 'cron-reminders.js'), 'utf8')), 'the reminders cron runs the sweep on its own clock');
}

/* Rob answered my idea. */
seedPush();
{
  _stores.suggestions = [{ _id: '707f1f77bcf86cd799439051', leadId: LEAD, kind: 'post', subject: 'The Friday special, with the window', status: 'new', note: '', seenAt: '' }];
  clear();
  await call(suggestions, 'PATCH', { body: { id: '707f1f77bcf86cd799439051', set: { status: 'planned', postId: PID(1) } } });
  ok(_sent.client.length === 1 && _sent.client[0].title === 'Rob answered your idea: The Friday special, with the window' && _sent.client[0].url.endsWith('?tab=ideas'), `planned: one push naming their idea, opening Ideas (got ${JSON.stringify(_sent.client[0])})`);
  await call(suggestions, 'PATCH', { body: { id: '707f1f77bcf86cd799439051', set: { status: 'declined', note: 'Not this month' } } });
  ok(_sent.client.length === 1, 'an idea answered twice pushes once');
  ok(!JSON.stringify(_sent.client).includes('Not this month'), "Rob's note is not in the push");
  _stores.suggestions.push({ _id: '707f1f77bcf86cd799439052', leadId: LEAD, subject: 'Another', status: 'new' });
  lead().planner.alerts = { ideas: false };
  await call(suggestions, 'PATCH', { body: { id: '707f1f77bcf86cd799439052', set: { status: 'declined' } } });
  ok(_sent.client.length === 1, 'with Rob answered my idea off: no push');
  lead().planner.alerts = {};
  _stores.suggestions.push({ _id: '707f1f77bcf86cd799439053', leadId: LEAD, subject: 'Seen only', status: 'new' });
  await call(suggestions, 'PATCH', { body: { id: '707f1f77bcf86cd799439053', set: { seenAt: true } } });
  ok(_sent.client.length === 1, 'seeing an idea is not answering it');
}

/* Rob's: the whole month approved, once. And the posted push carries its category. */
seedPush();
{
  _stores.posts = [mk(1, { status: 'approved' }), mk(2, { status: 'posted' }), mk(3, { status: 'review' }), mk(4, { status: 'review', month: '2027-01' })];
  clear();
  const a1 = await P({ postId: PID(3), action: 'approve' });
  ok(a1._status === 200 && _sent.rob.length === 1 && _sent.rob[0].title === 'Kims Cafe approved the whole month' && _sent.rob[0].category === 'client', `the last approval of December: Rob's push, category client (got ${JSON.stringify(_sent.rob)})`);
  ok((lead().planner.approvedMonths || []).join() === '2026-12', 'the month is kept on the planner record');
  _stores.posts.find(p => p._id === PID(3)).status = 'review';
  await P({ postId: PID(3), action: 'approve' });
  ok(_sent.rob.length === 1, 'the same month never says it twice');
  _stores.posts.push(mk(5, { status: 'review', month: '2027-01' }));
  await P({ postId: PID(4), action: 'approve' });
  ok(_sent.rob.length === 1, 'a month with one still waiting says nothing');
  const posted = await P({ postId: PID(1), action: 'posted' });
  ok(posted._status === 200 && _sent.rob.at(-1).category === 'client' && /posted the Dec 1 post$/.test(_sent.rob.at(-1).title), 'the posted push carries the client category (his switch decides)');
  ok(noCaption(), "none of Rob's pushes carries a caption");
}

/* The loop into Next up: a task written for a post completes when they post it; without one nothing is written. */
seedPush();
{
  _stores.posts = [mk(1, { status: 'approved' }), mk(2, { status: 'approved' })];
  lead().checklists = [{ id: 'ck1', name: 'Content', items: [{ id: 'tk1', text: 'Check the Dec 1 post went up', done: false, postId: PID(1) }, { id: 'tk2', text: 'Something else', done: false }] }];
  await P({ postId: PID(1), action: 'posted' });
  const items = lead().checklists[0].items;
  ok(items.find(t => t.id === 'tk1').done === true && !!items.find(t => t.id === 'tk1').doneAt, 'the task carrying that post is ticked through the shared task rules');
  ok(items.find(t => t.id === 'tk2').done === false, 'every other task is left alone');
  const before = JSON.stringify(lead().checklists);
  await P({ postId: PID(2), action: 'posted' });
  ok(JSON.stringify(lead().checklists) === before, 'with no task for the post, nothing is written');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing, ${passes} passing.` : `\nAll ${passes} planner alerts checks pass.`);
process.exit(fails ? 1 : 0);
