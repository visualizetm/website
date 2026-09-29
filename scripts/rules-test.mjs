#!/usr/bin/env node
/* The follow up rules (CRM revamp, step 7): every cron rule fires once for
 * a condition, does not refire, respects its key and fires again for a new
 * condition; the project actions on both mirrors; the delivery steps'
 * dates; all in America/New_York, and the whole thing through the real
 * daily cron with the in-memory mongo.
 *   node scripts/rules-test.mjs */
import fs from 'fs';
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
let fails = 0; let passes = 0;
// Assertions with wall clock expectations hold in New York; the UTC run only records the server's results.
const ok = (c, m) => { if (!NY) return; if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
const src = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);
const R = await src('api/_lib/rules.js');
const NA = await src('src/lib/nextAction.js');
const NS = await src('api/_lib/nextAction.js');
const P = await src('src/lib/projects.js');
const NOW = Date.UTC(2026, 8, 28, 14, 30); // Mon Sep 28 2026, 10:30 New York (14:30 UTC)
const DAY = 864e5;
const iso = (t) => new Date(t).toISOString();
const fire = (rules, record, ctx = {}, now = NOW) => rec(R.dueRules(rules, record, ctx, now));
const withKeys = (record, fired) => ({ ...record, ...Object.assign({}, ...fired.map(f => f.set)), cronRules: { ...(record.cronRules || {}), ...Object.fromEntries(fired.map(f => [f.id, f.key])) } });

section('1. introNoBooking');
{
  const deal = (introAt, over = {}) => ({ _id: 'a', business: 'A', stage: 'booked', callStatus: 'booked', meeting: { date: '2026-10-05', time: '10:00' }, callLog: [], deal: { checkpoints: { introSent: { at: iso(introAt), by: 'rob' }, callDone: null }, invoices: [] }, ...over });
  let f = fire(R.LEAD_RULES, deal(NOW - 3 * DAY - 60e3));
  ok(f.length === 1 && f[0].id === 'introNoBooking', 'three days after the intro with no booking and no call it fires');
  ok(f[0].set.callStatus === 'callback' && f[0].set.callbackAt === '2026-09-29T14:00:00.000Z' && f[0].set.callLog[0].note === 'Intro sent, no booking' && f[0].set.callLog[0].outcome === 'callback', 'a callback tomorrow at ten in New York, with the note');
  ok(fire(R.LEAD_RULES, deal(NOW - 2 * DAY)).length === 0, 'two days is not yet');
  ok(fire(R.LEAD_RULES, deal(NOW - 4 * DAY, { calendlyEventUri: 'https://api.calendly.com/x' })).length === 0, 'a Calendly event means they booked');
  const done = deal(NOW - 4 * DAY); done.deal.checkpoints.callDone = { at: iso(NOW - DAY), by: 'rob' };
  ok(fire(R.LEAD_RULES, done).length === 0, 'a logged call means it happened');
  const rec = deal(NOW - 4 * DAY); const after = withKeys(rec, fire(R.LEAD_RULES, rec));
  ok(fire(R.LEAD_RULES, after).length === 0, 'it does not refire for the same intro');
  const resent = { ...after, deal: { ...after.deal, checkpoints: { ...after.deal.checkpoints, introSent: { at: iso(NOW - 3 * DAY - 1), by: 'rob' } } } };
  ok(fire(R.LEAD_RULES, resent).some(x => x.id === 'introNoBooking'), 'a fresh intro with its own timestamp fires again');
  ok(fire(R.LEAD_RULES, deal(NOW - 4 * DAY, { stage: 'client' })).length === 0, 'a client is left alone');
}

