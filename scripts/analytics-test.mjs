#!/usr/bin/env node
/* Analytics (the nav revamp, milestone 6): the rules in src/lib/analytics.js
 * and their server mirror api/_lib/analytics.js with the same inputs, the
 * mirror byte for byte below ANALYTICS_RANGES, and the route against the
 * in-memory mongo. Runs twice, TZ=America/New_York and TZ=UTC: the server's
 * results must be identical in both.
 *   node scripts/analytics-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
if (!process.env.ZONE_RUN) {
  const { spawnSync } = await import('node:child_process');
  const runs = ['America/New_York', 'UTC'].map(tz => { const r = spawnSync(process.execPath, [process.argv[1]], { env: { ...process.env, TZ: tz, ZONE_RUN: '1' }, encoding: 'utf8' }); const out = `${r.stdout || ''}${r.stderr || ''}`; return { tz, status: r.status, out, digest: (out.match(/DIGEST (\w+)/) || [])[1] || '' }; });
  for (const r of runs) console.log(`\n[TZ=${r.tz}]\n${r.out.trim()}`);
  const same = !!runs[0].digest && runs[0].digest === runs[1].digest;
  console.log(same ? '\nThe server results are identical in America/New_York and UTC.' : `\nFAIL the server results differ between America/New_York and UTC (${runs[0].digest.slice(0, 12)} vs ${runs[1].digest.slice(0, 12)})`);
  process.exit(runs.every(r => r.status === 0) && same ? 0 : 1);
}
const NY = process.env.TZ === 'America/New_York';
import { createHash } from 'node:crypto';
const digest = [];
const rec = (v) => { digest.push(JSON.stringify(v)); return v; };
const printDigest = () => console.log('DIGEST ' + createHash('sha256').update(digest.join('\n')).digest('hex'));

let fails = 0; let passes = 0;
const ok = (c, m) => { if (!NY) return; if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
const client = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'analytics.js')).href);
const server = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'analytics.js')).href);

section('1. the mirror is byte for byte below ANALYTICS_RANGES');
{
  const body = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8').split('export const ANALYTICS_RANGES')[1];
  ok(body('src/lib/analytics.js') === body('api/_lib/analytics.js'), 'api/_lib/analytics.js is src/lib/analytics.js below ANALYTICS_RANGES');
}

const NOW = Date.UTC(2026, 9, 6, 15, 30); // Tue Oct 6 2026, 11:30 New York
const DAY = 864e5;
const iso = (t) => new Date(t).toISOString();
const d = (n) => iso(NOW - n * DAY);
const LEADS = [
  { _id: 'a', business: 'A', stage: 'client', clientSince: d(3), createdAt: d(200), callStatus: 'booked', callLog: [{ at: d(100) }], retainer: { status: 'active', amount: 250 },
    purchases: [{ id: 'p1', amount: 500, at: d(2), projectId: 'P1' }, { id: 'p2', amount: 250, at: d(40), projectId: 'P2' }, { id: 'p3', amount: 100, at: d(400) }, { id: 'p4', amount: 75, at: '2026-10-05' }],
    checklists: [{ id: 'c', name: 'x', items: [{ id: 't1', text: 'done now', done: true, doneAt: d(1) }, { id: 't2', text: 'done before', done: true, doneAt: d(45) }, { id: 't3', text: 'open', done: false, doneAt: '' }] }],
    deal: { invoices: [{ id: 'i1', amount: 300, status: 'sent', dueAt: '2026-10-20' }, { id: 'i2', amount: 999, status: 'paid' }, { id: 'i3', amount: 50, status: 'draft' }] },
    meeting: { date: '2026-10-01', time: '14:00' } },
  { _id: 'b', business: 'B', stage: 'won', clientSince: d(50), createdAt: d(20), callStatus: 'booked', callLog: [], nextAction: { kind: 'custom', label: 'legacy', doneAt: d(5) }, meeting: { date: '2026-10-08', time: '10:00' } },
  { _id: 'c', business: 'C', stage: 'lead', createdAt: d(2), callStatus: 'not-called', callLog: [] },
  { _id: 'd', business: 'D', stage: 'deal', createdAt: d(60), callStatus: 'booked', callLog: [{ at: d(10) }], meeting: { date: '2026-09-30' } },
  { _id: 'e', business: 'E', stage: 'triage', createdAt: d(1), callStatus: 'not-called', callLog: [] },
  { _id: 'f', business: 'F', stage: 'client', clientSince: d(1), createdAt: d(90), callStatus: 'booked', callLog: [], deleted: true, purchases: [{ amount: 9999, at: d(1) }] },
  { _id: 'g', business: 'G', stage: 'declined', createdAt: d(2), callStatus: 'no', callLog: [{ at: d(2) }] },
];
const PROJECTS = [
  { _id: 'P1', leadId: 'a', packageId: 'web-complete', kind: 'web', invoices: [{ id: 'j1', amount: 200, status: 'sent', dueAt: '2026-09-01' }, { id: 'j2', amount: 1, status: 'paid' }], checklists: [{ id: 'k', name: 'y', items: [{ id: 'u1', text: 'p done', done: true, doneAt: d(4) }] }] },
  { _id: 'P2', leadId: 'a', kind: 'retainer', schedule: [{ id: 's1', amount: 40, status: 'upcoming', dueAt: '2026-11-01' }, { id: 's2', amount: 41, status: 'paid' }] },
  { _id: 'P3', leadId: 'b', archived: true, invoices: [{ id: 'z', amount: 5000, status: 'sent' }] },
];

const both = (label, range, check) => {
  const s = rec(server.computeAnalytics(LEADS, PROJECTS, { range, now: NOW }));
  for (const [name, mod] of (NY ? [['client', client], ['server', server]] : [['server', server]])) {
    const got = mod.computeAnalytics(LEADS, PROJECTS, { range, now: NOW });
    check(got, `${name}: ${label}`);
  }
  return s;
};

section('2. the month: income, outstanding, clients gained, tasks completed, leads added, MRR, with the previous 30 days');
both('month', 'month', (g, n) => {
  ok(g.kpis.income.value === 575, `${n} income is the two ledger entries in the window, the day key one included (${g.kpis.income.value})`);
  ok(g.kpis.income.prev === 250 && g.kpis.income.delta === 130, `${n} the previous 30 days hold the 250 entry, delta 130% (${g.kpis.income.prev}, ${g.kpis.income.delta})`);
  ok(g.kpis.outstanding.value === 540, `${n} outstanding is the sent deal invoice, the sent project invoice and the legacy upcoming line, never paid, draft, deleted or archived (${g.kpis.outstanding.value})`);
  ok(g.kpis.clientsGained.value === 1 && g.kpis.clientsGained.prev === 1 && g.kpis.clientsGained.delta === 0, `${n} one client gained this period, one before (${JSON.stringify(g.kpis.clientsGained)})`);
  ok(g.kpis.tasksCompleted.value === 3 && g.kpis.tasksCompleted.prev === 1, `${n} tasks completed: a lead task, a project task and the legacy next action; one before (${JSON.stringify(g.kpis.tasksCompleted)})`);
  ok(g.trackingSince === d(45), `${n} tracking since the earliest doneAt (${g.trackingSince})`);
  ok(g.kpis.leadsAdded.value === 4 && g.kpis.leadsAdded.prev === 0, `${n} leads added counts every record created in the window, triage and declined too, not the deleted one; sixty days ago is past the previous thirty (${JSON.stringify(g.kpis.leadsAdded)})`);
  ok(g.kpis.mrr.value === 250, `${n} MRR is the active retainer (${g.kpis.mrr.value})`);
  ok(g.unit === 'week' && g.series.labels.length === 5 && g.series.income.reduce((a, b) => a + b, 0) === 575 && g.series.tasks.reduce((a, b) => a + b, 0) === 3 && g.series.clients.reduce((a, b) => a + b, 0) === 1, `${n} five weekly buckets that add up to the KPIs (${g.series.labels.join('|')}; ${g.series.income.join(',')})`);
  ok(g.funnel.triage === 1 && g.funnel.leads === 4 && g.funnel.contacted === 3 && g.funnel.booked === 3 && g.funnel.deals === 3 && g.funnel.clients === 2, `${n} the funnel is cumulative from Leads, the deleted and declined records out (${JSON.stringify(g.funnel)})`);
  ok(JSON.stringify(g.byPackage) === JSON.stringify([{ id: 'web-complete', amount: 500 }, { id: 'unlinked', amount: 75 }]), `${n} income by package follows the ledger's projectId (${JSON.stringify(g.byPackage)})`);
  ok(g.meetings.held === 2 && g.meetings.upcoming === 1 && g.meetings.next === '2026-10-08T10:00', `${n} meetings held in the window and the next within 7 days (${JSON.stringify(g.meetings)})`);
});

section('3. 90 days and the year');
both('90', '90', (g, n) => {
  ok(g.kpis.income.value === 825 && g.kpis.income.prev === 0 && g.kpis.income.delta === null, `${n} 90 days takes the 250 entry in, nothing before, delta null when the previous period is zero (${JSON.stringify(g.kpis.income)})`);
  ok(g.series.labels.length === 13 && g.kpis.tasksCompleted.value === 4, `${n} thirteen weekly buckets, every task in (${g.series.labels.length}, ${g.kpis.tasksCompleted.value})`);
});
both('year', 'year', (g, n) => {
  ok(g.unit === 'month' && g.series.labels.length === 12 && g.series.labels[11] === 'Oct' && g.series.labels[0] === 'Nov 25', `${n} twelve calendar months ending with this one (${g.series.labels.join('|')})`);
  ok(g.kpis.income.value === 825 && g.kpis.income.prev === 100, `${n} the year holds 825, the year before the 100 entry (${JSON.stringify(g.kpis.income)})`);
  ok(g.kpis.clientsGained.value === 2, `${n} both clients gained inside the year (${g.kpis.clientsGained.value})`);
});
both('bogus', 'bogus', (g, n) => ok(g.range === 'month', `${n} an unknown range reads as month (${g.range})`));

section('4. empty and malformed records');
{
  const g = client.computeAnalytics([], [], { range: 'month', now: NOW });
  ok(g.kpis.income.value === 0 && g.kpis.outstanding.value === 0 && g.trackingSince === '' && g.byPackage.length === 0 && g.series.income.every(v => v === 0), 'nothing stored is all zeros and no tracking date');
  const h = client.computeAnalytics([{ stage: 'client', purchases: 'nope', checklists: [{ items: 'x' }], clientSince: 'garbage', retainer: { status: 'active', amount: 'abc' } }, null], [null, { invoices: 'x' }], { range: 'month', now: NOW });
  ok(h.kpis.income.value === 0 && h.kpis.mrr.value === 0 && h.kpis.clientsGained.value === 0, 'malformed fields count nothing and throw nothing');
}

section('5. the route: GET only, the range from the query, projected reads, a brief private cache');
{
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'analytics-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-secret-not-real'; delete process.env.VERCEL;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const handler = (await load('_routes/analytics.js')).handler;
  _reset(); _stores.call_leads = LEADS.map(l => ({ ...l })); _stores.projects = PROJECTS.map(p => ({ ...p }));
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader(k, v) { this._headers[k.toLowerCase()] = v; }, end() {} });
  const res = fakeRes(); await handler({ method: 'GET', query: { range: 'year' }, headers: {} }, res);
  ok(res._status === 200 && res._json?.range === 'year' && res._json.kpis.income.value === 825, `GET ?range=year answers the year payload (${res._status}, ${res._json?.range}, ${res._json?.kpis?.income?.value})`);
  ok(/private/.test(res._headers['cache-control'] || '') && /max-age=60/.test(res._headers['cache-control'] || ''), `the answer is privately cached for a minute (${res._headers['cache-control']})`);
  const res2 = fakeRes(); await handler({ method: 'GET', query: { range: '<script>' }, headers: {} }, res2);
  ok(res2._status === 200 && res2._json.range === 'month', `a bad range falls back to month, never echoed (${res2._json?.range})`);
  const index = fs.readFileSync(path.join(repoRoot, 'api', 'admin', 'index.js'), 'utf8');
  ok(/'analytics': route\(analytics, \{ methods: \['GET'\] \}\)/.test(index), 'the dispatcher registers analytics as GET only inside route()');
  const vercel = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
  ok(vercel.rewrites.some(r => r.source === '/api/admin/analytics' && r.destination === '/api/admin/index?r=analytics'), 'vercel.json rewrites /api/admin/analytics onto the dispatcher');
  const fns = fs.readdirSync(path.join(repoRoot, 'api')).filter(f => f.endsWith('.js')).length + fs.readdirSync(path.join(repoRoot, 'api', 'admin')).filter(f => f.endsWith('.js')).length + fs.readdirSync(path.join(repoRoot, 'api', 'cron')).filter(f => f.endsWith('.js')).length;
  ok(fns === 10, `still ten Vercel functions (${fns})`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

printDigest();
if (NY) { console.log(`\n${passes} passed, ${fails} failed.`); process.exit(fails ? 1 : 0); }
