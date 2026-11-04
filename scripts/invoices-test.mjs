/* Money (prompt 3 of 3, milestone 1): the Invoices screen's logic, the Home numbers' targets, the reminder count and the plan rule.
 *   1. rows, sections and chips over projects and deals (past due oldest first, plans, retainers, paid in 30 days, a draft never shows).
 *   2. Mark paid writes exactly what the Stripe webhook writes (api/_lib/stripe.js applyPayment run on the same line): the same line
 *      fields, a ledger entry whose keys the webhook's entry carries too.
 *   3. A reminder or past due send counts on the line (stamps), the sanitizer keeps it, and the mirror stays byte for byte.
 *   4. The plan's final month: the Stripe cancel task, once, in New York time, not after it is cancelled.
 *   5. The Home numbers: Income opens Invoices on Paid 30 days, Outstanding on Past due (never the Clients dashboard), MRR Clients on
 *      retainers, and every target is a chip or a filter its screen has; the back tree puts /invoices under Home.
 * Run: node scripts/invoices-test.mjs (INV_SRC=<dir> reads src from a copy, for invoices-guard-proof.mjs) */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcRoot = process.env.INV_SRC ? path.resolve(process.env.INV_SRC) : path.join(repoRoot, 'src');
const src = (rel) => import(pathToFileURL(path.join(srcRoot, rel)).href);
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);

const il = await src('lib/invoiceList.js');
const hk = await src('lib/homeKpis.js');
const projectsLib = await src('lib/projects.js');
const backTree = await src('shell/backTree.js');

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'inv-')); const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
process.env.SESSION_SECRET = 'test-secret-not-real'; delete process.env.VERCEL; delete process.env.RESEND_API_KEY;
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset, getDb } = await load('_lib/mongo.js');

const NOW = Date.UTC(2026, 10, 4, 15, 0); // Nov 4 2026, 10:00 New York
const dk = (n) => new Date(NOW + n * 864e5).toISOString().slice(0, 10);
const lead = (id, name, extra = {}) => ({ _id: id, business: name, stage: 'client', purchases: [], ...extra });