section('2. twoNoAnswers');
{
  const lead = (log, over = {}) => ({ _id: 'b', business: 'B', stage: 'lead', callStatus: 'no-answer', priority: 'hot', listId: 'LS', callLog: log, ...over });
  const two = [{ at: iso(NOW - 2 * DAY), outcome: 'no-answer' }, { at: iso(NOW - DAY), outcome: 'no-answer' }];
  let f = fire(R.LEAD_RULES, lead(two));
  ok(f.length === 1 && f[0].id === 'twoNoAnswers' && f[0].set.priority === 'cold' && f[0].set.listId === '' && f[0].lists === 'remove', 'two no-answers in a row: cold and off the lists');
  ok(f[0].key === two[1].at, 'keyed by the second no-answer');
  ok(fire(R.LEAD_RULES, lead([two[0], { at: iso(NOW - DAY), outcome: 'callback' }, two[1]])).length === 0, 'a callback between them breaks the run');
  ok(fire(R.LEAD_RULES, lead([two[1]])).length === 0, 'one is not two');
  ok(fire(R.LEAD_RULES, withKeys(lead(two), f)).length === 0, 'it does not refire');
  const third = withKeys(lead(two), f); third.callLog = [...two, { at: iso(NOW - 3600e3), outcome: 'no-answer' }];
  ok(fire(R.LEAD_RULES, third).some(x => x.id === 'twoNoAnswers'), 'a third no-answer is a new run and fires again');
  ok(fire(R.LEAD_RULES, lead(two, { stage: 'deal' })).length === 0, 'only an open lead');
}

section('3. wentQuiet');
{
  const lead = (over = {}) => ({ _id: 'c', business: 'C', stage: 'lead', callStatus: 'not-called', priority: 'warm', notes: 'Old note', createdAt: iso(NOW - 40 * DAY), callLog: [], contactLog: [], ...over });
  let f = fire(R.LEAD_RULES, lead());
  ok(f.length === 1 && f[0].id === 'wentQuiet' && f[0].set.stage === 'triage' && f[0].set.notes === 'Went quiet 30 days\nOld note' && f[0].set.listId === '', 'forty quiet days: back to triage with the note on top');
  ok(fire(R.LEAD_RULES, lead({ callLog: [{ at: iso(NOW - 10 * DAY), outcome: 'no-answer' }] })).length === 0, 'a call ten days ago keeps it');
  ok(fire(R.LEAD_RULES, lead({ contactLog: [{ at: iso(NOW - 5 * DAY), type: 'email' }] })).length === 0, 'a contact log entry keeps it');
  ok(fire(R.LEAD_RULES, lead({ priority: 'cold' })).length === 0, 'a cold lead is not chased');
  ok(fire(R.LEAD_RULES, lead({ createdAt: iso(NOW - 10 * DAY) })).length === 0, 'a lead ten days old has not gone quiet yet');
  ok(fire(R.LEAD_RULES, withKeys(lead(), f)).length === 0 || withKeys(lead(), f).stage === 'triage', 'once in triage it is out of the rule');
  ok(fire(R.LEAD_RULES, { ...lead(), cronRules: { wentQuiet: f[0].key } }).length === 0, 'the key blocks a refire even if the stage came back');
}

section('4. stalledDeal');
{
  const deal = (since, over = {}) => ({ _id: 'd', business: 'D', stage: 'deal', callStatus: 'booked', deal: { checkpoints: {}, invoices: [], stalledSince: since ? iso(since) : '' }, ...over });
  let f = fire(R.LEAD_RULES, deal(NOW - 31 * DAY));
  ok(f.length === 1 && f[0].id === 'stalledDeal' && f[0].set.nextAction.kind === 'custom' && f[0].set.nextAction.label === 'Move to nurture?' && f[0].set.nextAction.auto === false, 'thirty one stalled days asks the question as a manual action');
  ok(fire(R.LEAD_RULES, deal(NOW - 20 * DAY)).length === 0, 'twenty days does not');
  ok(fire(R.LEAD_RULES, withKeys(deal(NOW - 31 * DAY), f)).length === 0, 'it does not refire for the same stall');
  const again = withKeys(deal(NOW - 31 * DAY), f); again.deal = { ...again.deal, stalledSince: iso(NOW - 45 * DAY) };
  ok(fire(R.LEAD_RULES, again).some(x => x.id === 'stalledDeal'), 'a new stall (a new stalledSince) fires again');
  ok(NA.resolveNextAction({ nextAction: f[0].set.nextAction }, NA.nextActionFor(deal(NOW - 31 * DAY), {}, NOW))?.label === 'Move to nurture?', 'the recompute keeps the manual question');
}

