#!/usr/bin/env node
/* The pipeline guard (stage regression fix) and the lead shape guard (lead
 * crash fix), against the real handlers and the real helpers.
 *
 *   - normalizeStage is the one decider and reads the stage field
 *   - a client's stage survives a status change, a spreadsheet re-import, a
 *     bulk re-import, and a PATCH that carries a lower stage without an
 *     explicit flag (409, record untouched); an explicit action moves it
 *   - the daily cron puts a client's stage back after a background job
 *     wiped it, and leaves everything else alone
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
