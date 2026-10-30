#!/usr/bin/env node
/* What the screens say about push (src/lib/pushStatus.js): Armed needs a cron run in the last three minutes, push keys on the
 * server and this device subscribed; the red alarm shows past ten minutes with no run; the Test button says how many devices
 * took it, and why when none did.
 *   node scripts/push-status-test.mjs */
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const P = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'pushStatus.js')).href);
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);
const NOW = Date.parse('2026-10-30T15:00:00Z');
const ago = (min, extra = {}) => ({ crons: { reminders: { lastRunAt: new Date(NOW - min * 60e3).toISOString(), runs: [0, 1, 2, 3, 4, 5, 6].map(i => new Date(NOW - (min + i) * 60e3).toISOString()), ...extra } } });

section('1. the cron\'s pace');
{
  let h = P.reminderHealth(ago(1), NOW);
  ok(h.ranRecently && !h.stale && h.ageMs === 60e3, 'a run a minute ago: recent, not stale');
  ok(P.reminderHealth(ago(3), NOW).ranRecently && !P.reminderHealth(ago(3.1), NOW).ranRecently, 'recent means three minutes or less');
  ok(!P.reminderHealth(ago(10), NOW).stale && P.reminderHealth(ago(10.1), NOW).stale, 'stale means more than ten minutes');
  h = P.reminderHealth({}, NOW);
  ok(!h.ranRecently && h.stale && h.lastRunAt === '' && h.ageMs === Infinity, 'no health at all: never ran, stale');
  h = P.reminderHealth(null, NOW);
  ok(h.stale && h.runs.length === 0, 'null health is the same');
  ok(P.reminderHealth(ago(1), NOW).runs.length === 5, 'the last five runs, newest first');
  ok(P.reminderHealth(ago(1), NOW).runs[0] > P.reminderHealth(ago(1), NOW).runs[4], 'newest first');
  h = P.reminderHealth(ago(1, { lastPushAt: 'x', lastPushError: 'no-devices', failed: 2, retrying: 1, devices: 3 }), NOW);
  ok(h.lastPushError === 'no-devices' && h.failed === 2 && h.retrying === 1 && h.devices === 3, 'the push counts come through');
}

section('2. Armed needs all three');
{
  const A = (o) => P.armedState({ health: ago(1), keysSet: true, subscribed: true, now: NOW, ...o });
  ok(A({}).armed && A({}).label === 'Armed' && A({}).missing.length === 0, 'cron recent, keys set, device subscribed: Armed');
  ok(!A({ health: ago(5) }).armed && A({ health: ago(5) }).missing.join() === 'cron', 'a cron run five minutes ago is not Armed', 'armed-cron');
  ok(!A({ keysSet: false }).armed && A({ keysSet: false }).missing.join() === 'keys', 'no keys on the server is not Armed', 'armed-keys');
  ok(!A({ subscribed: false }).armed && A({ subscribed: false }).missing.join() === 'device', 'this device not subscribed is not Armed', 'armed-device');
  const none = A({ health: {}, keysSet: false, subscribed: false });
  ok(none.missing.join() === 'cron,keys,device' && /never run/.test(none.why) && /no push keys/.test(none.why) && /not subscribed/.test(none.why), `all three missing says all three (${none.why})`);
  ok(/last ran 5 minutes ago/.test(A({ health: ago(5) }).why), 'the reason names how long ago it last ran');
}

section('3. the red alarm and the Next run cell');
{
  const clock = () => '2:55 PM';
  ok(P.alarmText(ago(2), NOW, clock) === '' && P.alarmText(ago(10), NOW, clock) === '', 'no alarm while the cron keeps its pace (ten minutes or less)');
  ok(/^Reminders have not run since 2:55 PM\./.test(P.alarmText(ago(11), NOW, clock)), 'past ten minutes the alarm names the last run', 'stale-alarm');
  ok(/^Reminders have never run\./.test(P.alarmText({}, NOW, clock)), 'with no run on record it says never');
  ok(P.nextRunText(ago(1), NOW) === 'Within a minute' && P.nextRunText(ago(6), NOW) === 'Not running' && P.nextRunText({}, NOW) === 'Not running yet', 'the Next run cell is honest');
  ok(P.ago(0) === 'less than a minute ago' && P.ago(90 * 60e3) === '1 hour ago' && P.ago(26 * 3600e3) === '26 hours ago' && P.ago(3 * 864e5) === '3 days ago' && P.ago(Infinity) === 'never', 'the ago words');
}

section('4. the Test button says what happened');
{
  const T = P.testMessage;
  ok(T({ attempted: 3, delivered: 3, removed: 0, errors: [] }).text === 'Sent to 3 of 3 devices.' && T({ attempted: 3, delivered: 3, removed: 0, errors: [] }).tone === 'success', 'all three took it');
  ok(T({ attempted: 1, delivered: 1, removed: 0, errors: [] }).text === 'Sent to 1 of 1 device.', 'one device, singular');
  let m = T({ attempted: 3, delivered: 2, removed: 1, errors: [] });
  ok(m.tone === 'warning' && m.text === 'Sent to 2 of 3 devices. 1 device was no longer valid and removed.', `two of three, one removed (${m.text})`, 'test-honest');
  ok(T({ attempted: 0, delivered: 0, removed: 0, errors: ['no-devices'] }).text.startsWith('No device is subscribed'), 'no devices says so');
  ok(/no push keys/.test(T({ attempted: 0, delivered: 0, removed: 0, errors: ['no-vapid'] }).text) && /refused/.test(T({ attempted: 0, delivered: 0, removed: 0, errors: ['bad-vapid'] }).text), 'missing and refused keys say so');
  ok(/refused it \(403\)/.test(T({ attempted: 2, delivered: 0, removed: 0, errors: ['http-403', 'http-403'] }).text), 'a refusal names the status');
  ok(/did not answer/.test(T({ attempted: 1, delivered: 0, removed: 0, errors: ['network'] }).text), 'a silence says so');
  ok(/removed.*subscribe again/.test(T({ attempted: 1, delivered: 0, removed: 1, errors: [] }).text), 'the only device gone says to subscribe again');
  ok(T(null).text === 'Could not send the test.' && T(null).tone === 'error', 'nothing answered');
  ok(T({ attempted: 2, delivered: 0, removed: 0, errors: [] }).text === 'Nothing was delivered.', 'nothing delivered and no reason still says nothing was delivered');
}

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