section('5. secondChase, on a deal and on a project');
{
  const chase = (dueAt, over = {}) => ({ _id: 'e', business: 'E', stage: 'deal', callStatus: 'booked', deal: { checkpoints: {}, invoices: [{ id: 'i1', amount: 100, dueAt: '2026-09-10', status: 'sent' }] }, nextAction: { kind: 'chase-invoice', label: 'Chase the invoice', dueAt: iso(dueAt), auto: true, doneAt: '' }, ...over });
  let f = fire(R.LEAD_RULES, chase(NOW - 8 * DAY));
  ok(f.length === 1 && f[0].id === 'secondChase' && f[0].set.nextAction.label === 'Second chase, then call' && f[0].set.nextAction.kind === 'chase-invoice' && f[0].set.nextAction.auto === false, 'eight days after the first chase with the invoice still late: the second chase');
  ok(fire(R.LEAD_RULES, chase(NOW - 3 * DAY)).length === 0, 'three days is not yet');
  ok(fire(R.LEAD_RULES, chase(NOW - 8 * DAY, { deal: { checkpoints: {}, invoices: [{ id: 'i1', amount: 100, dueAt: '2026-09-10', status: 'paid' }] } })).length === 0, 'paid in the meantime: nothing');
  ok(fire(R.LEAD_RULES, withKeys(chase(NOW - 8 * DAY), f)).length === 0, 'it does not refire, and the second chase itself is never chased');
  const project = { _id: 'p1', leadId: 'e', stage: 'build', invoices: [{ id: 'i1', amount: 100, dueAt: '2026-09-10', status: 'sent' }], nextAction: { kind: 'chase-invoice', label: 'Chase the invoice', dueAt: iso(NOW - 8 * DAY), auto: true, doneAt: '' } };
  const pf = fire(R.PROJECT_RULES, project, { lead: { _id: 'e' } });
  ok(pf.length === 1 && pf[0].id === 'secondChase', 'the same rule on a project invoice');
}

section('6. retainerKit');
{
  const the22nd = Date.UTC(2026, 8, 22, 13); const the15th = Date.UTC(2026, 8, 15, 13);
  const lead = { _id: 'r', retainer: { status: 'active' }, planner: { enabled: false } };
  const p = (monthly = [], over = {}) => ({ _id: 'rp', leadId: 'r', kind: 'retainer', stage: 'kickoff', monthly, invoices: [], ...over });
  let f = fire(R.PROJECT_RULES, p(), { lead }, the22nd);
  ok(f.length === 1 && f[0].id === 'retainerKit' && f[0].set.nextAction.label === "Deliver this month's kit" && f[0].key === '2026-09', 'nothing delivered by the twenty second: the kit action, keyed by the month');
  ok(fire(R.PROJECT_RULES, p(), { lead }, the15th).length === 0, 'the fifteenth is too early');
  ok(fire(R.PROJECT_RULES, p([{ month: '2026-09', delivered: 2, included: 8, log: [] }]), { lead }, the22nd).length === 0, 'two delivered this month: fine');
  ok(fire(R.PROJECT_RULES, p([{ month: '2026-08', delivered: 8, included: 8, log: [] }]), { lead }, the22nd).length === 1, 'last month does not count');
  const plannerLead = { ...lead, planner: { enabled: true } };
  ok(fire(R.PROJECT_RULES, p(), { lead: plannerLead, posts: [{ leadId: 'r', month: '2026-09', status: 'approved' }] }, the22nd).length === 0, 'with the planner on, an approved post this month counts');
  ok(fire(R.PROJECT_RULES, p(), { lead: plannerLead, posts: [{ leadId: 'r', month: '2026-09', status: 'review' }] }, the22nd).length === 1, 'a post still in review does not');
  ok(fire(R.PROJECT_RULES, withKeys(p(), f), { lead }, the22nd).length === 0, 'it does not refire this month');
  ok(fire(R.PROJECT_RULES, withKeys(p(), f), { lead }, Date.UTC(2026, 9, 22, 13)).length === 1, 'next month it fires again');
  ok(fire(R.PROJECT_RULES, p(), { lead: { ...lead, retainer: { status: 'cancelled' } } }, the22nd).length === 0, 'a cancelled retainer is left alone');
}

