#!/usr/bin/env node
/* Minute mode reminders (CLAUDE_CODE_PROMPT: on time push notifications):
 * a callback or a meeting pushes the minute it is due, once, on a key that
 * carries its time so an edited time pushes again; anything more than ten
 * minutes late is stamped without a push (the first live run after weeks of
 * a dead cron pushes nothing old); the morning digest sends once, on
 * the first run at or after 8:30am America/New_York; the email rules run
 * once a day; ten or more things due at once become one combined push; a push no
 * device took is not stamped as sent: it is tried again (three tries), then failed.
 *   node scripts/minute-reminders-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'node:child_process';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
if (process.env.TZ !== 'America/New_York') {
  const r = spawnSync(process.execPath, [process.argv[1]], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  process.exit(r.status ?? 1);
}
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);

const Z = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'zone.js')).href);
const MIN = 60e3;
const HOUR = 3600e3;

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'minute-')); const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), "export const _pushes = [];\nexport const _state = { result: { attempted: 1, delivered: 1, removed: 0, errors: [] } };\nexport async function sendPush(db, p) { _pushes.push(p); return _state.result; }\nexport async function sendClientPush() {}\n");
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset, getDb } = await load('_lib/mongo.js');
const { _pushes, _state } = await load('_lib/notify.js');
const { runReminders } = await load('_routes/cron-reminders.js');
const db = await getDb();
const iso = (t) => new Date(t).toISOString();

const L1 = '507f1f77bcf86cd7994390e1', L2 = '507f1f77bcf86cd7994390e2';
const AFTERNOON = Z.zoneDateAt('2026-10-02', 15, 0); // 3pm New York: past the 8:30 digest gate and the 9:00 rules gate
const BEFORE_DIGEST = Z.zoneDateAt('2026-10-02', 7, 0); // 7am: before the 8:30 gate

const DELIVERED = { attempted: 1, delivered: 1, removed: 0, errors: [] };
const NO_DEVICE = { attempted: 0, delivered: 0, removed: 0, errors: ['no-devices'] };
const seed = () => {
  _reset(); _pushes.length = 0; _state.result = DELIVERED;
  _stores.settings = [{ _id: 'notifications', reminders: { meetings: true, callbacks: true, bills: true, reviews: true, tasks: true }, sentReminderKeys: [] }];
  _stores.call_leads = [];
  _stores.projects = [];
  _stores.push_subscriptions = [];
};

section('1. a callback at 5:00 PM pushes on the 5:00 run, not before, and only once across four runs');
{
  seed();
  const at5 = Z.zoneDateAt('2026-10-02', 17, 0);
  _stores.call_leads = [{ _id: L1, business: 'Bella Rosy Pizzeria', stage: 'lead', callStatus: 'callback', callbackAt: iso(at5), socials: {} }];
  let r = await runReminders(db, at5 - 10 * MIN);
  ok(r.sent === 0 && !_pushes.some(p => /Bella Rosy Pizzeria/.test(p.title)), 'ten minutes before 5:00, nothing pushes yet');
  r = await runReminders(db, at5);
  const cb = _pushes.find(p => /Bella Rosy Pizzeria/.test(p.title));
  ok(r.sent === 1 && !!cb && cb.title === 'Call back: Bella Rosy Pizzeria, 5:00 PM', `the 5:00 run pushes "Call back: Bella Rosy Pizzeria, 5:00 PM" (${cb?.title})`);
  const before = _pushes.length;
  await runReminders(db, at5 + MIN);
  await runReminders(db, at5 + 2 * MIN);
  await runReminders(db, at5 + 3 * MIN);
  ok(_pushes.length === before, 'three more runs after 5:00 push nothing more: the callback key already dedupes it');
}

section('2. an edited time pushes again');
{
  const at530 = Z.zoneDateAt('2026-10-02', 17, 30);
  const lead = _stores.call_leads.find(l => l._id === L1);
  lead.callbackAt = iso(at530); // the callback was moved half an hour out
  const before = _pushes.length;
  await runReminders(db, at530 - MIN); // not yet due at the new time
  ok(_pushes.length === before, 'not yet due at the edited time');
  await runReminders(db, at530);
  const again = _pushes.filter(p => /Bella Rosy Pizzeria/.test(p.title));
  ok(again.length === 2, `the edited time pushes again, a second time for the same lead (${again.length})`);
}

section('3. a thing due more than ten minutes ago is stamped without a push (seven hours is the long case)');
{
  seed();
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(AFTERNOON)}`]; // isolate from the digest, not under test here
  const sevenHoursAgo = AFTERNOON - 7 * HOUR;
  _stores.call_leads = [{ _id: L2, business: 'Late Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(sevenHoursAgo), socials: {} }];
  const r = await runReminders(db, AFTERNOON);
  ok(r.sent === 0 && _pushes.length === 0, 'seven hours late: no push at all');
  await runReminders(db, AFTERNOON + MIN);
  ok(_pushes.length === 0, 'the next run never catches up on it either: it was stamped handled, not left pending');
  const key = (_stores.settings.find(s => s._id === 'notifications').sentReminderKeys || []);
  ok(key.some(k => k.startsWith(`cb:${L2}:`)), 'the stale callback key is stamped into sentReminderKeys so it is never reconsidered');
}

const notif = () => _stores.settings.find(s => s._id === 'notifications');
const lateTask = (id, business, label, at) => ({ _id: id, business, stage: 'lead', callStatus: 'not-called', socials: {}, nextAction: { kind: 'custom', label, dueAt: iso(at), auto: false, doneAt: '', remindAt: iso(at), notifiedAt: '' } });

section('3b. the window is ten minutes: nine minutes late still pushes, eleven does not, and the reason is kept');
{
  seed();
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(AFTERNOON)}`]; // isolate from the digest
  _stores.call_leads = [
    { _id: L1, business: 'Nine Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(AFTERNOON - 9 * MIN), socials: {} },
    { _id: L2, business: 'Eleven Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(AFTERNOON - 11 * MIN), socials: {} },
  ];
  const r = await runReminders(db, AFTERNOON);
  ok(r.sent === 1 && _pushes.length === 1 && /Nine Co/.test(_pushes[0].title), `nine minutes late pushes, eleven minutes late does not (${_pushes.map(p => p.title).join(' | ')})`);
  ok((notif().sentReminderKeys || []).some(k => k.startsWith(`cb:${L2}:`)), 'the eleven minute one is stamped handled, so it is not reconsidered');
  const skipped = (notif().reminderOutcomes || []).filter(o => o.status === 'skipped' && o.reason === 'stale');
  ok(skipped.length === 1 && skipped[0].kind === 'callback' && skipped[0].key.startsWith(`cb:${L2}:`), `its outcome is kept as skipped, stale (${JSON.stringify(skipped)})`, 'stale-window');
  await runReminders(db, AFTERNOON + MIN);
  ok(_pushes.length === 1, 'and it never pushes later');
}

section('3c. the first live run after weeks down pushes nothing old, only what is fresh');
{
  seed();
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(AFTERNOON)}`]; // isolate from the digest
  const day = 864e5;
  const overdue = Array.from({ length: 9 }, (_, i) => ({ _id: `old${i}`, business: `Overdue Co ${i}`, stage: 'lead', callStatus: 'callback', callbackAt: iso(AFTERNOON - (2 + i * 6) * day), socials: {} }));
  const today = Z.zoneDayKey(AFTERNOON);
  const meetings = [['m1', '08:00'], ['m2', '11:00']].map(([id, time]) => ({ _id: id, business: `Meeting Co ${id}`, stage: 'booked', callStatus: 'booked', meeting: { date: today, time }, socials: {} }));
  const tasks = [lateTask('t1', 'Task Co 1', 'Send the proof', AFTERNOON - 3 * day), lateTask('t2', 'Task Co 2', 'Call the printer', AFTERNOON - 30 * day), lateTask('t3', 'Task Co 3', 'Hang the sign', AFTERNOON - 2 * HOUR)];
  const fresh = [{ _id: 'fresh1', business: 'Fresh Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(AFTERNOON - 3 * MIN), socials: {} }, lateTask('fresh2', 'Fresh Task Co', 'Fresh task', AFTERNOON - 2 * MIN)];
  _stores.call_leads = [...overdue, ...meetings, ...tasks, ...fresh];
  const r = await runReminders(db, AFTERNOON);
  const titles = _pushes.map(p => p.title);
  ok(r.sent === 2 && _pushes.length === 2 && titles.some(t => /^Call back: Fresh Co/.test(t)) && titles.some(t => /^Task: Fresh task, Fresh Task Co/.test(t)), `only the two fresh items push (${JSON.stringify(titles)})`);
  const stale = (notif().reminderOutcomes || []).filter(o => o.status === 'skipped' && o.reason === 'stale');
  ok(stale.length === 14 && stale.filter(o => o.kind === 'callback').length === 9 && stale.filter(o => o.kind === 'meeting').length === 2 && stale.filter(o => o.kind === 'task').length === 3, `fourteen old things are recorded skipped, stale: 9 callbacks, 2 meetings, 3 tasks (${stale.length})`);
  ok(['t1', 't2', 't3'].every(id => !!_stores.call_leads.find(l => l._id === id).nextAction.notifiedAt), 'the old tasks are stamped handled on their own record');
  const before = _pushes.length;
  await runReminders(db, AFTERNOON + MIN);
  await runReminders(db, AFTERNOON + 2 * MIN);
  ok(_pushes.length === before, 'the next runs push nothing more, not even a late catch-up of the stale ones');
}

section('4. the digest sends once, on the first run at or after 8:30 America/New_York');
{
  seed();
  _stores.call_leads = [{ _id: L1, business: 'Due Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(BEFORE_DIGEST - HOUR), socials: {} }];
  let r = await runReminders(db, BEFORE_DIGEST);
  ok(r.digest === 0 && !_pushes.some(p => /^Today: /.test(p.title)), 'at 7am, before 8:30, no digest yet (its own callback still pushes on its own key)');
  const digest830 = Z.zoneDateAt('2026-10-02', 8, 30);
  r = await runReminders(db, digest830);
  ok(r.digest === 1 && _pushes.some(p => /^Today: /.test(p.title)), 'the first run at or after 8:30 sends the digest');
  const before = _pushes.filter(p => /^Today: /.test(p.title)).length;
  await runReminders(db, Z.zoneDateAt('2026-10-02', 9, 0));
  await runReminders(db, Z.zoneDateAt('2026-10-02', 12, 0));
  const after = _pushes.filter(p => /^Today: /.test(p.title)).length;
  ok(before === 1 && after === 1, 'later runs the same day send no second digest');
}

section('5. the email rules run once a day, on the first run at or after 9:00 America/New_York');
{
  seed();
  const at9 = Z.zoneDateAt('2026-10-02', 9, 0);
  await runReminders(db, Z.zoneDateAt('2026-10-02', 8, 59));
  const gate1 = (_stores.settings.find(s => s._id === 'cronGates') || {}).rulesLastRunAt;
  ok(!gate1, 'before 9:00, the rules gate has not stamped a run yet');
  await runReminders(db, at9);
  const gate2 = _stores.settings.find(s => s._id === 'cronGates').rulesLastRunAt;
  ok(!!gate2, 'the first run at or after 9:00 stamps the rules gate');
  await runReminders(db, at9 + MIN);
  const gate3 = _stores.settings.find(s => s._id === 'cronGates').rulesLastRunAt;
  ok(gate2 === gate3, 'a run a minute later does not run the rules again: same day, already stamped');
  await runReminders(db, Z.zoneDateAt('2026-10-03', 9, 0));
  const gate4 = _stores.settings.find(s => s._id === 'cronGates').rulesLastRunAt;
  ok(gate4 !== gate3, 'the next day, the first run at or after 9:00 runs the rules again');
}

section('6. twelve things due at once make one combined push, not a flood');
{
  seed();
  const now = Z.zoneDateAt('2026-10-02', 16, 0);
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(now)}`]; // isolate from the digest, not under test here
  _stores.call_leads = Array.from({ length: 12 }, (_, i) => ({ _id: `cb${i}`, business: `Combine Co ${i}`, stage: 'lead', callStatus: 'callback', callbackAt: iso(now), socials: {} }));
  const r = await runReminders(db, now);
  ok(r.sent === 1 && _pushes.length === 1, `twelve due callbacks make exactly one push (${_pushes.length})`);
  ok(/^12 callbacks due now$/.test(_pushes[0].title), `the combined push names the count ("${_pushes[0].title}")`);
  const keys = _stores.settings.find(s => s._id === 'notifications').sentReminderKeys || [];
  ok(Array.from({ length: 12 }, (_, i) => `cb:cb${i}:${iso(now)}`).every(k => keys.includes(k)), 'every one of the twelve is still stamped, even though only one push went out');
}

section('7. a push no device took is not stamped: tried again, three tries in all, then failed with the reason');
{
  seed();
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(AFTERNOON)}`]; // isolate from the digest
  _stores.call_leads = [{ _id: L1, business: 'No Phone Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(AFTERNOON), socials: {} }];
  const key = `cb:${L1}:${iso(AFTERNOON)}`;
  _state.result = NO_DEVICE;
  let r = await runReminders(db, AFTERNOON);
  ok(r.sent === 0 && r.retrying === 1 && r.failed === 0 && _pushes.length === 1, `try one: attempted, nothing delivered, to be retried (sent ${r.sent}, retrying ${r.retrying})`);
  ok(!(notif().sentReminderKeys || []).includes(key) && notif().reminderTries[key] === 1, 'it is not stamped as sent and the try is counted', 'zero-delivered');
  r = await runReminders(db, AFTERNOON + MIN);
  ok(_pushes.length === 2 && notif().reminderTries[key] === 2 && !(notif().sentReminderKeys || []).includes(key), 'the next run tries it again (try two)');
  r = await runReminders(db, AFTERNOON + 2 * MIN);
  ok(r.failed === 1 && _pushes.length === 3 && (notif().sentReminderKeys || []).includes(key) && !notif().reminderTries[key], 'the third try that fails stamps it failed, once');
  const fail = (notif().reminderOutcomes || []).find(o => o.key === key && o.status === 'failed');
  ok(!!fail && fail.reason === 'no-devices', `the outcome keeps the reason (${JSON.stringify(fail)})`);
  await runReminders(db, AFTERNOON + 3 * MIN);
  ok(_pushes.length === 3, 'and it is never tried a fourth time');
  const h = _stores.settings.find(x => x._id === 'health').crons.reminders;
  ok(h.lastPushError === 'no-devices' && h.failed === 0 && !h.lastPushAt, `health keeps the last error and no delivery (${h.lastPushError}, lastPushAt ${h.lastPushAt})`);
}

section('8. a device that comes back on the second try gets it, once');
{
  seed();
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(AFTERNOON)}`];
  _stores.call_leads = [{ _id: L1, business: 'Second Try Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(AFTERNOON), socials: {} }];
  const key = `cb:${L1}:${iso(AFTERNOON)}`;
  _state.result = { attempted: 1, delivered: 0, removed: 0, errors: ['http-403'] };
  await runReminders(db, AFTERNOON);
  _state.result = DELIVERED;
  const r = await runReminders(db, AFTERNOON + MIN);
  ok(r.sent === 1 && (notif().sentReminderKeys || []).includes(key) && !notif().reminderTries[key], 'delivered on the retry: stamped sent and the count cleared');
  ok((notif().reminderOutcomes || []).some(o => o.key === key && o.status === 'sent'), 'its outcome is sent');
  const before = _pushes.length;
  await runReminders(db, AFTERNOON + 2 * MIN);
  ok(_pushes.length === before, 'no third push');
  const h = _stores.settings.find(x => x._id === 'health').crons.reminders;
  ok(h.lastPushAt === iso(AFTERNOON + MIN) && h.lastPushError === '' && h.devices === 1, `health records the delivery (${h.lastPushAt}, ${h.devices} device)`);
}

section('9. twelve due at once, none delivered: all twelve wait, none stamped, then all go on delivery');
{
  seed();
  const now = Z.zoneDateAt('2026-10-02', 16, 0);
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(now)}`];
  _stores.call_leads = Array.from({ length: 12 }, (_, i) => ({ _id: `cb${i}`, business: `Combine Co ${i}`, stage: 'lead', callStatus: 'callback', callbackAt: iso(now), socials: {} }));
  _state.result = NO_DEVICE;
  await runReminders(db, now);
  ok(_pushes.length === 1 && (notif().sentReminderKeys || []).filter(k => k.startsWith('cb:')).length === 0, 'the combined push reached nobody: not one of the twelve is stamped');
  _state.result = DELIVERED;
  const r = await runReminders(db, now + MIN);
  ok(r.sent === 1 && (notif().sentReminderKeys || []).filter(k => k.startsWith('cb:')).length === 12, 'the next run delivers the combined push and stamps all twelve');
}

section('10. a task no device took keeps its reminder: notifiedAt is stamped only on delivery');
{
  seed();
  _stores.settings[0].sentReminderKeys = [`digest:${Z.zoneDayKey(AFTERNOON)}`];
  _stores.call_leads = [lateTask('tk1', 'Task Co', 'Send the proof', AFTERNOON - 2 * MIN)];
  _state.result = NO_DEVICE;
  await runReminders(db, AFTERNOON);
  ok(!_stores.call_leads[0].nextAction.notifiedAt, 'zero delivered: the task is not stamped');
  _state.result = DELIVERED;
  const r = await runReminders(db, AFTERNOON + MIN);
  ok(r.tasks === 1 && !!_stores.call_leads[0].nextAction.notifiedAt, 'delivered on the next run: the task is stamped notified');
}

section('11. the morning digest is owed until a device takes it, three tries, and a quiet day is still handled');
{
  seed();
  const t0 = Z.zoneDateAt('2026-10-02', 8, 40);
  _stores.call_leads = [{ _id: L1, business: 'Digest Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(Z.zoneDateAt('2026-10-02', 12, 0)), socials: {} }];
  const dk = `digest:${Z.zoneDayKey(t0)}`;
  _state.result = NO_DEVICE;
  let r = await runReminders(db, t0);
  ok(r.digest === 0 && !(notif().sentReminderKeys || []).includes(dk) && notif().reminderTries[dk] === 1, 'a digest nobody took is not stamped and is counted');
  _state.result = DELIVERED;
  r = await runReminders(db, t0 + MIN);
  ok(r.digest === 1 && (notif().sentReminderKeys || []).includes(dk) && !notif().reminderTries[dk], 'it goes on the next run and is stamped');
  const n = _pushes.length;
  await runReminders(db, t0 + 2 * MIN);
  ok(_pushes.length === n, 'and only once that day');
  seed(); _stores.call_leads = []; _state.result = NO_DEVICE;
  r = await runReminders(db, t0);
  ok(_pushes.length === 0 && (notif().sentReminderKeys || []).includes(dk) && !notif().reminderTries?.[dk], 'a day with nothing to say needs no device: it is stamped handled');
}

section('12. what the push asks of the push service: reminders are high urgency and short lived, the digest normal');
{
  seed();
  _stores.settings[0].sentReminderKeys = [];
  const t0 = Z.zoneDateAt('2026-10-02', 8, 40);
  _stores.call_leads = [{ _id: L1, business: 'Kind Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(t0 - MIN), socials: {} }];
  await runReminders(db, t0);
  const cb = _pushes.find(p => /^Call back/.test(p.title)); const dg = _pushes.find(p => /^Today:/.test(p.title));
  ok(!!cb && cb.kind === 'reminder' && !!dg && dg.kind === 'digest', `the cron tags a reminder as a reminder and the digest as the digest (${cb?.kind}, ${dg?.kind})`, 'push-kind');
}

section('13. the daily job tells Rob when the reminders job has stopped');
{
  process.env.CRON_SECRET = 'cron-test-secret';
  const { handler: daily } = await load('_routes/cron-daily.js');
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader(k, v) { this._headers[k] = v; } });
  const runDaily = async () => { const res = fakeRes(); await daily({ method: 'GET', query: {}, headers: { authorization: 'Bearer cron-test-secret' }, url: '/api/cron/daily', socket: {} }, res); return res; };
  const alarm = () => _pushes.filter(p => /^Reminders have not run/.test(p.title));
  seed();
  _stores.settings.push({ _id: 'health', crons: { reminders: { lastRunAt: new Date(Date.now() - 3 * HOUR).toISOString(), runs: [] } } });
  let res = await runDaily();
  ok(res._status === 200 && res._json.reminderAlarm === true && alarm().length === 1, `three hours since the last run: one push (${alarm().map(p => p.title).join()})`, 'daily-alarm');
  ok(/^Reminders have not run since /.test(alarm()[0].body) && /Pushes will not arrive/.test(alarm()[0].body), `it names the last run (${alarm()[0]?.body})`);
  seed();
  _stores.settings.push({ _id: 'health', crons: { reminders: { lastRunAt: new Date(Date.now() - 2 * MIN).toISOString(), runs: [] } } });
  res = await runDaily();
  ok(res._status === 200 && alarm().length === 0 && res._json.reminderAlarm === false, 'a run two minutes ago: no push');
  seed();
  res = await runDaily();
  ok(alarm().length === 1 && /never run/.test(alarm()[0].body), 'no reminders run on record at all: it says never');
  seed();
  _stores.settings.push({ _id: 'health', crons: { reminders: { lastRunAt: new Date(Date.now() - 3 * HOUR).toISOString(), runs: [] } } });
  _state.result = NO_DEVICE;
  res = await runDaily();
  ok(res._status === 200 && res._json.reminderAlarm === false && alarm().length === 1, 'a push nobody took still lets the daily job finish, and says it was not delivered');
  _state.result = DELIVERED;
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
