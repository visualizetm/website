#!/usr/bin/env node
/* The next action rules (CRM revamp, step 2), against src/lib/nextAction.js
 * and its server mirror api/_lib/nextAction.js with the same inputs, so the
 * two can never disagree. Dates are America/New_York: the process pins the
 * zone before the first Date is made.
 *   node scripts/next-action-test.mjs */
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
/* Closeout: this test runs itself twice, TZ=America/New_York and TZ=UTC.
 * The server's results are digested on each run and must be identical;
 * the client mirror (the browser's own zone) is asserted in the New York
 * run only. */
if (!process.env.ZONE_RUN) {
  const { spawnSync } = await import('node:child_process');
  const runs = ['America/New_York', 'UTC'].map(tz => { const r = spawnSync(process.execPath, [process.argv[1]], { env: { ...process.env, TZ: tz, ZONE_RUN: '1' }, encoding: 'utf8' }); const out = `${r.stdout || ''}${r.stderr || ''}`; return { tz, status: r.status, out, digest: (out.match(/^DIGEST (\S+)$/m) || [])[1] || '' }; });
  for (const r of runs) console.log(`\n[TZ=${r.tz}]\n${r.out.trim()}`);
  const same = !!runs[0].digest && runs[0].digest === runs[1].digest;
  console.log(same ? '\nThe server results are identical in America/New_York and UTC.' : `\nFAIL the server results differ between America/New_York and UTC (${runs[0].digest.slice(0, 12)} vs ${runs[1].digest.slice(0, 12)}).`);
  process.exit(runs.every(r => r.status === 0) && same ? 0 : 1);
}
const NY = process.env.TZ === 'America/New_York';
import { createHash } from 'node:crypto';
const digest = [];
const rec = (v) => { digest.push(JSON.stringify(v)); return v; };
const printDigest = () => console.log('DIGEST ' + createHash('sha256').update(digest.join('\n')).digest('hex'));
const client = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'nextAction.js')).href);
const server = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'nextAction.js')).href);