section('7. lastPayment');
{
  const lines = (last) => [{ id: 'm1', label: 'Month 1 of 3', amount: 100, dueAt: '2026-07-01', status: 'paid' }, { id: 'm2', label: 'Month 2 of 3', amount: 100, dueAt: '2026-08-01', status: 'paid' }, { id: 'm3', label: 'Month 3 of 3', amount: 100, dueAt: '2026-10-01', status: last }];
  const p = (last, over = {}) => ({ _id: 'pp', leadId: 'x', kind: 'web', stage: 'build', plan: { months: 3, monthly: 100 }, invoices: lines(last), ...over });
  let f = fire(R.PROJECT_RULES, p('sent'), { lead: { _id: 'x' } });
  ok(f.length === 1 && f[0].id === 'lastPayment' && f[0].set.nextAction.label === 'Collect the last payment and release the files' && f[0].set.nextAction.dueAt === '2026-10-01T13:00:00.000Z' && f[0].key === 'm3', 'the last month sent: collect it, due on its day, keyed by the invoice');
  ok(fire(R.PROJECT_RULES, p('draft'), { lead: { _id: 'x' } }).length === 0, 'a draft last month is not sent yet');
  ok(fire(R.PROJECT_RULES, p('paid'), { lead: { _id: 'x' } }).length === 0, 'paid: done');
  ok(fire(R.PROJECT_RULES, { ...p('sent'), invoices: lines('sent').slice(0, 2) }, { lead: { _id: 'x' } }).length === 0, 'two of three months: not the last');
  ok(fire(R.PROJECT_RULES, withKeys(p('sent'), f), { lead: { _id: 'x' } }).length === 0, 'it does not refire');
}

section('8. the project actions, client and server');
const both = (label, record, ctx, expect, now = NOW) => {
  rec(NS.nextActionFor(record, ctx, now));
  for (const [name, mod] of (NY ? [['client', NA], ['server', NS]] : [['server', NS]])) {
    const got = mod.nextActionFor(record, ctx, now);
    if (expect === null) ok(got === null, `${name}: ${label} is null (got ${JSON.stringify(got)})`);
    else {
      ok(!!got && got.kind === expect.kind && (!expect.label || got.label === expect.label), `${name}: ${label} is ${expect.kind}${expect.label ? ` "${expect.label}"` : ''} (got ${got?.kind} "${got?.label}")`);
      if (got && expect.dueAt) ok(Math.abs(new Date(got.dueAt) - new Date(expect.dueAt)) < 60e3, `${name}: ${label} is due ${expect.dueAt} (got ${got.dueAt})`);
    }
  }
};
{
  const base = { _id: 'q', leadId: 'l', stage: 'design', invoices: [{ id: 'i', amount: 100, dueAt: '2026-10-20', status: 'sent' }] };
  both('a round logged five days ago', { ...base, revisions: { log: [{ at: iso(NOW - 5 * DAY), note: '', extra: false }] } }, {}, { kind: 'revision', label: 'Send round 1', dueAt: iso(NOW + 2 * DAY) });
  both('two rounds, the second yesterday, on a rush job', { ...base, addonIds: ['rush'], revisions: { log: [{ at: iso(NOW - 20 * DAY) }, { at: iso(NOW - DAY) }] } }, {}, { kind: 'revision', label: 'Send round 2', dueAt: iso(NOW + 9 * DAY) });
  both('no round logged', base, {}, null);
  both('a late invoice beats the round', { ...base, invoices: [{ id: 'i', amount: 100, dueAt: '2026-09-01', status: 'sent' }], revisions: { log: [{ at: iso(NOW - DAY) }] } }, {}, { kind: 'chase-invoice' });
  both('delivery stage, everything paid, not released', { ...base, stage: 'delivery', invoices: [{ id: 'i', amount: 100, dueAt: '2026-09-01', status: 'paid' }], revisions: { log: [{ at: iso(NOW - DAY) }] } }, {}, { kind: 'deliver', label: 'Share the Drive folder and send the delivery email' });
  both('delivery stage with a line unpaid', { ...base, stage: 'delivery' }, {}, null);
  both('delivery stage, paid, already released', { ...base, stage: 'delivery', releasedAt: iso(NOW - DAY), invoices: [{ id: 'i', amount: 100, dueAt: '2026-09-01', status: 'paid' }] }, {}, null);
  both('delivered two days ago, pitch not sent', { ...base, stage: 'delivered', deliveredAt: iso(NOW - 2 * DAY), delivery: { pitchSent: false }, revisions: { log: [{ at: iso(NOW - 9 * DAY) }] } }, {}, { kind: 'retainer-pitch', dueAt: iso(NOW + DAY) });
  both('delivered, pitch sent, an old round', { ...base, stage: 'delivered', deliveredAt: iso(NOW - 2 * DAY), delivery: { pitchSent: true }, revisions: { log: [{ at: iso(NOW - 9 * DAY) }] } }, {}, null);
  both('the review ask stays on the lead three days after release', { _id: 'l', business: 'L', stage: 'client', reviews: { asks: [] } }, { projects: [{ _id: 'q', leadId: 'l', releasedAt: iso(NOW - 4 * DAY) }] }, { kind: 'review-ask' });
  ok(NA.NEXT_ACTION_KEYS.includes('revisions') && NA.NEXT_ACTION_KEYS.includes('deliveredAt') && NA.NEXT_ACTION_KEYS.includes('addonIds'), 'the helper recomputes on a round, a delivery or the add-ons');
}

