#!/usr/bin/env node
/* Node test for the public concepts endpoint (api/_routes/concepts-public.js,
 * reached as /api/concepts through api/showcase.js), on the planner test's
 * pattern: api/ is copied into a temp dir with _lib/mongo.js replaced by the
 * in-memory fake (scripts/fake-mongo.js), and the real handlers run.
 *
 * What is asserted is mostly what the door REFUSES: no token, a malformed
 * one, an unknown one, a draft, an archived set, a deleted one and a
 * directionId from another set all answer the same 404 bytes; the response
 * is the whitelist and nothing else, by key and by value against a set and
 * a lead stuffed with private fields; the 409s, the 429 at the 31st action
 * with reads still working, and the sentinel operator never reaching a
 * filter or an update.
 *   node scripts/concepts-endpoint-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'concepts-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
process.env.SESSION_SECRET = 'test-not-real';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _log, _reset } = await load('_lib/mongo.js');
const showcase = (await load('showcase.js')).default;
const adminIndex = (await load('admin/index.js')).default;
const { signSession } = await load('_lib/auth.js');

const LIVE = 'cncp_live_token_abcdefghijklmn';
const DRAFT = 'cncp_draft_token_abcdefghijkl';
const ARCH = 'cncp_arch_token_abcdefghijklmn';
const GONE = 'cncp_gone_token_abcdefghijklmn';
const OTHER = 'cncp_other_token_abcdefghijklm';
const LEAD = '507f1f77bcf86cd799439031';
const PRIVATE_VALUES = ['555-0100', 'owner@kims.example', 'Jamie the manager', 'internal only note', 'https://drive.example/secret', 'the client said this in confidence'];
function seed() {
  _reset();
  _stores.call_leads = [{ _id: LEAD, business: 'Kims Cafe', phone: '555-0100', email: 'owner@kims.example', askFor: 'Jamie the manager', notes: 'internal only note', links: { drive: 'https://drive.example/secret' }, stage: 'client', showcase: { published: true, slug: 'kims-cafe', displayName: 'Kims Cafe' } }];
  const dirs = () => [
    { id: 'dA', name: 'Warm', rationale: 'Friendly.', order: 0, items: [{ id: 'iA1', kind: 'logo', image: 'https://img.example/a.png', caption: 'Mark', order: 0 }, { id: 'iA2', kind: 'board', image: 'https://img.example/b.png', caption: '', order: 1 }] },
    { id: 'dB', name: 'Clean', rationale: 'Sharper.', order: 1, items: [{ id: 'iB1', kind: 'logo', image: 'https://img.example/c.png', caption: 'Wordmark', order: 0 }] },
  ];
  const base = (over) => ({ leadId: LEAD, title: 'Three ways', round: 1, intro: 'Hello.', directions: dirs(), feedback: [{ at: '2026-09-01T10:00:00Z', directionId: 'dA', action: 'change', name: 'Kim', note: 'the client said this in confidence' }], approvedDirectionId: '', approvedAt: '', projectId: 'p1', archived: false, tokenCreatedAt: '2026-09-01T00:00:00Z', sentAt: '2026-09-01T00:00:00Z', lastViewedAt: '', createdAt: new Date(), updatedAt: new Date(), ...over });
  _stores.concept_sets = [
    { _id: 'c07f1f77bcf86cd799439001', token: LIVE, status: 'sent', ...base({}) },
    { _id: 'c07f1f77bcf86cd799439002', token: DRAFT, status: 'draft', ...base({ sentAt: '' }) },
    { _id: 'c07f1f77bcf86cd799439003', token: ARCH, status: 'viewed', ...base({ archived: true }) },
    { _id: 'c07f1f77bcf86cd799439004', token: GONE, status: 'viewed', ...base({ deleted: true }) },
    { _id: 'c07f1f77bcf86cd799439005', token: OTHER, status: 'viewed', ...base({ directions: [{ id: 'dZ', name: 'Theirs', rationale: '', order: 0, items: [{ id: 'iZ1', kind: 'logo', image: 'https://img.example/z.png', caption: '', order: 0 }] }] }) },
  ];
  _stores.settings = [];
}
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; } });
async function call(method, query = {}, body = undefined, headers = {}) {
  const req = { method, query: { r: 'concepts', ...query }, body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, url: '/api/concepts', socket: {} };
  const res = fakeRes();
  try { await showcase(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  return res;
}
const bytes = (res) => `${res._status} ${JSON.stringify(res._json)}`;
const live = () => _stores.concept_sets[0];

/* ── GET: the whitelist ──────────────────────────────────────────────── */
seed();
{
  const res = await call('GET', { token: LIVE });
  ok(res._status === 200, `a live token answers 200 (got ${res._status})`);
  ok(res._headers['Cache-Control'] === 'no-store', 'the answer is Cache-Control: no-store');
  const body = res._json || {};
  ok(Object.keys(body).sort().join(',') === 'client,directions,feedback,set', `the response is exactly client, set, directions, feedback (got ${Object.keys(body).sort().join(',')})`);
  ok(Object.keys(body.client).join(',') === 'displayName' && body.client.displayName === 'Kims Cafe', 'client is exactly displayName, from the showcase');
  ok(Object.keys(body.set).sort().join(',') === 'approvedDirectionId,intro,round,status,title', `set is exactly title, round, intro, status, approvedDirectionId (got ${Object.keys(body.set).sort().join(',')})`);
  ok(body.directions.every(d => Object.keys(d).sort().join(',') === 'id,items,name,rationale'), 'every direction is exactly id, name, rationale, items');
  ok(body.directions.every(d => d.items.every(it => Object.keys(it).sort().join(',') === 'caption,id,image,kind')), 'every item is exactly id, kind, image, caption');
  ok(body.feedback.every(f => Object.keys(f).sort().join(',') === 'action,at,directionId,name'), `every feedback entry is exactly at, directionId, action, name, never the note (got ${Object.keys(body.feedback[0] || {}).sort().join(',')})`);
  ok(body.directions.map(d => d.id).join(',') === 'dA,dB' && body.directions[0].items.map(i => i.id).join(',') === 'iA1,iA2', 'directions and items come back in order');
  const dump = JSON.stringify(body);
  for (const key of ['phone', 'email', 'askFor', 'notes', 'links', 'token', 'tokenCreatedAt', 'leadId', '_id', 'projectId', 'sentAt', 'lastViewedAt', 'approvedAt', 'note', 'order', 'stage']) ok(!dump.includes(`"${key}"`), `private key "${key}" is nowhere in the response`);
  for (const v of PRIVATE_VALUES) ok(!dump.includes(v), `private value "${v.slice(0, 28)}" never leaks`);
  ok(!dump.includes(LIVE), 'the token itself is never echoed back');
  ok(body.set.status === 'viewed' && live().status === 'viewed', `the first view moves sent to viewed (got ${body.set.status})`);
  ok(!!live().lastViewedAt, 'the first view stamps lastViewedAt');
  const stamped = live().lastViewedAt;
  await call('GET', { token: LIVE });
  ok(live().lastViewedAt === stamped, 'a refresh inside the hour does not write again');
  live().lastViewedAt = new Date(Date.now() - 2 * 3600e3).toISOString();
  await call('GET', { token: LIVE });
  ok(live().lastViewedAt !== stamped && Date.now() - Date.parse(live().lastViewedAt) < 5000, 'a view an hour later stamps again');
}

