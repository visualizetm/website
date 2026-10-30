#!/usr/bin/env node
/* Push coverage (finish notifications, milestone 3): every place a callback or a meeting lives pushes, and Next up agrees.
 *   1. a callback pushes whatever callStatus says (the record's picker writes callbackAt alone), unless the lead is closed,
 *      declined, parked, booked, answered by a later call, or its next action is done; a manual callback (a snoozed row) wins
 *   2. the reminders cron and nextUpItems answer the same question for every one of those leads (one rule, two readers)
 *   3. a meeting pushes 15 minutes before it starts and when it starts, each once; booked, deal, won and client records, a
 *      record with no stage whose callStatus is booked, and the outcome sheet's afterCall text all count
 *   4. late runs: a heads-up the cron was too late for is skipped, the start still pushes
 *   5. the switches: Callbacks and Meetings off silence them
 *   6. the morning digest lists deal meetings and afterCall meetings
 *   7. Stripe: "Paid: Client $1,200" once per payment however many events Stripe sends, a retry says nothing, an unmatched payment still does
 *   8. invoices past due: from 9:00 New York, once per invoice per day, three times at most, projects and deals
 *   9. the scraper's new leads, every 15 minutes, never what was already there, never a lead Rob added by hand
 *  11. a spreadsheet import tells Rob once for the whole file, never per row; the site form's new lead carries its category
 *  10. Calendly: a booking and a cancellation once per event id, the first poll pushes nothing, a failed poll keeps its state
 *   node scripts/coverage-push-test.mjs */
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
const NA = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'nextAction.js')).href);
const MIN = 60e3;

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'coverage-')); const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), "export const _pushes = [];\nexport const _attempts = [];\nexport const _state = { result: { attempted: 1, delivered: 1, removed: 0, errors: [] } };\nexport async function sendPush(db, p) { _attempts.push(p); if (_state.result.delivered > 0) _pushes.push(p); return _state.result; }\nexport async function sendClientPush() { return { attempted: 0, delivered: 0, removed: 0, errors: ['no-devices'] }; }\n");
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset, getDb } = await load('_lib/mongo.js');
const { _pushes, _attempts, _state } = await load('_lib/notify.js');
const Webhook = (await load('stripe/webhook.js')).default;
const crypto = await import('node:crypto');
const { runReminders } = await load('_routes/cron-reminders.js');
const SrvNA = await load('_lib/nextAction.js');
const db = await getDb();
const iso = (t) => new Date(t).toISOString();
const DAY = '2026-10-02';
const at = (h, m = 0) => Z.zoneDateAt(DAY, h, m);

