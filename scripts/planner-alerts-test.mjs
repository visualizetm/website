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
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'alerts-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
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
async function call(fn, method, { query = {}, body } = {}) {
  const res = fakeRes();
  try { await fn({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.9' }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.stack || e) }; }
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
  ok(dead._status === 404 && !_stores.push_subscriptions.some(r => r.subscription.endpoint === sub(5).endpoint), 'an unknown token is the same 404 and saves nothing');
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

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing, ${passes} passing.` : `\nAll ${passes} planner alerts checks pass.`);
process.exit(fails ? 1 : 0);
