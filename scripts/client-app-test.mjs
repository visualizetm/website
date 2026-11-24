#!/usr/bin/env node
/* The client app's code door (client app job, milestone 2), against the real handlers on the shared in-memory Mongo
 * (scripts/fake-mongo.js): the weak code rule and its mirror, the setup link's step, setting a code, signing in by the
 * link, a phone or an email, the one 401 for no match, two matches and a wrong code, the lockouts at five and ten and
 * Rob's one push, the per IP limiter, the vz_client cookie (its attributes, its signature over the version, tampering,
 * expiry), Rob's Reset code signing every device out, and no response carrying any part of portal.code. The CRM reads
 * the code's status only, a save carries the code forward, and the backup holds no hash.
 *
 *   node scripts/client-app-test.mjs
 *   API_SRC=/a/cut/copy/of/api node scripts/client-app-test.mjs   (scripts/client-app-guard-proof.mjs) */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'clientapp-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(process.env.API_SRC || path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), `export const _sent = { rob: [], client: [] };
export async function sendPush(db, m, o) { _sent.rob.push({ ...m, now: o?.now }); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }
export async function sendClientPush(db, leadId, m) { _sent.client.push({ leadId: String(leadId), ...m }); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }
export const ownerSubs = (db) => db.collection('push_subscriptions').find({ role: { $ne: 'client' } }).toArray();
export const clientSubs = (db, leadId) => db.collection('push_subscriptions').find({ role: 'client', leadId: String(leadId) }).toArray();
`);

let fails = 0; let passes = 0;
const failed = [];
const ok = (c, m, id = '') => { if (c) { passes++; console.log(`ok   ${m}`); } else { fails++; failed.push(id || m); console.log(`FAIL ${id ? `[${id}] ` : ''}${m}`); } };
process.env.SESSION_SECRET = 'test-secret-not-real';
delete process.env.VERCEL;

const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const { _sent } = await load('_lib/notify.js');
const door = (await load('_routes/app-public.js')).handler;
const showcase = (await load('showcase.js')).default;
const reset = (await load('_routes/client-app.js')).handler;
const callLeads = (await load('_routes/call-leads.js')).handler;
const backup = (await load('_routes/backup.js')).handler;
const plannerDoor = (await load('planner.js')).default;
const portalDoor = (await load('_routes/portal-public.js')).handler;
const adminIndex = (await load('admin/index.js')).default;
const { resolveVars } = await load('_lib/email/vars.js');
const portalMods = await load('_lib/portalModules.js');
const plannerPush = await load('_lib/plannerPush.js');
const session = await load('_lib/clientSession.js');
const codeLib = await load('_lib/clientCode.js');

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { return this; } });
let ipN = 1;
const freshIp = () => `198.51.100.${ipN++}`;
let IP = freshIp();
async function call(fn, method, { query = {}, body, cookie = '', ip = IP, headers = {} } = {}) {
  const res = fakeRes();
  try { await fn({ method, query, body, headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}), ...headers }, url: '/api/app', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.stack || e) }; }
  return res;
}
const app = (method, a, opts = {}) => call(door, method, { ...opts, query: { ...(opts.query || {}), a } });
const cookieOf = (res) => { const c = String(res._headers['Set-Cookie'] || ''); const m = /^vz_client=([^;]*)/.exec(c); return m ? `vz_client=${m[1]}` : ''; };

/* Every door response is kept, and scanned at the end for any part of portal.code. */
const seen = [];
const keep = (r) => { seen.push(r._json); return r; };
const keysDeep = (v, out = new Set()) => { if (Array.isArray(v)) v.forEach(x => keysDeep(x, out)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); } return out; };

const PORTAL = 'prtl_app_token_abcdefghijklmn';
const PLANNER = 'plnr_app_token_abcdefghijklmn';
const PLANNER_ONLY = 'plnr_only_token_abcdefghijklm';
const LEAD = '507f1f77bcf86cd799439051', PLAN = '507f1f77bcf86cd799439052', TWIN_A = '507f1f77bcf86cd799439053', TWIN_B = '507f1f77bcf86cd799439054', OFF = '507f1f77bcf86cd799439055';
const lead = (id) => _stores.call_leads.find(l => String(l._id) === id);
function seed() {
  _reset();
  _sent.rob.length = 0;
  _stores.call_leads = [
    { _id: LEAD, business: 'Kims Cafe', askFor: 'Kim Lee', phone: '(555) 201-3344', email: 'Kim@KimsCafe.example', stage: 'client', showcase: { displayName: 'Kims Cafe' }, portal: { token: PORTAL, views: 0 }, planner: { enabled: true, token: PLANNER } },
    { _id: PLAN, business: 'Plan Only Co', askFor: 'Pat Doe', phone: '555-777-1000', email: 'pat@plan.example', stage: 'client', planner: { enabled: true, token: PLANNER_ONLY } },
    { _id: TWIN_A, business: 'Twin A', askFor: 'Ann', phone: '555 909 1212', email: 'a@twin.example', stage: 'client', portal: { token: 'prtl_twin_a_token_abcdefghijk' } },
    { _id: TWIN_B, business: 'Twin B', askFor: 'Bea', phone: '+1 555 909 1212', email: 'b@twin.example', stage: 'client', portal: { token: 'prtl_twin_b_token_abcdefghijk' } },
    { _id: OFF, business: 'Off Co', askFor: 'Oz', phone: '555 000 1111', stage: 'client', planner: { enabled: false, token: 'plnr_off_token_abcdefghijklm' } },
  ];
  _stores.settings = [];
  _stores.push_subscriptions = [];
}
const setCode = async (token, code, ip = IP) => keep(await app('POST', 'set', { body: { token, code, again: code }, ip }));

console.log('\n1. the weak code rule and its mirror');
{
  ok(fs.readFileSync(path.join(repoRoot, 'src/shared/clientCode.js'), 'utf8') === fs.readFileSync(path.join(apiDst, '_lib/clientCode.js'), 'utf8'), 'api/_lib/clientCode.js is src/shared/clientCode.js byte for byte', 'mirror');
  const repeats = Array.from({ length: 10 }, (_, d) => String(d).repeat(4));
  const up = Array.from({ length: 7 }, (_, d) => [0, 1, 2, 3].map(i => d + i).join(''));
  const down = Array.from({ length: 7 }, (_, d) => [3, 2, 1, 0].map(i => d + i).join(''));
  const list = ['1212', '1004', '2000', '2001', '1010', '1122', '1313', '6969', '2580', '0852'];
  ok(up[0] === '0123' && up[6] === '6789' && down[0] === '3210' && down[6] === '9876', 'the runs are 0123 to 6789 and 3210 to 9876');
  const weak = [...repeats, ...up, ...down, ...list];
  ok(weak.every(c => codeLib.isWeakCode(c)), `every weak code is refused (${weak.length}: four of one digit, the runs both ways, the list)`, 'weak-rule');
  const fine = ['4831', '0247', '9051', '1357', '2468', '7359', '0129', '8642'];
  ok(fine.every(c => !codeLib.isWeakCode(c)), `a code that is none of those is allowed (${fine.join(', ')})`);
  ok(['', '123', '12345', 'abcd', '12 4', null, undefined, 1234].every(c => codeLib.isWeakCode(c)), 'anything that is not four digits is refused as well');
  ok(codeLib.phoneKey('(555) 201-3344') === '5552013344' && codeLib.phoneKey('+1 555 201 3344') === '5552013344' && codeLib.phoneKey('201-3344') === '', 'a phone is its last ten digits, and fewer than ten is no phone');
  ok(codeLib.emailKey('  Kim@KimsCafe.Example ') === 'kim@kimscafe.example' && codeLib.emailKey('not an email') === '', 'an email is lowercased and trimmed');
  ok(codeLib.identifierOf('kim@kimscafe.example')?.kind === 'email' && codeLib.identifierOf('555.201.3344')?.kind === 'phone' && codeLib.identifierOf('hello') === null, 'an identifier is an email with an @, else a phone of ten digits');
}

console.log('\n2. the setup link');
{
  seed();
  const dead = keep(await app('GET', 'token', { query: { token: 'nope_not_a_real_token_00000' } }));
  const bad = keep(await app('GET', 'token', { query: { token: 'x<script>' } }));
  const none = keep(await app('GET', 'token', {}));
  const off = keep(await app('GET', 'token', { query: { token: 'plnr_off_token_abcdefghijklm' } }));
  const bodies = [dead, bad, none, off].map(r => `${r._status} ${JSON.stringify(r._json)}`);
  ok(bodies.every(b => b === '404 {"error":"not found"}'), `an unknown, a malformed, a missing and a switched off token are the same 404 (${[...new Set(bodies)].join(' | ')})`);
  const p = keep(await app('GET', 'token', { query: { token: PORTAL } }));
  const q = keep(await app('GET', 'token', { query: { token: PLANNER_ONLY } }));
  ok(p._status === 200 && p._json.step === 'set' && q._json?.step === 'set', 'a portal link and a planner link with no code yet say set');
  ok(JSON.stringify(Object.keys(p._json).sort()) === '["lock","step"]' && !JSON.stringify(p._json).includes('Kim'), `a token alone says only the step and the lock, nothing about the client (${Object.keys(p._json).join(', ')})`, 'token-data');
  ok(p._headers['Cache-Control'] === 'no-store', 'the door is no-store');
  const routed = keep(await call(showcase, 'GET', { query: { r: 'app', a: 'token', token: PORTAL } }));
  ok(routed._status === 200 && routed._json?.step === 'set', 'api/showcase.js hands r=app to the code door (the /api/app/:action rewrite)');
}

console.log('\n3. setting a code');
{
  seed();
  for (const c of ['1111', '1234', '9876', '2580', '0852']) {
    const r = keep(await app('POST', 'set', { body: { token: PORTAL, code: c, again: c }, ip: freshIp() }));
    ok(r._status === 400 && r._json?.error === 'weak' && !lead(LEAD).portal.code, `${c} is refused as weak and nothing is written`, 'set-weak');
  }
  const mism = keep(await app('POST', 'set', { body: { token: PORTAL, code: '4831', again: '4832' } }));
  ok(mism._status === 400 && mism._json?.error === 'mismatch' && !lead(LEAD).portal.code, 'the second four must be the first four');
  const shape = keep(await app('POST', 'set', { body: { token: PORTAL, code: '48a1', again: '48a1' } }));
  ok(shape._status === 400 && shape._json?.error === 'four digits', 'a code that is not four digits is a 400');
  const unknown = keep(await app('POST', 'set', { body: { token: 'nope_not_a_real_token_00000', code: '4831', again: '4831' } }));
  ok(unknown._status === 404, 'an unknown link cannot set a code');
  const good = await setCode(PORTAL, '4831');
  const stored = lead(LEAD).portal.code || {};
  ok(good._status === 200 && good._json?.ok && good._json.home === 'portal' && good._json.portal === true && good._json.planner === true, 'a good code signs this device in and lands on the portal');
  ok(stored.hash && stored.salt && stored.hash !== '4831' && !JSON.stringify(stored).includes('4831') && stored.version === 1 && stored.fails === 0 && stored.locked === false && stored.lockedUntil === '' && !!stored.setAt, 'portal.code is a scrypt hash and a salt, version 1, no fails, unlocked, never the digits');
  const sc = String(good._headers['Set-Cookie'] || '');
  ok(/^vz_client=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000$/.test(sc) && !/Domain=/i.test(sc), `the cookie is vz_client, HttpOnly, Secure, SameSite=Lax, Path=/, host only, 365 days (${sc.replace(/=[^;]+;/, '=...;')})`, 'cookie-attrs');
  const again = keep(await app('POST', 'set', { body: { token: PORTAL, code: '7359', again: '7359' } }));
  ok(again._status === 409 && codeLibMatches(lead(LEAD).portal.code, '4831'), 'a client who has a code cannot be given another through the link (409, the first code stands)', 'set-once');
  const step = keep(await app('GET', 'token', { query: { token: PLANNER } }));
  ok(step._json?.step === 'signin', 'the planner link of the same client now says sign in');
  const plan = await setCode(PLANNER_ONLY, '0247');
  ok(plan._status === 200 && plan._json.home === 'planner' && plan._json.portal === false, 'a planner only client lands on the planner');
}
function codeLibMatches(stored, code) { return session.codeMatches(stored, code); }

console.log('\n4. the session');
{
  seed();
  const set = await setCode(PORTAL, '4831');
  const ck = cookieOf(set);
  const me = keep(await app('GET', 'me', { cookie: ck }));
  ok(me._status === 200 && me._json?.signedIn === true && me._json.home === 'portal' && me._json.firstName === 'Kim', 'the cookie reads back as signed in, home the portal, first name Kim');
  const anon = keep(await app('GET', 'me', {}));
  ok(anon._status === 200 && anon._json?.signedIn === false && JSON.stringify(Object.keys(anon._json).sort()) === '["signedIn","textRob"]' && anon._json.textRob === '', 'no cookie is signed out, and nothing else (no number for Rob in Settings yet)');
  _stores.settings.push({ _id: 'profile', phone: '(555) 010-0100', email: 'rob@studio.example' });
  const anon2 = keep(await app('GET', 'me', {}));
  ok(anon2._json?.textRob === '5550100100' && !JSON.stringify(anon2._json).includes('studio.example'), "signed out, the sign in gets Rob's own number for the Forgot it text, and nothing else from Settings");
  const [id, v, exp, sig] = ck.slice('vz_client='.length).split('.');
  const tamperId = keep(await app('GET', 'me', { cookie: `vz_client=${PLAN}.${v}.${exp}.${sig}` }));
  const tamperExp = keep(await app('GET', 'me', { cookie: `vz_client=${id}.${v}.${Number(exp) + 1000}.${sig}` }));
  const tamperSig = keep(await app('GET', 'me', { cookie: `vz_client=${id}.${v}.${exp}.${sig.slice(0, -2)}xx` }));
  ok([tamperId, tamperExp, tamperSig].every(r => r._json?.signedIn === false), 'a cookie with another lead, another expiry or a broken signature is no session', 'cookie-tamper');
  const past = session.signClient(LEAD, 1, -1);
  ok((await app('GET', 'me', { cookie: `vz_client=${past}` }))._json?.signedIn === false, 'an expired cookie is no session');
  const asAdmin = keep(await app('GET', 'me', { cookie: `vz_admin=${exp}.${sig}` }));
  ok(asAdmin._json?.signedIn === false, "the admin's cookie is not a client session");
  ok(session.verifyClient({ headers: { cookie: ck } })?.leadId === LEAD, 'verifyClient reads the cookie with no database');
  const out = keep(await app('POST', 'signout', { cookie: ck }));
  ok(out._status === 200 && /^vz_client=; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=0$/.test(String(out._headers['Set-Cookie'])), 'sign out clears the cookie on this device');
}

console.log('\n5. signing in');
{
  seed();
  await setCode(PORTAL, '4831');
  await setCode('prtl_twin_a_token_abcdefghijk', '0247');
  await setCode('prtl_twin_b_token_abcdefghijk', '9051');
  IP = freshIp();
  const viaToken = keep(await app('POST', 'signin', { body: { token: PLANNER, code: '4831' } }));
  ok(viaToken._status === 200 && cookieOf(viaToken) && viaToken._json.home === 'portal', 'the right code on a setup link signs in');
  const viaPhone = keep(await app('POST', 'signin', { body: { identifier: '+1 555.201.3344', code: '4831' } }));
  ok(viaPhone._status === 200 && cookieOf(viaPhone), 'the right code with the phone, written another way, signs in (last ten digits)', 'signin-phone');
  const viaEmail = keep(await app('POST', 'signin', { body: { identifier: '  KIM@kimscafe.EXAMPLE ', code: '4831' } }));
  ok(viaEmail._status === 200 && cookieOf(viaEmail), 'the right code with the email, in any case and with spaces, signs in');
  const wrong = keep(await app('POST', 'signin', { body: { identifier: '5552013344', code: '7359' } }));
  const unknownPhone = keep(await app('POST', 'signin', { body: { identifier: '555 123 9999', code: '4831' } }));
  const unknownEmail = keep(await app('POST', 'signin', { body: { identifier: 'nobody@nowhere.example', code: '4831' } }));
  const twins = keep(await app('POST', 'signin', { body: { identifier: '5559091212', code: '0247' } }));
  const noCodeYet = keep(await app('POST', 'signin', { body: { identifier: '555-777-1000', code: '0247' } }));
  const junk = keep(await app('POST', 'signin', { body: { identifier: 'hello', code: '4831' } }));
  const answers = [wrong, unknownPhone, unknownEmail, twins, noCodeYet, junk].map(r => `${r._status} ${JSON.stringify(r._json)} ${r._headers['Set-Cookie'] ? 'cookie' : ''}`);
  ok(answers.every(a => a === answers[0]) && answers[0].startsWith('401 {"error":"did not match"}'), `a wrong code, an unknown phone, an unknown email, a phone two clients share, a client with no code and junk are one answer (${[...new Set(answers)].join(' | ')})`, 'same-401');
  /* The same work: a lookup that finds no one still pays for a scrypt. Medians of five, the miss at least 40% of the wrong code's time. */
  const time = async (body) => { const t = []; for (let i = 0; i < 5; i++) { const s = process.hrtime.bigint(); await app('POST', 'signin', { body, ip: freshIp() }); t.push(Number(process.hrtime.bigint() - s) / 1e6); } return t.sort((a, b) => a - b)[2]; };
  const tMiss = await time({ identifier: '555 123 9999', code: '4831' });
  const tWrong = await time({ token: 'prtl_twin_a_token_abcdefghijk', code: '7359' });
  ok(tMiss >= tWrong * 0.4, `no match costs the same scrypt as a wrong code (median ${tMiss.toFixed(1)} ms beside ${tWrong.toFixed(1)} ms)`, 'same-work');
  seed();
  await setCode(PORTAL, '4831');
  IP = freshIp();
  for (let i = 0; i < 3; i++) await app('POST', 'signin', { body: { token: PORTAL, code: '7359' } });
  ok(lead(LEAD).portal.code.fails === 3, 'three wrong codes count three');
  await app('POST', 'signin', { body: { token: PORTAL, code: '4831' } });
  ok(lead(LEAD).portal.code.fails === 0, 'a right code clears the count', 'fails-clear');
}

console.log('\n6. the lockouts');
{
  seed();
  await setCode(PORTAL, '4831');
  IP = freshIp();
  const wrongs = [];
  for (let i = 0; i < 4; i++) wrongs.push(keep(await app('POST', 'signin', { body: { identifier: '5552013344', code: '7359' } })));
  ok(wrongs.every(r => r._status === 401), 'four wrong in a row are four plain 401s');
  const fifth = keep(await app('POST', 'signin', { body: { token: PORTAL, code: '7359' } }));
  const until = Date.parse(lead(LEAD).portal.code.lockedUntil || '') || 0;
  ok(fifth._status === 423 && fifth._json?.error === 'locked' && fifth._json.hard === false && fifth._json.minutes === 15 && until > Date.now() + 14 * 60000 && until <= Date.now() + 15 * 60000, `the fifth wrong in a row locks the code for fifteen minutes (${fifth._status} ${JSON.stringify(fifth._json)})`, 'soft-lock');
  const rightDuring = keep(await app('POST', 'signin', { body: { token: PORTAL, code: '4831' } }));
  ok(rightDuring._status === 423 && !rightDuring._headers['Set-Cookie'], 'the right code during the lock does not sign in, and says how long', 'soft-lock-holds');
  const phoneWrong = keep(await app('POST', 'signin', { body: { identifier: '5552013344', code: '7359' } }));
  ok(phoneWrong._status === 401 && JSON.stringify(phoneWrong._json) === '{"error":"did not match"}' && lead(LEAD).portal.code.fails === 5, 'by phone, a wrong code during the lock is the same 401, and a try during a lock is not counted');
  const phoneRight = keep(await app('POST', 'signin', { body: { identifier: '5552013344', code: '4831' } }));
  ok(phoneRight._status === 423 && phoneRight._json.minutes >= 14, 'by phone, only the right code learns of the lock and the minutes left');
  const link = keep(await app('GET', 'token', { query: { token: PORTAL } }));
  ok(link._json?.step === 'signin' && link._json.lock?.hard === false && link._json.lock.minutes >= 14, 'the setup link says locked, with the minutes left');
  lead(LEAD).portal.code.lockedUntil = new Date(Date.now() - 1000).toISOString();
  let last = null;
  for (let i = 6; i <= 9; i++) last = keep(await app('POST', 'signin', { body: { token: PORTAL, code: '7359' } }));
  ok(last._status === 401 && lead(LEAD).portal.code.fails === 9 && !lead(LEAD).portal.code.locked, 'once the fifteen minutes are up, wrong six to nine are counted and the code is still open');
  ok(_sent.rob.length === 0, 'no push to Rob before the tenth');
  const tenth = keep(await app('POST', 'signin', { body: { token: PORTAL, code: '7359' } }));
  ok(tenth._status === 423 && tenth._json.hard === true && lead(LEAD).portal.code.locked === true, `the tenth wrong in a row locks it until Rob resets it (${tenth._status} ${JSON.stringify(tenth._json)})`, 'hard-lock');
  const push = _sent.rob[0] || {};
  ok(_sent.rob.length === 1 && push.category === 'client' && /Kims Cafe/.test(push.title) && /\/clients\//.test(push.url) && !/4831|7359/.test(JSON.stringify(push)), `Rob gets one push, category client, naming the client and no code (${push.title})`, 'hard-push');
  const rightAfter = keep(await app('POST', 'signin', { body: { token: PORTAL, code: '4831' } }));
  const phoneAfter = keep(await app('POST', 'signin', { body: { identifier: 'kim@kimscafe.example', code: '7359' } }));
  ok(rightAfter._status === 423 && rightAfter._json.hard && phoneAfter._status === 401 && _sent.rob.length === 1, 'the right code does not open a hard lock, more tries push nothing more', 'hard-lock-holds');
}

console.log('\n7. the per IP limiter');
{
  seed();
  await setCode(PORTAL, '4831', freshIp());
  const ip = freshIp();
  let r = null;
  for (let i = 0; i < 20; i++) r = await app('POST', 'signin', { body: { identifier: `555 300 ${String(1000 + i)}`, code: '4831' }, ip });
  ok(r._status === 401, 'twenty tries from one address in an hour are answered');
  const over = keep(await app('POST', 'signin', { body: { token: PORTAL, code: '4831' }, ip }));
  ok(over._status === 429 && over._headers['Retry-After'] && !over._headers['Set-Cookie'], 'the twenty first is a 429 with Retry-After, even with the right code', 'ip-limit');
  const other = keep(await app('POST', 'signin', { body: { token: PORTAL, code: '4831' }, ip: freshIp() }));
  ok(other._status === 200, 'another address is not held back');
  const sip = freshIp();
  for (let i = 0; i < 20; i++) await app('POST', 'set', { body: { token: 'nope_not_a_real_token_00000', code: '4831', again: '4831' }, ip: sip });
  const setOver = keep(await app('POST', 'set', { body: { token: PLANNER_ONLY, code: '0247', again: '0247' }, ip: sip }));
  ok(setOver._status === 429 && !lead(PLAN).portal?.code, 'the set door has the same twenty an hour per address', 'ip-limit-set');
  ok(_stores.settings.filter(d => /^rate:app(set|sign):/.test(String(d._id))).every(d => !JSON.stringify(d).includes('198.51.100')), 'the limiter keys hold a hash of the address, never the address');
}

console.log('\n8. Reset code');
{
  seed();
  const first = await setCode(PORTAL, '4831');
  const ck1 = cookieOf(first);
  const phone = keep(await app('POST', 'signin', { body: { identifier: '5552013344', code: '4831' } }));
  const ck2 = cookieOf(phone);
  lead(LEAD).portal.code.fails = 10; lead(LEAD).portal.code.locked = true;
  const r = await call(reset, 'POST', { body: { action: 'reset-code', id: LEAD } });
  const code = lead(LEAD).portal.code;
  ok(r._status === 200 && code.hash === '' && code.salt === '' && code.version === 2 && code.fails === 0 && code.locked === false, 'Reset code clears the code, unlocks it and bumps the version');
  ok(JSON.stringify(Object.keys(r._json.code).sort()) === '["fails","locked","lockedUntil","set","setAt"]' && r._json.code.set === false && !('hash' in r._json.code) && !('version' in r._json.code), 'its answer is the status, never the hash, the salt or the version');
  const [m1, m2] = [await app('GET', 'me', { cookie: ck1 }), await app('GET', 'me', { cookie: ck2 })];
  ok(m1._json?.signedIn === false && m2._json?.signedIn === false, 'every device signed in before is signed out', 'reset-signout');
  ok((await app('GET', 'token', { query: { token: PORTAL } }))._json?.step === 'set', 'the link says set again');
  const second = await setCode(PORTAL, '7359');
  const ck3 = cookieOf(second);
  ok(second._status === 200 && lead(LEAD).portal.code.version === 3 && (await app('GET', 'me', { cookie: ck3 }))._json?.signedIn === true && (await app('GET', 'me', { cookie: ck1 }))._json?.signedIn === false, 'the new code signs in at version 3 and the old cookie stays dead');
  /* The signature covers the version: an old cookie relabelled with the stored version must not verify. */
  const [id, , exp, sig] = ck1.slice('vz_client='.length).split('.');
  const relabelled = await app('GET', 'me', { cookie: `vz_client=${id}.3.${exp}.${sig}` });
  ok(relabelled._json?.signedIn === false, 'an old cookie with its version changed to the stored one does not verify (the version is signed)', 'cookie-version');
  ok((await call(reset, 'POST', { body: { action: 'reset-code', id: 'nope' } }))._status === 404 && (await call(reset, 'POST', { body: { action: 'reset-code' } }))._status === 400, 'Reset code on no client is a 404, with no id a 400');
}

console.log('\n9. the CRM and the backup');
{
  seed();
  await setCode(PORTAL, '4831');
  const list = await call(callLeads, 'GET', {});
  const row = (list._json?.items || []).find(l => String(l._id) === LEAD);
  ok(row && row.portal.code && row.portal.code.set === true && !('hash' in row.portal.code) && !('salt' in row.portal.code) && !('version' in row.portal.code), 'the CRM reads the code as its status only: set, when, the lock', 'crm-read');
  const hash = lead(LEAD).portal.code.hash;
  await call(callLeads, 'PATCH', { body: { id: LEAD, set: { portal: { hours: 'Mon to Fri', code: { hash: 'x', salt: 'y', version: 99, locked: true } } } } });
  const after = lead(LEAD).portal.code || {};
  ok(after.hash === hash && after.version === 1 && after.locked === false && lead(LEAD).portal.hours === 'Mon to Fri', 'a portal save carries the code forward and never takes one from the request', 'crm-carry');
  const b = await call(backup, 'GET', {});
  const body = String(b._body || '');
  ok(b._status === 200 && body.includes('Kims Cafe') && !body.includes(hash) && !body.includes(lead(LEAD).portal.code.salt), 'the backup holds the status of a code, never its hash or salt', 'backup');
}

console.log('\n10. the data doors read the cookie (milestone 3)');
{
  seed();
  const set = await setCode(PORTAL, '4831');
  const ck = cookieOf(set);
  const inStep = keep(await app('GET', 'token', { query: { token: PLANNER }, cookie: ck }));
  ok(inStep._status === 200 && inStep._json?.step === 'in' && inStep._json.lock === null, "a setup link opened on a device already signed in as that client goes straight in ('in')");
  const otherStep = keep(await app('GET', 'token', { query: { token: PLANNER_ONLY }, cookie: ck }));
  ok(otherStep._json?.step === 'set', "another client's link on that device still asks for that client's code");
  const alonePlanner = keep(await call(plannerDoor, 'GET', { query: { token: PLANNER } }));
  const alonePortal = keep(await call(portalDoor, 'GET', { query: { token: PORTAL } }));
  const aloneWrite = keep(await call(plannerDoor, 'POST', { query: { token: PLANNER }, body: { action: 'alerts', alerts: { review: false } } }));
  ok([alonePlanner, alonePortal, aloneWrite].every(r => r._status === 401 && JSON.stringify(r._json) === '{"error":"sign in"}') && lead(LEAD).planner.alerts?.review !== false, 'a token alone reads and writes nothing on the planner or the portal: 401 { error: sign in }', 'token-alone');
  const withPlanner = keep(await call(plannerDoor, 'GET', { cookie: ck }));
  const withPortal = keep(await call(portalDoor, 'GET', { cookie: ck }));
  ok(withPlanner._status === 200 && withPlanner._json?.client?.firstName === 'Kim' && withPortal._status === 200 && withPortal._json?.client && withPortal._json.unlocked === true, 'the cookie alone reads the planner and the portal, unlocked');
  const otherSet = await setCode(PLANNER_ONLY, '0247');
  const ck2 = cookieOf(otherSet);
  const mixed = keep(await call(plannerDoor, 'GET', { query: { token: PLANNER }, cookie: ck2 }));
  ok(mixed._status === 200 && mixed._json?.client?.firstName === 'Pat', "the lead is the cookie's, never the token's: Pat's cookie with Kim's token reads Pat", 'cookie-wins');
  const noPortal = keep(await call(portalDoor, 'GET', { cookie: ck2 }));
  ok(noPortal._status === 404 && JSON.stringify(noPortal._json) === '{"error":"not found"}', "a signed in client with no portal is the portal's 404");
  lead(LEAD).deleted = true;
  const [gp, gq, gm] = [keep(await call(plannerDoor, 'GET', { cookie: ck })), keep(await call(portalDoor, 'GET', { cookie: ck })), keep(await app('GET', 'me', { cookie: ck }))];
  ok(gp._status === 404 && gq._status === 404 && gm._json?.signedIn === false, 'a deleted record is the same 404 on both doors, and the device reads as signed out');
  delete lead(LEAD).deleted;
  lead(LEAD).planner.enabled = false;
  ok(keep(await call(plannerDoor, 'GET', { cookie: ck }))._status === 404, 'a signed in client whose planner is switched off is the 404');
}

console.log('\n11. links, pushes and Rob\'s previews (milestone 5)');
{
  seed();
  const L = () => lead(LEAD);
  ok(portalMods.CLIENT_APP_BASE === 'https://app.visualizeclients.com' && portalMods.portalUrl(L()) === `https://app.visualizeclients.com/c/${PORTAL}`, 'the setup link Rob sends is the app host plus the portal token');
  const before = resolveVars({ lead: L() });
  ok(before.portalLink === `https://app.visualizeclients.com/c/${PORTAL}` && before.plannerLink === `https://app.visualizeclients.com/planner/${PLANNER}`, 'an email before the client has a code carries the setup link (the only token an email ever carries)', 'email-setup-link');
  await setCode(PORTAL, '4831');
  const after = resolveVars({ lead: L() });
  ok(after.portalLink === 'https://app.visualizeclients.com/' && after.plannerLink === 'https://app.visualizeclients.com/planner' && !JSON.stringify(after).includes(PORTAL) && !JSON.stringify(after).includes(PLANNER), 'once the code is set, an email carries the app itself, no token', 'email-no-token');
  ok(portalMods.portalPath(L()) === 'https://app.visualizeclients.com/' && portalMods.plannerLink(L()) === '/planner', "the way back is the panel's home and the portal's planner card is the app's own /planner, no token");
  ok(plannerPush.SITE === 'https://app.visualizeclients.com', 'the planner pushes open the app host');
  /* Rob's previews: the exact answer of the client's door, read by the admin, stamping nothing, never a client cookie. */
  const ck = cookieOf(await app('POST', 'signin', { body: { token: PORTAL, code: '4831' }, ip: freshIp() }));
  const own = keep(await call(portalDoor, 'GET', { cookie: ck }));
  const ownP = keep(await call(plannerDoor, 'GET', { cookie: ck }));
  _stores.settings = _stores.settings.filter(d => !/^rate:pview:/.test(String(d._id))); // the hour's view limit cleared, so a preview that stamped would show
  L().planner.lastViewedAt = '';
  const stamp = JSON.stringify({ v: L().portal.views, a: L().portal.activity, last: L().portal.lastViewedAt, paid: L().portal.lastPaidSeenAt, pl: L().planner.lastViewedAt });
  const adminCookie = `vz_admin=${(await load('_lib/auth.js')).signSession()}`;
  const viaAdmin = async (query, cookie = adminCookie) => { const res = { _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { return this; } }; await adminIndex({ method: 'GET', query: { r: 'client-app', ...query }, headers: { cookie, 'x-forwarded-for': '203.0.113.5' }, url: '/api/admin/client-app', socket: {} }, res); return res; };
  const prev = await viaAdmin({ view: 'portal', id: LEAD });
  ok(prev._status === 200 && JSON.stringify(prev._json) === JSON.stringify({ ...own._json, paid: prev._json.paid }), "the portal preview is exactly the client's own answer", 'preview-same');
  const pp = await viaAdmin({ view: 'planner', id: LEAD });
  ok(pp._status === 200 && JSON.stringify(pp._json) === JSON.stringify(ownP._json), "the planner preview is exactly the client's own month");
  const stamp2 = JSON.stringify({ v: L().portal.views, a: L().portal.activity, last: L().portal.lastViewedAt, paid: L().portal.lastPaidSeenAt, pl: L().planner.lastViewedAt });
  ok(stamp2 === stamp, 'a preview stamps nothing: no view, no activity, no lastViewedAt, no paid thanks moved', 'preview-no-stamp');
  ok(!prev._headers['Set-Cookie'] && !pp._headers['Set-Cookie'] && prev._headers['Cache-Control'] === 'no-store', 'a preview never sets a cookie for Rob, and is no-store', 'preview-no-cookie');
  ok(!keysDeep([prev._json, pp._json]).has('hash') && !keysDeep([prev._json, pp._json]).has('salt'), 'a preview carries no part of the code');
  const anon = await viaAdmin({ view: 'portal', id: LEAD }, '');
  const asClient = await viaAdmin({ view: 'portal', id: LEAD }, ck);
  ok(anon._status === 401 && asClient._status === 401, "a preview needs the admin's cookie: none, or a client's, is 401", 'preview-admin');
  ok((await viaAdmin({ view: 'portal', id: PLAN }))._status === 404 && (await viaAdmin({ view: 'planner', id: TWIN_A }))._status === 404 && (await viaAdmin({ view: 'other', id: LEAD }))._status === 400, "a client with no portal, or no planner, is the door's own 404; an unknown view is a 400");
}

console.log('\n12. nothing leaves with the code');
{
  const secret = ['hash', 'salt', 'version', 'fails', 'lockedUntil', 'locked'];
  ok(JSON.stringify(session.CODE_SECRET_KEYS) === JSON.stringify(secret), `the never-send list is ${secret.join(', ')}`);
  const found = [...keysDeep(seen)].filter(k => secret.includes(k));
  ok(seen.length > 40 && found.length === 0, `no response from the code door carries a key of portal.code (${seen.length} responses, ${found.join(', ') || 'none'})`, 'never-send');
  const text = JSON.stringify(seen);
  ok(!/"4831"|"7359"|"0247"/.test(text), 'no response carries a code');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.${failed.length ? ` Failed: ${[...new Set(failed)].join(', ')}` : ''}`);
process.exit(fails ? 1 : 0);
