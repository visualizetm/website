/* The call console and the close (prompt 2 of 3): the pure half.
 *   1. The script module: a line is never blank, the lead's own objection line wins, the two default times and the task's due
 *      instant are New York wall clock (across the November change), say it back, the follow ups, the invite's blocks.
 *   2. The stepper's writes: a step's Next keeps every saved answer, an objection counts, the ask counter has two homes,
 *      a no answer carries its callback, a booking carries the answers.
 *   3. The catalog: every package's items resolve to a catalog id, every package has items, the quote's math (milestone 4).
 *   4. The server whitelist: afterCall.closer, deal.quote and the counts land; an unknown key does not.
 * Run: node scripts/close-test.mjs (CLOSE_SRC=<dir> reads the pure half from a copy of src) */
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
/* CLOSE_SRC points the pure half at a copy of src (close-guard-proof.mjs cuts a guard there and expects a failure). */
const srcRoot = process.env.CLOSE_SRC ? path.resolve(process.env.CLOSE_SRC) : path.join(repoRoot, 'src');
const src = (rel) => import(pathToFileURL(path.join(srcRoot, rel)).href);
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);

const cs = await src('shared/callScript.js');
const pricing = await src('shared/pricing.js');
const outcome = await src('lib/callOutcome.js');

section('1. The script module');
const bare = { _id: 'L1', business: 'Bare Shop' };
for (const k of ['confirm', 'intro', 'homework', 'question', 'goalQuestion', 'hook', 'ask', 'lockIt', 'ifNo', 'noAnswer', 'voicemail', 'nightBefore']) ok(cs.scriptLine(bare, k).length > 10, `scriptLine ${k} falls back to the v2 line`);
ok(cs.scriptLine({ script: { intro: 'My own intro' } }, 'intro') === 'My own intro', 'the lead\'s own script line wins');
ok(cs.scriptLine({ close: { noAnswer: 'My own voicemail' } }, 'noAnswer') === 'My own voicemail', 'the lead\'s own close line wins');
ok(cs.scriptLine({ script: { intro: '   ' } }, 'intro') === cs.V2.intro, 'a blank own line falls back');
ok(cs.OBJECTIONS.map(o => o.id).join(',') === 'money,time,fit,partner,stall,burned', 'the shared objections are Money, Time, Fit, Partner, Stall and Bad past experience');
ok(cs.OBJECTIONS.every(o => o.said && o.line && o.logic), 'every card has what they said, the line and the logic');
ok(cs.OBJECTIONS.find(o => o.id === 'money').line.startsWith('Is $500 a lot right now? Good'), 'the money line is section 4 word for word');
const own = { objections: [{ say: 'The price is too high for us', respond: 'Rob\'s own money line' }] };
ok(cs.objectionCard(own, 'money').line === 'Rob\'s own money line' && cs.objectionCard(own, 'money').own === true, 'the lead\'s own objection line comes first');
ok(cs.objectionCard(own, 'time').line === cs.OBJECTIONS[1].line && !cs.objectionCard(own, 'time').own, 'the shared line when the lead has none for it');
ok(cs.objectionCard(bare, 'nope') === null, 'an unknown id is null');
/* New York: 2026-11-03 10:00 NY (EST, 15:00Z) and 16:00 NY (21:00Z); the DST change was November 1 2026. */
const morning = Date.UTC(2026, 10, 3, 15, 0); const evening = Date.UTC(2026, 10, 3, 21, 0);
ok(cs.defaultSlots(morning).join(' ') === '2026-11-03T20:30:00.000Z 2026-11-04T15:00:00.000Z', 'before 3 PM: today 3:30 PM and tomorrow 10 AM New York');
ok(cs.defaultSlots(evening).join(' ') === '2026-11-04T15:00:00.000Z 2026-11-05T15:00:00.000Z', 'after 3 PM: tomorrow 10 and the day after 10');
const oct = Date.UTC(2026, 9, 30, 14, 0); // EDT, 10:00 NY
ok(cs.defaultSlots(oct)[0] === '2026-10-30T19:30:00.000Z', 'under daylight time 3:30 PM New York is 19:30Z');
ok(cs.slotsFor(null, morning).source === 'default' && cs.slotsFor(['2026-11-05T15:00:00.000Z'], morning).source === 'default', 'fewer than two Calendly slots means the defaults');
const live = cs.slotsFor(['2026-11-05T15:00:00.000Z', '2026-11-06T18:30:00.000Z', '2026-11-07T15:00:00.000Z'], morning);
ok(live.source === 'calendly' && live.slots.length === 2 && live.slots[1].label === 'Fri 1:30 PM', `two Calendly slots, labelled in New York (${live.slots[1].label})`);
ok(cs.slotsFor(null, morning).slots.map(s => s.label).join('|') === 'Today 3:30 PM|Tomorrow 10:00 AM', 'the default labels');
ok(cs.slotToMeeting('2026-11-04T15:00:00.000Z').date === '2026-11-04' && cs.slotToMeeting('2026-11-04T15:00:00.000Z').time === '10:00', 'a slot becomes the meeting fields in New York');
ok(cs.conceptTaskDue({ date: '2026-11-02' }) === '2026-11-02T01:00:00.000Z', 'Build the concept is due Nov 1 8 PM New York (EST after the change) for a Nov 2 meeting');
ok(cs.conceptTaskDue({ date: '2026-10-31' }) === '2026-10-31T00:00:00.000Z', 'and Oct 30 8 PM EDT for an Oct 31 meeting');
ok(cs.conceptTaskDue({ date: '' }) === '' && cs.conceptTaskDue(null) === '', 'no date, no due');
ok(cs.laterToday(morning) === '2026-11-03T17:00:00.000Z', 'later today is two hours on');
ok(cs.laterToday(evening) === '2026-11-04T15:00:00.000Z', 'past 6 PM New York it is tomorrow 10 AM');
ok(cs.sayItBack('The site is from 2014', 'to get more jobs') === "So what I'm hearing is the site is from 2014, and you want to get more jobs. That sound right?", 'say it back from their words');
ok(cs.sayItBack('').startsWith("So what I'm hearing is the work's good"), 'say it back with nothing said is the label line');
ok(cs.followUpText({ askFor: 'Dana' }, 1, 'the price').includes('Dana') && cs.followUpText(bare, 1, 'the price').includes('the price') && cs.followUpText(bare, 3).includes('partner') && cs.followUpText(bare, 7).includes('next open start'), 'the day 1, 3 and 7 texts');
ok(cs.FOLLOW_UP_DAYS.join(',') === '1,3,7', 'follow ups on day 1, 3 and 7');
const inv = cs.inviteOverride({ askFor: 'Dana', business: 'Dana Detailing' }, { date: '2026-11-04', time: '10:00' });
ok(inv.subject === 'Good talking to you, Dana' && inv.blocks.every(b => ['eyebrow', 'heading', 'text', 'button'].includes(b.type)) && inv.blocks[2].text.includes('10:00 AM'), 'the invite override: subject, block types the renderer knows, the time');
ok(cs.nightBeforeText(bare, { time: '10:00' }).includes('tomorrow at 10:00 AM'), 'the night before text names the time');
ok(cs.beliefsDone({ closer: true, trust: true, works: true }) && !cs.beliefsDone({ closer: true, trust: true }), 'three beliefs, all three');
ok(cs.PILLARS.map(p => p.id).join(',') === 'look,trust,leads' && cs.PILLARS.every(p => p.story.length > 60), 'three pillars with a story each');
ok(cs.CLOSER_LINES.label === "Got it. The work's good but the brand doesn't match it. That sound right?", 'the label line is section 4 word for word');

