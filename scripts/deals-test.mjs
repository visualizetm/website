#!/usr/bin/env node
/* The deal (CRM revamp, step 5): every transition, every next action rule,
 * stalledSince, the mark paid conversion and its undo, invoiceStatus across
 * month ends in America/New_York, the mirrors byte for byte, and the whole
 * thing against the real handlers with the in-memory mongo.
 *   node scripts/deals-test.mjs */
process.env.TZ = 'America/New_York';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
const src = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);
const body = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8').split('\n').filter(l => !l.startsWith(' *') && !l.startsWith('/*')).join('\n');

section('0. the mirrors');
ok(body('src/lib/deal.js').split('export const CHECKPOINTS')[1] === body('api/_lib/deal.js').split('export const CHECKPOINTS')[1], 'api/_lib/deal.js is src/lib/deal.js byte for byte below the header');
ok(body('src/lib/invoices.js').split('export const INVOICE_STATUS_IDS')[1] === body('api/_lib/invoices.js').split('export const INVOICE_STATUS_IDS')[1], 'api/_lib/invoices.js is src/lib/invoices.js byte for byte below the header');

const D = await src('src/lib/deal.js');
const I = await src('src/lib/invoices.js');
const C = await src('src/lib/dealConvert.js');
const NA = await src('src/lib/nextAction.js');
const NS = await src('api/_lib/nextAction.js');
const NOW = new Date(2026, 8, 28, 10, 30).getTime(); // Mon Sep 28 2026, 10:30 New York
const DAY = 864e5; const HOUR = 3600e3;
const iso = (t) => new Date(t).toISOString();
const booked = (over = {}) => ({ _id: 'b', business: 'B', stage: 'booked', callStatus: 'booked', meeting: { date: '2026-09-28', time: '09:00' }, ...over });
const withTicks = (lead, ticks) => { let l = { ...lead, stage: 'deal' }; for (const [id, at] of Object.entries(ticks)) l = { ...l, ...D.tickPatch(l, id, 'rob', at) }; return l; };

section('1. transitions');
{
  ok(D.shouldBecomeDeal(booked(), NOW), 'a booked lead an hour and a half past its meeting becomes a deal');
  ok(!D.shouldBecomeDeal(booked({ meeting: { date: '2026-09-28', time: '10:00' } }), NOW), 'thirty minutes past is not yet');
  ok(!D.shouldBecomeDeal(booked({ meeting: { date: '', time: '' } }), NOW), 'no meeting, no transition');
  const auto = D.dealAutoPatch(booked(), { sets: [] }, NOW);
  ok(auto?.stage === 'deal' && auto.deal && !auto.deal.checkpoints.callDone, 'the auto patch writes stage deal and a fresh deal object, callDone still open');
  const withSet = D.dealAutoPatch(booked({ meeting: { date: '2026-09-30', time: '10:00' } }), { sets: [{ leadId: 'b' }] }, NOW);
  ok(withSet && !withSet.stage && withSet.deal.checkpoints.concepts?.by === 'auto', 'a concept set ticks Concepts on its own, before the meeting, without moving the stage');
  ok(D.dealAutoPatch(booked({ meeting: { date: '2026-09-30', time: '10:00' } }), { sets: [{ leadId: 'b', archived: true }] }, NOW) === null, 'an archived set does not count');
  const cal = D.dealAutoPatch(booked({ calendlyEventUri: 'https://api.calendly.com/scheduled_events/x' }), {}, NOW);
  ok(cal?.stage === 'deal' && cal.deal.checkpoints.callDone?.by === 'auto' && cal.deal.metAt, 'a linked Calendly call that is past ticks Call done and stamps metAt');
  const met = D.metPatch(booked({ meeting: { date: '2026-10-02', time: '10:00' } }), NOW);
  ok(met.stage === 'deal' && met.deal.checkpoints.callDone?.by === 'rob' && met.deal.metAt === iso(NOW), 'Met them writes stage deal, callDone by rob and metAt, even before the meeting');
  ok(D.dealAutoPatch({ _id: 'x', stage: 'lead' }, {}, NOW) === null && D.dealAutoPatch({ _id: 'x', stage: 'client', meeting: { date: '2026-01-01', time: '10:00' } }, {}, NOW) === null, 'a lead and a client are left alone');
  const t = D.tickPatch(booked(), 'introSent', 'rob', NOW);
  ok(t.deal.checkpoints.introSent.at === iso(NOW) && t.deal.checkpoints.introSent.by === 'rob' && t.deal.stalledSince === '', 'a tick stamps at and by and clears the stall');
  const u = D.untickPatch({ ...booked(), ...t }, 'introSent');
  ok(u.deal.checkpoints.introSent === null, 'an untick clears it');
  ok(D.columnOf(D.dealOf(booked())) === 'booked' && D.columnOf(t.deal) === 'introSent' && D.columnOf(D.tickPatch({ ...booked(), ...t }, 'contractAgreed', 'rob', NOW + 1).deal) === 'contractSent', 'the column is the newest tick, Booked with none, contractAgreed sits under Contract sent');
  ok(D.CHECKPOINT_IDS.join(',') === 'concepts,introSent,callDone,onboardingSent,formReceived,contractSent,contractAgreed,invoiceSent,paid', 'the nine checkpoints in order');
}

section('2. stalledSince');
{
  const quiet = withTicks(booked(), { introSent: NOW - 8 * DAY });
  const a = D.dealAutoPatch(quiet, {}, NOW);
  ok(a?.deal.stalledSince === iso(NOW), 'a deal whose newest tick is eight days old is stalled from now');
  const again = D.dealAutoPatch({ ...quiet, deal: a.deal }, {}, NOW + DAY);
  ok(again === null, 'a second run leaves the stall where it was');
  const moved = { ...quiet, ...D.tickPatch({ ...quiet, deal: a.deal }, 'callDone', 'rob', NOW + DAY) };
  ok(moved.deal.stalledSince === '' && D.dealAutoPatch(moved, {}, NOW + DAY) === null, 'a tick clears the stall and the rules agree');
  const fresh = withTicks(booked(), { introSent: NOW - 3 * DAY });
  ok(D.dealAutoPatch(fresh, {}, NOW) === null, 'three quiet days is not a stall');
  const stale = D.dealAutoPatch({ ...fresh, deal: { ...fresh.deal, stalledSince: iso(NOW - DAY) } }, {}, NOW);
  ok(stale?.deal.stalledSince === '', 'a stall on a deal that moved inside the week is cleared');
  ok(D.daysHere(quiet, NOW) === 8 && D.daysHere(booked(), NOW) === 0, 'days here counts from the newest tick, else the meeting');
  const untouched = { _id: 'd', business: 'D', stage: 'deal', callStatus: 'booked', meeting: { date: '2026-09-10', time: '10:00' } };
  ok(D.dealAutoPatch(untouched, {}, NOW)?.deal.stalledSince === iso(NOW), 'a deal with no ticks stalls from its meeting');
}

section('3. the next action rules, client and server');
const both = (label, record, ctx, expect) => {
  for (const [name, mod] of [['client', NA], ['server', NS]]) {
    const got = mod.nextActionFor(record, ctx, NOW);
    if (expect === null) ok(got === null, `${name}: ${label} is null (got ${JSON.stringify(got)})`);
    else {
      ok(!!got && got.kind === expect.kind && (!expect.label || got.label === expect.label), `${name}: ${label} is ${expect.kind}${expect.label ? ` "${expect.label}"` : ''} (got ${got?.kind} "${got?.label}")`);
      if (got && expect.dueAt) ok(Math.abs(new Date(got.dueAt) - new Date(expect.dueAt)) < 60e3, `${name}: ${label} is due ${expect.dueAt} (got ${got.dueAt})`);
    }
  }
};
{
  both('a booked lead with no concept set', booked({ meeting: { date: '2026-09-30', time: '16:30' } }), { sets: [] }, { kind: 'build-concepts', dueAt: iso(new Date(2026, 8, 29, 9, 0).getTime()) });
  both('a booked lead with a set and nothing else', booked({ meeting: { date: '2026-09-30', time: '16:30' } }), { sets: [{ leadId: 'b' }] }, null);
  both('intro sent two days ago and no Calendly event, still booked', withTicks(booked({ meeting: { date: '2026-09-30', time: '16:30' }, stage: 'booked' }), { introSent: NOW - 2 * DAY - 1 }), { sets: [{ leadId: 'b' }] }, { kind: 'custom', label: 'Confirm the call' });
  const d = (ticks, over = {}) => withTicks(booked(over), ticks);
  both('intro sent two days ago and no Calendly event, in deal', { ...d({ introSent: NOW - 2 * DAY - 1 }), stage: 'deal' }, {}, { kind: 'custom', label: 'Confirm the call' });
  both('intro sent two days ago with a Calendly event', d({ introSent: NOW - 2 * DAY - 1 }, { calendlyEventUri: 'https://api.calendly.com/x' }), {}, { kind: 'log-outcome', label: 'Log the call' });
  both('intro sent yesterday', d({ introSent: NOW - DAY }), {}, { kind: 'log-outcome', label: 'Log the call' });
  both('a deal with no call logged', d({}), {}, { kind: 'log-outcome', label: 'Log the call', dueAt: iso(new Date(2026, 8, 28, 10, 0).getTime()) });
  both('call done, no onboarding', d({ callDone: NOW - HOUR }), {}, { kind: 'send-onboarding', dueAt: iso(NOW - HOUR) });
  both('onboarding sent two days ago, no form', d({ callDone: NOW - 4 * DAY, onboardingSent: NOW - 2 * DAY }), {}, null);
  both('onboarding sent three days ago, no form', d({ callDone: NOW - 4 * DAY, onboardingSent: NOW - 3 * DAY }), {}, { kind: 'chase-form', dueAt: iso(NOW) });
  both('form back, no contract', d({ callDone: NOW - 4 * DAY, onboardingSent: NOW - 3 * DAY, formReceived: NOW - HOUR }), {}, { kind: 'send-contract', dueAt: iso(NOW - HOUR + DAY) });
  both('contract sent two days ago', d({ callDone: NOW - 9 * DAY, onboardingSent: NOW - 8 * DAY, formReceived: NOW - 5 * DAY, contractSent: NOW - 2 * DAY }), {}, null);
  both('contract sent three days ago, not agreed', d({ callDone: NOW - 9 * DAY, onboardingSent: NOW - 8 * DAY, formReceived: NOW - 5 * DAY, contractSent: NOW - 3 * DAY }), {}, { kind: 'chase-contract', dueAt: iso(NOW) });
  both('contract agreed, no invoice', d({ callDone: NOW - 9 * DAY, onboardingSent: NOW - 8 * DAY, formReceived: NOW - 5 * DAY, contractSent: NOW - 3 * DAY, contractAgreed: NOW - HOUR }), {}, { kind: 'send-invoice', dueAt: iso(NOW - HOUR) });
  const full = d({ callDone: NOW - 9 * DAY, onboardingSent: NOW - 8 * DAY, formReceived: NOW - 5 * DAY, contractSent: NOW - 3 * DAY, contractAgreed: NOW - 2 * DAY, invoiceSent: NOW - DAY });
  both('invoice sent, nothing late', { ...full, deal: { ...full.deal, invoices: [{ id: 'i', label: 'Deposit', amount: 100, dueAt: '2026-10-02', status: 'sent' }] } }, {}, null);
  both('an invoice past its day', { ...full, deal: { ...full.deal, invoices: [{ id: 'i', label: 'Deposit', amount: 100, dueAt: '2026-09-27', status: 'sent' }] } }, {}, { kind: 'chase-invoice', dueAt: iso(NOW) });
  both('a draft past its day is not late', { ...full, deal: { ...full.deal, invoices: [{ id: 'i', label: 'Deposit', amount: 100, dueAt: '2026-09-01', status: 'draft' }] } }, {}, null);
  both('a project with a sent line past its day', { _id: 'p', leadId: 'b', stage: 'build', invoices: [{ id: 'i', amount: 300, dueAt: '2026-09-27', status: 'sent' }] }, {}, { kind: 'chase-invoice' });
  both('a project with an old schedule line past its day', { _id: 'p', leadId: 'b', stage: 'build', schedule: [{ id: 'i', amount: 300, dueAt: '2026-09-27', status: 'upcoming' }] }, {}, { kind: 'chase-invoice' });
  both('a project with only drafts', { _id: 'p', leadId: 'b', stage: 'build', invoices: [{ id: 'i', amount: 300, dueAt: '2026-09-01', status: 'draft' }] }, {}, null);
  ok(NA.NEXT_ACTION_KEYS.includes('deal') && NA.NEXT_ACTION_KEYS.includes('invoices') && NA.NEXT_ACTION_KEYS.includes('calendlyEventUri'), 'the helper recomputes on a deal, invoices or Calendly write');
  const w = NA.withNextAction(d({}), D.tickPatch(d({}), 'callDone', 'rob', NOW), {}, NOW);
  ok(w.nextAction?.kind === 'send-onboarding', 'withNextAction carries the next step on a tick');
}

section('4. invoiceStatus across month ends, America/New_York');
{
  const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
  const sent = (dueAt) => ({ id: 'x', status: 'sent', dueAt, amount: 1 });
  ok(I.invoiceStatus(sent('2026-01-31'), at(2026, 1, 31, 23)) === 'due', 'due on its own day, late in the evening');
  ok(I.invoiceStatus(sent('2026-01-31'), at(2026, 2, 1, 0)) === 'past-due', 'past due the moment the next day starts');
  ok(I.invoiceStatus(sent('2026-03-01'), at(2026, 2, 28, 9)) === 'due', 'March 1 is due on February 28');
  ok(I.invoiceStatus(sent('2026-03-08'), at(2026, 3, 1, 9)) === 'due' && I.invoiceStatus(sent('2026-03-09'), at(2026, 3, 1, 9)) === 'sent', 'seven days out is due, eight is just sent (across the DST change on March 8)');
  ok(I.invoiceStatus(sent('2026-12-31'), at(2027, 1, 1, 0, 1)) === 'past-due', 'past due across the year end');
  ok(I.invoiceStatus({ status: 'draft', dueAt: '2020-01-01' }, NOW) === 'draft', 'a draft never goes past due');
  ok(I.invoiceStatus({ status: 'paid', dueAt: '2020-01-01' }, NOW) === 'paid' && I.invoiceStatus({ status: 'sent', dueAt: '2020-01-01', ledgerId: 'l' }, NOW) === 'paid', 'paid is paid, a ledgerId is paid');
  ok(I.invoiceStatus({ status: 'sent', dueAt: '' }, NOW) === 'sent', 'a sent line with no day is sent');
  ok(I.addMonthsKey('2026-01-31', 1) === '2026-02-28' && I.addMonthsKey('2026-01-15', 1, 31) === '2026-02-28' && I.addMonthsKey('2026-11-30', 3) === '2027-02-28', 'the same day of month clamps to the month end');
  ok(I.legacyToInvoice({ id: 's', amount: 5, dueAt: '2026-01-01', status: 'past-due', ledgerId: '' }).status === 'sent' && I.legacyToInvoice({ id: 's', amount: 5, dueAt: '2026-01-01', status: 'paid', ledgerId: 'lg' }).ledgerId === 'lg', 'the migration mapping: paid stays paid with its ledgerId, the rest sent');
  ok(I.sanitizeInvoice({ id: 'x'.repeat(80), label: 'y'.repeat(200), amount: 999999, dueAt: 'soon', status: 'bogus', note: 'z'.repeat(400), $where: '1' }).id.length === 40 && I.sanitizeInvoice({ label: 'y'.repeat(200) }).label.length === 120 && I.sanitizeInvoice({ amount: 999999 }).amount === 100000 && I.sanitizeInvoice({ dueAt: 'soon' }).dueAt === '' && I.sanitizeInvoice({ status: 'bogus' }).status === 'draft' && I.sanitizeInvoice({ note: 'z'.repeat(400) }).note.length === 300 && !('$where' in I.sanitizeInvoice({ $where: 1 })), 'the whitelist caps every field and drops the rest');
}

section('5. the mark paid conversion and its undo');
{
  const deal = { ...D.emptyDeal('launch-plan'), plan: { months: 6, monthly: 200 }, invoices: [I.newInvoice({ label: 'Month 1 of 6', amount: 200, dueAt: '2026-09-30', status: 'sent', now: NOW })] };
  const lead = { _id: 'b', business: 'B', stage: 'deal', callStatus: 'booked', purchases: [], deal };
  const conv = C.markPaidConversion(lead, deal.invoices[0].id, { paidAt: '2026-09-28', note: 'Zelle' }, NOW);
  ok(conv.leadSet.stage === 'client' && conv.leadSet.clientStatus === 'active' && conv.leadSet.clientSince === iso(NOW), 'the lead becomes an active client, stamped');
  ok(conv.leadSet.deal.checkpoints.paid?.by === 'rob' && conv.leadSet.deal.invoices[0].status === 'paid' && conv.leadSet.deal.invoices[0].ledgerId === conv.purchaseId, 'paid is ticked and the invoice is paid, pointing at the ledger entry');
  ok(conv.leadSet.purchases.length === 1 && conv.leadSet.purchases[0].amount === 200 && conv.leadSet.purchases[0].at === '2026-09-28' && conv.leadSet.purchases[0].projectId === '' && conv.leadSet.purchases[0].notes === 'Zelle', 'one purchases entry, the project id still empty');
  ok(conv.projectDoc.name === 'Launch Plan' && conv.projectDoc.packageId === 'launch-plan' && conv.projectDoc.leadId === 'b' && conv.projectDoc.plan?.months === 6, 'the project is built from the package and the plan');
  ok(conv.projectDoc.invoices.length === 6 && conv.projectDoc.invoices[0].status === 'paid' && conv.projectDoc.invoices.slice(1).every(i => i.status === 'sent'), 'the deal invoices move onto the project, the paid one first, the remaining plan months as sent lines');
  ok(conv.projectDoc.invoices.map(i => i.dueAt).join(',') === '2026-09-30,2026-10-28,2026-11-28,2026-12-28,2027-01-28,2027-02-28', `the plan months land on the same day of month (${conv.projectDoc.invoices.map(i => i.dueAt).join(',')})`);
  ok(conv.projectDoc.total === 1200, 'the total is the package price');
  const withProj = C.purchasesWithProject(conv.leadSet.purchases, conv.purchaseId, 'P1');
  ok(withProj[0].projectId === 'P1', 'the purchases entry gets the project id once the project exists');
  const undo = C.undoConversionSet(lead);
  ok(undo.stage === 'deal' && undo.explicit === true && undo.purchases.length === 0 && undo.clientSince === '' && undo.deal === deal, 'the undo puts the stage, the deal and the ledger back, explicitly');
  const custom = C.markPaidConversion({ ...lead, deal: { ...D.emptyDeal(''), invoices: [I.newInvoice({ label: 'Deposit', amount: 300, dueAt: '2026-09-30', status: 'sent', now: NOW })] } }, lead.deal.invoices[0].id, {}, NOW);
  ok(custom === null, 'an unknown invoice id converts nothing');
  const addons = C.markPaidConversion({ ...lead, deal: { ...D.emptyDeal(''), addonIds: ['rush'], invoices: [{ ...I.newInvoice({ label: 'Rush', amount: 20, dueAt: '2026-09-30', status: 'sent', now: NOW }), id: 'r1' }] } }, 'r1', {}, NOW);
  ok(addons.projectDoc.kind === 'print' && addons.projectDoc.invoices.length === 1 && addons.projectDoc.plan === null, 'an add-on deal builds a print project with just the paid line');
  const pro = C.wonWithoutPayment(lead, NOW);
  ok(pro.leadSet.stage === 'client' && !pro.leadSet.purchases && pro.projectDoc.invoices.length === 0 && pro.leadSet.bookedOutcome.result === 'won', 'won without payment: a client and a project with no invoice and no ledger entry');
  ok(JSON.stringify(C.dealFromOptions([{ packageId: 'build-plan', plan: '12mo', recommended: true }])) === JSON.stringify({ packageId: 'build-plan', addonIds: [], plan: { months: 12, monthly: 150 } }), 'a booking reads the recommended option into the deal');
  ok(C.dealFromOptions([{ label: 'Recommended', price: 1150 }]).packageId === '', 'a legacy free-text option starts the deal with no package');
  ok(C.firstInvoiceDefaults(deal).label === 'Month 1 of 6' && C.firstInvoiceDefaults(deal).amount === 200 && C.firstInvoiceDefaults(D.emptyDeal('web-complete')).amount === 750, 'the first invoice is prefilled from the plan month or the package');
}

section('6. against the real handlers');
{
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'deals-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-secret-not-real'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const callLeads = (await load('_routes/call-leads.js')).handler;
  const projects = (await load('_routes/projects.js')).handler;
  const conceptSets = (await load('_routes/concept-sets.js')).handler;
  const submissionsAdmin = (await load('_routes/submissions.js')).handler;
  const submissionsPublic = (await load('submissions.js')).default;
  const cronDaily = (await load('_routes/cron-daily.js')).handler;
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; } });
  const call = async (fn, method, { query = {}, body, headers = {} } = {}) => { const res = fakeRes(); try { await fn({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; } return res; };
  const B = '507f1f77bcf86cd799439061', DL = '507f1f77bcf86cd799439062', PJ = '507f1f77bcf86cd799439071';
  const lead = (id) => _stores.call_leads.find(l => String(l._id) === id);
  const yesterday = new Date(Date.now() - DAY); const pad = (n) => String(n).padStart(2, '0'); const yKey = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  _reset();
  _stores.call_leads = [
    { _id: B, business: 'Booked Co', stage: 'booked', callStatus: 'booked', meeting: { date: yKey, time: '10:00', type: 'call', location: '' }, socials: {}, callLog: [], purchases: [] },
    { _id: DL, business: 'Deal Co', stage: 'deal', callStatus: 'booked', meeting: { date: '2026-01-05', time: '10:00', type: 'call', location: '' }, socials: {}, callLog: [], purchases: [], deal: { ...D.emptyDeal('web-complete'), checkpoints: { ...D.emptyDeal().checkpoints, callDone: { at: '2026-01-05T16:00:00.000Z', by: 'rob' } } } },
  ];
  _stores.projects = []; _stores.settings = []; _stores.stripe_events = []; _stores.concept_sets = []; _stores.lists = []; _stores.submissions = []; _stores.rate_limits = [];
  // the whitelist
  let r = await call(callLeads, 'PATCH', { body: { id: B, set: { deal: { checkpoints: { concepts: { at: '2026-09-01T00:00:00Z', by: 'robot' }, bogus: { at: 'x' } }, packageId: 'x'.repeat(80), addonIds: ['rush', 'a'.repeat(80), ''], plan: { months: 999, monthly: -5 }, invoices: [{ id: 'i1', label: 'L', amount: 50, dueAt: '2026-10-01', status: 'sent', $where: '1' }], contractLink: 'javascript:alert(1)', metAt: '2026-09-01T00:00:00Z', stalledSince: '', extra: 'no' } } } });
  const dl = lead(B).deal;
  ok(r._status === 200 && dl.checkpoints.concepts.by === 'rob' && !('bogus' in dl.checkpoints) && Object.keys(dl.checkpoints).length === 9 && dl.checkpoints.paid === null, 'the deal whitelist: by falls back to rob, an unknown checkpoint is dropped, every one of the nine exists');
  ok(dl.packageId.length === 40 && dl.addonIds.length === 2 && dl.addonIds[1].length === 40 && dl.plan.months === 60 && dl.plan.monthly === 0, 'packageId caps at 40, addonIds at 40 each, the plan at 60 months and 0');
  ok(dl.invoices.length === 1 && !('$where' in dl.invoices[0]) && dl.contractLink === '' && !('extra' in dl), 'invoices go through the invoice whitelist, a javascript link is dropped, nothing unknown is written');
  r = await call(callLeads, 'PATCH', { body: { id: B, set: { deal: null } } });
  ok(r._status === 200 && lead(B).deal === null, 'deal: null clears it');
  // projects: invoices and the old schedule name
  r = await call(projects, 'POST', { body: { leadId: DL, name: 'Old shape', schedule: [{ id: 's1', amount: 100, dueAt: '2026-09-01', status: 'upcoming', ledgerId: '' }, { id: 's2', amount: 100, dueAt: '2026-08-01', status: 'paid', ledgerId: 'lg1' }] } });
  const old = r._json?.item;
  ok(r._status === 200 && Array.isArray(old.invoices) && old.invoices[0].status === 'sent' && old.invoices[1].status === 'paid' && old.invoices[1].ledgerId === 'lg1' && !('schedule' in old), 'a POST that still says schedule is stored as invoices, mapped');
  r = await call(projects, 'PATCH', { body: { id: String(old._id), set: { schedule: [{ id: 's1', amount: 100, dueAt: '2026-09-01', status: 'paid', ledgerId: 'lg2' }] } } });
  ok(r._status === 200 && _stores.projects.find(p => String(p._id) === String(old._id)).invoices[0].ledgerId === 'lg2', 'a PATCH that says schedule lands on invoices too');
  r = await call(projects, 'PATCH', { body: { id: String(old._id), set: { invoices: [{ id: 'n1', label: 'Draft', amount: 5, dueAt: '2026-12-01', status: 'draft' }] } } });
  ok(r._status === 200 && _stores.projects.find(p => String(p._id) === String(old._id)).invoices[0].status === 'draft', 'invoices writes through the invoice whitelist');
  // a concept set ticks Concepts
  lead(B).deal = D.emptyDeal('launch-plan');
  r = await call(conceptSets, 'POST', { body: { leadId: B, title: 'Directions' } });
  ok(r._status === 200 && lead(B).deal.checkpoints.concepts?.by === 'auto', 'a concept set ticks Concepts on the booked record, by auto');
  // a linked start brief ticks Form received (admin link and the public form)
  _stores.submissions = [{ _id: '507f1f77bcf86cd799439081', type: 'start', name: 'Sam', email: 'sam@x.com', status: 'new' }];
  r = await call(submissionsAdmin, 'PATCH', { body: { id: '507f1f77bcf86cd799439081', set: { linkedLeadId: B } } });
  ok(r._status === 200 && lead(B).deal.checkpoints.formReceived?.by === 'auto', 'Link to lead on a start brief ticks Form received');
  lead(DL).email = 'deal@x.com';
  r = await call(submissionsPublic, 'POST', { body: { type: 'start', name: 'Dee', business: 'Deal Co', email: 'deal@x.com', phone: '' } });
  ok(r._status === 200 && lead(DL).deal.checkpoints.formReceived?.by === 'auto' && _stores.submissions[_stores.submissions.length - 1].linkedLeadId === DL, 'a start brief from the site that matches the deal ticks Form received');
  // the cron: booked past its meeting becomes deal, stall set, plan month drafted on the bill day
  lead(B).deal.checkpoints = D.emptyDeal().checkpoints;
  lead(DL).deal.checkpoints.formReceived = { at: '2026-01-06T16:00:00.000Z', by: 'auto' }; // the brief above ticked it just now; for the stall it needs to be old
  const todayKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;
  _stores.projects.push({ _id: PJ, leadId: DL, name: 'Plan', kind: 'web', stage: 'build', plan: { months: 6, monthly: 200 }, invoices: [{ id: 'm1', label: 'Month 1 of 6', amount: 200, dueAt: I.addMonthsKey(todayKey, -1), status: 'paid' }], archived: false, createdAt: new Date() });
  r = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(r._status === 200 && r._json.dealsMoved >= 2, `the cron moved the deals (${r._json?.dealsMoved})`);
  ok(lead(B).stage === 'deal', 'a booked record a day past its meeting is a deal in the morning');
  ok(!!lead(DL).deal.stalledSince, 'a deal quiet since January is stalled');
  ok(lead(DL).nextAction?.kind === 'send-onboarding', `the next action follows the checkpoints (${lead(DL).nextAction?.kind})`); // the form is back but onboarding never went out
  const pj = _stores.projects.find(p => String(p._id) === PJ);
  ok(r._json.drafted === 1 && pj.invoices.length === 2 && pj.invoices[1].status === 'draft' && pj.invoices[1].label === 'Month 2 of 6' && pj.invoices[1].dueAt === todayKey, `on the bill day the next plan month is drafted (${JSON.stringify(pj.invoices[1])})`);
  const again = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(again._json.drafted === 0 && again._json.dealsMoved === 0, `a second run drafts and moves nothing (drafted ${again._json.drafted}, moved ${again._json.dealsMoved}; B stage ${lead(B).stage}, stall ${lead(B).deal?.stalledSince || '-'}, DL stall ${lead(DL).deal?.stalledSince || '-'})`);
  // the conversion through the routes
  const inv = I.newInvoice({ label: 'Web Complete', amount: 750, dueAt: todayKey, status: 'sent' });
  lead(DL).deal.invoices = [inv];
  const conv = C.markPaidConversion(lead(DL), inv.id, { paidAt: todayKey, note: '' });
  r = await call(callLeads, 'PATCH', { body: { id: DL, set: conv.leadSet } });
  ok(r._status === 200 && lead(DL).stage === 'client' && lead(DL).clientSince && lead(DL).purchases.length === 1 && lead(DL).deal.checkpoints.paid?.by === 'rob', 'the conversion lands on the record: client, clientSince, one ledger entry, paid ticked');
  r = await call(projects, 'POST', { body: conv.projectDoc });
  ok(r._status === 200 && r._json.item.invoices[0].status === 'paid' && r._json.item.invoices[0].ledgerId === conv.purchaseId, 'the project is created with the paid invoice first');
  const guard = await call(callLeads, 'PATCH', { body: { id: DL, set: { stage: 'deal' } } });
  ok(guard._status === 409, 'a client does not slip back to deal without explicit');
  const { explicit, ...undoSet } = C.undoConversionSet({ _id: DL, stage: 'deal', deal: { ...lead(DL).deal, checkpoints: { ...lead(DL).deal.checkpoints, paid: null } }, purchases: [] }); // the app lifts explicit onto the body
  r = await call(callLeads, 'PATCH', { body: { id: DL, set: undoSet, explicit } });
  ok(r._status === 200 && lead(DL).stage === 'deal' && lead(DL).purchases.length === 0 && lead(DL).deal.checkpoints.paid === null, 'the undo puts the record back (explicit), the ledger entry gone');
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passes} checks passed, ${fails} failed.`);
console.log(fails ? 'Deals tests FAILED.' : 'All deals tests pass.');
process.exit(fails ? 1 : 0);
