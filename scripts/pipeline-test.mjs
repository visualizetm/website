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
 *   - a declined record (CRM revamp, step 1) is never revived by a sheet or
 *     a bulk import, by name or by phone; a decline writes the reason and
 *     clears the callback; Bring back clears it; an unknown reason reads as other
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
for (const s of ['triage', 'deal', 'nurture', 'declined']) ok(normalizeStage({ stage: s }) === s, `${s} is a stage`);
ok(normalizeStage({ stage: 'client', callStatus: 'not-called' }) === 'client', 'client with callStatus not-called is a client');
ok(normalizeStage({ stage: 'won', callStatus: 'no' }) === 'won', 'won with callStatus no is won');
ok(normalizeStage({ stage: 'client', callLog: [] }) === 'client', 'a client with no call history is a client');
ok(normalizeStage({ stage: 'booked', callStatus: 'not-called' }) === 'booked', 'booked is booked whatever the call status');
ok(normalizeStage({ callStatus: 'booked' }) === 'booked', 'a legacy record with no stage and a booked call reads as booked');
ok(normalizeStage({ stage: '', callStatus: 'not-called' }) === 'triage', 'an empty stage on an untouched record reads as triage (CRM revamp, step 4); the cron below exists for the wiped client');
ok(normalizeStage({ stage: '', callStatus: 'no-answer' }) === 'lead' && normalizeStage({ callStatus: 'not-called', callLog: [{ outcome: 'no-answer' }] }) === 'lead', 'an empty stage on a record that has been dialed reads as lead');

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
  ok(fresh && fresh.stage === 'triage' && fresh.source === 'import' && normalizeStage(fresh) === 'triage', 'a new row lands in triage, marked as an import (CRM revamp, step 4)');
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

section('6. declined: a re-import leaves it alone, a decline writes the reason, Bring back clears it');
{
  seed();
  const DECL = '507f1f77bcf86cd799439034';
  _stores.call_leads.push({ _id: DECL, business: 'Nope Detailing', phone: '(302) 555-0400', stage: 'declined', callStatus: 'not-called', priority: 'warm', declined: { reason: 'well-branded', note: '', at: '2026-09-01T00:00:00Z' }, socials: {}, callLog: [] });
  const r = await call(leadsImport, 'POST', { body: { rows: [
    { business: 'Nope Detailing', phone: '302-555-0400', priority: 'hot', status: 'callback', notes: 'from the sheet' },
    { business: 'Nope Detailing LLC', phone: '+1 302 555 0400', priority: 'hot' },
    { business: 'Brand New Co', phone: '302-555-0500' },
  ] } });
  ok(r._status === 200 && r._json.created === 1 && r._json.updated === 0, `the sheet creates one and updates nothing (${JSON.stringify(r._json)})`);
  ok(r._json.skipped.length === 2 && r._json.skipped.every(x => x.reason === 'declined, left alone'), `both rows for the declined record are skipped with the reason (${JSON.stringify(r._json.skipped)})`);
  ok(lead(DECL).stage === 'declined' && lead(DECL).priority === 'warm' && lead(DECL).callStatus === 'not-called' && !lead(DECL).notes, 'the declined record is untouched');
  const post = await call(callLeads, 'POST', { body: { leads: [{ business: 'nope detailing', phone: '3025550400', socials: { website: 'https://nope.example' } }, { business: 'Other Name', phone: '(302) 555-0400' }, { business: 'Fresh Two', phone: '302-555-0600' }] } });
  ok(post._status === 200 && post._json.inserted === 1 && post._json.declined === 2, `a bulk POST inserts one and skips two declined matches, by name and by phone (${JSON.stringify(post._json)})`);
  ok(!lead(DECL).socials?.website, 'the declined record gains nothing from the backfill');
  ok(post._json.skippedReasons?.[0]?.reason === 'declined, left alone', 'the POST names the reason');

  const dec = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { stage: 'declined', declined: { reason: 'out-of-area', note: 'Two hours away.', at: '2026-09-28T10:00:00Z' }, callbackAt: '' }, explicit: true } });
  ok(dec._status === 200 && lead(LEAD).stage === 'declined' && lead(LEAD).declined?.reason === 'out-of-area' && lead(LEAD).declined?.note === 'Two hours away.' && lead(LEAD).callbackAt === '', `a decline writes stage, the reason, the note and clears the callback (${dec._status})`);
  const bad = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { declined: { reason: 'made-up', note: 'x'.repeat(400), at: 'now', $where: '1' } } } });
  ok(bad._status === 200 && lead(LEAD).declined.reason === 'other' && lead(LEAD).declined.note.length === 300 && !('$where' in lead(LEAD).declined), 'an unknown reason reads as other, the note caps at 300, nothing else is written');
  const back = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { stage: 'triage', declined: null }, explicit: true } });
  ok(back._status === 200 && lead(LEAD).stage === 'triage' && lead(LEAD).declined === null, `Bring back sets triage and clears declined (${back._status}, ${lead(LEAD).stage})`);
  // step 3: the decline write clears the dial list membership, and the route stores it
  const { declinePatch } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'decline.js')).href);
  lead(LEAD).listId = 'list-abc';
  const dset = declinePatch(lead(LEAD), 'not-fit', 'no');
  ok(dset.listId === '' && dset.nextAction === null, 'declinePatch clears listId and nextAction');
  const { explicit: _e, ...dsetBody } = dset;
  const declined2 = await call(callLeads, 'PATCH', { body: { id: LEAD, set: dsetBody, explicit: true } });
  ok(declined2._status === 200 && lead(LEAD).listId === '' && lead(LEAD).stage === 'declined', `the route stores the cleared listId (${lead(LEAD).listId})`);
  const guard = await call(callLeads, 'PATCH', { body: { id: CLIENT, set: { stage: 'declined', declined: { reason: 'other', note: '', at: '' } } } });
  ok(guard._status === 409 && lead(CLIENT).stage === 'client', 'a client cannot be declined without the explicit flag');
}