section('1. Rows, sections and chips');
const leads = [lead('a', 'Alpha'), lead('b', 'Bravo'), lead('c', 'Charlie', { stage: 'deal', deal: { invoices: [{ id: 'd1', label: 'Deposit', amount: 250, dueAt: dk(3), status: 'sent' }, { id: 'd2', label: 'Final', amount: 250, dueAt: dk(40), status: 'draft' }] } }), lead('d', 'Delta', { retainer: { status: 'active', amount: 250 } })];
const projects = [
  { _id: 'p1', leadId: 'a', name: 'Brand', kind: 'brand', invoices: [{ id: 'i1', label: 'Deposit', amount: 300, dueAt: dk(-12), status: 'sent', reminders: 2 }, { id: 'i2', label: 'Final', amount: 300, dueAt: dk(20), status: 'sent' }] },
  { _id: 'p2', leadId: 'b', name: 'Launch Plan', kind: 'web', plan: { months: 6, monthly: 200 }, invoices: [
    { id: 'm1', label: 'Month 1 of 6', amount: 200, dueAt: dk(-62), status: 'paid', paidAt: new Date(NOW - 20 * 864e5).toISOString(), ledgerId: 'L1', kind: 'plan' },
    { id: 'm2', label: 'Month 2 of 6', amount: 200, dueAt: dk(-30), status: 'paid', paidAt: new Date(NOW - 45 * 864e5).toISOString(), ledgerId: 'L2', kind: 'plan' },
    { id: 'm3', label: 'Month 3 of 6', amount: 200, dueAt: dk(20), status: 'sent', kind: 'plan' },
    { id: 'm4', label: 'Month 4 of 6', amount: 200, dueAt: dk(50), status: 'sent', kind: 'plan' }] },
  { _id: 'p3', leadId: 'd', name: 'Care', kind: 'retainer', invoices: [{ id: 'r1', label: 'Month 7', amount: 250, dueAt: dk(25), status: 'sent' }] },
  { _id: 'p4', leadId: 'a', name: 'Old', kind: 'web', archived: true, invoices: [{ id: 'x1', label: 'Old', amount: 999, dueAt: dk(-90), status: 'sent' }] },
];
const rows = il.invoiceRows(leads, projects, NOW);
ok(!rows.some(r => r.inv.id === 'd2'), 'a draft line never shows (the record holds it)');
ok(!rows.some(r => r.inv.id === 'x1'), 'an archived project does not show');
ok(rows.find(r => r.inv.id === 'd1')?.src === 'deal' && rows.find(r => r.inv.id === 'i1')?.src === 'project', 'deal lines and project lines both show');
const secs = il.invoiceSections(rows, NOW); const by = Object.fromEntries(secs.map(s => [s.id, s.rows.map(r => r.inv.id)]));
ok(by['past-due'].join() === 'i1' && by['past-due'].length === 1, `Past due holds the late line (${by['past-due']})`);
ok(il.invoiceRows(leads, projects, NOW).find(r => r.inv.id === 'i1').late === 12, 'twelve days late');
ok(by.plans.join() === 'm3,m4', `Plans: the unpaid months in order (${by.plans})`);
ok(by.retainers.join() === 'r1', 'Retainers');
ok(by['due-soon'].includes('d1') && by['due-soon'].includes('i2'), `Due soon holds the one-off lines coming up (${by['due-soon']})`);
ok(by.paid.join() === 'm1', 'Paid last 30 days holds m1 only (m2 was paid 45 days ago)');
const m3 = rows.find(r => r.inv.id === 'm3');
ok(m3.plan.n === 3 && m3.plan.of === 6 && m3.plan.stopsAfter === 6 && m3.plan.endsAt === dk(50), 'a plan line says month 3 of 6, ends at the last line, stops after month 6');
ok(il.chipRows(rows, 'past-due', NOW).map(r => r.inv.id).join() === 'i1', 'chip Past due');
ok(il.chipRows(rows, 'paid30', NOW).map(r => r.inv.id).join() === 'm1', 'chip Paid 30 days');
ok(il.chipRows(rows, 'plans', NOW).every(r => r.kind === 'plan' || r.kind === 'retainer') && il.chipRows(rows, 'plans', NOW).length >= 4, 'chip Plans: every plan and retainer line');
ok(il.chipRows(rows, 'unpaid', NOW).every(r => r.st !== 'paid') && il.owedTotal(rows) === 300 + 300 + 200 + 200 + 250 + 250, `Unpaid total ${il.owedTotal(rows)}`);
ok(il.chipCount(rows, 'unpaid', NOW) === il.chipRows(rows, 'unpaid', NOW).length, 'the chip count is the list');
const byHand = il.invoiceRows([lead('z', 'Zed')], [{ _id: 'pz', leadId: 'z', name: 'P', invoices: [{ id: 'q', label: 'Old logged', amount: 100, dueAt: dk(-3), status: 'paid', paidAt: new Date(NOW - 864e5).toISOString() }] }], NOW);
ok(byHand[0].st === 'paid' && byHand[0].byHand === true, 'a paid line with no ledger id and no Stripe link reads logged by hand, with no due date guessed');

