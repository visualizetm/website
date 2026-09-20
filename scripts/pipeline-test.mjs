#!/usr/bin/env node
/* The pipeline guard (stage regression fix) and the lead shape guard (lead
 * crash fix), against the real handlers and the real helpers.
 *
 *   - normalizeStage is the one decider and reads the stage field
 *   - a client's stage survives a status change, a spreadsheet re-import, a
 *     bulk re-import, and a PATCH that carries a lower stage without an
 *     explicit flag (409, record untouched); an explicit action moves it
 *   - the daily cron puts a client's stage back after a background job
 *     wiped it (clientSince, a won outcome, a published showcase, a project,
 *     a purchase, a planner, a testimonial), leaves a genuine lead alone,
 *     names each heal for the drawer, and stamps clientSince on every client
 *   - every path to client stamps clientSince
 *   - normalizeLead turns every shape that crashed a screen into the shape
 *     the screen expects, and leaves a well formed record identical
 *
 *   node scripts/pipeline-test.mjs
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'pipeline-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
process.env.SESSION_SECRET = 'test-secret-not-real';
process.env.CRON_SECRET = 'cron-test-secret';
delete process.env.VERCEL;

const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const callLeads = (await load('_routes/call-leads.js')).handler;
const leadsImport = (await load('_routes/leads-import.js')).handler;
const cronDaily = (await load('_routes/cron-daily.js')).handler;
const { normalizeStage } = await import(pathToFileURL(path.join(repoRoot, 'src', 'shared', 'semantics.js')).href);
const { normalizeLead } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'leadShape.js')).href);

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; } });
async function call(fn, method, { query = {}, body, headers = {} } = {}) {
  const res = fakeRes();
  try { await fn({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  return res;
}
const CLIENT = '507f1f77bcf86cd799439031', WON = '507f1f77bcf86cd799439032', LEAD = '507f1f77bcf86cd799439033';
function seed() {
  _reset();
  _stores.call_leads = [
    { _id: CLIENT, business: 'Abyssinia Bar and Restaurant', phone: '302-555-0100', stage: 'client', callStatus: 'not-called', priority: 'warm', clientSince: '2026-05-01T00:00:00Z', sourceId: 'row-1', socials: {}, callLog: [] },
    { _id: WON, business: 'Nibble and Nabble', phone: '302-555-0200', stage: 'won', callStatus: 'not-called', priority: 'hot', bookedOutcome: { result: 'won', at: '2026-04-01T00:00:00Z' }, socials: {}, callLog: [] },
    { _id: LEAD, business: 'Fresh Lead Co', phone: '302-555-0300', stage: 'lead', callStatus: 'not-called', priority: 'warm', socials: {}, callLog: [] },
  ];
  _stores.projects = []; _stores.settings = []; _stores.stripe_events = [];
}
const lead = (id) => _stores.call_leads.find(l => String(l._id) === id);

section('1. normalizeStage reads the stage field and nothing else');
ok(normalizeStage({ stage: 'client', callStatus: 'not-called' }) === 'client', 'client with callStatus not-called is a client');
ok(normalizeStage({ stage: 'won', callStatus: 'no' }) === 'won', 'won with callStatus no is won');
ok(normalizeStage({ stage: 'client', callLog: [] }) === 'client', 'a client with no call history is a client');
ok(normalizeStage({ stage: 'booked', callStatus: 'not-called' }) === 'booked', 'booked is booked whatever the call status');
ok(normalizeStage({ callStatus: 'booked' }) === 'booked', 'a legacy record with no stage and a booked call reads as booked');
ok(normalizeStage({ stage: '', callStatus: 'not-called' }) === 'lead', 'an empty stage reads as lead (which is why the cron below exists)');

section('2. a client stays a client through everything but an explicit action');
{
  seed();
  let r = await call(callLeads, 'PATCH', { body: { id: CLIENT, set: { callStatus: 'no-answer', callLog: [{ at: '2026-09-01T00:00:00Z', outcome: 'no-answer' }] } } });
  ok(r._status === 200 && lead(CLIENT).stage === 'client' && lead(CLIENT).callStatus === 'no-answer', `a status change on a client keeps stage client (${r._status}, ${lead(CLIENT).stage})`);
  r = await call(callLeads, 'PATCH', { body: { id: CLIENT, set: { stage: 'lead' } } });
  ok(r._status === 409 && lead(CLIENT).stage === 'client', `stage lead on a client without the explicit flag is 409 and untouched (${r._status}, ${lead(CLIENT).stage})`);
  r = await call(callLeads, 'PATCH', { body: { id: CLIENT, set: { stage: 'booked', notes: 'x' } } });
  ok(r._status === 409 && lead(CLIENT).stage === 'client' && !lead(CLIENT).notes, `a mixed write carrying a lower stage is refused whole (${r._status})`);
  r = await call(callLeads, 'PATCH', { body: { id: WON, set: { stage: 'lead' } } });
  ok(r._status === 409 && lead(WON).stage === 'won', `won is guarded the same way (${r._status})`);
  r = await call(callLeads, 'PATCH', { body: { id: WON, set: { stage: 'client', clientSince: '2026-09-01T00:00:00Z' } } });
  ok(r._status === 200 && lead(WON).stage === 'client', `won to client is a promotion and passes (${r._status})`);
  r = await call(callLeads, 'PATCH', { body: { id: CLIENT, set: { stage: 'lost', bookedOutcome: { result: 'lost', reason: 'moved away', at: '2026-09-01T00:00:00Z' } }, explicit: true } });
  ok(r._status === 200 && lead(CLIENT).stage === 'lost', `an explicit action can move a client to lost (${r._status}, ${lead(CLIENT).stage})`);
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { stage: 'booked' } } });
  ok(r._status === 200 && lead(LEAD).stage === 'booked', 'a lead still moves forward freely');
  r = await call(callLeads, 'PATCH', { body: { id: CLIENT, set: { stage: '' } } });
  ok(r._status === 400 && lead(CLIENT).stage === 'lost', `an empty stage is not a stage the API will write (${r._status})`);
}

section('3. a spreadsheet re-import never touches a client');
{
  seed();
  const r = await call(leadsImport, 'POST', { body: { rows: [
    { id: 'row-1', business: 'Abyssinia Bar and Restaurant', phone: '302-555-0100', status: 'not_called', priority: 'cold', notes: 'from the sheet' },
    { business: 'Fresh Lead Co', phone: '302-555-0300', status: 'callback', priority: 'hot' },
    { business: 'Brand New Place', phone: '302-555-0400', status: 'new', priority: 'warm' },
  ] } });
  ok(r._status === 200 && r._json.updated === 2 && r._json.created === 1, `the import updates two and creates one (${JSON.stringify(r._json)})`);
  ok(lead(CLIENT).stage === 'client' && lead(CLIENT).callStatus === 'not-called' && lead(CLIENT).priority === 'warm' && lead(CLIENT).notes === 'from the sheet', `the client keeps stage, callStatus and priority, takes the notes (${lead(CLIENT).stage}, ${lead(CLIENT).callStatus}, ${lead(CLIENT).priority})`);
  ok(lead(LEAD).stage === 'lead' && lead(LEAD).callStatus === 'callback' && lead(LEAD).priority === 'hot', 'a lead row still updates status and priority');
  const fresh = _stores.call_leads.find(l => l.business === 'Brand New Place');
  ok(fresh && !('stage' in fresh) && normalizeStage(fresh) === 'lead', 'a new row is a lead');
}

section('4. a bulk re-import through call-leads POST skips what exists');
{
  seed();
  const r = await call(callLeads, 'POST', { body: { leads: [{ business: 'Abyssinia Bar and Restaurant', callStatus: 'not-called', stage: 'lead', socials: { website: 'abyssinia.example' } }, { business: 'Another New One' }] } });
  ok(r._status === 200 && r._json.inserted === 1, `one inserted, the existing business skipped (${JSON.stringify(r._json)})`);
  ok(lead(CLIENT).stage === 'client' && lead(CLIENT).socials?.website === 'https://abyssinia.example', 'the client keeps its stage and only gains the missing socials');
}

section('5. the daily cron puts a wiped client stage back');
{
  seed();
  lead(CLIENT).stage = '';                      // what the enricher leaves behind
  lead(WON).stage = '';
  _stores.call_leads.push({ _id: '507f1f77bcf86cd799439034', business: 'Wiped Lead', stage: '', callStatus: 'no-answer', socials: {}, callLog: [] });
  _stores.call_leads.push({ _id: '507f1f77bcf86cd799439035', business: 'Deleted Client', stage: '', clientSince: '2026-01-01T00:00:00Z', deleted: true, socials: {}, callLog: [] });
  const denied = await call(cronDaily, 'GET', {});
  ok(denied._status === 401, `the cron refuses a call without the secret (${denied._status})`);
  const r = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(r._status === 200, `the cron runs (${r._status} ${JSON.stringify(r._json).slice(0, 120)})`);
  ok(lead(CLIENT).stage === 'client', `a client with clientSince and a wiped stage is a client again (${JSON.stringify(lead(CLIENT).stage)})`);
  ok(lead(WON).stage === 'client', `a won outcome with a wiped stage is a client again (${JSON.stringify(lead(WON).stage)})`);
  ok(_stores.call_leads.find(l => l.business === 'Wiped Lead').stage === '', 'a wiped lead with no client marker is left alone');
  ok(_stores.call_leads.find(l => l.business === 'Deleted Client').stage === '', 'a deleted record is left alone');
  const health = _stores.settings.find(s => s._id === 'health');
  ok(health?.crons?.daily?.healed === 2, `the health document counts the two heals (${health?.crons?.daily?.healed})`);
  ok(lead(LEAD).stage === 'lead', 'a real lead is untouched');
}

section('5b. the broadened heal: a client with none of the old markers, wiped, is still a client');
{
  const P1 = '507f1f77bcf86cd799439041', P2 = '507f1f77bcf86cd799439042', P3 = '507f1f77bcf86cd799439043', P4 = '507f1f77bcf86cd799439044', P5 = '507f1f77bcf86cd799439045', L2 = '507f1f77bcf86cd799439046';
  seed();
  const bare = (id, business, extra) => ({ _id: id, business, stage: '', callStatus: 'not-called', priority: 'warm', socials: {}, callLog: [], updatedAt: new Date('2026-06-01T00:00:00Z'), ...extra });
  _stores.call_leads.push(
    bare(P1, 'Project Only Client', {}),
    bare(P2, 'Purchase Only Client', { purchases: [{ label: 'Website', amount: 900, at: '2026-03-03T00:00:00Z' }] }),
    bare(P3, 'Showcase Only Client', { showcase: { published: true, slug: 'showcase-only' } }),
    bare(P4, 'Planner Only Client', { planner: { enabled: true, postsPerMonth: 8, token: 't' } }),
    bare(P5, 'Testimonial Only Client', { reviews: { asks: [], testimonials: [{ quote: 'Great work', name: 'A' }] } }),
    bare(L2, 'Genuine Lead', { showcase: { published: false }, purchases: [], planner: { enabled: false }, reviews: { testimonials: [] }, intel: { accomplishments: ['x'] }, notes: 'called twice' }),
  );
  _stores.projects.push({ _id: '507f1f77bcf86cd799439051', leadId: P1, name: 'Logo', stage: 'delivered', createdAt: new Date('2026-04-04T00:00:00Z') });
  const r = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(r._status === 200, `the cron runs (${r._status})`);
  for (const [id, name] of [[P1, 'a project'], [P2, 'a purchase'], [P3, 'a published showcase'], [P4, 'a planner'], [P5, 'a testimonial']]) {
    ok(lead(id).stage === 'client', `a wiped client with only ${name} is a client again (${JSON.stringify(lead(id).stage)})`);
  }
  ok(lead(L2).stage === '', `a genuine lead with none of those is not healed into a client (${JSON.stringify(lead(L2).stage)})`);
  ok(lead(P1).clientSince === '2026-04-04T00:00:00.000Z', `the healed project-only client is stamped from its first project (${lead(P1).clientSince})`);
  ok(lead(P2).clientSince === '2026-03-03T00:00:00.000Z', `the healed purchase-only client is stamped from its first purchase (${lead(P2).clientSince})`);
  ok(lead(P3).clientSince === '2026-06-01T00:00:00.000Z', `a healed client with neither is stamped from updatedAt (${lead(P3).clientSince})`);
  ok(lead(P1).stageHeals?.count === 1 && lead(P1).stageHeals.lastRules.join() === 'project', `the heal is counted on the record with its rule (${JSON.stringify(lead(P1).stageHeals)})`);
  const health = _stores.settings.find(s => s._id === 'health');
  ok(health?.crons?.daily?.healed === 5, `the health document counts every heal (${health?.crons?.daily?.healed})`);
  ok((health?.crons?.daily?.healedRecords || []).some(h => h.business === 'Project Only Client' && h.rules.includes('project')), 'the health document names the healed record and its rule');
}

section('5c. a repeated heal is counted, and the drawer names both');
{
  const { healItems } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'heals.js')).href);
  const buildNotifications = (leads, o) => healItems(o.health?.crons?.daily?.healedRecords, leads, {}, o.now);
  seed();
  lead(CLIENT).stage = ''; lead(CLIENT).stageHeals = { count: 2, lastAt: '2026-09-18T06:00:00Z', lastRules: ['clientSince'] };
  lead(WON).stage = '';
  _stores.settings.push({ _id: 'health', crons: { daily: { healedRecords: [{ id: CLIENT, business: 'Abyssinia Bar and Restaurant', at: '2026-09-18T06:00:00.000Z', count: 2, rules: ['clientSince'] }] } } });
  const r = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(r._status === 200 && lead(CLIENT).stageHeals.count === 3, `the third heal counts to three (${lead(CLIENT).stageHeals?.count})`);
  const health = _stores.settings.find(s => s._id === 'health');
  const recs = health.crons.daily.healedRecords;
  ok(recs.length === 3 && recs[0].count === 3, `the health list keeps the earlier heal and adds today's two (${recs.length}, newest count ${recs[0]?.count})`);
  const now = new Date(recs[0].at).getTime() + 3600e3;
  const items = buildNotifications(_stores.call_leads, { health, now });
  const heals = items.filter(i => i.kind === 'heal');
  const abyss = heals.find(i => i.title === 'Abyssinia Bar and Restaurant was restored to Clients' && i.at === new Date(recs[0].at).getTime());
  ok(abyss && abyss.group === 'system', `the drawer has a System item naming the client (${heals.map(i => i.title).join(' | ')})`);
  ok(abyss && abyss.tone === 'danger' && /3rd time/.test(abyss.detail) && /upstream/.test(abyss.detail), `more than two heals says something upstream is still wiping it (${abyss?.detail})`);
  const nibble = heals.find(i => i.title === 'Nibble and Nabble was restored to Clients');
  ok(nibble && nibble.tone !== 'danger' && !/upstream/.test(nibble.detail), `a first heal is a plain restore (${nibble?.detail})`);
  ok(new Set(heals.map(i => i.id)).size === heals.length, 'every heal item has its own id (readIds work)');
  ok(buildNotifications(_stores.call_leads, { health, now: now + 8 * 864e5 }).filter(i => i.kind === 'heal').length === 0, 'heal items leave the drawer after seven days');
}

section('5d. every path to client stamps clientSince');
{
  seed();
  let r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { stage: 'client' } } });
  ok(r._status === 200 && /^\d{4}-\d{2}-\d{2}T/.test(lead(LEAD).clientSince || ''), `an explicit stage change to client stamps clientSince (${lead(LEAD).clientSince})`);
  const before = lead(WON).clientSince;
  r = await call(callLeads, 'PATCH', { body: { id: WON, set: { stage: 'client' } } });
  ok(r._status === 200 && /^\d{4}/.test(lead(WON).clientSince || ''), `won to client with no clientSince gets one (${lead(WON).clientSince}, before ${JSON.stringify(before)})`);
  r = await call(callLeads, 'PATCH', { body: { id: CLIENT, set: { stage: 'client', notes: 'still here' } } });
  ok(lead(CLIENT).clientSince === '2026-05-01T00:00:00Z', `an existing clientSince is never overwritten (${lead(CLIENT).clientSince})`);
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { stage: 'client', clientSince: '2026-02-02T00:00:00Z' } } });
  ok(lead(LEAD).clientSince === '2026-02-02T00:00:00Z', `a clientSince the caller sends (the Won dialog) wins (${lead(LEAD).clientSince})`);
  r = await call(callLeads, 'POST', { body: { business: 'Walk In Client', stage: 'client', clientStatus: 'active' } });
  const walk = _stores.call_leads.find(l => l.business === 'Walk In Client');
  ok(r._status === 200 && /^\d{4}/.test(walk?.clientSince || ''), `Add client (POST with stage client) stamps clientSince (${walk?.clientSince})`);
  r = await call(callLeads, 'POST', { body: { business: 'Plain Lead', stage: 'lead' } });
  ok(!_stores.call_leads.find(l => l.business === 'Plain Lead').clientSince, 'a new lead gets no clientSince');
  // 1c: the cron backfills the records from before the rule.
  _stores.call_leads.push({ _id: '507f1f77bcf86cd799439061', business: 'Old Client', stage: 'client', clientSince: '', purchases: [{ label: 'Cards', amount: 200, at: '2026-01-15T00:00:00Z' }], updatedAt: new Date('2026-08-01T00:00:00Z'), socials: {}, callLog: [] });
  _stores.call_leads.push({ _id: '507f1f77bcf86cd799439062', business: 'Old Won', stage: 'won', updatedAt: new Date('2026-07-01T00:00:00Z'), socials: {}, callLog: [] });
  r = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(_stores.call_leads.find(l => l.business === 'Old Client').clientSince === '2026-01-15T00:00:00.000Z', 'the cron backfills clientSince from the first purchase');
  ok(_stores.call_leads.find(l => l.business === 'Old Won').clientSince === '2026-07-01T00:00:00.000Z', 'and from updatedAt when there is nothing else');
  ok(_stores.settings.find(s => s._id === 'health').crons.daily.stamped === 2, `the health document counts the stamps (${_stores.settings.find(s => s._id === 'health').crons.daily.stamped})`);
}

section('6. normalizeLead turns every crashing shape into the expected one');
{
  const n = normalizeLead({ business: { name: 'Casa Mia' }, industry: ['Restaurant', 'Catering'], descriptor: ['A', '.'], priority: 'Restaurant and Catering', callStatus: 'new', stage: 'x',
    callLog: '[{"at":"2026-01-01","outcome":"no-answer"}]', beforeYouDial: '["Open their site"]', objections: '[]', script: '{"confirm":"Hey"}', intel: null, socials: 'https://instagram.com/x', reviews: { asks: 'no', testimonials: null }, phone: 3025550100 });
  ok(n.business === 'Casa Mia', `an object business becomes its name (${JSON.stringify(n.business)})`);
  ok(n.industry === 'Restaurant Catering' && n.descriptor === 'A .', 'array strings join');
  ok(n.priority === 'warm' && n.callStatus === 'not-called' && n.stage === '', 'unknown enums fall back');
  ok(Array.isArray(n.callLog) && n.callLog.length === 1 && n.callLog[0].outcome === 'no-answer', 'a JSON string array is parsed');
  ok(Array.isArray(n.beforeYouDial) && Array.isArray(n.objections), 'the other lists too');
  ok(n.script.confirm === 'Hey', 'a JSON string object is parsed');
  ok(n.intel && Array.isArray(n.intel.accomplishments) && Array.isArray(n.intel.gaps), 'null intel becomes empty lists');
  ok(n.socials && typeof n.socials === 'object' && !Array.isArray(n.socials), 'a string socials becomes an empty object');
  ok(Array.isArray(n.reviews.asks) && Array.isArray(n.reviews.testimonials), 'review lists are arrays');
  ok(n.phone === '3025550100', 'a numeric phone is a string');
  const good = { _id: 'x', business: 'Fine', industry: 'salon', stage: 'client', callStatus: 'not-called', priority: 'hot', callLog: [{ at: 'a' }], socials: { website: 'https://a.co' }, showcase: { slug: 's' } };
  const same = normalizeLead(good);
  ok(JSON.stringify(same) === JSON.stringify(good), 'a well formed record comes back identical');
  ok(normalizeLead(null) === null && normalizeLead(undefined) === undefined, 'nothing in, nothing out');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} checks passed, ${fails} failed.`);
if (fails) { console.log('Pipeline tests FAILED.'); process.exit(1); }
console.log('All pipeline tests pass.');