section('7. the next action (CRM revamp, step 2): a stage change recomputes it, the cron repairs it');
{
  const { withNextAction, nextActionFor } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'nextAction.js')).href);
  const day = 864e5;
  const soon = new Date(Date.now() + 2 * day); const mdate = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  const set = withNextAction({ _id: LEAD, business: 'Fresh Lead Co', stage: 'lead', callStatus: 'not-called' }, { stage: 'booked', meeting: { date: mdate, time: '10:00', type: 'call', location: '' } }, { sets: [] });
  ok(set.nextAction?.kind === 'build-concepts', `booking a lead puts build-concepts on the same set (${set.nextAction?.kind})`);
  const back = withNextAction({ _id: LEAD, business: 'Fresh Lead Co', stage: 'booked', meeting: { date: mdate, time: '10:00' }, nextAction: set.nextAction }, { stage: 'nurture' }, { sets: [] });
  ok(back.nextAction === null, 'moving it to nurture clears the action on the same set');
  seed();
  const r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { stage: 'booked', meeting: { date: mdate, time: '10:00', type: 'call', location: '' }, nextAction: set.nextAction } } });
  ok(r._status === 200 && lead(LEAD).nextAction?.kind === 'build-concepts' && lead(LEAD).nextAction.auto === true, 'the route stores the whitelisted action');
  const junk = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { nextAction: { kind: 'made-up', label: 'x'.repeat(200), dueAt: 'now', auto: 'yes', doneAt: '', $where: '1' } } } });
  ok(junk._status === 200 && lead(LEAD).nextAction.kind === 'custom' && lead(LEAD).nextAction.label.length === 120 && !('$where' in lead(LEAD).nextAction), 'an unknown kind reads as custom, the label caps at 120, nothing else is written');
  // the cron: a stale action is put right, a manual one is kept
  lead(LEAD).nextAction = { kind: 'callback', label: 'Call back', dueAt: '2026-01-01T00:00:00Z', auto: true, doneAt: '' };
  lead(WON).nextAction = { kind: 'custom', label: 'Drop off the samples', dueAt: '2027-01-01T00:00:00Z', auto: false, doneAt: '' };
  _stores.concept_sets = [];
  const cron = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(cron._status === 200 && cron._json.nextActions >= 1, `the cron reports what it recomputed (${cron._json?.nextActions})`);
  ok(lead(LEAD).nextAction?.kind === 'build-concepts', `the stale callback became build-concepts overnight (${lead(LEAD).nextAction?.kind})`);
  ok(lead(WON).nextAction?.label === 'Drop off the samples' && lead(WON).nextAction.auto === false, 'a manual action survives the cron');
  ok(nextActionFor(lead(CLIENT), { projects: _stores.projects, sets: [] }) === null && (lead(CLIENT).nextAction == null), 'a client with nothing due carries nothing');
}