section('2. The stepper\'s writes');
const lead = { _id: 'L2', business: 'Two', phone: '3025550100', askFor: 'Dana', afterCall: { answered: 'owner', homework: 'landed', whatTheySaid: 'Site is old', asks: 1 }, callLog: [], nextAction: { kind: 'x', auto: false, label: 'Manual' } };
ok(cs.startStepFor(lead) === 1 && cs.startStepFor({ phone: '' }) === 2, 'a lead with no phone starts at step 2');
ok(cs.CALL_STEPS.length === 8 && cs.CALL_STEPS[0].id === 'answer' && cs.CALL_STEPS[7].id === 'lock', 'eight steps, Did they answer to Lock it in');
const s4 = cs.stepSet(lead, { goal: 'More jobs' }, 5);
ok(s4.afterCall.answered === 'owner' && s4.afterCall.whatTheySaid === 'Site is old' && s4.afterCall.goal === 'More jobs' && s4.afterCall.step === 5 && !('askFor' in s4) && !('nextAction' in s4), 'a step\'s Next keeps every saved answer, writes the step, touches nothing else');
ok(cs.stepSet(lead, { askFor: 'Dana R' }, 2).askFor === 'Dana R' && !('askFor' in cs.stepSet(lead, { askFor: 'Dana R' }, 2).afterCall), 'askFor is the lead\'s own field, not under afterCall');
const o1 = cs.objectionPatch(lead, 'money'); const o2 = cs.objectionPatch({ ...lead, ...o1 }, 'money'); const o3 = cs.objectionPatch({ ...lead, ...o2 }, 'time');
ok(o1.afterCall.objection === 'money' && o1.afterCall.objections.money === 1 && o2.afterCall.objections.money === 2 && o3.afterCall.objections.money === 2 && o3.afterCall.objections.time === 1 && o3.afterCall.objection === 'time', 'an objection logs with a count, the latest named');
ok(o1.afterCall.asks === 1 && o1.afterCall.whatTheySaid === 'Site is old', 'logging an objection keeps the rest of afterCall');
ok(cs.askPatch(lead).afterCall.asks === 2 && cs.askPatch({ afterCall: {} }).afterCall.asks === 1, 'Handled, ask again bumps afterCall.asks');
ok(cs.askPatch({ afterCall: { closer: { asks: 2 } } }, 'closer').afterCall.closer.asks === 3 && cs.askPatch(lead, 'closer').afterCall.closer.asks === 1 && cs.askPatch(lead, 'closer').afterCall.asks === 1, 'and afterCall.closer.asks on the concept call, the other counter untouched');
const na = outcome.callOutcomeSet(lead, 'no-answer', { note: 'vm', callbackAt: '2026-11-03T17:00:00.000Z' }, morning);
ok(na.set.callStatus === 'no-answer' && na.set.callbackAt === '2026-11-03T17:00:00.000Z' && na.set.callLog.length === 1 && na.set.callLog[0].outcome === 'no-answer', 'a no answer from the stepper carries its callback for later today');
ok(!('callbackAt' in outcome.callOutcomeSet(lead, 'no-answer', { note: 'vm' }, morning).set), 'a plain no answer still sets no callback');
const merged = { ...lead, ...cs.stepSet(lead, { goal: 'More jobs', partner: 'no', cell: '3025550100' }, 8) };
const bk = outcome.callOutcomeSet(merged, 'booked', { email: 'd@example.com', meeting: { date: '2026-11-04', time: '10:00', type: 'call' } }, morning);
ok(bk.set.callStatus === 'booked' && bk.set.stage === 'booked' && bk.set.meeting.date === '2026-11-04' && bk.set.afterCall.goal === 'More jobs' && bk.set.afterCall.partner === 'no' && bk.set.afterCall.email === 'd@example.com' && bk.set.afterCall.meeting === '2026-11-04 10:00', 'a booking from the stepper is the record\'s booking write and carries the answers');
ok(!('nextAction' in bk.set) && !('nextAction' in na.set), 'neither outcome write touches the next action itself (the shell\'s helper recomputes and keeps a manual one)');

