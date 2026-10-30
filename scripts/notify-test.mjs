#!/usr/bin/env node
/* The push door (api/_lib/notify.js) against a stub of the web-push library: every send answers what actually happened
 * ({ attempted, delivered, removed, errors }), a reminder asks the push service for high urgency and a fifteen minute life
 * while the digest and every other push are normal urgency, a gone device (404 or 410) is deleted and the last one flags the app
 * to subscribe again, a refusal or a silence is a code and never an endpoint, and Rob's pushes never go to a client's device.
 *   node scripts/notify-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'notify-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
/* The nearest node_modules wins, so this stub stands in for web-push: what it does for a device is written on the subscription. */
const stubDir = path.join(tmp, 'node_modules', 'web-push'); fs.mkdirSync(stubDir, { recursive: true });
fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify({ name: 'web-push', type: 'module', main: 'index.js', version: '0.0.0-test' }));
fs.writeFileSync(path.join(stubDir, 'index.js'), `export const calls = []; export const state = { vapidThrows: false };
export default {
  setVapidDetails() { if (state.vapidThrows) throw new Error('bad key'); },
  async sendNotification(sub, payload, opts) { calls.push({ sub, payload, opts }); const b = sub.behave || 'ok'; if (b === 'ok') return { statusCode: 201 }; if (b === 'network') throw new Error('socket'); const e = new Error('push ' + b); e.statusCode = Number(b); throw e; },
};
`);

process.env.VAPID_PUBLIC_KEY = 'test-public'; process.env.VAPID_PRIVATE_KEY = 'test-private';
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset, getDb } = await load('_lib/mongo.js');
const stub = await import(pathToFileURL(path.join(stubDir, 'index.js')).href);
const N = await load('_lib/notify.js');
const db = await getDb();
const reset = () => { _reset(); stub.calls.length = 0; stub.state.vapidThrows = false; _stores.push_subscriptions = []; _stores.settings = [{ _id: 'notifications' }]; };
const owner = (n, behave) => ({ _id: `o${n}`, subscription: { endpoint: `https://push.example/${n}`, keys: { p256dh: 'k', auth: 'a' }, behave }, updatedAt: new Date() });
const client = (n, leadId, behave) => ({ _id: `c${n}`, role: 'client', leadId, subscription: { endpoint: `https://push.example/c${n}`, keys: { p256dh: 'k', auth: 'a' }, behave }, updatedAt: new Date() });
const msg = { title: 'T', body: 'B', url: 'https://admin.visualizeclients.com/' };

section('1. the answer is counts and codes');
{
  reset(); _stores.push_subscriptions = [owner(1, 'ok'), owner(2, 'ok')];
  let r = await N.sendPush(db, msg);
  ok(r.attempted === 2 && r.delivered === 2 && r.removed === 0 && r.errors.length === 0, `two devices took it (${JSON.stringify(r)})`);
  reset();
  r = await N.sendPush(db, msg);
  ok(r.attempted === 0 && r.delivered === 0 && r.errors[0] === 'no-devices' && stub.calls.length === 0, `no device: nothing is sent and the code says so (${JSON.stringify(r)})`);
  reset(); _stores.push_subscriptions = [owner(1, '403'), owner(2, 'ok'), owner(3, 'network'), owner(4, '500')];
  r = await N.sendPush(db, msg);
  ok(r.attempted === 4 && r.delivered === 1 && r.removed === 0 && r.errors.sort().join() === 'http-403,http-500,network', `a refusal is http-<status>, a silence is network, and neither deletes the device (${JSON.stringify(r)})`);
  ok(_stores.push_subscriptions.length === 4, 'all four rows are still there');
  ok(!JSON.stringify(r).includes('push.example'), 'no endpoint anywhere in the answer');
}