section('8. triage (CRM revamp, step 4): every new lead lands there, nurture comes back through it');
{
  const submissions = (await load('submissions.js')).default;
  const { saidNoPatch } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'nurture.js')).href);
  const { keepPatch, undoKeepPatch, laterPatch, undoLaterPatch, sourceOf, triageLeads } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'triage.js')).href);
  const { parseCapture, captureLead } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'capture.js')).href);
  seed(); _stores.submissions = []; _stores.rate_limits = [];
  // POST, single and bulk
  let r = await call(callLeads, 'POST', { body: { business: 'Single New' } });
  ok(r._status === 200 && _stores.call_leads.find(l => l.business === 'Single New')?.stage === 'triage', 'a single POST lands in triage');
  r = await call(callLeads, 'POST', { body: { leads: [{ business: 'Bulk A' }, { business: 'Bulk B', stage: 'lead' }] } });
  ok(_stores.call_leads.find(l => l.business === 'Bulk A')?.stage === 'triage' && _stores.call_leads.find(l => l.business === 'Bulk B')?.stage === 'lead', 'a bulk POST defaults to triage and keeps a stage the row names');
  r = await call(callLeads, 'POST', { body: { business: 'Added client', stage: 'client' } });
  ok(_stores.call_leads.find(l => l.business === 'Added client')?.stage === 'client', 'Add client still makes a client');
  // the public submission: match by email, then phone, else a triage lead
  const sub = (b) => call(submissions, 'POST', { body: { type: 'start', name: 'Sam', ...b } });
  r = await sub({ business: 'Fresh Lead Co', email: 'x@y.com', phone: '(302) 555-0300' });
  let s = _stores.submissions[_stores.submissions.length - 1];
  ok(r._status === 200 && s.linkedLeadId === LEAD, `a brief with a matching phone links to the existing lead (${s?.linkedLeadId})`);
  lead(LEAD).email = 'owner@fresh.example';
  r = await sub({ business: 'Someone', email: 'Owner@Fresh.example', phone: '' });
  s = _stores.submissions[_stores.submissions.length - 1];
  ok(s.linkedLeadId === LEAD, 'a brief with a matching email (any case) links to the existing lead');
  lead(WON).email = ''; lead(WON).phone = '302-555-0200'; lead(WON).stage = 'nurture'; lead(WON).nurture = { until: '2099-01-01', reason: 'Later' };
  r = await sub({ business: 'Nibble', email: 'other@nibble.example', phone: '13025550200' });
  s = _stores.submissions[_stores.submissions.length - 1];
  ok(s.linkedLeadId === WON && lead(WON).stage === 'nurture', 'a brief that matches a nurture record links it and leaves the stage alone');
  const before = _stores.call_leads.length;
  r = await sub({ business: 'Brand New Brief', email: 'new@brief.example', phone: '302-555-0999' });
  s = _stores.submissions[_stores.submissions.length - 1];
  const made = _stores.call_leads.find(l => l.business === 'Brand New Brief');
  ok(_stores.call_leads.length === before + 1 && made?.stage === 'triage' && s.linkedLeadId === String(made._id), 'a brief with no match makes a triage lead and links it');
  ok(sourceOf(made, new Set([String(made._id)])).id === 'brief' && sourceOf({ sourceId: 'r1' }).id === 'scraper' && sourceOf({ source: 'import' }).id === 'import' && sourceOf({}).id === 'hand', 'the source pill: brief, scraper, import, by hand');
  r = await sub({ business: 'Empty mail', email: 'nobody@nowhere.example', phone: '' });
  s = _stores.submissions[_stores.submissions.length - 1];
  ok(s.linkedLeadId && s.linkedLeadId !== LEAD && s.linkedLeadId !== WON && lead(WON).email === '', 'a brief with an unknown email and no phone never matches a record with an empty email');
  r = await sub({ business: 'No brief', email: 'x', phone: '302-555-0300' });
  ok(r._status === 400, 'a brief without a valid email is refused before any lead is touched');
  // the pools
  ok(triageLeads([{ stage: 'triage', score: 10, createdAt: '2026-01-01' }, { stage: 'lead' }, { stage: 'triage', score: 90 }, { stage: 'triage', score: 10, createdAt: '2026-02-01' }]).map(l => l.score + (l.createdAt || '')).join(',') === '90,102026-02-01,102026-01-01', 'the pile sorts by score, then newest');
  ok(triageLeads([{ stage: 'lead' }, { callStatus: 'not-called' }]).length === 1, 'a record with no stage and no call is in the pile');
  // keep, later, bin and the nurture field
  seed(); lead(LEAD).stage = 'triage';
  const kp = keepPatch(lead(LEAD), { priority: 'hot', bestWindow: 'Morning' });
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: kp } });
  ok(r._status === 200 && lead(LEAD).stage === 'lead' && lead(LEAD).priority === 'hot' && lead(LEAD).bestWindow === 'Morning' && lead(LEAD).nurture === null, 'Keep writes stage lead with the priority and the window');
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: undoKeepPatch({ ...lead(LEAD), priority: 'warm', bestWindow: '' }) } });
  ok(lead(LEAD).stage === 'triage' && lead(LEAD).priority === 'warm', 'the undo puts it back in triage with what it had');
  const lp = laterPatch(lead(LEAD), Date.parse('2026-09-28T12:00:00-04:00'));
  ok(lp.stage === 'nurture' && lp.nurture.until === '2026-10-28' && lp.nurture.reason === 'Later', `Later parks 30 days out (${lp.nurture.until})`);
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: lp } });
  ok(r._status === 200 && lead(LEAD).stage === 'nurture' && lead(LEAD).nurture.until === '2026-10-28', 'the route stores the nurture field');
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { nurture: { until: 'soon', reason: 'x'.repeat(300), $where: '1' } } } });
  ok(lead(LEAD).nurture.until === '' && lead(LEAD).nurture.reason.length === 120 && !('$where' in lead(LEAD).nurture), 'a bad until reads as empty, the reason caps at 120, nothing else is written');
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: undoLaterPatch({ nurture: null }) } });
  ok(lead(LEAD).stage === 'triage' && lead(LEAD).nurture === null, 'the Later undo returns it to triage and clears the parking');
  const sn = saidNoPatch(Date.parse('2026-09-28T12:00:00-04:00'));
  ok(sn.stage === 'nurture' && sn.nurture.until === '2026-12-27' && sn.nurture.reason === 'Said no' && sn.listId === '', `Said no parks 90 days out and leaves the list (${sn.nurture.until})`);
  r = await call(callLeads, 'DELETE', { query: { id: LEAD } });
  ok(r._status === 200 && lead(LEAD).deleted === true, 'Bin soft deletes');
  r = await call(callLeads, 'PATCH', { body: { action: 'restore', ids: [LEAD] } });
  ok(r._status === 200 && !lead(LEAD).deleted, 'and the undo restores');
  r = await call(callLeads, 'PATCH', { body: { id: LEAD, set: { score: 250 } } });
  ok(lead(LEAD).score === 100, 'the score is clamped to 100');
  // the cron resurfaces nurture
  seed(); _stores.submissions = []; _stores.concept_sets = []; _stores.lists = [];
  lead(LEAD).stage = 'nurture'; lead(LEAD).nurture = { until: '2020-01-01', reason: 'Said no' }; lead(LEAD).notes = 'Old note';
  lead(WON).stage = 'nurture'; lead(WON).nurture = { until: '2099-01-01', reason: 'Later' };
  const cron = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(cron._status === 200 && cron._json.resurfaced === 1, `the cron resurfaces the one past its day (${cron._json?.resurfaced})`);
  ok(lead(LEAD).stage === 'triage' && lead(LEAD).nurture === null && lead(LEAD).notes === 'Back from nurture (Said no)\nOld note', `back in triage, parking cleared, the note prepended (${JSON.stringify(lead(LEAD).notes)})`);
  ok(lead(WON).stage === 'nurture' && lead(WON).nurture.until === '2099-01-01', 'one whose day has not come stays parked');
  // quick capture
  ok(parseCapture('@the.bakery.co').kind === 'instagram' && captureLead(parseCapture('@the.bakery.co')).socials.instagram === 'https://instagram.com/the.bakery.co' && captureLead(parseCapture('@the.bakery.co')).business === 'the.bakery.co', 'a leading @ is a handle and fills socials.instagram');
  ok(parseCapture('302 555 0100').kind === 'phone' && captureLead(parseCapture('302 555 0100')).phone === '(302) 555-0100', 'digits are a phone');
  ok(parseCapture('Bay Ridge Bakery').kind === 'name' && captureLead(parseCapture('Bay Ridge Bakery')).stage === 'triage' && !parseCapture(''), 'anything else is a name, headed for triage; nothing is nothing');
  r = await call(callLeads, 'POST', { body: captureLead(parseCapture('@captured')) });
  const cap = _stores.call_leads.find(l => l.business === 'captured');
  ok(r._status === 200 && cap?.stage === 'triage' && cap.source === 'capture' && cap.socials?.instagram === 'https://instagram.com/captured', 'the capture lands in triage with the handle');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} checks passed, ${fails} failed.`);
if (fails) { console.log('Pipeline tests FAILED.'); process.exit(1); }
console.log('All pipeline tests pass.');
