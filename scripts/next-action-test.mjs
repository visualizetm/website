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

printDigest();
console.log(NY ? `\n${passes} checks passed, ${fails} failed.` : '\nUTC run: the server results recorded.');
console.log(fails ? 'Next action tests FAILED.' : 'All next action tests pass.');
process.exit(fails ? 1 : 0);