let fails = 0; let passes = 0;
const ok = (c, m) => { if (!NY) return; if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
const NOW = Date.UTC(2026, 8, 28, 14, 30); // Mon Sep 28 2026, 10:30 New York (14:30 UTC)
const DAY = 864e5;
const iso = (t) => new Date(t).toISOString();
const both = (label, record, ctx, expect) => {
  rec(server.nextActionFor(record, ctx, NOW));
  for (const [name, mod] of (NY ? [['client', client], ['server', server]] : [['server', server]])) {
    const got = mod.nextActionFor(record, ctx, NOW);
    if (expect === null) ok(got === null, `${name}: ${label} is null (got ${JSON.stringify(got)})`);
    else {
      ok(!!got && got.kind === expect.kind, `${name}: ${label} is ${expect.kind} (got ${got?.kind})`);
      if (got && expect.dueAt) ok(Math.abs(new Date(got.dueAt) - new Date(expect.dueAt)) < 60e3, `${name}: ${label} is due ${expect.dueAt} (got ${got.dueAt})`);
      if (got) ok(got.auto === true && got.doneAt === '' && typeof got.label === 'string' && got.label.length > 0, `${name}: ${label} is auto, not done, labelled`);
    }
  }
};

section('1. leads');
both('a lead with a callback', { _id: 'a', business: 'A', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + 2 * 3600e3) }, {}, { kind: 'callback', dueAt: iso(NOW + 2 * 3600e3) });
both('a lead with callback status and no time', { _id: 'a', business: 'A', stage: 'lead', callStatus: 'callback' }, {}, null);
both('a lead not called', { _id: 'a', business: 'A', stage: 'lead', callStatus: 'not-called' }, {}, null);
both('a legacy record with no stage and a callback', { _id: 'a', business: 'A', callStatus: 'callback', callbackAt: iso(NOW + DAY) }, {}, { kind: 'callback', dueAt: iso(NOW + DAY) });
both('a booked lead with a meeting on Wednesday and no concept set', { _id: 'b', business: 'B', stage: 'booked', meeting: { date: '2026-09-30', time: '16:30' } }, { sets: [] }, { kind: 'build-concepts', dueAt: new Date(2026, 8, 29, 9, 0).toISOString() });
both('a booked lead with a meeting and a set', { _id: 'b', business: 'B', stage: 'booked', meeting: { date: '2026-09-30', time: '16:30' } }, { sets: [{ leadId: 'b' }] }, null);
both('a booked lead with a meeting and only an archived set', { _id: 'b', business: 'B', stage: 'booked', meeting: { date: '2026-09-30', time: '16:30' } }, { sets: [{ leadId: 'b', archived: true }] }, { kind: 'build-concepts' });
both('a booked lead with no meeting date', { _id: 'b', business: 'B', stage: 'booked', meeting: { date: '', time: '' } }, {}, null);
both('a booked lead whose meeting passed 24h ago with no outcome', { _id: 'c', business: 'C', stage: 'booked', meeting: { date: '2026-09-26', time: '10:00' } }, { sets: [] }, { kind: 'log-outcome', dueAt: iso(NOW) });
both('a booked lead whose meeting passed 12h ago', { _id: 'c', business: 'C', stage: 'booked', meeting: { date: '2026-09-27', time: '22:00' } }, { sets: [{ leadId: 'c' }] }, null);
both('a booked lead whose meeting passed 12h ago and has no set', { _id: 'c', business: 'C', stage: 'booked', meeting: { date: '2026-09-27', time: '22:00' } }, { sets: [] }, { kind: 'build-concepts' });
both('a booked lead whose meeting passed with an outcome', { _id: 'c', business: 'C', stage: 'booked', meeting: { date: '2026-09-26', time: '10:00' }, bookedOutcome: { result: 'won', at: iso(NOW - DAY) } }, { sets: [{ leadId: 'c' }] }, null);
const released = { _id: 'p1', leadId: 'd', name: 'Site', stage: 'delivered', releasedAt: iso(NOW - 4 * DAY), schedule: [], delivery: { pitchSent: true } };
both('a client with a release four days old and no asks', { _id: 'd', business: 'D', stage: 'client', reviews: { asks: [] } }, { projects: [released] }, { kind: 'review-ask', dueAt: iso(NOW - DAY) });
both('a client with a release two days old', { _id: 'd', business: 'D', stage: 'client', reviews: { asks: [] } }, { projects: [{ ...released, releasedAt: iso(NOW - 2 * DAY) }] }, null);
both('a client already asked', { _id: 'd', business: 'D', stage: 'client', reviews: { asks: [{ at: iso(NOW - DAY), channel: 'text' }] } }, { projects: [released] }, null);
both('a client with no released project', { _id: 'd', business: 'D', stage: 'client' }, { projects: [{ ...released, releasedAt: '' }] }, null);
both('a declined lead with a callback', { _id: 'e', business: 'E', stage: 'declined', callStatus: 'callback', callbackAt: iso(NOW + DAY) }, {}, null);
both('a nurture lead with a meeting', { _id: 'e', business: 'E', stage: 'nurture', meeting: { date: '2026-09-30', time: '10:00' } }, { sets: [] }, null);
both('a won record', { _id: 'e', business: 'E', stage: 'won' }, {}, null);

section('2. projects');
both('a project with an unpaid line past its date', { _id: 'p2', leadId: 'd', stage: 'build', schedule: [{ id: 's1', amount: 300, dueAt: '2026-09-20', status: 'upcoming' }], delivery: { pitchSent: false } }, {}, { kind: 'chase-invoice', dueAt: iso(NOW) });
both('a project with a line due today', { _id: 'p2', leadId: 'd', stage: 'build', schedule: [{ id: 's1', amount: 300, dueAt: '2026-09-28', status: 'upcoming' }] }, {}, null);
both('a project with a paid past line', { _id: 'p2', leadId: 'd', stage: 'build', schedule: [{ id: 's1', amount: 300, dueAt: '2026-09-20', status: 'paid' }] }, {}, null);
both('a delivered project with the pitch not sent', { _id: 'p3', leadId: 'd', stage: 'delivered', releasedAt: iso(NOW - DAY), schedule: [], delivery: { pitchSent: false } }, {}, { kind: 'retainer-pitch', dueAt: iso(NOW + 2 * DAY) });
both('a delivered project with the pitch sent', { _id: 'p3', leadId: 'd', stage: 'delivered', releasedAt: iso(NOW - DAY), schedule: [], delivery: { pitchSent: true } }, {}, null);
both('a delivered project with a late line pitches after the chase', { _id: 'p3', leadId: 'd', stage: 'delivered', releasedAt: iso(NOW - DAY), schedule: [{ id: 's1', amount: 100, dueAt: '2026-09-01', status: 'upcoming' }], delivery: { pitchSent: false } }, {}, { kind: 'chase-invoice' });
both('an archived project', { _id: 'p3', leadId: 'd', stage: 'delivered', archived: true, schedule: [{ id: 's1', amount: 100, dueAt: '2026-09-01', status: 'upcoming' }], delivery: { pitchSent: false } }, {}, null);