/* ── The 404s: every wrong door looks identical ──────────────────────── */
{
  seed(); _log.length = 0;
  const cases = [['no token', {}], ['an unknown token', { token: 'cncp_nope_nope_nope_nope_nope' }], ['a draft', { token: DRAFT }], ['an archived set', { token: ARCH }], ['a deleted set', { token: GONE }], ['a token shaped wrong', { token: '../../etc/passwd' }], ['a short token', { token: 'short' }], ['an array', { token: [LIVE, LIVE] }]];
  const bodies = [];
  for (const [label, query] of cases) { const res = await call('GET', query); bodies.push(bytes(res)); ok(res._status === 404 && res._json?.error === 'not found', `${label} answers 404 { error: 'not found' }`); }
  ok(new Set(bodies).size === 1, 'every 404 body is byte for byte identical');
  ok(!_log.some(e => e.op === 'updateOne'), 'a miss writes nothing');
  ok(_log.filter(e => e.op === 'findOne' && e.collection === 'concept_sets').length === 4, `only the well formed tokens reach the database (${_log.filter(e => e.collection === 'concept_sets').length} lookups for 8 requests)`);
  const post = await call('POST', { token: DRAFT }, { action: 'approve', directionId: 'dA' });
  ok(bytes(post) === bodies[0], 'a POST on a draft is the same 404');
  ok(_stores.concept_sets[1].status === 'draft' && _stores.concept_sets[1].feedback.length === 1, 'and the draft is untouched');
}