section('9. the delivery steps date themselves');
if (NY) {
  const t = new Date(2026, 8, 28, 15).getTime(); // the client's own clock: local, New York in this run
  const d0 = { driveShared: false, emailSent: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', steps: P.deliveryStepsAtDelivery(t) };
  ok(d0.steps.driveShared.dueAt === '2026-09-28', 'at delivery the first step is due today');
  const s1 = P.deliveryStepsAfter(d0, 'driveShared', true, t);
  ok(s1.driveShared.doneAt === iso(t) && s1.emailSent.dueAt === '2026-09-28', 'Drive shared: done now, the email due today');
  const s2 = P.deliveryStepsAfter({ ...d0, steps: s1 }, 'emailSent', true, t);
  ok(s2.emailSent.doneAt === iso(t) && s2.pitchSent.dueAt === '2026-10-01', 'email sent: the pitch due three days on');
  const s3 = P.deliveryStepsAfter({ ...d0, steps: s2 }, 'pitchSent', true, t + 3 * DAY);
  ok(s3.reviewLinkSent.dueAt === '2026-09-28', 'pitch sent: the review link was due with the email');
  const s4 = P.deliveryStepsAfter({ ...d0, steps: s3 }, 'reviewLinkSent', true, t + 3 * DAY);
  ok(s4.followUp.dueAt === '2026-10-04', 'review link sent: the follow up three days on');
  const s5 = P.deliveryStepsAfter({ ...d0, steps: s4 }, 'emailSent', false, t);
  ok(s5.emailSent.doneAt === '' && s5.pitchSent.dueAt === '2026-10-01', 'unticking clears its doneAt and keeps the dates already set');
  ok(P.deliveryStepsAfter({ steps: {} }, 'followUp', true, t).followUp.doneAt === iso(t), 'the last step just marks itself done');
}

section('10. through the real daily cron: once, keyed, counted');
{
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'rules-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-secret-not-real'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const cronDaily = (await load('_routes/cron-daily.js')).handler;
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader(k, v) { this._headers[k] = v; } });
  const run = async () => { const res = fakeRes(); await cronDaily({ method: 'GET', query: {}, headers: { authorization: 'Bearer cron-test-secret' }, url: '/api/x', socket: {} }, res); return res; };
  const now = Date.now();
  const A = '507f1f77bcf86cd7994390a1', B = '507f1f77bcf86cd7994390a2', C = '507f1f77bcf86cd7994390a3', D = '507f1f77bcf86cd7994390a4', PJ = '507f1f77bcf86cd7994390b1';
  _reset();
  _stores.call_leads = [
    { _id: A, business: 'Intro Co', stage: 'booked', callStatus: 'booked', meeting: { date: '2026-12-01', time: '10:00' }, socials: {}, callLog: [], deal: { checkpoints: { introSent: { at: iso(now - 4 * DAY), by: 'rob' } }, invoices: [] } },
    { _id: B, business: 'No Answer Co', stage: 'lead', callStatus: 'no-answer', priority: 'hot', listId: 'LS', socials: {}, callLog: [{ at: iso(now - 2 * DAY), outcome: 'no-answer' }, { at: iso(now - DAY), outcome: 'no-answer' }] },
    { _id: C, business: 'Quiet Co', stage: 'lead', callStatus: 'not-called', priority: 'warm', notes: 'n', createdAt: new Date(now - 45 * DAY), socials: {}, callLog: [] },
    { _id: D, business: 'Stalled Co', stage: 'deal', callStatus: 'booked', socials: {}, callLog: [], deal: { checkpoints: { callDone: { at: iso(now - 40 * DAY), by: 'rob' } }, invoices: [], stalledSince: iso(now - 32 * DAY) } },
  ];
  _stores.projects = [{ _id: PJ, leadId: D, name: 'Plan', kind: 'web', stage: 'build', plan: { months: 2, monthly: 100 }, invoices: [{ id: 'm1', label: 'Month 1 of 2', amount: 100, dueAt: '2026-01-05', status: 'paid' }, { id: 'm2', label: 'Month 2 of 2', amount: 100, dueAt: '2026-02-05', status: 'sent' }], archived: false, createdAt: new Date() }];
  _stores.lists = [{ _id: 'LS', name: 'Tuesday', status: 'open', target: 25, leadIds: [B, C] }];
  _stores.settings = []; _stores.stripe_events = []; _stores.concept_sets = []; _stores.submissions = []; _stores.posts = [];
  const lead = (id) => _stores.call_leads.find(l => String(l._id) === id);
  const pj = () => _stores.projects.find(p => String(p._id) === PJ);
  let r = await run();
  const rules = Object.fromEntries((r._json.rules || []).map(x => [x.name, x.count]));
  ok(r._status === 200 && rules.introNoBooking === 1 && rules.twoNoAnswers === 1 && rules.wentQuiet === 1 && rules.stalledDeal === 1 && rules.lastPayment === 1 && rules.secondChase === 0 && rules.retainerKit === 0, `the cron counts each rule (${JSON.stringify(rules)})`);
  rec([lead(A).callbackAt, lead(A).callLog[0]?.note, pj().nextAction?.dueAt, lead(D).nextAction?.label]);
  ok(lead(A).callStatus === 'callback' && lead(A).callLog[0]?.note === 'Intro sent, no booking' && lead(A).cronRules.introNoBooking === lead(A).deal.checkpoints.introSent.at, 'intro rule: callback written, keyed by the intro');
  ok(/T14:00:00\.000Z$/.test(lead(A).callbackAt) || /T15:00:00\.000Z$/.test(lead(A).callbackAt), `the callback is ten in New York whatever the process zone (${lead(A).callbackAt})`);
  ok(lead(B).priority === 'cold' && lead(B).listId === '' && !_stores.lists[0].leadIds.includes(B) && _stores.lists[0].leadIds.includes(C) === false, 'no-answer rule: cold, off the list (the quiet lead left it too)');
  ok(lead(C).stage === 'triage' && lead(C).notes.startsWith('Went quiet 30 days') && lead(C).cronRules.wentQuiet, 'quiet rule: triage with the note');
  ok(lead(D).nextAction?.label === 'Move to nurture?' && lead(D).nextAction.auto === false, 'stalled rule: the question stays through the recompute');
  ok(pj().nextAction?.label === 'Collect the last payment and release the files' && pj().cronRules.lastPayment === 'm2', 'last payment rule on the project, keyed by the invoice');
  const health = _stores.settings.find(s => s._id === 'health');
  ok(Array.isArray(health?.crons?.daily?.rules) && health.crons.daily.rules.find(x => x.name === 'wentQuiet')?.count === 1, 'health.crons.daily.rules carries the counts');
  r = await run();
  const again = Object.fromEntries((r._json.rules || []).map(x => [x.name, x.count]));
  ok(Object.values(again).every(n => n === 0), `a second run fires nothing (${JSON.stringify(again)})`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

printDigest();
console.log(NY ? `\n${passes} checks passed, ${fails} failed.` : '\nUTC run: the server results recorded.');
console.log(fails ? 'Rules tests FAILED.' : NY ? 'All rules tests pass.' : 'UTC run done.');
process.exit(fails ? 1 : 0);