section('3. resolve: manual, done, and the shared write helper');
{
  const lead = { _id: 'a', business: 'A', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + DAY), nextAction: { kind: 'custom', label: 'Drop off the samples', dueAt: iso(NOW + DAY), auto: false, doneAt: '' } };
  for (const [name, mod] of [['client', client], ['server', server]]) {
    ok(mod.resolveNextAction(lead, mod.nextActionFor(lead, {}, NOW)).label === 'Drop off the samples', `${name}: a manual action survives the recompute`);
    const done = { ...lead, nextAction: { kind: 'callback', label: 'Call back', dueAt: iso(NOW + DAY), auto: true, doneAt: iso(NOW) } };
    ok(mod.resolveNextAction(done, mod.nextActionFor(done, {}, NOW)).doneAt === iso(NOW), `${name}: a done action for the same due stays done`);
    const moved = { ...done, callbackAt: iso(NOW + 2 * DAY) };
    const r = mod.resolveNextAction(moved, mod.nextActionFor(moved, {}, NOW));
    ok(r.doneAt === '' && r.dueAt === iso(NOW + 2 * DAY), `${name}: a done action is raised again when the due moves`);
    ok(mod.resolveNextAction({ ...lead, nextAction: { kind: 'callback', label: 'Call back', dueAt: '', auto: true, doneAt: '' }, stage: 'declined' }, null) === null, `${name}: a null rule clears an auto action`);
  }
  const set = client.withNextAction({ _id: 'a', business: 'A', stage: 'lead', callStatus: 'not-called' }, { callStatus: 'callback', callbackAt: iso(NOW + DAY) }, {}, NOW);
  ok(set.nextAction?.kind === 'callback', 'withNextAction adds the callback on the same set');
  const same = client.withNextAction({ _id: 'a', business: 'A', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + DAY), nextAction: set.nextAction }, { notes: 'hi' }, {}, NOW);
  ok(!('nextAction' in same), 'a write that touches nothing relevant leaves the field alone');
  const cleared = client.withNextAction({ _id: 'a', business: 'A', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + DAY), nextAction: set.nextAction }, { stage: 'declined' }, {}, NOW);
  ok(cleared.nextAction === null, 'a stage change to declined clears it');
  const explicit = client.withNextAction({ _id: 'a', business: 'A', stage: 'lead' }, { stage: 'booked', nextAction: null }, {}, NOW);
  ok(explicit.nextAction === null, 'an explicit nextAction in the set is never overridden');
  const q = client.nextUpItems([
    { _id: 'o', business: 'Overdue Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW - 2 * DAY) },
    { _id: 't', business: 'Today Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + 3600e3) },
    { _id: 'l', business: 'Later Co', stage: 'booked', meeting: { date: '2026-10-03', time: '10:00' } },
    { _id: 'f', business: 'Far Co', stage: 'booked', meeting: { date: '2026-10-20', time: '10:00' } },
    { _id: 'x', business: 'Done Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW - DAY), nextAction: { kind: 'callback', label: 'Call back', dueAt: iso(NOW - DAY), auto: true, doneAt: iso(NOW) } },
  ], [{ _id: 'p9', leadId: 't', name: 'Site', stage: 'build', schedule: [{ id: 's', amount: 1, dueAt: '2026-09-01', status: 'upcoming' }] }], [], NOW);
  ok(q.overdue.map(i => i.lead.business).join(',') === 'Overdue Co', `overdue holds the late callback (${q.overdue.map(i => i.lead.business).join(',')})`);
  ok(q.today.length === 2 && q.today.every(i => i.lead.business === 'Today Co') && q.today.some(i => i.action.kind === 'chase-invoice'), 'today holds the callback due in an hour and the invoice to chase, which is due now');
  ok(q.later.length === 1 && q.later[0].action.kind === 'build-concepts', 'later holds the concepts due this week, not the meeting three weeks out');
  ok(!q.all.some(i => i.lead.business === 'Done Co'), 'a done action is not in the queue');
  ok(client.nextUpBadge([{ _id: 'o', business: 'O', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW - DAY) }], [], [], NOW) === 1, 'the badge counts overdue plus today');
}

section('4. the home rows: Tomorrow at 9:00 New York, what the check does, the lists');
const home = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'homeRows.js')).href);
// Asserted in the New York run and the UTC run alike: Tomorrow is pinned to the zone, not to the browser's.
const okAll = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
{
  const cases = [
    ['a mid morning New York', NOW, Date.UTC(2026, 8, 29, 13, 0)],
    ['11:30 at night New York is still the same New York day (03:30 UTC the next day)', Date.UTC(2026, 8, 29, 3, 30), Date.UTC(2026, 8, 29, 13, 0)],
    ['the eve of the fall back (Nov 1): 9:00 is Eastern Standard', Date.UTC(2026, 9, 31, 15, 0), Date.UTC(2026, 10, 1, 14, 0)],
    ['the eve of the spring forward (Mar 8): 9:00 is Eastern Daylight', Date.UTC(2026, 2, 7, 17, 0), Date.UTC(2026, 2, 8, 13, 0)],
    ['the last day of a month', Date.UTC(2026, 8, 30, 16, 0), Date.UTC(2026, 9, 1, 13, 0)],
  ];
  for (const [label, now, want] of cases) { const got = client.tomorrowNineNY(now); rec([label, got]); okAll(got === want, `tomorrowNineNY, ${label}: ${new Date(got).toISOString()} (want ${new Date(want).toISOString()})`); }
}
const isoAt = (t) => new Date(t).toISOString();
const phoneLead = { _id: 'cb', business: 'Callback Co', stage: 'lead', callStatus: 'callback', callbackAt: isoAt(NOW - 3600e3), phone: '(302) 555-0100' };
const quietLead = { _id: 'cq', business: 'No Phone Co', stage: 'lead', callStatus: 'callback', callbackAt: isoAt(NOW - 3 * DAY) };
const taskClient = { _id: 'tc', business: 'Task Co', stage: 'client', checklists: [{ id: 'L', name: 'Print', items: [{ id: 't1', text: 'Print the NFC sticker covers', done: false, doneAt: '', due: isoAt(NOW - DAY), note: 'keep', order: 0, pinned: false, remindAt: '', notifiedAt: isoAt(NOW - DAY), source: 'manual', suggestionId: '' }, { id: 't2', text: 'Second task', done: false, due: isoAt(NOW + 3 * DAY), order: 1 }] }] };
const manualLead = { _id: 'mn', business: 'Manual Co', stage: 'lead', callStatus: 'not-called', nextAction: { kind: 'custom', label: 'Drop off the samples', dueAt: isoAt(NOW - 2 * DAY), auto: false, doneAt: '', remindAt: isoAt(NOW - 2 * DAY), notifiedAt: '' } };
const lateProject = { _id: 'pl', leadId: 'inv', name: 'Site', stage: 'build', schedule: [{ id: 's1', amount: 300, dueAt: '2026-09-20', status: 'upcoming' }], delivery: { pitchSent: false } };
const invLead = { _id: 'inv', business: 'Invoice Co', stage: 'client' };
const outcomeLead = { _id: 'lo', business: 'Outcome Co', stage: 'booked', meeting: { date: '2026-09-26', time: '10:00' } };
const qHome = client.nextUpItems([phoneLead, quietLead, taskClient, manualLead, invLead, outcomeLead], [lateProject], [], NOW);
const itemOf = (id) => [...qHome.overdue, ...qHome.today, ...qHome.later].find(i => i.id === id);
{
  const call = itemOf('l:cb'), quiet = itemOf('l:cq'), task = itemOf('l:tc'), manual = itemOf('l:mn'), inv = itemOf('p:pl'), out = itemOf('l:lo');
  ok(!!call && !!quiet && !!task && !!manual && !!inv && !!out, `every record has a next action in the queue (${[call, quiet, task, manual, inv, out].map(Boolean).join(',')})`);
  const pc = client.homeRowAction(call, NOW), pq = client.homeRowAction(quiet, NOW), pt = client.homeRowAction(task, NOW), pm = client.homeRowAction(manual, NOW), pi = client.homeRowAction(inv, NOW), po = client.homeRowAction(out, NOW);
  ok(pc.check === 'outcome' && pc.tomorrow === 'callback' && pc.call === true, `a callback: the check opens the outcome sheet, Tomorrow moves the callback, Call is there (${JSON.stringify(pc)})`);
  ok(pq.call === false && pq.check === 'outcome', 'a callback with no phone number has no Call button and still opens the outcome sheet');
  ok(pt.check === 'task' && pt.tomorrow === 'task' && pt.call === false, `a real task: the check completes it, Tomorrow moves its due (${JSON.stringify(pt)})`);
  ok(pm.check === 'manual' && pm.tomorrow === 'manual', `a manual action with no task: done stamps its doneAt, Tomorrow moves its due (${JSON.stringify(pm)})`);
  ok(pi.check === 'open' && pi.tomorrow === null && pi.open === 'payments', `an invoice to chase is derived: Open, no Tomorrow, the payments section (${JSON.stringify(pi)})`);
  ok(po.check === 'open' && po.tomorrow === null && po.open === 'outcome', 'a meeting outcome to log is derived: Open at the outcome, no Tomorrow');
  ok(pt.title === 'Print the NFC sticker covers' && client.homeRowAction(inv, NOW).title.endsWith(', Site'), 'the title is the action, with the project name after a comma on a project');

  section('4b. the check: a call or a callback never writes done');
  const cw = home.checkWrite(call, {}, NOW);
  ok(cw === null, 'the check on a callback writes nothing (it opens the Log outcome sheet)');
  ok(home.checkWrite(quiet, {}, NOW) === null && home.checkWrite(inv, {}, NOW) === null && home.checkWrite(out, {}, NOW) === null, 'the check on a derived rule action writes nothing');
  const tw = home.checkWrite(task, {}, NOW);
  const doneItem = tw?.set.checklists?.[0]?.items?.find(i => i.id === 't1');
  ok(!!doneItem && doneItem.done === true && doneItem.doneAt === isoAt(NOW) && tw.set.checklists[0].items.find(i => i.id === 't2').done === false, 'the check on a task completes that task only, stamping doneAt');
  ok(tw?.undo(task.record).checklists[0].items.find(i => i.id === 't1').done === false, 'the undo of a task check reopens it');
  const mw = home.checkWrite(manual, {}, NOW);
  ok(mw?.set.nextAction.doneAt === isoAt(NOW) && mw.set.nextAction.label === 'Drop off the samples' && mw.undo().nextAction.doneAt === '', 'the check on a manual action stamps its doneAt, and the undo clears it');

  section('4c. Tomorrow: 9:00 AM New York, the row leaves overdue, the undo puts it back');
  const nine = isoAt(Date.UTC(2026, 8, 29, 13, 0));
  const tt = home.tomorrowWrite(task, {}, NOW);
  const moved = tt?.set.checklists?.[0]?.items?.find(i => i.id === 't1');
  okAll(!!moved && moved.due === nine && moved.text === 'Print the NFC sticker covers' && moved.done === false && moved.note === 'keep' && moved.notifiedAt === '', `Tomorrow on a task moves its due to 9:00 New York tomorrow and clears notifiedAt (${moved?.due})`);
  okAll(tt?.set.checklists[0].items.find(i => i.id === 't2').due === isoAt(NOW + 3 * DAY), 'Tomorrow leaves the other tasks alone');
  okAll(tt?.undo(task.record).checklists[0].items.find(i => i.id === 't1').due === isoAt(NOW - DAY), 'the undo puts the old due back');
  const after = client.nextUpItems([{ ...taskClient, checklists: tt.set.checklists }], [], [], NOW);
  okAll(after.overdue.length === 0 && after.later.some(i => i.action.taskId === 't1' || i.action.taskId === 't2'), 'after Tomorrow the task is out of Overdue');
  const cbw = home.tomorrowWrite(call, {}, NOW);
  okAll(cbw?.set.callbackAt === nine && cbw.undo().callbackAt === phoneLead.callbackAt && Object.keys(cbw.set).join() === 'callbackAt', 'Tomorrow on a callback writes callbackAt alone, the same field the record writes, and the undo restores it');
  const mtw = home.tomorrowWrite(manual, {}, NOW);
  okAll(mtw?.set.nextAction.dueAt === nine && mtw.set.nextAction.auto === false && mtw.undo().nextAction.dueAt === manual.action.dueAt, 'Tomorrow on a manual action moves its dueAt and keeps it manual');
  okAll(home.tomorrowWrite(inv, {}, NOW) === null && home.tomorrowWrite(out, {}, NOW) === null, 'a derived row has no Tomorrow');
}