/* ── POST: the cross set check ───────────────────────────────────────── */
{
  seed();
  const dead = bytes(await call('GET', { token: 'cncp_nope_nope_nope_nope_nope' }));
  const cross = await call('POST', { token: LIVE }, { action: 'approve', directionId: 'dZ' });
  ok(bytes(cross) === dead, `a directionId from another set is the same 404 (${bytes(cross)})`);
  ok(live().status === 'sent' && live().approvedDirectionId === '' && live().feedback.length === 1, 'and nothing on this set changed');
  ok(_stores.concept_sets[4].status === 'viewed' && _stores.concept_sets[4].feedback.length === 1, 'and nothing on the other set changed');
  const upd = _log.find(e => e.op === 'updateOne' && e.collection === 'concept_sets' && e.filter && e.filter['directions.id']);
  ok(upd && String(upd.filter._id) === live()._id && upd.filter['directions.id'] === 'dZ', `the direction check is inside the update's own filter (${JSON.stringify(upd?.filter)})`);
  const madeUp = await call('POST', { token: LIVE }, { action: 'approve', directionId: 'nope' });
  ok(bytes(madeUp) === dead, 'a made up directionId is the same 404');
  const none = await call('POST', { token: LIVE }, { action: 'approve' });
  ok(bytes(none) === dead, 'approve without a directionId is the same 404');
}

/* ── POST: change, then approve, then 409 ────────────────────────────── */
{
  seed();
  const empty = await call('POST', { token: LIVE }, { action: 'change', directionId: 'dA', note: '   ' });
  ok(empty._status === 400 && live().status === 'sent', 'a change request with no note is a 400 and changes nothing');
  const ch = await call('POST', { token: LIVE }, { action: 'change', directionId: 'dA', note: '  Bigger, please.  ', name: '  Kim  ' });
  ok(ch._status === 200 && ch._json.status === 'changes' && live().status === 'changes', 'a change request moves the set to changes');
  const last = live().feedback[live().feedback.length - 1];
  ok(last.action === 'change' && last.directionId === 'dA' && last.note === 'Bigger, please.' && last.name === 'Kim' && !!last.at, `the entry is appended, trimmed and stamped (${JSON.stringify(last)})`);
  const ch2 = await call('POST', { token: LIVE }, { action: 'change', directionId: 'dB', note: 'x'.repeat(1500) });
  ok(ch2._status === 200 && live().feedback.length === 3 && live().feedback[2].note.length === 1000, 'a second change request before approval is allowed and its note is capped at 1000');
  const note = await call('POST', { token: LIVE }, { action: 'note', directionId: '', note: 'Also the phone number changed.', name: 'Kim' });
  ok(note._status === 200 && live().status === 'changes' && live().feedback.length === 4 && live().feedback[3].action === 'note', 'a general note appends and changes no status');
  const noteEmpty = await call('POST', { token: LIVE }, { action: 'note', directionId: '', note: '' });
  ok(noteEmpty._status === 400, 'an empty general note is a 400');
  const ap = await call('POST', { token: LIVE }, { action: 'approve', directionId: 'dB', note: 'Perfect.', name: 'Kim' });
  ok(ap._status === 200 && ap._json.status === 'approved' && live().status === 'approved' && live().approvedDirectionId === 'dB' && !!live().approvedAt, 'approve from changes sets approved, approvedDirectionId and approvedAt');
  ok(live().feedback[live().feedback.length - 1].action === 'approve', 'and appends an approve entry');
  const again = await call('POST', { token: LIVE }, { action: 'approve', directionId: 'dA' });
  ok(again._status === 409 && again._json.error === 'This set is already decided.', `a second approval is a 409 (${bytes(again)})`);
  const chAfter = await call('POST', { token: LIVE }, { action: 'change', directionId: 'dA', note: 'Wait.' });
  ok(chAfter._status === 409 && live().approvedDirectionId === 'dB', 'a change request after approval is a 409 and the pick stands');
  const noteAfter = await call('POST', { token: LIVE }, { action: 'note', directionId: '', note: 'One more thing.' });
  ok(noteAfter._status === 200 && live().status === 'approved', 'a note after approval still lands and the status stays approved');
  const bogus = await call('POST', { token: LIVE }, { action: 'delete', directionId: 'dA', title: 'rewritten', status: 'draft', token: 'cncp_mine_now_abcdefghijklmnop' });
  ok(bogus._status === 400 && live().title === 'Three ways' && live().token === LIVE, 'an unknown action is a 400 and nothing sent alongside is ever written');
  const readBack = await call('GET', { token: LIVE });
  ok(readBack._status === 200 && !JSON.stringify(readBack._json).includes('Bigger, please.'), 'a stored note never comes back to the client page');
}

