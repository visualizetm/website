#!/usr/bin/env node
/* The push routes against the real handlers, a fake database and a stub of the web-push library: the Test button's route answers
 * the counts and the codes (never a bare ok), the settings read carries the device count and the subscribe-again flag (and no
 * endpoint), saving a device clears the flag and keeps one row per endpoint.
 *   node scripts/push-route-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'pushroute-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
const stubDir = path.join(tmp, 'node_modules', 'web-push'); fs.mkdirSync(stubDir, { recursive: true });
fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify({ name: 'web-push', type: 'module', main: 'index.js', version: '0.0.0-test' }));
fs.writeFileSync(path.join(stubDir, 'index.js'), `export default { setVapidDetails() {}, async sendNotification(sub) { const b = sub.behave || 'ok'; if (b === 'ok') return { statusCode: 201 }; const e = new Error('push ' + b); e.statusCode = Number(b); throw e; } };\n`);
process.env.VAPID_PUBLIC_KEY = 'test-public'; process.env.VAPID_PRIVATE_KEY = 'test-private'; process.env.CRON_SECRET = 'x';

const load = async (rel, tag = '') => import(`${pathToFileURL(path.join(apiDst, rel)).href}${tag ? `?${tag}` : ''}`);
const { _stores, _reset } = await load('_lib/mongo.js');
const settingsRoute = await load('_routes/settings.js');
const subscribeRoute = await load('_routes/push-subscribe.js');
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader(k, v) { this._headers[k] = v; } });
const call = async (h, req) => { const res = fakeRes(); await h({ query: {}, headers: {}, socket: {}, ...req }, res); return res; };
const owner = (n, behave) => ({ _id: `o${n}`, subscription: { endpoint: `https://push.example/${n}`, keys: { p256dh: 'k', auth: 'a' }, behave }, updatedAt: new Date() });
const reset = () => { _reset(); _stores.push_subscriptions = []; _stores.settings = [{ _id: 'notifications', readIds: [] }]; };
const notif = () => _stores.settings.find(s => s._id === 'notifications');

section('1. the Test button\'s route answers what happened');
{
  reset(); _stores.push_subscriptions = [owner(1, 'ok'), owner(2, 'ok'), owner(3, '410')];
  let r = await call(settingsRoute.handler, { method: 'POST', body: { action: 'test-push' } });
  ok(r._status === 200 && r._json.ok === true && r._json.attempted === 3 && r._json.delivered === 2 && r._json.removed === 1 && r._json.errors.length === 0, `three devices, two took it, one was gone (${JSON.stringify(r._json)})`, 'test-route-counts');
  reset();
  r = await call(settingsRoute.handler, { method: 'POST', body: { action: 'test-push' } });
  ok(r._status === 200 && r._json.attempted === 0 && r._json.delivered === 0 && r._json.errors[0] === 'no-devices', `no device is a 200 with the code no-devices (${JSON.stringify(r._json)})`);
  reset(); _stores.push_subscriptions = [owner(1, '403')];
  r = await call(settingsRoute.handler, { method: 'POST', body: { action: 'test-push' } });
  ok(r._json.delivered === 0 && r._json.errors[0] === 'http-403', 'a refusal comes back as http-403, not as a success');
  ok(!JSON.stringify(r._json).includes('push.example'), 'no endpoint in the answer');
}

section('2. the settings read: the device count and the flag, no endpoint');
{
  reset(); _stores.push_subscriptions = [owner(1, 'ok'), owner(2, 'ok')];
  let r = await call(settingsRoute.handler, { method: 'GET' });
  ok(r._status === 200 && r._json.push && r._json.push.devices === 2 && r._json.push.needsResubscribe === false, `two devices, no flag (${JSON.stringify(r._json.push)})`);
  ok(!JSON.stringify(r._json).includes('push.example'), 'no endpoint anywhere in the settings read');
  reset(); _stores.push_subscriptions = [owner(1, '410')];
  await call(settingsRoute.handler, { method: 'POST', body: { action: 'test-push' } });
  r = await call(settingsRoute.handler, { method: 'GET' });
  ok(r._json.push.devices === 0 && r._json.push.needsResubscribe === true, `the last device removed: zero devices and the flag (${JSON.stringify(r._json.push)})`, 'resubscribe-flag-read');
}

section('3. saving a device');
{
  reset();
  notif().pushNeedsResubscribe = true;
  const sub = { endpoint: 'https://push.example/new', keys: { p256dh: 'k', auth: 'a' } };
  let r = await call(subscribeRoute.handler, { method: 'POST', body: { subscription: sub } });
  ok(r._status === 200 && _stores.push_subscriptions.length === 1 && notif().pushNeedsResubscribe === false, 'it saves the device and clears the subscribe-again flag', 'flag-cleared');
  r = await call(subscribeRoute.handler, { method: 'POST', body: { subscription: sub } });
  ok(_stores.push_subscriptions.length === 1, 'saving the same endpoint again keeps one row');
  r = await call(subscribeRoute.handler, { method: 'POST', body: { subscription: { keys: {} } } });
  ok(r._status === 400 && _stores.push_subscriptions.length === 1, 'a body with no endpoint is a 400 and writes nothing');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