section('4d. the late labels (the browser zone, asserted in the New York run)');
{
  const row = (due) => ({ action: { kind: 'callback', dueAt: isoAt(due) }, due });
  ok(client.lateLabel(row(NOW - 3600e3), NOW) === '1h late', 'an hour past today reads 1h late');
  ok(client.lateLabel(row(NOW - 20 * 60e3), NOW) === '20m late', 'twenty minutes past reads 20m late');
  ok(client.lateLabel(row(NOW - 150 * 60e3), NOW) === '2h late', 'two and a half hours past reads 2h late');
  ok(client.lateLabel(row(NOW + 60e3), NOW) === '' && client.lateLabel(row(NOW), NOW) === '', 'a row not yet due is not late');
  ok(client.lateLabel(row(Date.UTC(2026, 8, 27, 19, 0)), NOW) === 'Yesterday', 'yesterday afternoon reads Yesterday');
  ok(client.lateLabel(row(Date.UTC(2026, 8, 25, 14, 0)), NOW) === '3 days late', 'three calendar days back reads 3 days late');
  ok(client.lateLabel(row(Date.UTC(2026, 8, 28, 3, 0)), NOW) === 'Yesterday', 'late last night (11 PM the day before) reads Yesterday, by the calendar day');
  ok(/^9:30\sAM, 1h late$/.test(client.homeTimeLabel(row(NOW - 3600e3), NOW)) && /^11:30\sAM$/.test(client.homeTimeLabel(row(NOW + 3600e3), NOW)), 'a Today row reads "9:30 AM, 1h late" past and just the time ahead');
}