/* ── The operator sentinel ───────────────────────────────────────────── */
{
  const SENTINEL = 'INJECT';
  const hasSentinel = (v) => { if (!v || typeof v !== 'object') return false; if (Array.isArray(v)) return v.some(hasSentinel); for (const [k, x] of Object.entries(v)) { if (k.startsWith('$') && JSON.stringify(x).includes(SENTINEL)) return true; if (hasSentinel(x)) return true; } return false; };
  for (const [label, method, query, body, allowed] of [
    ['?token', 'GET', { token: { $gt: SENTINEL } }, undefined, [404]],
    ['POST directionId', 'POST', { token: LIVE }, { action: 'approve', directionId: { $ne: SENTINEL } }, [404]],
    ['POST action', 'POST', { token: LIVE }, { action: { $regex: SENTINEL }, directionId: 'dA' }, [400]],
    ['POST note', 'POST', { token: LIVE }, { action: 'change', directionId: 'dA', note: { $gt: SENTINEL } }, [200, 400]],
    ['POST name', 'POST', { token: LIVE }, { action: 'note', directionId: '', note: 'hi', name: { $gt: SENTINEL } }, [200]],
  ]) {
    seed(); _log.length = 0;
    const res = await call(method, query, body);
    ok(!_log.some(e => hasSentinel(e.filter) || hasSentinel(e.update)), `${label}: the operator never reaches a filter or an update`);
    ok(allowed.includes(res._status), `${label}: answers ${allowed.join('/')} (got ${res._status})`);
  }
}

/* ── The rate limit ──────────────────────────────────────────────────── */
{
  seed();
  let last = null; let n = 0;
  for (let i = 0; i < 40; i++) { n = i + 1; last = await call('POST', { token: LIVE }, { action: 'note', directionId: '', note: `note ${i}` }); if (last._status === 429) break; }
  ok(last._status === 429 && n === 31 && last._headers['Retry-After'], `the 31st action in an hour is 429 with Retry-After (stopped at ${n}, ${last._status})`);
  const stillReads = await call('GET', { token: LIVE });
  ok(stillReads._status === 200, 'reads are never limited');
  ok(_stores.settings.every(s => !String(s._id).includes(LIVE)), 'the limiter key never carries the token');
}

/* ── The admin side: a javascript: image is stored empty, the token is minted ─ */
{
  seed();
  const cookie = `vz_admin=${signSession()}`;
  const admin = async (method, body, query = {}) => { const req = { method, query: { r: 'concept-sets', ...query }, body, headers: { cookie, 'x-forwarded-for': '203.0.113.9' }, url: '/api/admin/index', socket: {} }; const res = fakeRes(); await adminIndex(req, res); return res; };
  const made = await admin('POST', { leadId: LEAD, title: 'New', round: 1, token: 'cncp_mine_now_abcdefghijklmnop', status: 'sent', directions: [{ id: 'd1', name: 'x', rationale: '', order: 0, items: [{ id: 'i1', kind: 'logo', image: 'javascript:alert(1)', caption: 'x', order: 0 }, { id: 'i2', kind: 'logo', image: 'https://img.example/ok.png', caption: '', order: 1 }] }] });
  const item = made._json?.item;
  if (!item) console.log("admin POST answered", made._status, JSON.stringify(made._json).slice(0, 200));
  ok(made._status === 200 && item && item.token !== 'cncp_mine_now_abcdefghijklmnop' && /^[A-Za-z0-9_-]{32}$/.test(item.token), `the token is minted server side, never taken from the request (${item?.token})`);
  ok(item.status === 'draft', 'a new set is always a draft');
  ok(item.directions[0].items[0].image === '' && item.directions[0].items[1].image === 'https://img.example/ok.png', 'a javascript: image is stored empty and a real one is kept');
  const dead = await call('GET', { token: item.token });
  ok(dead._status === 404, 'the new draft does not resolve publicly');
  const sent = await admin('PATCH', { id: item._id, set: { status: 'sent', token: 'cncp_mine_now_abcdefghijklmnop' } });
  const doc = _stores.concept_sets.find(s => String(s._id) === String(item._id));
  ok(sent._status === 200 && doc.status === 'sent' && !!doc.sentAt && doc.token === item.token, 'sending stamps sentAt and a token in the PATCH is ignored');
  const pub = await call('GET', { token: item.token });
  ok(pub._status === 200 && pub._json.directions[0].items[0].image === '', 'once sent it resolves, with the bad image still empty');
  const regen = await admin('PATCH', { id: item._id, set: { regenerate: true } });
  ok(regen._status === 200 && doc.token !== item.token && /^[A-Za-z0-9_-]{32}$/.test(doc.token), 'regenerate mints a new token');
  ok((await call('GET', { token: item.token }))._status === 404, 'and the old one is the same 404 on the next call');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing.` : '\nAll concepts endpoint tests pass.');
process.exit(fails ? 1 : 0);