section('2. a gone device is deleted, and the last one flags the app to subscribe again');
{
  reset(); _stores.push_subscriptions = [owner(1, '410'), owner(2, 'ok')];
  let r = await N.sendPush(db, msg);
  ok(r.delivered === 1 && r.removed === 1 && _stores.push_subscriptions.length === 1, `a 410 is removed, the other still takes it (${JSON.stringify(r)})`);
  ok(!_stores.settings.find(s => s._id === 'notifications').pushNeedsResubscribe, 'one device left: no flag');
  reset(); _stores.push_subscriptions = [owner(1, '404'), owner(2, '410')];
  r = await N.sendPush(db, msg);
  const n = _stores.settings.find(s => s._id === 'notifications');
  ok(r.delivered === 0 && r.removed === 2 && _stores.push_subscriptions.length === 0, `both gone: both rows deleted, nothing delivered (${JSON.stringify(r)})`);
  ok(n.pushNeedsResubscribe === true && !!n.pushLostAt, 'the last owner device going sets pushNeedsResubscribe', 'resubscribe-flag');
  reset(); _stores.push_subscriptions = [owner(1, '410'), client(1, 'L1', 'ok')];
  await N.sendPush(db, msg);
  ok(_stores.settings.find(s => s._id === 'notifications').pushNeedsResubscribe === true, 'a client device does not count as one of Rob\'s: the flag is set');
}

section('3. the keys');
{
  /* initVapid caches success per module instance, so each case loads a fresh copy of the door. */
  const fresh = (tag) => import(`${pathToFileURL(path.join(apiDst, '_lib', 'notify.js')).href}?${tag}`);
  reset(); _stores.push_subscriptions = [owner(1, 'ok')];
  const keep = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  let r = await (await fresh('nokey')).sendPush(db, msg);
  ok(r.attempted === 0 && r.errors[0] === 'no-vapid' && stub.calls.length === 0, `no private key: nothing is sent, the code is no-vapid (${JSON.stringify(r)})`, 'no-vapid');
  process.env.VAPID_PRIVATE_KEY = keep;
  stub.state.vapidThrows = true;
  r = await (await fresh('badkey')).sendPush(db, msg);
  ok(r.attempted === 0 && r.errors[0] === 'bad-vapid' && stub.calls.length === 0, `a key the library refuses: bad-vapid, never a throw (${JSON.stringify(r)})`);
  stub.state.vapidThrows = false;
}

section('4. what is asked of the push service');
{
  reset(); _stores.push_subscriptions = [owner(1, 'ok')];
  await N.sendPush(db, { ...msg, kind: 'reminder' });
  await N.sendPush(db, { ...msg, kind: 'digest' });
  await N.sendPush(db, msg);
  const [rem, dig, evt] = stub.calls.map(c => c.opts);
  ok(rem.urgency === 'high' && rem.TTL === 900, `a reminder is high urgency and lives fifteen minutes (${JSON.stringify(rem)})`, 'push-ttl');
  ok(dig.urgency === 'normal' && dig.TTL === 6 * 3600, `the digest is normal urgency and lives six hours (${JSON.stringify(dig)})`);
  ok(evt.urgency === 'normal' && evt.TTL === 86400, `any other push is normal urgency and lives a day (${JSON.stringify(evt)})`);
  ok([rem, dig, evt].every(o => o.timeout > 0 && o.timeout <= 15000), 'every send has a timeout, so the minute cron is never held by a silent push service');
  const body = JSON.parse(stub.calls[0].payload);
  ok(body.title === 'T' && body.url === msg.url && !('kind' in body), 'the payload is the title, body and url');
}

section('5. Rob\'s pushes stay with Rob, a client\'s with that client');
{
  reset(); _stores.push_subscriptions = [owner(1, 'ok'), client(1, 'L1', 'ok'), client(2, 'L2', 'ok')];
  let r = await N.sendPush(db, msg);
  ok(r.attempted === 1 && stub.calls.length === 1, 'sendPush reaches the one owner device, not the clients');
  stub.calls.length = 0;
  r = await N.sendClientPush(db, 'L1', msg);
  ok(r.attempted === 1 && r.delivered === 1 && stub.calls.length === 1 && stub.calls[0].sub.endpoint.endsWith('/c1'), 'sendClientPush reaches only that client\'s device');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