section('2. Mark paid writes what the Stripe webhook writes');
{
  _reset();
  const lines = [{ id: 'i1', label: 'Deposit', amount: 300, dueAt: dk(-12), status: 'sent', sentAt: new Date(NOW - 20 * 864e5).toISOString() }];
  _stores.call_leads = [{ _id: 'L-a', business: 'Alpha', stage: 'client', purchases: [] }];
  _stores.projects = [{ _id: 'P-a', leadId: 'L-a', name: 'Brand', kind: 'brand', invoices: lines }];
  _stores.email_log = []; _stores.settings = []; _stores.concept_sets = [];
  const { applyPayment } = await load('_lib/stripe.js');
  const db = await getDb();
  const leadDoc = _stores.call_leads[0];
  await applyPayment(db, { id: 'evt_1', type: 'charge.succeeded', amount: 300, at: new Date(NOW).toISOString(), description: 'Deposit', paymentLinkId: '' }, leadDoc);
  const webhookLine = _stores.projects[0].invoices[0]; const webhookEntry = _stores.call_leads[0].purchases[0];
  const changed = (a, b) => Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
  const webhookDiff = changed(lines[0], webhookLine);
  const mine = il.paidByHand({ purchases: [] }, { _id: 'P-a', name: 'Brand', invoices: lines }, lines[0], {}, NOW);
  const myDiff = changed(lines[0], mine.line);
  ok(myDiff.join() === webhookDiff.join(), `the line changes the same fields: ${myDiff.join()} vs the webhook's ${webhookDiff.join()}`);
  ok(mine.line.status === 'paid' && mine.line.ledgerId === mine.entry.id && mine.projectSet.invoices[0].ledgerId === mine.entry.id, 'the line points at its ledger entry');
  const extra = Object.keys(mine.entry).filter(k => !(k in webhookEntry));
  ok(extra.length === 0 || (extra.length === 1 && extra[0] === 'source'), `the ledger entry has no key the webhook's lacks (${extra})`);
  ok(mine.entry.amount === 300 && mine.entry.projectId === 'P-a' && mine.leadSet.purchases.length === 1, 'the amount, the project and one entry on the client');
  ok(il.paidByHand({}, null, lines[0]) === null, 'a deal line is not paid from the list (its first payment is the conversion with its confirm)');
}

section('3. Reminders count on the line');
{
  _reset();
  const { applySendStamps } = await load('_lib/email/stamps.js');
  const { sanitizeInvoice } = await load('_lib/invoices.js');
  _stores.call_leads = [{ _id: 'L-a', business: 'Alpha', stage: 'client', purchases: [], contactLog: [] }];
  const inv = { id: 'i1', label: 'Deposit', amount: 300, dueAt: dk(-12), status: 'sent' };
  _stores.projects = [{ _id: 'P-a', leadId: 'L-a', name: 'Brand', kind: 'brand', invoices: [inv] }];
  _stores.email_log = []; _stores.settings = []; _stores.concept_sets = [];
  const db = await getDb();
  const sentAt = new Date(NOW).toISOString();
  await applySendStamps(db, { lead: _stores.call_leads[0], project: _stores.projects[0], invoice: inv, kind: 'invoice_reminder', sentAt, note: 'Sent invoice reminder' });
  const once = _stores.projects[0].invoices[0];
  ok(once.reminders === 1 && once.remindedAt === sentAt, `a reminder send counts once (${once.reminders})`);
  await applySendStamps(db, { lead: _stores.call_leads[0], project: _stores.projects[0], invoice: once, kind: 'invoice_past_due', sentAt, note: 'Sent past due' });
  ok(_stores.projects[0].invoices[0].reminders === 2, 'a past due send is the second');
  await applySendStamps(db, { lead: _stores.call_leads[0], project: _stores.projects[0], invoice: _stores.projects[0].invoices[0], kind: 'invoice', sentAt, note: 'Sent invoice' });
  ok(_stores.projects[0].invoices[0].reminders === 2, 'the invoice email itself is not a reminder');
  ok(sanitizeInvoice({ id: 'z', reminders: 3, remindedAt: sentAt }).reminders === 3 && !('reminders' in sanitizeInvoice({ id: 'z' })) && sanitizeInvoice({ id: 'z', reminders: 500 }).reminders === 99, 'the sanitizer keeps it, caps it, and an older line has none');
  const below = (t) => t.split('\n').filter(l => !l.startsWith(' *') && !l.startsWith('/*')).join('\n').split('export const INVOICE_STATUS_IDS')[1];
  ok(below(fs.readFileSync(path.join(repoRoot, 'src/lib/invoices.js'), 'utf8')).replace(/\s+/g, '') === below(fs.readFileSync(path.join(repoRoot, 'api/_lib/invoices.js'), 'utf8')).replace(/\s+/g, ''), 'src/lib/invoices.js and its api mirror agree below the clock');
}