section('4e. the lists: Today is never capped, Overdue shows five and says how many more');
{
  const mk = (id, due, extra = {}) => ({ id, record: { _id: id }, lead: { _id: id, business: id }, project: null, action: { kind: 'custom', label: id, dueAt: isoAt(due), auto: true, doneAt: '', ...extra }, due, bucket: 'today' });
  const many = { today: Array.from({ length: 7 }, (_, i) => mk(`t${i}`, NOW + i * 60e3)), overdue: Array.from({ length: 9 }, (_, i) => mk(`o${i}`, NOW - (9 - i) * DAY)), later: [mk('l0', NOW + 2 * DAY)] };
  const a = home.homeLists(many);
  ok(a.today.length === 7, `Today shows all seven (got ${a.today.length})`);
  ok(a.overdue.length === 5 && a.hidden === 4 && a.overdueCount === 9, `Overdue shows five and hides four of nine (got ${a.overdue.length} shown, ${a.hidden} hidden)`);
  ok(a.overdue[0].item.id === 'o0' && a.overdue[4].item.id === 'o4', 'Overdue is oldest first');
  ok(home.homeLists(many, {}, { expanded: true }).overdue.length === 9 && home.homeLists(many, {}, { expanded: true }).hidden === 0, 'Show more opens all nine');
  const gone = mk('t0', NOW, {});
  const g = { [home.rowKey(gone)]: { key: home.rowKey(gone), item: gone, card: 'today', mode: 'done' } };
  const none = home.homeLists({ today: [], overdue: [], later: [] }, g);
  ok(none.today.length === 1 && none.today[0].done === true && none.doneToday === 1, 'a task finished this session stays in Today, done, and counts toward X of Y');
  const dup = home.homeLists({ today: [gone], overdue: [], later: [] }, g);
  ok(dup.today.length === 1 && dup.today[0].done === false, 'a row that comes back (an undo) is the live row, not a second one');
  const leaving = mk('o1', NOW - 2 * DAY);
  const lg = home.homeLists({ today: [], overdue: [], later: [] }, { k: { key: home.rowKey(leaving), item: leaving, card: 'overdue', mode: 'leaving' } });
  ok(lg.overdue.length === 1 && lg.overdue[0].leaving === true && lg.overdueCount === 0, 'a row moved to tomorrow fades in place and is not counted');
  const done = [0, 1, 2].map(i => mk(`d${i}`, NOW + i));
  const three = home.homeLists({ today: done.slice(1), overdue: [], later: [] }, { x: { key: home.rowKey(done[0]), item: done[0], card: 'today', mode: 'done' } });
  ok(three.today.length === 3 && three.doneToday === 1, '1 of 3 done: the finished row and the two still open');
}

printDigest();
console.log(NY ? `\n${passes} checks passed, ${fails} failed.` : '\nUTC run: the server results recorded.');
console.log(fails ? 'Next action tests FAILED.' : 'All next action tests pass.');
process.exit(fails ? 1 : 0);
