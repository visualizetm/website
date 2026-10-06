#!/usr/bin/env node
/* Tasks with a due date: remindAt for each Remind me choice in
 * America/New_York, then the reminders cron with the in-memory mongo: a due
 * task pushes once and never again, a done task never pushes, the toggle off
 * sends nothing, the digest lists today's tasks under Tasks.
 *   node scripts/task-reminder-test.mjs */
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

section('1. remindAt for each Remind me choice, America/New_York');
const T = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'tasks.js')).href);
const Z = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'zone.js')).href);
{
  const date = '2026-10-02'; const time = '14:30';
  const dueMs = Z.zoneDateAt(date, 14, 30);
  const at = T.taskTimes({ date, time, remind: 'at' });
  ok(new Date(at.dueAt).getTime() === dueMs, `dueAt is 2:30pm New York (${at.dueAt})`);
  ok(at.remindAt === at.dueAt, 'at the time: remindAt is dueAt');
  const hour = T.taskTimes({ date, time, remind: 'hour' });
  ok(new Date(hour.remindAt).getTime() === dueMs - 3600e3, '1 hour before: remindAt is dueAt minus an hour');
  const morning = T.taskTimes({ date, time, remind: 'morning' });
  ok(new Date(morning.remindAt).getTime() === Z.zoneDateAt(date, 9, 0), 'the morning of at 9:00: remindAt is nine that day in New York');
  const off = T.taskTimes({ date, time, remind: 'off' });
  ok(off.remindAt === '' && off.dueAt === at.dueAt, 'off: no remindAt, the same dueAt');
  const built = T.buildTask({ label: '  Drop off the proof  ', date, time, remind: 'hour' });
  ok(built.kind === 'custom' && built.auto === false && built.doneAt === '' && built.notifiedAt === '' && built.label === 'Drop off the proof' && built.remindAt === hour.remindAt, 'buildTask writes the task shape with auto false and notifiedAt empty');
  ok(T.isTask(built) && !T.isTask({ kind: 'custom', label: 'x', auto: false }) && !T.isTask({ ...built, auto: true }), 'isTask needs custom, auto false and the remindAt field');
  ok(T.remindChoiceOf(built) === 'hour' && T.remindChoiceOf(T.buildTask({ label: 'a', date, time, remind: 'morning' })) === 'morning' && T.remindChoiceOf(T.buildTask({ label: 'a', date, time, remind: 'off' })) === 'off' && T.remindChoiceOf(T.buildTask({ label: 'a', date, time, remind: 'at' })) === 'at', 'remindChoiceOf reads the choice back for the prefilled sheet');
  const todayKey = T.dateKeyOf(new Date());
  ok(/^Today /.test(T.fmtTaskDue(T.taskTimes({ date: todayKey, time: '14:30' }).dueAt)), `today reads "Today 2:30 PM" (${T.fmtTaskDue(T.taskTimes({ date: todayKey, time: '14:30' }).dueAt)})`);
  ok(T.fmtTaskDue(at.dueAt, Date.UTC(2026, 8, 29, 12)) === 'Fri Oct 2, 2:30 PM', `another day reads "Fri Oct 2, 2:30 PM" (${T.fmtTaskDue(at.dueAt, Date.UTC(2026, 8, 29, 12))})`);
  const S = await import(pathToFileURL(path.join(repoRoot, 'src', 'shared', 'semantics.js')).href);
  const A = await import(pathToFileURL(path.join(repoRoot, 'api', '_semantics.js')).href);
  ok(JSON.stringify(S.NEXT_ACTION_FIELDS) === JSON.stringify(A.NEXT_ACTION_FIELDS) && JSON.stringify(S.REMIND_CHOICE_IDS) === JSON.stringify(A.REMIND_CHOICE_IDS) && JSON.stringify(T.REMIND_CHOICE_IDS) === JSON.stringify(A.REMIND_CHOICE_IDS), 'the field list and the Remind me ids are mirrored in api/_semantics.js');
}