section('4. The plan\'s final month');
{
  const { PROJECT_RULES, dueRules } = await load('_lib/rules.js');
  const plan = (extra = {}, lastDue = dk(10)) => ({ _id: 'p', leadId: 'a', name: 'Launch Plan', plan: { months: 3, monthly: 200 }, checklists: [], invoices: [
    { id: 'a1', label: 'Month 1 of 3', amount: 200, dueAt: dk(-50), status: 'paid', ledgerId: 'x', paidAt: dk(-50) },
    { id: 'a2', label: 'Month 2 of 3', amount: 200, dueAt: dk(-20), status: 'paid', ledgerId: 'y', paidAt: dk(-20) },
    { id: 'a3', label: 'Month 3 of 3', amount: 200, dueAt: lastDue, status: 'sent' }], ...extra });
  const fire = (p, now = NOW) => dueRules(PROJECT_RULES, p, { lead: { business: 'Bravo' } }, now).find(f => f.id === 'planStripeCancel');
  ok(!fire(plan({}, dk(40))), 'not before the last line\'s month');
  const f = fire(plan({}, dk(10)));
  ok(!!f && f.key === 'a3', 'in the final month it fires, keyed by the last line');
  const t = f?.set.checklists.flatMap(l => l.items).find(i => /Cancel the Stripe subscription/.test(i.text));
  ok(!!t && /Bravo/.test(t.text) && /month 3/.test(t.text) && t.due.startsWith(dk(10)) && !t.done, `the task names the client and the month, due the last line's day (${t?.due})`);
  ok(f?.set.checklists.length === 1 && f.set.checklists[0].name === 'Payment plan', 'it lands in a Payment plan list on the project (the one task system)');
  ok(!fire(plan({ cronRules: { planStripeCancel: 'a3' } })), 'once per last line: the same key does not fire again');
  ok(!fire(plan({ plan: { months: 3, monthly: 200, stripeCancelled: true } })), 'not once the subscription is cancelled');
  ok(!fire(plan({ archived: true })), 'not on an archived project');
  ok(!fire({ _id: 'p', invoices: [] }), 'not without a plan');
  const edge = fire(plan({}, '2026-11-30'), Date.UTC(2026, 10, 1, 4, 30)); // Nov 1 00:30 New York (EDT ended the day Nov 1 at 2:00; zone month is still November)
  ok(!!edge, 'the month is New York\'s: Nov 1 00:30 New York is already November');
  const lateOct = fire(plan({}, '2026-11-02'), Date.UTC(2026, 10, 1, 3, 30)); // Oct 31 23:30 New York (EDT)
  ok(!lateOct, 'and Oct 31 23:30 New York is still October');
}

section('5. The Home numbers');
ok(hk.kpiPath('income') === '/invoices?chip=paid30', 'Income opens Invoices on Paid 30 days');
ok(hk.kpiPath('outstanding') === '/invoices?chip=past-due', 'Outstanding opens Invoices on Past due');
ok(hk.kpiPath('outstanding') !== '/overview' && !/^\/(overview|clients)$/.test(hk.kpiPath('outstanding')), 'Outstanding never opens the Clients dashboard');
ok(hk.kpiPath('mrr') === '/clients?filter=retainer', 'MRR opens Clients on retainers');
for (const id of ['income', 'outstanding']) { const chip = new URLSearchParams(hk.kpiPath(id).split('?')[1]).get('chip'); ok(il.CHIP_IDS.includes(chip), `${id}'s chip (${chip}) is one the Invoices screen has`); }
ok(projectsLib.CLIENT_FILTERS.some(([id]) => id === 'retainer') && projectsLib.CLIENT_FILTERS.some(([id]) => id === 'planner'), 'Clients has the retainer and planner filters the taps use');
ok(backTree.parentOf('/invoices') === '/' && backTree.isRoot('/invoices'), '/invoices is a root under Home');
ok(hk.kpiPath('nope') === '/', 'an unknown id falls to the home');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\ninvoices-test: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