section('3. The catalog');
ok(Array.isArray(pricing.CATALOG) && pricing.CATALOG.length >= 20, `the a la carte catalog has ${pricing.CATALOG.length} items`);
ok(pricing.CATALOG.every(c => /^[a-z-]+$/.test(c.id) && typeof c.price === 'number' && c.label), 'every catalog item has an id, a label and a number price');
ok(new Set(pricing.CATALOG.map(c => c.id)).size === pricing.CATALOG.length, 'catalog ids are unique');
for (const [pid, ids] of Object.entries(pricing.PACKAGE_ITEMS)) { ok(pricing.packageOf(pid), `PACKAGE_ITEMS ${pid} is a package`); ok(ids.every(id => pricing.catalogOf(id)), `every item of ${pid} resolves to a catalog id`); }
ok(pricing.PACKAGES.every(p => (pricing.PACKAGE_ITEMS[p.id] || []).length > 0), 'every package has items');
for (const id of ['logo', 'logo-alt', 'card-design', 'facebook-banner', 'instagram-kit', 'stickers', 'google-business', 'one-page-site', 'vinyl', 'nfc-card']) ok(pricing.catalogOf(id), `the print and a la carte item ${id} is in the catalog`);

section('4. The server whitelist');
const { default: fs } = await import('fs');
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'close-')); const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
process.env.SESSION_SECRET = 'test-secret-not-real'; delete process.env.VERCEL;
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const callLeads = (await load('_routes/call-leads.js')).handler;
const { signSession, COOKIE } = await load('_lib/auth.js');
const cookie = `${COOKIE}=${signSession()}`;
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { this.headersSent = true; return this; } });
async function call(method, { query = {}, body } = {}) {
  const res = fakeRes();
  try { await callLeads({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.9', cookie }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  return { status: res._status, data: res._json };
}
_reset();
const id = '507f1f77bcf86cd799439077';
_stores.call_leads = [{ _id: id, business: 'Whitelist', stage: 'lead', callStatus: 'not-called', afterCall: { whatTheySaid: 'old' } }];
_stores.lists = []; _stores.projects = []; _stores.settings = []; _stores.concept_sets = [];
const store = _stores.call_leads;
const r1 = await call('PATCH', { body: { id: String(id), set: { afterCall: { whatTheySaid: 'old', answered: 'owner', homework: 'flat', goal: 'More', partner: 'yes', objection: 'money', objections: { money: 2, time: 1, 'BAD KEY': 9 }, asks: 3, step: 6, cell: '3025550100', closer: { why: 'Saw the concepts', label: 'yes', pain: [{ tried: 'Fiverr', howLong: 'a month', result: 'Nothing' }], pillars: { look: '2026-11-03T15:00:00.000Z' }, beliefs: { closer: true, trust: false, works: true }, asks: 2, gap: { now: 'here', want: 'there', missing: 'a site' }, step: 4 }, evil: 'x' } } } });
const doc = store.find(d => String(d._id) === String(id));
ok(r1.status === 200, `PATCH afterCall answers 200 (${r1.status} ${JSON.stringify(r1.data).slice(0, 80)})`);
ok(doc.afterCall.answered === 'owner' && doc.afterCall.homework === 'flat' && doc.afterCall.partner === 'yes' && doc.afterCall.objection === 'money' && doc.afterCall.asks === 3 && doc.afterCall.step === 6 && doc.afterCall.cell === '3025550100', 'the cold call answers land');
ok(doc.afterCall.objections.money === 2 && doc.afterCall.objections.time === 1 && !('BAD KEY' in doc.afterCall.objections), 'the objection counts land, a bad key does not');
ok(doc.afterCall.closer.why === 'Saw the concepts' && doc.afterCall.closer.pain.length === 1 && doc.afterCall.closer.pain[0].tried === 'Fiverr' && doc.afterCall.closer.beliefs.closer === true && doc.afterCall.closer.beliefs.trust === false && doc.afterCall.closer.asks === 2 && doc.afterCall.closer.gap.missing === 'a site' && doc.afterCall.closer.pillars.look.startsWith('2026-11-03'), 'the concept call answers land under afterCall.closer');
ok(!('evil' in doc.afterCall), 'an unknown afterCall key is dropped');
const r2 = await call('PATCH', { body: { id: String(id), set: { deal: { quote: { lines: [{ id: 'logo', label: 'Logo', price: 250, listPrice: 250, free: false }, { id: 'card-design', label: 'Cards', price: 0, listPrice: 30, free: true }], packageId: 'brand-starter', retainerPitch: false, givenFree: 30, total: 250, deposit: 125, at: '2026-11-03T15:00:00.000Z', evil: 1 } } } } });
const d2 = store.find(d => String(d._id) === String(id));
ok(r2.status === 200 && d2.deal?.quote?.lines?.length === 2 && d2.deal.quote.lines[1].free === true && d2.deal.quote.packageId === 'brand-starter' && d2.deal.quote.retainerPitch === false && d2.deal.quote.givenFree === 30 && d2.deal.quote.deposit === 125 && !('evil' in d2.deal.quote), 'deal.quote lands with its lines, the package, the pitch flag and the totals; an unknown key does not');

section('5. The quote (src/lib/quote.js)');
const q = await src('lib/quote.js');
let ls = q.addLine([], 'brand-starter'); ls = q.addLine(ls, 'card-design'); ls = q.addLine(ls, 'card-design');
ok(ls.length === 2 && ls[0].kind === 'package' && ls[1].kind === 'item' && ls[1].listPrice === 30, 'lines come from pricing.js at their list price; a repeat is not added twice');
ok(q.addLine(ls, 'not-a-thing').length === 2 && q.lineFor('not-a-thing') === null, 'an id pricing.js does not know makes no line');
const free = q.toggleFree(ls, 'card-design');
ok(free[1].free === true && free[1].price === 0 && q.toggleFree(free, 'card-design')[1].price === 30, 'Free zeroes the price and back restores the list price');
ok(q.setPrice(ls, 'brand-starter', 300)[0].price === 300 && q.setPrice(ls, 'brand-starter', -5)[0].price === 0, 'a price edits, never below zero');
const t = q.quoteTotals(free);
ok(t.total === 350 && t.givenFree === 30 && t.deposit === 175 && t.plan === null, `totals: 350, 30 given free, deposit 175 (${JSON.stringify(t)})`);
ok(q.quoteTotals(q.setPrice(ls, 'brand-starter', 300)).givenFree === 50, 'a price cut counts as given free too');
ok(q.quoteTotals([q.lineFor('launch-plan')]).plan?.months === 6 && q.quoteTotals([q.lineFor('launch-plan')]).plan?.monthly === 200, 'a plan package carries its plan');
ok(q.validQuote(ls) && !q.validQuote([]) && !q.validQuote([{ id: 'logo', label: 'Logo', price: 250, listPrice: 999, free: false }]) && !q.validQuote([{ id: 'nope', label: 'x', price: 1, listPrice: 1, free: false }]) && !q.validQuote([{ id: 'logo', label: 'Logo', price: 250, listPrice: 250, free: true }]), 'the guard: a line off the price list, a list price that is not pricing.js\'s, a free line with a price, or no lines, is refused');
ok(q.suggestPackageFor([q.lineFor('logo'), q.lineFor('palette-type'), q.lineFor('brand-sheet')])?.id === 'brand-starter' && q.suggestPackageFor([q.lineFor('logo')]) === null, 'the package the lines add up to');
ok(q.suggestPackage({ pricingOptions: [{ packageId: 'web-complete', recommended: true }] }, {}) === 'web-complete' && q.suggestPackage({}, { missing: 'a site that works on a phone and a logo' }) === 'launch-plan' && q.suggestPackage({}, { missing: 'a logo' }) === 'brand-starter' && q.suggestPackage({}, {}) === 'web-essentials', 'the suggested package: the recommended option, else the words in the gap');
ok(q.ladderFor('web-essentials').map(r => r.id).join(',') === 'build-plan,launch-plan,web-essentials,social-refresh,review', 'the ladder, highest first, the fit package, Social Refresh, then the brand review');
ok(q.ladderFor('launch-plan').map(r => r.id).join(',') === 'build-plan,launch-plan,social-refresh,review' && q.ladderFor('launch-plan')[1].line === 'Launch Plan is $1,200. Most people do $200 a month for $6 months.'.replace('$6', '6'), 'a plan rung says the monthly line from pricing.js');
ok(q.gapSentence({ now: 'a Wix site', want: 'more calls', missing: 'A site that works on a phone' }, 'web-essentials').endsWith("That's Web Essentials, $500."), 'the gap sentence ends on the package and its price');
ok(q.startSlotLine('') === 'I take two builds a month.' && /next open start is the 10th/.test(q.startSlotLine('2026-11-10')) && /the 1st of December/.test(q.startSlotLine('2026-12-01')) === (new Date().getUTCMonth() !== 11), 'the start slot line reads the Settings day');
const quote = q.quoteFromLines(free, { retainerPitch: true });
ok(quote.lines.length === 2 && quote.packageId === 'brand-starter' && quote.total === 350 && quote.deposit === 175 && quote.givenFree === 30 && quote.retainerPitch === true && quote.at, 'the saved quote');
const dep = q.depositInvoice(quote);
ok(dep.amount === 175 && dep.kind === 'deposit' && dep.items.length === 2 && dep.items[1].amount === 'Included' && dep.status === 'draft', 'the deposit invoice line: 50 percent, the lines as items, a draft (the Stripe link comes on send)');
const ov = q.quoteOverride({ askFor: 'Dana', business: 'Dana Detailing' }, quote, { nextOpenStart: '2026-11-10' });
ok(ov.subject.includes('Dana') && ov.blocks.every(b => ['eyebrow', 'heading', 'text'].includes(b.type)) && ov.blocks.some(b => /Total \$350/.test(b.text)) && ov.blocks.some(b => /next open start is the 10th/.test(b.text)) && ov.blocks.some(b => /keep me on/.test(b.text)), 'the quote email: the total, the deposit, the start slot, the retainer pitch');
ok(!q.quoteOverride({}, { ...quote, retainerPitch: false }).blocks.some(b => /keep me on/.test(b.text)), 'no retainer line when the pitch is off');
ok(!/discount/i.test(JSON.stringify(ov)) && !/prepay/i.test(JSON.stringify(q.ladderFor('build-plan'))), 'never a prepay discount');

section('6. The concept call\'s writes');
const bl = { _id: 'L6', afterCall: { goal: 'More jobs', closer: { why: 'Saw the concepts', step: 2 } } };
const c1 = cs.closerSet(bl, { label: 'yes' }, 3, morning);
ok(c1.afterCall.goal === 'More jobs' && c1.afterCall.closer.why === 'Saw the concepts' && c1.afterCall.closer.label === 'yes' && c1.afterCall.closer.step === 3 && c1.afterCall.closer.at === '2026-11-03T15:00:00.000Z', 'a closer step keeps the rest of afterCall and closer, writes the step and the time');
const p1 = cs.pillarPatch(bl, 'look', morning); const p2 = cs.pillarPatch({ ...bl, ...p1 }, 'trust', morning + 60e3);
ok(p1.afterCall.closer.pillars.look === '2026-11-03T15:00:00.000Z' && p2.afterCall.closer.pillars.look && p2.afterCall.closer.pillars.trust, 'pillars stamp in order and keep the earlier stamps');
ok(cs.pitchElapsed(p2.afterCall.closer, morning + 90e3) === 90e3 && cs.pitchElapsed({}, morning) === null, 'the pitch clock runs from the first pillar');
ok(cs.askUnlocked({ beliefs: { closer: true, trust: true, works: true } }) === true && cs.askUnlocked({ beliefs: { closer: true, trust: true } }) === false && cs.askUnlocked({}) === false, 'the ask unlocks on three beliefs, never two');
ok(cs.painFilled([{ tried: 'Fiverr', howLong: 'a month', result: '' }, { tried: 'Cousin', howLong: '', result: 'Never finished' }, { tried: 'x', howLong: '', result: '' }]) === 2, 'a pain row counts with what was tried and one more answer');
ok(cs.CLOSER_STEPS.map(s => s.id).join(',') === 'clarify,label,pain,pillars,beliefs,ask', 'six steps, Clarify to The ask');
ok(cs.CLOSER_LINES.pain.join(' ') === "Have you tried fixing this before? Who did it? How'd that go? What else?" && cs.CLOSER_LINES.notOnYou.startsWith("Honestly that's not on you."), 'the pain cycle lines are section 4 word for word');

section('7. Settings: the next open start');
const settings = (await load('_routes/settings.js')).handler;
async function callSettings(method, body) {
  const res = fakeRes();
  try { await settings({ method, query: {}, body, headers: { 'x-forwarded-for': '203.0.113.9', cookie }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  return { status: res._status, data: res._json };
}
const s1 = await callSettings('PATCH', { set: { profile: { nextOpenStart: '2026-11-10' } } });
const s2 = await callSettings('GET');
ok(s1.status === 200 && s2.data?.profile?.nextOpenStart === '2026-11-10', `the profile keeps the next open start (${s1.status}, ${s2.data?.profile?.nextOpenStart})`);
const s3 = await callSettings('PATCH', { set: { profile: { nextOpenStart: 'soon' } } });
ok(s3.status === 200 && (await callSettings('GET')).data?.profile?.nextOpenStart === '', 'anything but a day clears it');

section('8. The session (src/lib/callSession.js) and the bulk edit');
const cs2 = await src('lib/callSession.js');
const pf = cs2.prepFacts({ reviews: { latest: { count: 212, rating: 4.9 } }, socials: { instagram: 'https://instagram.com/shop', website: 'https://shop.example' }, intel: { gaps: ['Website is a dead link'], dropLines: ['Saw the new bay'] }, bestWindow: 'After 5pm' });
ok(pf.rating === '4.9 on 212 reviews' && pf.website === 'Site: Website is a dead link' && pf.drop === 'Saw the new bay' && pf.window === 'After 5pm' && pf.instagram.includes('instagram'), 'the prep facts: the rating and count, the site from the gaps, the window, one drop line');
ok(cs2.prepFacts({ intel: { accomplishments: ['4.8 stars on 40 reviews'] } }).rating === '4.8 stars on 40 reviews' && cs2.prepFacts({}).website === 'No site', 'the rating falls back to the intel line; no site reads No site');
const sess = { ids: ['a', 'b', 'c', 'd'], stats: { calls: 4, noAnswer: 1, wrongNumber: 1, callbacks: 1 }, logged: { a: 'booked', b: 'callback', c: 'no-answer' }, startedAt: morning };
const by = new Map([['a', { _id: 'a', business: 'A', afterCall: { partner: 'yes' } }], ['b', { _id: 'b', business: 'B', afterCall: { asks: 1, objection: 'money' } }], ['c', { _id: 'c' }], ['d', { _id: 'd', afterCall: { asks: 2 } }]]);
const sm = cs2.sessionSummary(sess, by);
ok(sm.dialed === 4 && sm.answered === 2 && sm.asked === 3 && sm.booked === 1 && sm.askRate === 33 && sm.bookedRows[0].business === 'A', `dialed, answered, asked, booked and the ask rate (${JSON.stringify({ ...sm, bookedRows: sm.bookedRows.length })})`);
ok(cs2.askRateLine(sm, { askRate: 50 }).startsWith('Ask rate 33% (1 of 3 asked), down 17 points from last session') && cs2.askRateLine(sm, null).includes('First session') && cs2.askRateLine({ asked: 0 }, null).startsWith('No asks yet'), 'the ask rate line against the last session');
ok(cs2.noDecisionIds(sess).join(',') === 'b', 'a callback logged is a no decision; a booking, a no answer and nothing logged are not');
ok(cs2.concernOf(by.get('b')) === "That's a lot right now" && cs2.concernOf({ afterCall: { whatTheySaid: 'Site is old' } }) === 'Site is old', 'the saved concern: the objection they raised, else their words');
const fu = cs2.followUpDrafts(by.get('b'));
ok(fu.length === 3 && fu.map(d => d.day).join(',') === '1,3,7' && fu[0].body.includes("that's a lot right now") && fu[0].subject === 'Follow up, day 1', 'the day 1, 3 and 7 follow up texts carry the concern');
_stores.call_leads.push({ _id: '507f1f77bcf86cd799439078', business: 'Bulk A', stage: 'lead', callStatus: 'not-called', priority: 'warm' }, { _id: '507f1f77bcf86cd799439079', business: 'Bulk B', stage: 'lead', callStatus: 'not-called', priority: 'warm', nextAction: { kind: 'manual', auto: false, label: 'Keep' } }, { _id: '507f1f77bcf86cd79943907a', business: 'Bulk C', stage: 'client', callStatus: 'not-called', priority: 'warm' });
const bulk = await call('PATCH', { body: { ids: ['507f1f77bcf86cd799439078', '507f1f77bcf86cd799439079', '507f1f77bcf86cd79943907a', 'nope'], set: { priority: 'hot', evil: 1 } } });
const bA = store.find(d => String(d._id) === '507f1f77bcf86cd799439078'); const bB = store.find(d => String(d._id) === '507f1f77bcf86cd799439079'); const bC = store.find(d => String(d._id) === '507f1f77bcf86cd79943907a');
ok(bulk.status === 200 && bulk.data.updated === 3 && bA.priority === 'hot' && bB.priority === 'hot' && bC.priority === 'hot' && !('evil' in bA), `one PATCH with an id array updates every lead through the whitelist (${bulk.status}, ${bulk.data?.updated})`);
ok(bulk.data.ids.length === 3 && !bulk.data.ids.includes('nope'), 'a bad id is dropped, the answer names the ids written');
const bulk2 = await call('PATCH', { body: { ids: ['507f1f77bcf86cd799439078', '507f1f77bcf86cd799439079'], set: { callStatus: 'callback', callbackAt: new Date(morning + 864e5).toISOString() } } });
const bB2 = store.find(d => String(d._id) === '507f1f77bcf86cd799439079'); const bA2 = store.find(d => String(d._id) === '507f1f77bcf86cd799439078');
ok(bulk2.status === 200 && bA2.callStatus === 'callback' && bA2.nextAction?.kind === 'callback', `a bulk call status change recomputes the next action per lead (${JSON.stringify(bA2.nextAction)})`);
ok(bB2.nextAction?.auto === false && bB2.nextAction?.label === 'Keep', 'and keeps a manual next action');
const bulk3 = await call('PATCH', { body: { ids: ['507f1f77bcf86cd79943907a'], set: { stage: 'lead' } } });
ok(bulk3.status === 400 && store.find(d => String(d._id) === '507f1f77bcf86cd79943907a').stage === 'client', 'a stage never rides on a bulk edit (the pipeline guard is per record)');
ok((await call('PATCH', { body: { ids: [], set: { priority: 'hot' } } })).status === 400 && (await call('PATCH', { body: { ids: ['507f1f77bcf86cd799439078'], set: { evil: 1 } } })).status === 400, 'no ids or nothing the whitelist knows is a 400');

section('9. Nothing in the console or the close sends');
{
  const files = ['components/calls/CallStepper.jsx', 'components/calls/CloserStepper.jsx', 'components/calls/ObjectionSheet.jsx', 'components/calls/PricePresenter.jsx', 'components/calls/CallSheet.jsx', 'pages/AdminQuote.jsx', 'pages/AdminCalls.jsx', 'lib/quote.js', 'lib/callSession.js', 'shared/callScript.js'];
  for (const f of files) {
    const text = fs.readFileSync(path.join(srcRoot, f), 'utf8');
    ok(!/send:\s*true/.test(text) && !/approvedAt/.test(text) && !/approvedBy/.test(text) && !/email\/approve/.test(text), `${f} never posts a send or a stamp (the Drafts rule: only the send sheet's Send now does)`);
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nclose-test: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