const DELIVERED = { attempted: 1, delivered: 1, removed: 0, errors: [] };
const NO_DEVICE = { attempted: 0, delivered: 0, removed: 0, errors: ['no-devices'] };
const seed = (reminders = {}, digestDone = true) => {
  _reset(); _pushes.length = 0; _attempts.length = 0;
  _stores.settings = [{ _id: 'notifications', reminders: { meetings: true, callbacks: true, bills: true, reviews: true, tasks: true, ...reminders }, sentReminderKeys: digestDone ? ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'].map(d => `digest:${d}`) : [] }];
  _state.result = DELIVERED;
  _stores.call_leads = []; _stores.projects = []; _stores.push_subscriptions = [];
};
const titles = () => _pushes.map(p => p.title);
const has = (re) => titles().some(t => re.test(t));
let n = 0;
const id = () => `507f1f77bcf86cd7994${String(++n).padStart(5, '0')}`;

section('1. a callback pushes whatever callStatus says');
const T = at(17, 0); // every callback below is due at 5:00 PM
const CALLBACKS = [
  // [name, lead fields, pushes?]
  ['picker on a fresh lead (triage, never called)', { callStatus: 'not-called', callLog: [] }, true],
  ['picker on a lead with no stage and an old call', { callStatus: 'no-answer', callLog: [{ at: iso(T - 3 * 864e5), outcome: 'no-answer' }] }, true],
  ['the Call Console (callStatus callback)', { stage: 'lead', callStatus: 'callback', callLog: [{ at: iso(T - 864e5), outcome: 'callback' }] }, true],
  ['stage lead, status no-answer, last call before the time', { stage: 'lead', callStatus: 'no-answer', callLog: [{ at: iso(T - 2 * 864e5), outcome: 'no-answer' }] }, true],
  ['a call logged after the callback time answered it', { stage: 'lead', callStatus: 'no-answer', callbackAt: iso(T - 5 * MIN), callLog: [{ at: iso(T - 2 * MIN), outcome: 'no-answer' }] }, false],
  ['booked', { stage: 'booked', callStatus: 'booked', callLog: [{ at: iso(T - 864e5), outcome: 'booked' }] }, false],
  ['a client', { stage: 'client', callStatus: 'booked', callLog: [{ at: iso(T - 864e5), outcome: 'booked' }] }, false],
  ['declined', { stage: 'declined', callStatus: 'no', callLog: [{ at: iso(T - 864e5), outcome: 'no' }] }, false],
  ['parked in nurture', { stage: 'nurture', callStatus: 'no', callLog: [{ at: iso(T - 864e5), outcome: 'no' }] }, false],
  ['a wrong number', { stage: 'lead', callStatus: 'wrong-number', callLog: [{ at: iso(T - 864e5), outcome: 'wrong-number' }] }, false],
  ['deleted', { stage: 'lead', callStatus: 'callback', callLog: [{ at: iso(T - 864e5), outcome: 'callback' }], deleted: true }, false],
  ['a manual callback (snoozed row) with an old callbackAt', { stage: 'lead', callStatus: 'callback', callbackAt: iso(T - 2 * 864e5), callLog: [{ at: iso(T - 3 * 864e5), outcome: 'callback' }], nextAction: { kind: 'callback', label: 'Call back', dueAt: iso(T), auto: false, doneAt: '' } }, true],
  ['a manual callback already done', { stage: 'lead', callStatus: 'no-answer', callbackAt: '', callLog: [{ at: iso(T - 3 * 864e5), outcome: 'no-answer' }], nextAction: { kind: 'callback', label: 'Call back', dueAt: iso(T), auto: false, doneAt: iso(T - 5 * MIN) } }, false],
];
const rows = CALLBACKS.map(([name, f, want], i) => {
  const fields = f;
  return { name, want, lead: { _id: id(), business: `Callback${i} Co`, phone: '555-0100', socials: {}, callbackAt: iso(T), ...fields } };
});
seed();
_stores.call_leads = rows.map(r => r.lead);
await runReminders(db, T);
for (const r of rows) ok(has(new RegExp(`Call back: ${r.lead.business}`)) === r.want, `${r.name}: ${r.want ? 'pushes' : 'does not push'}`);
const before = _pushes.length;
await runReminders(db, T + MIN); await runReminders(db, T + 2 * MIN);
ok(_pushes.length === before, 'two more runs push nothing: each callback is on its key');

section('2. the cron and nextUpItems answer the same question');
for (const r of rows) {
  const lead = JSON.parse(JSON.stringify(r.lead));
  const queue = NA.nextUpItems([lead], [], [], T + 1000).all.concat(NA.nextUpItems([lead], [], [], T + 1000).beyond);
  const cb = queue.find(i => i.action.kind === 'callback');
  const server = SrvNA.callbackDue(lead);
  const client = NA.callbackDue(lead);
  ok(!!cb === r.want && !!server === r.want && !!client === r.want, `${r.name}: Next up ${cb ? 'shows' : 'does not show'} a callback, the cron rule ${server ? 'owes' : 'does not owe'} a push`);
  if (r.want) ok(server.at === client.at && server.stamp === client.stamp, `${r.name}: client and server mirrors give the same instant and stamp`);
}

section('3. a meeting pushes 15 minutes before and when it starts');
const MEETING = { date: DAY, time: '17:00', type: 'call', location: 'Zoom' };
const MEETINGS = [
  ['booked', { stage: 'booked', callStatus: 'booked', meeting: MEETING }, true],
  ['a deal', { stage: 'deal', callStatus: 'booked', meeting: MEETING }, true],
  ['won', { stage: 'won', callStatus: 'booked', meeting: MEETING }, true],
  ['a client', { stage: 'client', callStatus: 'booked', meeting: MEETING }, true],
  ['no stage field, callStatus booked', { callStatus: 'booked', callLog: [{ at: iso(T - 864e5), outcome: 'booked' }], meeting: MEETING }, true],
  ['afterCall text only (outcome sheet, no structured date)', { stage: 'booked', callStatus: 'booked', afterCall: { meeting: `${DAY} 17:00` } }, true],
  ['an open lead with a leftover meeting', { stage: 'lead', callStatus: 'no-answer', callLog: [{ at: iso(T - 864e5), outcome: 'no-answer' }], meeting: MEETING }, false],
  ['declined', { stage: 'declined', meeting: MEETING }, false],
  ['free text afterCall that is not a date', { stage: 'booked', callStatus: 'booked', afterCall: { meeting: 'next Tuesday sometime' } }, false],
];
const mrows = MEETINGS.map(([name, fields, want], i) => ({ name, want, lead: { _id: id(), business: `Meeting${i} Co`, socials: {}, ...fields } }));
seed();
_stores.call_leads = mrows.map(r => r.lead);
await runReminders(db, T - 16 * MIN);
ok(_pushes.length === 0, '16 minutes before: nothing yet');
await runReminders(db, T - 15 * MIN);
for (const r of mrows) ok(has(new RegExp(`Meeting in 15 min: ${r.lead.business}, 5:00 PM`)) === r.want, `${r.name}: 15 minutes before ${r.want ? 'pushes' : 'does not push'}`);
await runReminders(db, T - 10 * MIN); await runReminders(db, T - MIN);
const heads = _pushes.length;
ok(heads === mrows.filter(r => r.want).length, `the heads-up is once per meeting (${heads})`);
await runReminders(db, T);
for (const r of mrows) ok(has(new RegExp(`Meeting now: ${r.lead.business}, 5:00 PM`)) === r.want, `${r.name}: at the start ${r.want ? 'pushes' : 'does not push'}`);
const total = _pushes.length;
await runReminders(db, T + MIN); await runReminders(db, T + 5 * MIN);
ok(total === mrows.filter(r => r.want).length * 2 && _pushes.length === total, `two pushes per meeting, nothing repeated (${total})`);
ok(_pushes.find(p => /Meeting0 Co/.test(p.title) && /now/.test(p.title))?.url.includes('/booked?open='), 'the push opens the booked record');

section('4. a run that is late');
{
  seed();
  const a = { _id: id(), business: 'Late Co', stage: 'booked', callStatus: 'booked', meeting: MEETING, socials: {} };
  _stores.call_leads = [a];
  await runReminders(db, T - 3 * MIN);
  ok(_pushes.length === 0, 'three minutes before the start the 15 minute heads-up is 12 minutes late: skipped, nothing pushes');
  const outcomes = _stores.settings.find(s => s._id === 'notifications').reminderOutcomes || [];
  ok(outcomes.some(o => o.kind === 'meeting-soon' && o.status === 'skipped'), 'the skip is recorded in the outcomes log');
  await runReminders(db, T);
  ok(titles().join('|') === 'Meeting now: Late Co, 5:00 PM', `the start still pushes (${titles().join('|')})`);

  seed();
  _stores.call_leads = [{ ...a, _id: id(), business: 'Booked Late Co' }];
  await runReminders(db, T - 10 * MIN);
  ok(titles().join('|') === 'Meeting in 10 min: Booked Late Co, 5:00 PM', `booked 10 minutes ahead: the first run pushes "in 10 min" (${titles().join('|')})`);

  seed();
  _stores.call_leads = [{ ...a, _id: id(), business: 'After Start Co' }];
  await runReminders(db, T + MIN);
  ok(titles().join('|') === 'Meeting now: After Start Co, 5:00 PM', `first seen a minute after the start: one push, no heads-up (${titles().join('|')})`);

  seed();
  const b = { ...a, _id: id(), business: 'Moved Co' };
  _stores.call_leads = [b];
  await runReminders(db, T - 15 * MIN);
  b.meeting = { ...MEETING, time: '18:00' };
  await runReminders(db, T + 45 * MIN);
  ok(has(/Meeting in 15 min: Moved Co, 6:00 PM/), 'a moved meeting pushes again for its new time');
}

section('5. the switches');
{
  seed({ meetings: false });
  _stores.call_leads = [{ _id: id(), business: 'Sw Co', stage: 'booked', callStatus: 'booked', meeting: MEETING, socials: {} }, { _id: id(), business: 'Sw Cb Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(T), socials: {} }];
  await runReminders(db, T - 15 * MIN); await runReminders(db, T);
  ok(!has(/Meeting (now|in)/) && has(/Call back: Sw Cb Co/), `Meetings off: no meeting push, the callback still pushes (${titles().join('|')})`);
  seed({ callbacks: false });
  _stores.call_leads = [{ _id: id(), business: 'Sw2 Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(T), socials: {} }];
  await runReminders(db, T);
  ok(_pushes.length === 0, 'Callbacks off: no callback push');
}

section('6. the morning digest');
{
  seed({}, false);
  _stores.call_leads = [
    { _id: id(), business: 'Deal Digest Co', stage: 'deal', callStatus: 'booked', meeting: { date: DAY, time: '14:00' }, socials: {} },
    { _id: id(), business: 'After Digest Co', stage: 'booked', callStatus: 'booked', afterCall: { meeting: `${DAY} 16:30` }, socials: {} },
    { _id: id(), business: 'Picker Digest Co', stage: 'lead', callStatus: 'no-answer', callLog: [{ at: iso(at(8, 0) - 864e5) }], callbackAt: iso(at(9, 0)), socials: {} },
  ];
  await runReminders(db, at(8, 31));
  const d = _pushes.find(p => /^Today:/.test(p.title));
  ok(!!d && /2 meetings/.test(d.title) && /1 callback/.test(d.title), `the digest counts both meetings and the picker callback (${d?.title})`);
  ok(/Deal Digest Co at 2:00 PM/.test(d?.body || '') && /After Digest Co at 4:30 PM/.test(d?.body || '') && /Picker Digest Co/.test(d?.body || ''), 'and names them');
}

section('7. Stripe: Paid, once per payment');
{
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_not_real';
  const LEAD = '507f1f77bcf86cd799439071';
  const fakeRes = () => ({ _status: 200, _json: null, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader() {}, end() { return this; } });
  const post = async (event) => {
    const raw = JSON.stringify(event); const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex');
    const req = { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}`, 'x-forwarded-for': '203.0.113.7' }, body: raw, query: {}, url: '/api/stripe/webhook' };
    const res = fakeRes(); await Webhook(req, res); return res;
  };
  const ev = (id, type, object) => ({ id, type, created: Math.floor(Date.now() / 1000), data: { object } });
  const seedPay = () => { seed(); _stores.call_leads = [{ _id: LEAD, business: 'Sharpless Detailing', email: 'dan@sharpless.example', stage: 'client', purchases: [] }]; _stores.projects = []; _stores.stripe_events = []; };
  seedPay();
  let r = await post(ev('evt_1', 'checkout.session.completed', { object: 'checkout.session', amount_total: 120000, currency: 'usd', customer_details: { email: 'dan@sharpless.example', name: 'Dan' }, description: 'Website deposit' }));
  ok(r._status === 200 && titles().join('|') === 'Paid: Sharpless Detailing $1,200', `a payment pushes "Paid: Sharpless Detailing $1,200" (${titles().join('|')})`);
  ok(_pushes[0]?.url.endsWith(`/clients/${LEAD}`) && _pushes[0]?.category === 'payments', 'it opens the client and carries the payments category');
  await post(ev('evt_2', 'charge.succeeded', { object: 'charge', amount: 120000, currency: 'usd', billing_details: { email: 'dan@sharpless.example' } }));
  await post(ev('evt_3', 'invoice.paid', { object: 'invoice', amount_paid: 120000, currency: 'usd', customer_email: 'dan@sharpless.example' }));
  ok(_pushes.length === 1, `the charge and the invoice events of the same payment say nothing more (${_pushes.length} push)`);
  r = await post(ev('evt_1', 'checkout.session.completed', { object: 'checkout.session', amount_total: 120000, currency: 'usd', customer_details: { email: 'dan@sharpless.example' } }));
  ok(_pushes.length === 1, 'Stripe retrying the same event id says nothing');
  await post(ev('evt_4', 'charge.succeeded', { object: 'charge', amount: 45050, currency: 'usd', billing_details: { email: 'dan@sharpless.example' } }));
  ok(_pushes.length === 2 && _pushes[1].title === 'Paid: Sharpless Detailing $450.50', `a different amount is another payment (${_pushes[1]?.title})`);
  await post(ev('evt_5', 'charge.succeeded', { object: 'charge', amount: 5000, currency: 'usd', billing_details: { email: 'stranger@nowhere.example', name: 'Stranger' } }));
  ok(_pushes.length === 3 && _pushes[2].title === 'Paid: Stranger $50' && _pushes[2].url.endsWith('/settings'), `a payment no client matches still pushes, to Settings (${_pushes[2]?.title})`);
  await post(ev('evt_6', 'customer.subscription.created', { object: 'subscription', id: 'sub_1' }));
  ok(_pushes.length === 3, 'a subscription event is not a payment');
  seedPay(); _state.result = NO_DEVICE;
  await post(ev('evt_7', 'charge.succeeded', { object: 'charge', amount: 70000, currency: 'usd', billing_details: { email: 'dan@sharpless.example' } }));
  _state.result = DELIVERED;
  await post(ev('evt_8', 'invoice.paid', { object: 'invoice', amount_paid: 70000, currency: 'usd', customer_email: 'dan@sharpless.example' }));
  ok(_attempts.length === 2 && _pushes.length === 1 && _pushes[0].title === 'Paid: Sharpless Detailing $700', 'a push no device took does not count as told: the next event for that payment tells Rob');
}

section('8. invoices past due');
{
  const LEAD = '507f1f77bcf86cd799439072';
  const late = (id, over = {}) => ({ id, label: `Line ${id}`, amount: 350, dueAt: '2026-09-20', status: 'sent', sentAt: '2026-09-10T00:00:00.000Z', paidAt: '', note: '', ...over });
  const seedInv = (invoices, reminders = {}) => { seed(reminders); _stores.call_leads = [{ _id: LEAD, business: 'Owed Co', stage: 'client', socials: {} }]; _stores.projects = [{ _id: 'p1', leadId: LEAD, name: 'Website', invoices }]; };
  const day = (d, h = 9, m = 5) => Z.zoneDateAt(d, h, m);
  seedInv([late('a')]);
  await runReminders(db, day('2026-10-02', 8, 55));
  ok(_pushes.length === 0, 'before 9:00 New York nothing is said (the phone may be asleep)');
  await runReminders(db, day('2026-10-02'));
  ok(titles().join('|') === 'Overdue: Owed Co $350', `at 9:05 one overdue line pushes "Overdue: Owed Co $350" (${titles().join('|')})`);
  ok(_pushes[0]?.url.endsWith(`/clients/${LEAD}`) && _pushes[0]?.category === 'payments', 'it opens the client');
  await runReminders(db, day('2026-10-02', 15, 0)); await runReminders(db, day('2026-10-02', 15, 1));
  ok(_pushes.length === 1, 'once per invoice per day');
  await runReminders(db, day('2026-10-03')); await runReminders(db, day('2026-10-04'));
  ok(_pushes.length === 3, `the next two days each say it again (${_pushes.length})`);
  await runReminders(db, day('2026-10-05')); await runReminders(db, day('2026-10-06'));
  ok(_pushes.length === 3, 'but never a fourth time');

  seedInv([late('a'), late('b', { amount: 100, dueAt: '2026-09-25' }), late('c', { status: 'paid', paidAt: '2026-09-21' }), late('d', { status: 'draft' }), late('e', { dueAt: '2026-10-30' })]);
  await runReminders(db, day('2026-10-02'));
  ok(titles().join('|') === '2 invoices overdue' && /Owed Co \$350, Owed Co \$100/.test(_pushes[0]?.body || ''), `only the two sent and past due lines count, paid, draft and not yet due do not (${titles().join('|')}: ${_pushes[0]?.body})`);

  seedInv([]);
  _stores.call_leads = [{ _id: LEAD, business: 'Deal Co', stage: 'deal', socials: {}, deal: { invoices: [late('z', { amount: 900 })] } }];
  await runReminders(db, day('2026-10-02'));
  ok(titles().filter(t => /Overdue/.test(t)).join('|') === 'Overdue: Deal Co $900', `an invoice on a deal not yet converted counts (${titles().join('|')})`);

  seedInv([late('a')], { bills: false });
  await runReminders(db, day('2026-10-02'));
  ok(_pushes.length === 0, 'the Bills switch off silences it');

  seedInv([late('a')]); _state.result = NO_DEVICE;
  await runReminders(db, day('2026-10-02', 9, 5)); await runReminders(db, day('2026-10-02', 9, 6)); await runReminders(db, day('2026-10-02', 9, 7)); await runReminders(db, day('2026-10-02', 9, 8));
  const g = _stores.settings.find(s => s._id === 'cronGates');
  ok(g?.overdueDay === '2026-10-02' && !g?.overdueNudges?.a, 'with no device it is tried three times, then dropped for the day without using up one of the three nudges');
  _state.result = DELIVERED;
  await runReminders(db, day('2026-10-03'));
  ok(titles().filter(t => /Overdue/.test(t)).join('|') === 'Overdue: Owed Co $350' && _stores.settings.find(s => s._id === 'cronGates').overdueNudges.a.n === 1, `and tomorrow it is the first nudge (${titles().join('|')})`);
}

section('9. the scraper\'s new leads');
{
  const T0 = Z.zoneDateAt('2026-10-02', 12, 0);
  const scraped = (name, at) => ({ _id: id(), business: name, sourceId: `src-${name}`, createdAt: new Date(at), socials: {}, stage: 'triage' });
  seed();
  _stores.call_leads = [scraped('Already There', T0 - 3600e3)];
  await runReminders(db, T0);
  ok(_pushes.length === 0, 'the first look only sets the mark: what is already in the CRM is not news');
  _stores.call_leads.push(scraped('Fresh One', T0 + 2 * MIN), { _id: id(), business: 'Added By Rob', createdAt: new Date(T0 + 3 * MIN), socials: {}, stage: 'triage' });
  await runReminders(db, T0 + 10 * MIN);
  ok(_pushes.length === 0, 'inside the 15 minute gate nothing is looked at');
  await runReminders(db, T0 + 15 * MIN);
  ok(titles().join('|') === 'New lead: Fresh One' && _pushes[0].category === 'leads', `one scraped lead pushes by name, the one Rob added by hand does not (${titles().join('|')})`);
  ok(_pushes[0].url.includes('/leads?open='), 'and opens it');
  await runReminders(db, T0 + 31 * MIN);
  ok(_pushes.length === 1, 'the same lead is never told twice');
  _stores.call_leads.push(scraped('Two A', T0 + 33 * MIN), scraped('Two B', T0 + 34 * MIN), scraped('Two C', T0 + 35 * MIN));
  await runReminders(db, T0 + 47 * MIN);
  ok(_pushes.length === 2 && _pushes[1].title === '3 new leads' && /Two A/.test(_pushes[1].body), `several arrive as one push (${_pushes[1]?.title})`);
  _stores.call_leads.push(scraped('Nobody Home', T0 + 50 * MIN));
  _state.result = NO_DEVICE;
  await runReminders(db, T0 + 63 * MIN);
  _state.result = DELIVERED;
  await runReminders(db, T0 + 79 * MIN);
  ok(_pushes.length === 3 && _pushes[2].title === 'New lead: Nobody Home', `a look with no device keeps the mark, so the next look tells Rob (${titles().join('|')})`);
}

section('11. a spreadsheet import, and the site form');
{
  const Import = await load('_routes/leads-import.js');
  const fakeRes = () => ({ _status: 200, _json: null, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; } });
  seed();
  let res = fakeRes();
  await Import.handler({ method: 'POST', body: { rows: [{ business: 'Sheet One', phone: '555 0101' }, { business: 'Sheet Two' }, { business: 'Sheet Three' }] }, query: {}, headers: {} }, res);
  ok(res._json?.created === 3 && titles().join('|') === '3 new leads imported' && _pushes[0].category === 'leads', `three new rows are one push (${titles().join('|')})`);
  res = fakeRes();
  await Import.handler({ method: 'POST', body: { rows: [{ business: 'Sheet One', phone: '555 0101' }, { business: 'Sheet Two' }] }, query: {}, headers: {} }, res);
  ok(res._json?.created === 0 && _pushes.length === 1, 'a file with nothing new says nothing');
  const sub = fs.readFileSync(path.join(apiDst, 'submissions.js'), 'utf8');
  ok(/category: doc\.type === 'review' \? 'client' : 'leads'/.test(sub), 'the site form push is tagged leads (a review client)');
}

section('10. Calendly bookings');
{
  process.env.CALENDLY_TOKEN = 'cal-test-not-real';
  const T0 = Z.zoneDateAt('2026-10-02', 12, 0);
  const evt = (n, startsInDays, name = 'Studio meeting') => ({ uri: `https://api.calendly.com/scheduled_events/EV${n}`, name, start_time: new Date(T0 + startsInDays * 864e5).toISOString(), end_time: new Date(T0 + startsInDays * 864e5 + 1800e3).toISOString() });
  const world = { active: [], canceled: [], invitees: {}, fail: 0, calls: 0 };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (!u.startsWith('https://api.calendly.com')) return { ok: false, status: 404, json: async () => ({}) };
    world.calls++;
    const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
    if (world.fail) return json({}, world.fail);
    if (u.endsWith('/users/me')) return json({ resource: { uri: 'https://api.calendly.com/users/ME' } });
    if (u.includes('/scheduled_events?')) return json({ collection: u.includes('status=canceled') ? world.canceled : world.active });
    const m = /scheduled_events\/(EV\d+)\/invitees/.exec(u);
    if (m) return json({ collection: [{ name: world.invitees[m[1]] || 'Someone', email: 'x@y.example' }] });
    return json({}, 404);
  };
  try {
    seed();
    world.active = [evt(1, 3)]; world.invitees.EV1 = 'Pat Old';
    await runReminders(db, T0);
    ok(_pushes.length === 0, 'the first poll records what is booked and says nothing');
    world.active = [evt(1, 3), evt(2, 4)]; world.invitees.EV2 = 'Dana Newman';
    const calls0 = world.calls;
    await runReminders(db, T0 + 10 * MIN);
    ok(world.calls === calls0 && _pushes.length === 0, 'inside the 15 minute gate Calendly is not asked');
    await runReminders(db, T0 + 15 * MIN);
    ok(titles().join('|') === 'Booked: Dana Newman' && _pushes[0].category === 'meetings' && /\/calendar$/.test(_pushes[0].url), `a new booking pushes by invitee name (${titles().join('|')})`);
    ok(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/.test(_pushes[0].body) && /PM|AM/.test(_pushes[0].body), `with the day and time in New York (${_pushes[0].body})`);
    await runReminders(db, T0 + 31 * MIN);
    ok(_pushes.length === 1, 'the same booking is never told twice');
    world.active = [evt(2, 4)]; world.canceled = [evt(1, 3)];
    await runReminders(db, T0 + 47 * MIN);
    ok(_pushes.length === 2 && _pushes[1].title === 'Canceled: Pat Old', `a cancellation of a booking we knew pushes once (${_pushes[1]?.title}), told as Pat Old`);
    await runReminders(db, T0 + 63 * MIN);
    ok(_pushes.length === 2, 'and not again');
    world.canceled = [evt(1, 3), evt(9, 5)];
    await runReminders(db, T0 + 79 * MIN);
    ok(_pushes.length === 2, 'a cancellation of something never announced says nothing');
    world.active = [evt(2, 4), evt(3, 6), evt(4, 7)]; world.invitees.EV3 = 'Lee Three'; world.invitees.EV4 = 'Kim Four';
    await runReminders(db, T0 + 95 * MIN);
    ok(_pushes.length === 3 && _pushes[2].title === '2 new bookings' && /Lee Three/.test(_pushes[2].body), `several arrive as one (${_pushes[2]?.title})`);
    world.fail = 401;
    world.active = [evt(2, 4), evt(3, 6), evt(4, 7), evt(5, 8)]; world.invitees.EV5 = 'Failed Fetch';
    await runReminders(db, T0 + 111 * MIN);
    const gate = _stores.settings.find(s => s._id === 'cronGates');
    ok(_pushes.length === 3 && gate.calendlyError === 'http-401' && Object.keys(gate.calendlySeen).length === 3, `a poll Calendly refuses pushes nothing, keeps what it knew and records the code (${gate.calendlyError})`);
    world.fail = 0; _state.result = NO_DEVICE;
    await runReminders(db, T0 + 127 * MIN);
    _state.result = DELIVERED;
    await runReminders(db, T0 + 143 * MIN);
    ok(_pushes.length === 4 && _pushes[3].title === 'Booked: Failed Fetch', `a poll where no device took it keeps the booking unannounced, the next poll tells Rob (${titles().join('|')})`);
    delete process.env.CALENDLY_TOKEN;
    const before = world.calls;
    await runReminders(db, T0 + 160 * MIN);
    ok(world.calls === before, 'without a token Calendly is never asked');
  } finally { globalThis.fetch = realFetch; delete process.env.CALENDLY_TOKEN; }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
