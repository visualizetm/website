#!/usr/bin/env node
/* Dial lists (CRM revamp, step 3): the route's whitelist, the Callbacks due
 * system list rules, and every outcome rule the Call Console applies,
 * against the real handlers with the in-memory mongo.
 *   node scripts/lists-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
process.env.TZ = 'America/New_York';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'lists-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
process.env.SESSION_SECRET = 'test-secret-not-real'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL;

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const lists = (await load('_routes/lists.js')).handler;
const callLeads = (await load('_routes/call-leads.js')).handler;
const cronDaily = (await load('_routes/cron-daily.js')).handler;
const srv = await load('_lib/lists.js');
const lib = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'lists.js')).href);
const decline = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'decline.js')).href);

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; } });
async function call(fn, method, { query = {}, body, headers = {} } = {}) {
  const res = fakeRes();
  try { await fn({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  return res;
}
const NOW = Date.now(); const H = 3600e3; const DAY = 864e5;
const iso = (t) => new Date(t).toISOString();
const L = (i) => `507f1f77bcf86cd7994390${String(i).padStart(2, '0')}`;
function seed() {
  _reset();
  _stores.call_leads = [
    { _id: L(1), business: 'Late Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW - 2 * DAY), socials: {}, callLog: [] },
    // Due ten minutes ago: today at any hour of the day. Two hours ahead used to cross midnight in New York on a late run.
    { _id: L(2), business: 'Today Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW - 10 * 60e3), socials: {}, callLog: [] },
    { _id: L(3), business: 'Tomorrow Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + 2 * DAY), socials: {}, callLog: [] },
    { _id: L(4), business: 'Booked Co', stage: 'booked', callStatus: 'callback', callbackAt: iso(NOW - DAY), socials: {}, callLog: [] },
    { _id: L(5), business: 'No Time Co', stage: 'lead', callStatus: 'callback', callbackAt: '', socials: {}, callLog: [] },
    { _id: L(6), business: 'Plain Co', stage: 'lead', callStatus: 'not-called', listId: '', socials: {}, callLog: [] },
    { _id: L(7), business: 'Declined Co', stage: 'lead', callStatus: 'no-answer', listId: '', socials: {}, callLog: [] },
  ];
  _stores.lists = []; _stores.projects = []; _stores.settings = []; _stores.concept_sets = [];
}
const list = (id) => _stores.lists.find(l => String(l._id) === String(id));

section('1. the system list: created on first read, filled by the callbacks due, in order');
{
  seed();
  const r = await call(lists, 'GET', {});
  ok(r._status === 200 && r._json.items.length === 1, `the first read answers the one system list (${r._status}, ${r._json?.items?.length})`);
  const sys = r._json.items[0];
  ok(sys.system === true && sys.name === 'Callbacks due' && sys.status === 'open', 'it is system, named Callbacks due, open');
  ok(JSON.stringify(sys.leadIds) === JSON.stringify([L(1), L(2)]), `its members are the callbacks due today or earlier, earliest first, stage lead only (${JSON.stringify(sys.leadIds)})`);
  ok(lib.callbacksDueIds(_stores.call_leads, NOW).join() === srv.callbacksDueIds(_stores.call_leads, NOW).join(), 'the client and server rules agree');
  const again = await call(lists, 'GET', {});
  ok(again._json.items.length === 1 && String(again._json.items[0]._id) === String(sys._id), 'a second read does not make a second system list');
  // a callback moved: the read refreshes the members
  _stores.call_leads[2].callbackAt = iso(NOW - H);
  const fresh = await call(lists, 'GET', {});
  ok(JSON.stringify(fresh._json.items[0].leadIds) === JSON.stringify([L(1), L(3), L(2)]), `a read refreshes the members in callback order (${JSON.stringify(fresh._json.items[0].leadIds)})`);
  // the cron does the same
  _stores.call_leads[1].callStatus = 'not-called';
  const cron = await call(cronDaily, 'GET', { headers: { authorization: 'Bearer cron-test-secret' } });
  ok(cron._status === 200 && cron._json.callbacksDue === 2 && JSON.stringify(list(sys._id).leadIds) === JSON.stringify([L(1), L(3)]), `the daily cron recomputes the members (${cron._json?.callbacksDue}, ${JSON.stringify(list(sys._id)?.leadIds)})`);
  // the rules
  const rename = await call(lists, 'PATCH', { body: { id: sys._id, set: { name: 'Mine now' } } });
  ok(rename._status === 400 && list(sys._id).name === 'Callbacks due', 'it cannot be renamed');
  const resize = await call(lists, 'PATCH', { body: { id: sys._id, set: { target: 3 } } });
  ok(resize._status === 400, 'it cannot be resized');
  const done = await call(lists, 'PATCH', { body: { id: sys._id, set: { status: 'done' } } });
  ok(done._status === 400 && list(sys._id).status === 'open', 'it cannot be marked done');
  const hand = await call(lists, 'PATCH', { body: { id: sys._id, set: { leadIds: [L(6)] } } });
  ok(hand._status === 400 && !list(sys._id).leadIds.includes(L(6)), 'it cannot be filled by hand');
  const sync = await call(lists, 'PATCH', { body: { id: sys._id, set: { leadIds: [L(1)] }, sync: true } });
  ok(sync._status === 200 && JSON.stringify(list(sys._id).leadIds) === JSON.stringify([L(1)]), 'a sync may set its members');
  const del = await call(lists, 'DELETE', { query: { id: String(sys._id) } });
  ok(del._status === 409 && list(sys._id).status === 'open', 'it cannot be deleted');
  const taken = await call(lists, 'POST', { body: { name: 'callbacks DUE', target: 10 } });
  ok(taken._status === 400, 'the name is reserved');
}

section('2. the whitelist');
{
  seed();
  const r = await call(lists, 'POST', { body: { name: 'x'.repeat(200), target: 9999, window: 'night', leadIds: [L(6), L(6), 42, '', { $gt: '' }, 'a'.repeat(100)], status: 'weird', system: true, scheduledFor: 'tomorrow', bogus: 1 } });
  const it = r._json?.item;
  ok(r._status === 200 && it.name.length === 80, `the name caps at 80 (${it?.name?.length})`);
  ok(it.target === 500 && it.window === 'any' && it.status === 'open' && it.system === false && it.scheduledFor === '', `target clamps to 500, window and status fall back, system is never taken from a request, a bad date reads as none (${it?.target}, ${it?.window}, ${it?.status}, ${it?.system})`);
  ok(JSON.stringify(it.leadIds) === JSON.stringify([L(6), '42', 'a'.repeat(64)]), `leadIds are strings, unique, capped at 64 chars, objects dropped (${JSON.stringify(it?.leadIds)})`);
  ok(!('bogus' in it), 'an unknown key is not written');
  const low = await call(lists, 'POST', { body: { name: 'Small', target: 0 } });
  ok(low._json.item.target === 1, 'target floors at 1');
  const noname = await call(lists, 'POST', { body: { target: 5 } });
  ok(noname._status === 400, 'a list needs a name');
  const p = await call(lists, 'PATCH', { body: { id: it._id, set: { name: 'Tuesday morning', target: 25, window: 'morning', leadIds: [L(6), L(7)], scheduledFor: '2026-10-01', system: true } } });
  ok(p._status === 200 && list(it._id).name === 'Tuesday morning' && list(it._id).target === 25 && list(it._id).window === 'morning' && list(it._id).scheduledFor === '2026-10-01' && list(it._id).system === false, 'a PATCH sets the four fields and cannot make a list system');
  const big = await call(lists, 'PATCH', { body: { id: it._id, set: { leadIds: Array.from({ length: 600 }, (_, i) => `id${i}`) } } });
  ok(big._status === 200 && list(it._id).leadIds.length === 500, 'members cap at 500');
  const del = await call(lists, 'DELETE', { query: { id: String(it._id) } });
  ok(del._status === 200 && list(it._id).status === 'done', 'delete is soft: status done');
  const getAll = await call(lists, 'GET', {});
  ok(getAll._json.items.some(x => String(x._id) === String(it._id)), 'a list done today still comes back for seven days');
  list(it._id).updatedAt = new Date(NOW - 8 * DAY);
  const later = await call(lists, 'GET', {});
  ok(!later._json.items.some(x => String(x._id) === String(it._id)), 'a list done eight days ago is gone from the read');
  const missing = await call(lists, 'PATCH', { body: { id: '000000000000000000000000', set: { name: 'x' } } });
  ok(missing._status === 404, 'an unknown id is 404');
  const lead = await call(callLeads, 'PATCH', { body: { id: L(6), set: { listId: String(it._id) } } });
  ok(lead._status === 200 && _stores.call_leads[5].listId === String(it._id), 'a lead stores its listId');
  const clear = await call(callLeads, 'PATCH', { body: { id: L(6), set: { listId: null } } });
  ok(clear._status === 200 && _stores.call_leads[5].listId === '', 'null clears it');
}

section('3. the outcome rules (src/lib/lists.js applyOutcome)');
{
  const ids = ['a', 'b', 'c'];
  for (const o of ['booked', 'no', 'wrong-number', 'declined', 'callback']) ok(JSON.stringify(lib.applyOutcome(ids, 'b', o)) === JSON.stringify(['a', 'c']) && lib.outcomeRemoves(o), `${o} removes the lead and clears its listId`);
  ok(JSON.stringify(lib.applyOutcome(ids, 'a', 'no-answer')) === JSON.stringify(['b', 'c', 'a']) && !lib.outcomeRemoves('no-answer'), 'no-answer moves the lead to the bottom and keeps its listId');
  ok(lib.applyOutcome(ids, 'zzz', 'booked') === null, 'a lead not on the list changes nothing');
  ok(JSON.stringify(lib.withLeads(['a'], ['b', 'a', 'c'])) === JSON.stringify(['a', 'b', 'c']), 'adding keeps order and drops duplicates');
  ok(lib.listsBadge([{ status: 'open', target: 3, leadIds: ['a', 'b', 'c'] }, { status: 'open', target: 3, leadIds: ['a'] }, { status: 'open', system: true, target: 1, leadIds: ['a', 'b'] }, { status: 'done', target: 1, leadIds: ['a'] }]) === 1, 'the badge counts open hand lists at or above target');
  const d = decline.declinePatch({ _id: 'x', listId: 'list1' }, 'budget', '');
  ok(d.listId === '' && d.stage === 'declined', 'a decline clears the listId on the same write');
}

section('9. the undo on a call outcome puts the lead back on its list, in its old place (CRM revamp, step 4)');
{
  ok(lib.restoreLead(['a', 'c', 'd'], 'b', 1).join(',') === 'a,b,c,d', 'restored to index 1');
  ok(lib.restoreLead(['a', 'c', 'd'], 'b', 0).join(',') === 'b,a,c,d', 'restored to the front');
  ok(lib.restoreLead(['a', 'c', 'd'], 'b', 9).join(',') === 'a,c,d,b', 'an index past the end goes last');
  ok(lib.restoreLead(['a', 'c', 'd'], 'b', -1).join(',') === 'a,c,d,b', 'no known index goes last');
  ok(lib.restoreLead(['a', 'b', 'c'], 'b', 0).join(',') === 'b,a,c', 'a lead still on the list moves instead of doubling');
  // the whole beat against the route: the outcome takes it off, the undo puts it back where it was
  const [L1, L2, L3, LS] = [L(81), L(82), L(83), L(90)];
  _reset(); _stores.call_leads = [{ _id: L1, business: 'One', stage: 'lead', callStatus: 'not-called', listId: LS }, { _id: L2, business: 'Two', stage: 'lead', callStatus: 'not-called', listId: LS }, { _id: L3, business: 'Three', stage: 'lead', callStatus: 'not-called', listId: LS }];
  _stores.lists = [{ _id: LS, name: 'Tuesday', status: 'open', target: 25, window: 'any', leadIds: [L1, L2, L3], createdAt: new Date() }];
  const list = () => _stores.lists.find(l => String(l._id) === LS);
  const before = list().leadIds.indexOf(L2);
  const said = lib.applyOutcome(list().leadIds, L2, 'no');
  await call(lists, 'PATCH', { body: { id: LS, set: { leadIds: said } } });
  const { saidNoPatch } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'nurture.js')).href);
  await call(callLeads, 'PATCH', { body: { id: L2, set: { callStatus: 'no', ...saidNoPatch() } } });
  const two = () => _stores.call_leads.find(l => String(l._id) === L2);
  ok(list().leadIds.join(',') === [L1, L3].join(',') && two().stage === 'nurture' && two().listId === '', 'Said no takes the lead off the list and parks it');
  await call(callLeads, 'PATCH', { body: { id: L2, set: { callStatus: 'not-called', stage: 'lead', nurture: null, listId: LS } } });
  await call(lists, 'PATCH', { body: { id: LS, set: { leadIds: lib.restoreLead(list().leadIds, L2, before) } } });
  ok(list().leadIds.join(',') === [L1, L2, L3].join(',') && two().stage === 'lead' && two().listId === LS && two().nurture === null, 'the undo restores the stage, the listId and the position');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} checks passed, ${fails} failed.`);
console.log(fails ? 'Lists tests FAILED.' : 'All lists tests pass.');
process.exit(fails ? 1 : 0);