section('2. the reminders cron: once per task, never done, toggle off, the digest');
{
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'tasks-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  /* The push sender records instead of sending. */
  fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), "export const _pushes = [];\nexport async function sendPush(db, p) { _pushes.push(p); }\n");
  process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const { _pushes } = await load('_lib/notify.js');
  const cron = (await load('_routes/cron-reminders.js')).handler;
  const fakeRes = () => ({ _status: 200, _json: null, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader() {} });
  const run = async () => { const res = fakeRes(); await cron({ method: 'GET', query: {}, headers: { authorization: 'Bearer cron-test-secret' }, url: '/api/cron/reminders', socket: {} }, res); return res; };
  const now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const L1 = '507f1f77bcf86cd7994390c1', L2 = '507f1f77bcf86cd7994390c2', L3 = '507f1f77bcf86cd7994390c3', L4 = '507f1f77bcf86cd7994390c4', PJ = '507f1f77bcf86cd7994390d1';
  const todayKey = Z.zoneDayKey(now);
  const seed = (prefs = {}) => {
    _reset(); _pushes.length = 0;
    _stores.settings = [{ _id: 'notifications', reminders: { meetings: true, callbacks: true, bills: true, reviews: true, ...prefs }, sentReminderKeys: [] }];
    _stores.call_leads = [
      { _id: L1, business: 'Due Co', stage: 'lead', callStatus: 'not-called', socials: {}, nextAction: { kind: 'custom', label: 'Drop off the proof', dueAt: iso(now - 20 * 60e3), auto: false, doneAt: '', remindAt: iso(now - 20 * 60e3), notifiedAt: '' } },
      { _id: L2, business: 'Done Co', stage: 'client', callStatus: 'booked', socials: {}, nextAction: { kind: 'custom', label: 'Call about the sign', dueAt: iso(now - 60e3), auto: false, doneAt: iso(now - 30e3), remindAt: iso(now - 60e3), notifiedAt: '' } },
      { _id: L3, business: 'Later Co', stage: 'client', callStatus: 'booked', socials: {}, nextAction: { kind: 'custom', label: 'Send the proof', dueAt: iso(Z.zoneDateAt(todayKey, 23, 30)), auto: false, doneAt: '', remindAt: iso(now + 6 * 3600e3), notifiedAt: '' } },
      /* The task system: a checklist task with its own reminder, and a pinned one whose next action carries no reminder (so it is pushed once, from the task). */
      { _id: L4, business: 'List Co', stage: 'client', callStatus: 'booked', socials: {}, nextAction: { kind: 'custom', label: 'Hang the sign', dueAt: iso(now - 10 * 60e3), auto: false, doneAt: '', remindAt: '', notifiedAt: '', taskId: 'tk1' },
        checklists: [{ id: 'ck', name: 'Launch', items: [{ id: 'tk1', text: 'Hang the sign', done: false, due: iso(now - 10 * 60e3), remindAt: iso(now - 10 * 60e3), notifiedAt: '', pinned: true }, { id: 'tk2', text: 'Done already', done: true, due: iso(now - 60e3), remindAt: iso(now - 60e3), notifiedAt: '' }, { id: 'tk3', text: 'Tonight', done: false, due: iso(Z.zoneDateAt(todayKey, 22, 0)), remindAt: iso(now + 5 * 3600e3), notifiedAt: '' }] }] },
    ];
    _stores.projects = [{ _id: PJ, leadId: L2, name: 'Sign', kind: 'print', stage: 'design', invoices: [], nextAction: { kind: 'custom', label: 'Pick up the vinyl', dueAt: iso(now - 5 * 60e3), auto: false, doneAt: '', remindAt: iso(now - 5 * 60e3), notifiedAt: '' } }];
    _stores.push_subscriptions = [];
  };
  const lead = (id) => _stores.call_leads.find(l => String(l._id) === id);
  seed();
  let r = await run();
  const taskPushes = _pushes.filter(p => /^Task due: /.test(p.title));
  ok(r._status === 200 && r._json.tasks === 3 && taskPushes.length === 3, `three tasks past their reminder push once each, the pinned one once (${JSON.stringify(_pushes.map(p => p.title))})`);
  const sign = taskPushes.filter(p => p.title === 'Task due: Hang the sign');
  ok(sign.length === 1 && sign[0].url.endsWith(`/tasks?open=${L4}`), 'a checklist task pushes from the task, once, even though it is pinned as the next action');
  const l4 = lead(L4);
  ok(!!l4.checklists[0].items[0].notifiedAt && !l4.checklists[0].items[1].notifiedAt && !l4.checklists[0].items[2].notifiedAt && !l4.nextAction.notifiedAt, 'notifiedAt is stamped on the one checklist item, not the done one, not the one still ahead, and not the pinned next action');
  const proof = taskPushes.find(p => p.title === 'Task due: Drop off the proof');
  ok(!!proof && proof.url.endsWith(`/tasks?open=${L1}`) && /^Due Co · due \d{1,2}:\d{2} (AM|PM)$/.test(proof.body), `the push carries the business, the time and the deep link (${proof?.body}, ${proof?.url})`);
  const vinyl = taskPushes.find(p => p.title === 'Task due: Pick up the vinyl');
  ok(!!vinyl && vinyl.url.endsWith(`/tasks?open=${L2}`) && vinyl.body.startsWith('Done Co · due'), 'a project task names the client and opens the client');
  ok(!!lead(L1).nextAction.notifiedAt && !!_stores.projects[0].nextAction.notifiedAt, 'notifiedAt is stamped on both');
  ok(!lead(L2).nextAction.notifiedAt && !taskPushes.some(p => p.title === 'Task due: Call about the sign'), 'a done task never pushes');
  ok(!lead(L3).nextAction.notifiedAt, 'a task whose reminder is still ahead waits');
  const digest = _pushes.find(p => /^Today: /.test(p.title));
  ok(!!digest && /Tasks: /.test(digest.body) && /Send the proof \(Later Co, 11:30 PM\)/.test(digest.body), `the digest lists today's tasks under Tasks (${digest?.body})`);
  ok(/Tonight \(List Co, 10:00 PM\)/.test(digest?.body || ''), `a checklist task due today is in the digest too (${digest?.body})`);
  ok(!/Done already/.test(digest?.body || ''), 'a done checklist task is not in the digest');
  ok(!/Call about the sign/.test(digest?.body || ''), 'a done task is not in the digest');
  const before = _pushes.length;
  r = await run();
  ok(r._json.tasks === 0 && _pushes.length === before, 'a second run fifteen minutes later pushes nothing again (notifiedAt is the key, on the next action and on the checklist item)');
  const health = _stores.settings.find(s => s._id === 'health');
  ok(Array.isArray(health?.crons?.reminders?.runs) && health.crons.reminders.runs.length === 2 && !!health.crons.reminders.lastRunAt, 'health keeps the run times');
  seed({ tasks: false });
  r = await run();
  ok(r._json.tasks === 0 && !_pushes.some(p => /^Task due: /.test(p.title)) && !lead(L1).nextAction.notifiedAt && !/Tasks:/.test(_pushes.find(p => /^Today: /.test(p.title))?.body || ''), 'the toggle off sends no task push and leaves the digest without Tasks');
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
