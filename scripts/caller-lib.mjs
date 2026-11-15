/* The caller walls (Billy's Call Room, part 1; docs/SECURITY-AUDIT.md, "The caller"): one module, three users, the same
 * shape as scripts/docs-lib.mjs.
 *   scripts/caller-test.mjs          runs every check against the real api/ and public/sw.js
 *   scripts/security-test.mjs        runs the same checks as part of the security gate
 *   scripts/caller-guard-proof.mjs   runs them against a copy with ONE wall cut out and expects that wall's checks to fail
 * runCaller({ api, sw }) copies api into a temp tree with _lib/mongo.js swapped for the in-memory fake, loads the real admin
 * dispatcher (api/admin/index.js, as in production: /api/caller/<action> is its ?r=caller&a=<action>) and returns
 * [{ id, guard, desc, pass }]. A check with a guard is one wall; the guard proof cuts that wall and requires those checks to fail. */
import fs from 'fs';
import path from 'path';
import vm from 'node:vm';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');

export async function runCaller({ api = path.join(repoRoot, 'api'), sw = path.join(repoRoot, 'public', 'sw.js') } = {}) {
  const tmpBase = path.join(repoRoot, '.tmp-verify');
  fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'caller-'));
  const apiDst = path.join(tmp, 'api');
  fs.cpSync(api, apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  /* The nearest node_modules wins, so this stub stands in for web-push (as in notify-test): a booking's push is read back from it. */
  const stubDir = path.join(tmp, 'node_modules', 'web-push'); fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify({ name: 'web-push', type: 'module', main: 'index.js', version: '0.0.0-test' }));
  fs.writeFileSync(path.join(stubDir, 'index.js'), 'export const calls = []; export default { setVapidDetails() {}, async sendNotification(sub, payload, opts) { calls.push({ sub, payload, opts }); return { statusCode: 201 }; } };\n');
  const pushStub = await import(pathToFileURL(path.join(stubDir, 'index.js')).href);
  process.env.SESSION_SECRET = 'test-not-real';
  delete process.env.VERCEL; delete process.env.CALENDLY_TOKEN; delete process.env.CALENDLY_PAT;
  const envBefore = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
  process.env.VAPID_PUBLIC_KEY = 'test-public'; process.env.VAPID_PRIVATE_KEY = 'test-private';
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const adminIndex = (await load('admin/index.js')).default;
  const auth = await load('_lib/auth.js');
  const view = await load('_lib/callerView.js');
  const srvLists = await load('_lib/lists.js');
  const cliLists = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'lists.js')).href);
  const { callOutcomeSet } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'callOutcome.js')).href);
  const roomLib = await import(pathToFileURL(path.join(repoRoot, 'src', 'room', 'roomLib.js')).href);
  const zone = await load('_lib/zone.js');

  const out = [];
  const check = (id, guard, desc, pass) => out.push({ id, guard, desc, pass: !!pass });
  /* A section that throws is a failed check of its own, never a thrown run: the guard proof stands on each wall's own check failing. */
  let sectionNo = 0;
  const section = async (fn) => { sectionNo++; const no = sectionNo; try { await fn(); } catch (e) { check(`section-${no}-ran`, null, `section ${no} of the checks ran to its end (${String(e?.message || e).slice(0, 80)})`, false); } };

  const L = (i) => `507f1f77bcf86cd7994391${String(i).padStart(2, '0')}`;
  const LIST = (i) => `507f1f77bcf86cd7994392${String(i).padStart(2, '0')}`;
  const NOW = Date.now(); const DAY = 864e5;
  const FORBID = 'FORBIDDEN-VALUE';
  /* A lead that carries every field the admin's sanitize knows, each forbidden one holding the sentinel. */
  const fullLead = (over = {}) => ({
    _id: L(1), business: 'Kims Cafe', industry: 'Cafe', descriptor: `${FORBID} descriptor`, phone: '(302) 555-0100', phoneNote: `${FORBID} phone note`, email: `${FORBID}@kims.example`, area: 'Dover',
    serviceInterest: `${FORBID} interest`, sourceId: 'gmaps:kims', source: 'import', notes: `${FORBID} Rob's notes`, askFor: 'Kim', bestWindow: 'Tue to Sat, 7 to 3', callbackAt: '', priority: 'warm', callStatus: 'not-called',
    angle: 'Your reviews are strong and the brand online does not match them yet.', beforeYouDial: ['Check the sign out front'],
    script: { confirm: 'Is this Kim?', intro: 'Hey Kim, quick one.', homework: 'I looked you up.', question: 'Who runs the site?', likelyAnswers: [{ say: 'My nephew', respond: 'Makes sense.' }], hook: 'I made concepts.', ask: 'Two times.' },
    objections: [{ say: 'Too pricey', respond: 'Fair.' }], close: { lockIt: 'Perfect.', ifNo: 'No problem.', noAnswer: 'Voicemail line.' },
    afterCall: { meeting: `${FORBID} meeting`, email: `${FORBID}@after.example`, whatTheySaid: `${FORBID} what they said to Rob`, nextAction: `${FORBID} next`, goal: `${FORBID} goal`, cell: FORBID, closer: { why: `${FORBID} why`, goal: `${FORBID} closer goal`, pain: [{ tried: FORBID }] } },
    intel: { accomplishments: ['4.8 stars on 212 reviews'], gaps: ['The site is dead (404)'], dropLines: ['Best cold brew in Dover'] },
    socials: { website: 'https://kims.example', instagram: 'https://instagram.com/kimscafe', facebook: `https://facebook.com/${FORBID}` },
    callLog: [{ at: new Date(NOW - 3 * DAY).toISOString(), outcome: 'no-answer', note: `${FORBID} Rob's call note`, meeting: `${FORBID}`, email: `${FORBID}@log.example` }, { at: new Date(NOW - DAY).toISOString(), outcome: 'callback', note: 'Billy heard: call after 2', meeting: '', email: '', by: 'billy' }],
    stage: 'lead', meeting: { date: '2026-12-01', time: '10:00', type: 'call', location: `${FORBID} place` }, conceptsOffered: FORBID, address: `${FORBID} street`,
    concepts: [{ id: 'c1', label: `${FORBID} concept`, status: 'planned', link: `https://x.example/${FORBID}` }], gamePlan: [{ serviceId: 'logo', checked: true, note: `${FORBID} plan` }], servicesPlanned: [FORBID],
    pricingOptions: [{ id: 'o1', packageId: 'web-essentials', price: 500, note: `${FORBID} price note`, label: FORBID }], conceptsTracker: { items: [{ label: FORBID, done: false }], demoUrl: `https://d.example/${FORBID}` }, prepNotes: `${FORBID} prep`,
    checklists: [{ id: 'cl', name: 'Tasks', items: [{ id: 't1', text: `${FORBID} task` }] }], clientSince: '', mergedInto: '', calendlyEventUri: `https://api.calendly.com/${FORBID}`,
    purchases: [{ label: `${FORBID} purchase`, amount: 1200, at: '2026-01-01' }], referredBy: { code: FORBID, leadId: FORBID, business: FORBID }, links: { website: `https://l.example/${FORBID}` },
    brand: { primary: FORBID, notes: `${FORBID} brand` }, showcase: { published: false, slug: FORBID, blurb: FORBID }, planner: { enabled: true, token: `${FORBID}-planner-token` }, retainer: { amount: 300, planId: FORBID },
    clientStatus: '', portal: { token: `${FORBID}-portal-token`, pin: FORBID }, reviews: { latest: { count: 212, rating: 4.8, at: '2026-10-01' }, googleLink: `https://g.example/${FORBID}`, testimonials: [{ id: 'r1', quote: FORBID }], visualize: { token: `${FORBID}-review-token` } },
    contactLog: [{ type: 'call', at: '2026-10-01', note: `${FORBID} contact note` }], bookedOutcome: { result: 'lost', reason: FORBID }, cronRules: {}, deal: { packageId: FORBID, invoices: [{ id: 'i1', label: `${FORBID} invoice`, amount: 500, status: 'sent' }], quote: { total: 1200, lines: [{ label: FORBID, price: 500 }] } },
    nurture: null, score: 80, listId: '', nextAction: { kind: 'call', label: `${FORBID} next action`, dueAt: '', auto: false }, declined: null, createdAt: new Date(NOW - 5 * DAY), updatedAt: new Date(NOW - DAY), ...over,
  });
  const plain = (i, business, over = {}) => ({ _id: L(i), business, industry: 'Barber', area: 'Dover', phone: '(302) 555-01' + String(i).padStart(2, '0'), askFor: '', stage: 'lead', callStatus: 'not-called', callLog: [], socials: {}, intel: {}, score: 40, listId: '', createdAt: new Date(NOW - i * 3600e3), ...over });

  function seed() {
    _reset();
    _stores.call_leads = [
      fullLead(),
      plain(2, 'Triage One', { stage: 'triage', score: 70 }),
      plain(3, 'Triage Two', { stage: 'triage', score: 55 }),
      plain(4, 'On Robs List', { listId: LIST(1) }),
      plain(5, 'On Billys List', { listId: LIST(2) }),
      plain(6, 'Booked Co', { stage: 'booked', callStatus: 'booked', meeting: { date: '2026-12-02', time: '11:00' }, bookedBy: { who: 'billy', at: new Date(NOW - 2 * DAY).toISOString() }, notes: `${FORBID} booked notes`, deal: { invoices: [] } }),
      plain(7, 'Deal Co', { stage: 'deal', bookedBy: { who: 'billy', at: new Date(NOW - 9 * DAY).toISOString() }, deal: { invoices: [{ id: 'd1', label: `${FORBID} deposit`, amount: 500, status: 'sent', sentAt: '2026-11-01' }] } }),
      plain(8, 'Client Co', { stage: 'client' }),
      plain(9, 'Declined Co', { stage: 'declined', declined: { reason: 'budget', note: '', at: '' } }),
      /* An older record: no stage field, booked on the call. normalizeStage reads it as booked. */
      { _id: L(10), business: 'Old Booked', phone: '', callStatus: 'booked', callLog: [{ at: '2026-01-01', outcome: 'booked', note: FORBID }], socials: {}, intel: {}, createdAt: new Date(NOW - 40 * DAY) },
      plain(11, 'Nurture Co', { stage: 'nurture', nurture: { until: '2027-01-01', reason: 'Later' } }),
      plain(12, 'Free Lead'),
      plain(13, 'Deleted Co', { deleted: true }),
    ];
    _stores.lists = [
      { _id: LIST(1), name: 'Robs Tuesday', target: 25, window: 'any', leadIds: [L(4)], status: 'open', system: false, createdAt: new Date(NOW - 3 * DAY), updatedAt: new Date() },
      { _id: LIST(2), name: 'Billys barbers', target: 5, window: 'any', leadIds: [L(5)], status: 'open', system: false, createdBy: 'billy', callerId: 'billy', createdAt: new Date(NOW - 2 * DAY), updatedAt: new Date() },
      { _id: LIST(3), name: 'Callbacks due', target: 500, window: 'any', leadIds: [], status: 'open', system: true, createdAt: new Date(NOW - 9 * DAY), updatedAt: new Date() },
      { _id: LIST(4), name: 'Closed list', target: 25, window: 'any', leadIds: [], status: 'done', system: false, createdAt: new Date(NOW - 9 * DAY), updatedAt: new Date() },
    ];
    _stores.settings = []; _stores.team = []; _stores.team_activity = []; _stores.projects = []; _stores.concept_sets = []; _stores.submissions = []; _stores.orders = []; _stores.concept_packs = []; _stores.docs = []; _stores.stripe_events = [];
  }

  const fakeRes = () => ({ _status: 200, _json: null, _body: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; return this; }, getHeader(k) { return this._headers[k]; }, end() { this.headersSent = true; return this; } });
  const adminCookie = `vz_admin=${auth.signSession()}`;
  let ip = 10;
  const raw = async (r, method, { a, body, query = {}, cookie = '', sameIp = false } = {}) => {
    const req = { method, query: { r, ...(a ? { a } : {}), ...query }, body, headers: { ...(cookie ? { cookie } : {}), 'x-forwarded-for': sameIp ? '198.51.100.200' : `198.51.100.${(ip = (ip % 200) + 1)}` }, url: `/api/admin/index?r=${r}`, socket: {} };
    const res = fakeRes();
    try { await adminIndex(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
    return res;
  };
  const admin = (r, method, opts = {}) => raw(r, method, { cookie: adminCookie, ...opts });
  let billyCookie = '';
  const billy = (method, a, body, opts = {}) => raw('caller', method, { a, body, cookie: billyCookie, ...opts });
  const bytes = (res) => `${res._status} ${JSON.stringify(res._json ?? res._body)}`;
  const lead = (i) => _stores.call_leads.find(d => String(d._id) === L(i));
  const list = (i) => _stores.lists.find(d => String(d._id) === LIST(i));
  const rows = (kind) => _stores.team_activity.filter(r => !kind || r.kind === kind);
  const keysDeep = (v, acc = new Set()) => { if (Array.isArray(v)) v.forEach(x => keysDeep(x, acc)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { acc.add(k); keysDeep(x, acc); } return acc; };
  const cookieOf = (res) => String(res._headers['Set-Cookie'] || '').split(';')[0];

  /* Set Billy up the way Rob does (Settings > Team > Billy), then sign him in. Returns the passcode shown once. */
  async function setUp() {
    seed();
    await admin('team', 'PATCH', { body: { set: { email: 'Billy@Example.com', name: 'Billy' } } });
    const reset = await admin('team', 'POST', { body: { action: 'reset-passcode' } });
    const passcode = reset._json?.passcode || '';
    const login = await raw('caller-door', 'POST', { a: 'login', body: { email: 'billy@example.com', passcode } });
    billyCookie = cookieOf(login);
    return { passcode, reset, login };
  }

  /* ── 1. Sign in, the cookie, the passcode ───────────────────────────── */
  await section(async () => {
    const { passcode, login } = await setUp();
    const stored = _stores.team[0] || {};
    check('login-ok', null, 'the right email and passcode sign Billy in and set vz_caller (HttpOnly, Secure, scoped to /api/caller)', login._status === 200 && /^vz_caller=\d+\.\d+\.[\w-]+$/.test(billyCookie) && /HttpOnly/.test(login._headers['Set-Cookie']) && /Secure/.test(login._headers['Set-Cookie']) && /Path=\/api\/caller/.test(login._headers['Set-Cookie']));
    check('passcode-format', null, 'the passcode Rob is shown is eight characters in two groups, answered once', /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(passcode) && !('passcode' in ((await admin('team', 'GET'))._json?.billy || {})));
    const flat = JSON.stringify(_stores.team);
    check('passcode-hash', 'passcode-hash', 'the passcode is stored as a scrypt hash and a salt, never in plain text', !!stored.passHash && !!stored.passSalt && passcode.length === 9 && !flat.includes(passcode) && !flat.includes(passcode.replace('-', '')) && stored.passHash.length >= 80);
    check('team-collection', null, 'the record is the one document in the team collection, not a settings document', _stores.team.length === 1 && _stores.team[0]._id === 'billy' && !_stores.settings.some(d => 'passHash' in d || d._id === 'billy' || d._id === 'team'));

    const home = await billy('GET', 'home');
    check('home-ok', null, 'the caller cookie reads the Call Room', home._status === 200 && Array.isArray(home._json?.leads) && home._json.me?.name === 'Billy');
    check('no-store', 'no-store', 'a caller response says Cache-Control: no-store', home._headers['Cache-Control'] === 'no-store');

    /* The door: a POST with a body, behind the shared limiter. */
    const viaQuery = await raw('caller-door', 'POST', { a: 'login', query: { email: 'billy@example.com', passcode }, body: {} });
    check('login-body', 'login-body', 'a credential in the query string is ignored: no cookie', viaQuery._status === 401 && !viaQuery._headers['Set-Cookie']);
    const wrongPass = await raw('caller-door', 'POST', { a: 'login', body: { email: 'billy@example.com', passcode: 'AAAA-AAAA' } });
    const wrongMail = await raw('caller-door', 'POST', { a: 'login', body: { email: 'nobody@example.com', passcode } });
    const opInject = await raw('caller-door', 'POST', { a: 'login', body: { email: { $gt: '' }, passcode: { $gt: '' } } });
    check('login-identical', null, 'a wrong passcode, a wrong email and an operator in the body answer identical bytes and set no cookie', wrongPass._status === 401 && bytes(wrongPass) === bytes(wrongMail) && bytes(wrongPass) === bytes(opInject) && !wrongPass._headers['Set-Cookie'] && !opInject._headers['Set-Cookie']);
    let last = null;
    for (let i = 0; i < 11; i++) last = await raw('caller-door', 'POST', { a: 'login', body: { email: 'billy@example.com', passcode: 'WRNG-WRNG' }, sameIp: true });
    check('login-limiter', 'login-limiter', 'the eleventh wrong passcode from one address is 429 with Retry-After', last._status === 429 && Number(last._headers['Retry-After']) > 0);
    const locked = await raw('caller-door', 'POST', { a: 'login', body: { email: 'billy@example.com', passcode }, sameIp: true });
    check('login-limiter-right', 'login-limiter', 'while that address is locked out even the right passcode waits', locked._status === 429);
    check('limiter-key', null, 'the limiter counts under a rate: key in settings (out of the backup, never served)', _stores.settings.some(d => /^rate:caller:[0-9a-f]{32}$/.test(String(d._id))));
    const getLogin = await raw('caller-door', 'GET', { a: 'login', query: { email: 'billy@example.com', passcode } });
    check('login-post-only', null, 'the door is POST only', getLogin._status === 405);

    /* The two cookies never verify as each other. */
    const [v, exp, sig] = billyCookie.replace('vz_caller=', '').split('.');
    const [aExp, aSig] = adminCookie.replace('vz_admin=', '').split('.');
    const spliceAdmin = await raw('call-leads', 'GET', { cookie: `vz_admin=${exp}.${sig}` });
    const spliceCaller = await raw('caller', 'GET', { a: 'home', cookie: `vz_caller=${v}.${aExp}.${aSig}` });
    check('cookie-payload-admin', 'cookie-payload', 'the caller cookie\'s signature spliced into vz_admin is refused', spliceAdmin._status === 401);
    check('cookie-payload-caller', 'cookie-payload', 'the admin cookie\'s signature spliced into vz_caller is refused', spliceCaller._status === 401);
    const expired = `vz_caller=${v}.${Date.now() - 1000}.${sig}`;
    check('cookie-expired', null, 'an expired or tampered caller cookie is 401', (await raw('caller', 'GET', { a: 'home', cookie: expired }))._status === 401 && (await raw('caller', 'GET', { a: 'home', cookie: `vz_caller=${Number(v) + 1}.${exp}.${sig}` }))._status === 401);

    /* One route, the role guard. */
    const none = await raw('caller', 'GET', { a: 'home' });
    const withAdmin = await raw('caller', 'GET', { a: 'home', cookie: adminCookie });
    check('role-none', 'role', 'a caller route with no cookie is 401', none._status === 401);
    check('role-admin-cookie', 'role', 'a caller route with the admin cookie is 401', withAdmin._status === 401);
    const adminRoutes = ['analytics', 'backup', 'calendly-events', 'call-leads', 'concept-packs', 'concept-sets', 'docs', 'email', 'export', 'lists', 'suggestions', 'log', 'orders', 'posts', 'projects', 'settings', 'stripe-events', 'submissions', 'team'];
    const asCaller = [];
    for (const r of adminRoutes) asCaller.push((await raw(r, 'GET', { cookie: billyCookie.replace('vz_caller=', 'vz_caller=') }))._status);
    const asCallerNamedAdmin = (await raw('call-leads', 'GET', { cookie: billyCookie.replace('vz_caller=', 'vz_admin=') }))._status;
    check('admin-refuses-caller', 'admin-refuses-caller', `the caller cookie is 401 on every admin route (${adminRoutes.length} routes)`, asCaller.every(s => s === 401) && asCallerNamedAdmin === 401);
    check('unknown-action', null, 'an action the route does not know is 404', (await billy('GET', 'call-leads'))._status === 404 && (await billy('POST', 'delete', { leadId: L(12) }))._status === 404);

    /* Reset passcode, Pause and Can sign in off kill the cookie on its next request. */
    const before = (await billy('GET', 'session'))._status;
    await admin('team', 'POST', { body: { action: 'reset-passcode' } });
    check('version-kill', 'version-kill', 'Reset passcode: the old caller cookie is 401 on its next request', before === 200 && (await billy('GET', 'session'))._status === 401);
    await setUp();
    await admin('team', 'POST', { body: { action: 'pause' } });
    check('pause-kill', null, 'Pause now: the cookie is dead and the passcode no longer signs in', (await billy('GET', 'session'))._status === 401 && _stores.team[0].canSignIn === false);
    const { passcode: p2 } = await setUp();
    _stores.team[0].canSignIn = false; // switched off with the version left alone: the switch itself must hold
    check('can-sign-in', 'can-sign-in', 'Can sign in off: the cookie is 401 and a sign in is refused', (await billy('GET', 'session'))._status === 401 && (await raw('caller-door', 'POST', { a: 'login', body: { email: 'billy@example.com', passcode: p2 } }))._status === 401);
    await setUp();
    const v1 = _stores.team[0].version;
    await admin('team', 'PATCH', { body: { set: { canSignIn: false } } });
    check('switch-bumps', null, 'Can sign in switched off by Rob bumps the version', _stores.team[0].version === v1 + 1 && (await billy('GET', 'session'))._status === 401);

    /* Nothing secret leaves: not from Rob's team page, not from the caller, not from the settings route, the leads route or the backup. */
    await setUp();
    const SECRET = ['passHash', 'passSalt', 'version'];
    const teamGet = await admin('team', 'GET');
    const teamPatch = await admin('team', 'PATCH', { body: { set: { moveOffRobLists: true } } });
    const teamReset = await admin('team', 'POST', { body: { action: 'reset-passcode' } });
    const { login: login2 } = await setUp();
    const responses = [teamGet, teamPatch, teamReset, login2, await billy('GET', 'home'), await billy('GET', 'session'), await admin('settings', 'GET'), await admin('call-leads', 'GET'), await admin('team', 'GET', { query: { view: 'day' } })];
    const leaked = responses.flatMap(r => [...keysDeep(r._json)].filter(k => SECRET.includes(k)));
    const storedNow = _stores.team[0];
    const valuesOut = responses.some(r => { const t = JSON.stringify(r._json || {}); return t.includes(storedNow.passHash) || t.includes(storedNow.passSalt); });
    check('team-secrets', 'team-secrets', `passHash, passSalt and version are in no response (${responses.length} responses read)`, teamGet._status === 200 && teamGet._json?.billy?.email === 'billy@example.com' && leaked.length === 0 && !valuesOut);
    const backup = await admin('backup', 'GET');
    const dump = String(backup._body || JSON.stringify(backup._json || {}));
    const parsed = (() => { try { return JSON.parse(dump); } catch { return {}; } })();
    check('backup-out', 'backup-out', 'the backup holds neither team nor team_activity, and no passcode hash', backup._status === 200 && !!parsed.collections && !('team' in parsed.collections) && !('team_activity' in parsed.collections) && !dump.includes(storedNow.passHash) && !dump.includes('passSalt'));
  });

  /* ── 2. Reads: the line and the whitelist ───────────────────────────── */
  await section(async () => {
    await setUp();
    const home = await billy('GET', 'home');
    const names = (home._json?.leads || []).map(l => l.business).sort();
    check('read-line', 'read-line', 'the Call Room reads triage, lead and nurture only: nothing booked, a deal, a client, declined, deleted, or booked on the call with no stage', home._status === 200 && names.join() === ['Free Lead', 'Kims Cafe', 'Nurture Co', 'On Billys List', 'On Robs List', 'Triage One', 'Triage Two'].join());
    const flat = JSON.stringify(home._json || {});
    const full = (home._json?.leads || []).find(l => l.id === L(1)) || {};
    check('whitelist-keys', 'whitelist', `every lead in a caller response has exactly the whitelisted keys (${view.CALLER_LEAD_KEYS.length})`, (home._json?.leads || []).length > 0 && (home._json.leads).every(l => Object.keys(l).sort().join() === [...view.CALLER_LEAD_KEYS].sort().join()));
    check('whitelist-values', 'whitelist', 'a lead that carries every field gives up no money, quote, deal, invoice, note of Rob\'s, concept, doc, draft or token', !flat.includes(FORBID));
    check('whitelist-shape', null, 'the fields the Call Room needs come through: type, city, owner, score, rating and reviews, the website flag, Instagram, hours, the script, the intel, the objection lines', full.type === 'Cafe' && full.city === 'Dover' && full.owner === 'Kim' && full.score === 80 && full.rating === 4.8 && full.reviews === 212 && full.website === 'dead' && /instagram\.com\/kimscafe/.test(full.instagram || '') && full.hours === 'Tue to Sat, 7 to 3' && full.script?.intro === 'Hey Kim, quick one.' && full.script?.lockIt === 'Perfect.' && full.intel?.gaps?.length === 1 && full.objections?.[0]?.say === 'Too pricey' && full.found?.where === 'scraper');
    const log = full.callLog || [];
    check('log-notes', 'log-notes', 'a call log entry is who, at and outcome, with the note only where Billy made the call', log.length === 2 && log[0].who === 'rob' && !('note' in log[0]) && log[1].who === 'billy' && log[1].note === 'Billy heard: call after 2' && log.every(e => !('email' in e) && !('meeting' in e)));
    const lists = home._json?.lists || [];
    check('lists-shape', null, 'lists come through with who calls each and only the ids on Billy\'s side of the line', lists.length === 3 && lists.every(l => Object.keys(l).sort().join() === [...view.CALLER_LIST_KEYS].sort().join()) && lists.find(l => l.id === LIST(1))?.callerId === 'rob' && lists.find(l => l.id === LIST(2))?.callerId === 'billy' && lists.find(l => l.id === LIST(2))?.madeBy === 'billy' && lists.find(l => l.id === LIST(3))?.system === true && !lists.some(l => l.id === LIST(4)));
    const booked = home._json?.booked || [];
    check('booked-word', 'booked-word', 'Me > Booked is the business, one status word and the day, nothing else', booked.length === 2 && booked.every(x => Object.keys(x).sort().join() === [...view.CALLER_BOOKED_KEYS].sort().join()) && booked.find(x => x.business === 'Booked Co')?.word === 'Booked' && booked.find(x => x.business === 'Deal Co')?.word === 'Quoted');
    check('booked-words', null, 'the five words: Booked, Met, Quoted, Client, Closed', view.bookedWord({ stage: 'booked' }) === 'Booked' && view.bookedWord({ stage: 'deal', deal: { invoices: [] } }) === 'Met' && view.bookedWord({ stage: 'deal', deal: { invoices: [{ status: 'draft' }] } }) === 'Met' && view.bookedWord({ stage: 'deal', deal: { invoices: [{ status: 'sent' }] } }) === 'Quoted' && view.bookedWord({ stage: 'client' }) === 'Client' && view.bookedWord({ stage: 'declined' }) === 'Closed' && view.bookedWord({ stage: 'lost' }) === 'Closed');
  });

  /* ── 3. Writes: the line, the whitelist, the stamp ──────────────────── */
  await section(async () => {
    await setUp();
    const missing = await billy('POST', 'outcome', { leadId: '507f1f77bcf86cd799439999', outcome: 'no-answer' });
    const writes = [
      ['outcome', { outcome: 'no-answer' }], ['outcome', { outcome: 'callback' }], ['outcome', { outcome: 'no', reason: 'budget' }], ['contact', { phone: '555' }], ['triage', { decision: 'accept' }], ['triage', { decision: 'decline', reason: 'budget' }], ['book', { at: new Date(Date.now() + 2 * DAY).toISOString(), notes: 'x' }],
    ];
    const beyond = [6, 7, 8, 9, 10, 13];
    const snap = JSON.stringify(beyond.map(lead));
    const answers = [];
    for (const i of beyond) for (const [a, body] of writes) answers.push(bytes(await billy('POST', a, { leadId: L(i), ...body })));
    answers.push(bytes(await billy('POST', 'batch', { leadIds: [L(12), L(6)], op: 'decline', reason: 'budget' })));
    answers.push(bytes(await billy('POST', 'list', { op: 'skip', listId: LIST(2), leadId: L(6) })));
    check('write-line', 'write-line', `a write on a lead that is booked, a deal, a client, declined or deleted answers the same 404 as one that does not exist, and changes nothing (${answers.length} writes)`, missing._status === 404 && answers.every(x => x === bytes(missing)) && JSON.stringify(beyond.map(lead)) === snap && lead(12).stage === 'lead');

    /* The contact fix: phone and owner name only. */
    const was = JSON.parse(JSON.stringify(lead(1)));
    const fix = await billy('POST', 'contact', { leadId: L(1), phone: '(302) 555-0199', owner: 'Kim Park', notes: 'mine now', stage: 'client', email: 'x@y.z', deal: { packageId: 'x' }, business: 'Renamed', score: 100, by: 'rob', at: '2000-01-01T00:00:00.000Z' });
    const after = lead(1);
    const others = Object.keys(was).filter(k => !['phone', 'askFor', 'callerStamp', 'updatedAt', 'nextAction'].includes(k));
    check('contact-whitelist', 'write-whitelist', 'the contact fix writes the phone and the owner name and nothing else', fix._status === 200 && after.phone === '(302) 555-0199' && after.askFor === 'Kim Park' && others.every(k => JSON.stringify(after[k]) === JSON.stringify(was[k])));
    check('stamp', 'stamp', 'a write is stamped { by: billy, at } on the server, whatever the request says', after.callerStamp?.by === 'billy' && Math.abs(new Date(after.callerStamp.at).getTime() - Date.now()) < 60e3);
    check('activity-contact', 'activity', 'the contact fix appends one team_activity row, who billy', rows('contact').length === 1 && rows('contact')[0].who === 'billy' && rows('contact')[0].leadIds[0] === L(1) && Math.abs(new Date(rows('contact')[0].at).getTime() - Date.now()) < 60e3);

    /* The outcome: the console's own write, stamped Billy, the list rule with it. */
    const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o?.[k]]));
    const same = [];
    for (const [i, outcome, extra, keys] of [[12, 'no-answer', { note: 'rang out' }, ['callStatus']], [5, 'wrong-number', { note: 'a dentist answered' }, ['callStatus', 'phoneNote']]]) {
      const b4 = JSON.parse(JSON.stringify(lead(i)));
      const r = await billy('POST', 'outcome', { leadId: L(i), outcome, ...extra });
      const want = callOutcomeSet(b4, outcome, extra).set;
      const got = lead(i);
      const e = got.callLog[got.callLog.length - 1]; const w = want.callLog[want.callLog.length - 1];
      same.push(r._status === 200 && JSON.stringify(pick(got, keys)) === JSON.stringify(pick(want, keys)) && e.outcome === w.outcome && e.note === w.note && e.meeting === w.meeting && e.email === w.email && got.callLog.length === want.callLog.length);
    }
    const future = new Date(Date.now() + 26 * 3600e3).toISOString();
    const b4cb = JSON.parse(JSON.stringify(lead(11)));
    const cb = await billy('POST', 'outcome', { leadId: L(11), outcome: 'callback', note: 'after lunch', callbackAt: future });
    same.push(cb._status === 200 && lead(11).callbackAt === callOutcomeSet(b4cb, 'callback', { note: 'after lunch', callbackAt: future }).set.callbackAt && lead(11).callStatus === 'callback');
    check('outcome-parity', 'outcome-parity', 'no answer, wrong number and call back write what src/lib/callOutcome.js writes', same.length === 3 && same.every(Boolean));
    check('outcome-by', 'stamp-log', 'the call log entry carries by: billy', lead(12).callLog.slice(-1)[0]?.by === 'billy' && lead(5).callLog.slice(-1)[0]?.by === 'billy');
    check('outcome-list', null, 'the list rule rides the same write: a wrong number leaves the list and its listId clears', !list(2).leadIds.includes(L(5)) && lead(5).listId === '');
    check('activity-call', 'activity', 'each outcome appends one team_activity row of kind call', rows('call').length === 3 && rows('call').every(r => r.who === 'billy' && r.leadIds.length === 1 && r.detail?.outcome));
    const past = await billy('POST', 'outcome', { leadId: L(1), outcome: 'callback', callbackAt: new Date(Date.now() - 60e3).toISOString() });
    check('callback-past', 'callback-past', 'a callback in the past is refused and nothing is written', past._status === 400 && lead(1).callStatus === 'not-called' && !lead(1).callbackAt);
    const dflt = await billy('POST', 'outcome', { leadId: L(1), outcome: 'callback' });
    const at = new Date(lead(1).callbackAt);
    const ny = Number.isFinite(at.getTime()) ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(at) : '';
    check('callback-default', null, 'with no time picked a callback is tomorrow at 9:00 AM New York', dflt._status === 200 && ny === '09:00' && at.getTime() > Date.now() && at.getTime() - Date.now() < 49 * 3600e3);
    check('callbacks-due-sync', null, 'the system list is refreshed by the sync, never written by hand', list(3).system === true && list(3).name === 'Callbacks due');
    const vm1 = await billy('POST', 'outcome', { leadId: L(12), outcome: 'no-answer', voicemail: true, note: 'second try' });
    check('voicemail-note', null, 'a voicemail left is said in the call log entry', vm1._status === 200 && lead(12).callLog.slice(-1)[0].note === 'Left a voicemail. second try');
    const noReason = await billy('POST', 'outcome', { leadId: L(12), outcome: 'no' });
    const said = await billy('POST', 'outcome', { leadId: L(12), outcome: 'no', reason: 'budget', note: 'no money until spring' });
    check('not-interested', null, 'Not interested declines the lead with his reason and note, and the record is still there', noReason._status === 400 && said._status === 200 && said._json?.lead === null && lead(12).stage === 'declined' && lead(12).declined?.reason === 'budget' && lead(12).declined?.note === 'no money until spring' && lead(12).deleted !== true && _stores.call_leads.length === 13);
    check('gone-after-decline', null, 'a declined lead is behind the line on the next write', (await billy('POST', 'contact', { leadId: L(12), phone: '1' }))._status === 404);
    const booked = await billy('POST', 'outcome', { leadId: L(1), outcome: 'booked' });
    check('outcome-enum', null, 'the outcome route takes its four outcomes only (a booking has its own action)', booked._status === 400 && (await billy('POST', 'outcome', { leadId: L(1), outcome: { $gt: '' } }))._status === 400);
    const onRob = await billy('POST', 'outcome', { leadId: L(4), outcome: 'no-answer' });
    check('outcome-rob-list', 'outcome-rob-list', 'a lead on a list Rob calls cannot be logged until Billy moves it to one of his own', onRob._status === 403 && lead(4).callLog.length === 0);
  });

  /* ── 4. Triage and lists ────────────────────────────────────────────── */
  await section(async () => {
    await setUp();
    const acc = await billy('POST', 'triage', { leadId: L(2), decision: 'accept', listId: LIST(2) });
    check('triage-accept', null, 'Accept and add: stage lead, on the list, the list and the listId together', acc._status === 200 && lead(2).stage === 'lead' && lead(2).listId === LIST(2) && list(2).leadIds.includes(L(2)) && acc._json?.lead?.listId === LIST(2));
    const snooze = await billy('POST', 'triage', { leadId: L(3), decision: 'snooze' });
    check('triage-snooze', null, 'Not now persists triageSnoozedAt and leaves the stage alone', snooze._status === 200 && lead(3).stage === 'triage' && !!lead(3).triageSnoozedAt && snooze._json?.lead?.triageSnoozedAt === lead(3).triageSnoozedAt);
    const dec = await billy('POST', 'triage', { leadId: L(3), decision: 'decline', reason: 'not-fit', note: 'a chain' });
    check('triage-decline', null, 'Decline writes the reason and the note, never a delete', dec._status === 200 && lead(3).stage === 'declined' && lead(3).declined?.reason === 'not-fit' && lead(3).deleted !== true);
    check('triage-sorted', null, 'a lead already sorted cannot be triaged again', (await billy('POST', 'triage', { leadId: L(2), decision: 'accept' }))._status === 409 && (await billy('POST', 'triage', { leadId: L(1), decision: 'decline', reason: 'nope' }))._status === 409);
    check('activity-sort', 'activity', 'each triage decision appends one team_activity row of kind sort', rows('sort').length === 3 && rows('sort').every(r => r.who === 'billy') && rows('sort').find(r => r.detail?.op === 'decline')?.detail?.before?.[0]?.stage === 'triage');

    /* The same list helpers on both sides. */
    const sameHelpers = JSON.stringify(srvLists.withLeads(['a', 'b'], ['b', 'c'])) === JSON.stringify(cliLists.withLeads(['a', 'b'], ['b', 'c'])) && JSON.stringify(srvLists.withoutLead(['a', 'b'], 'a')) === JSON.stringify(cliLists.withoutLead(['a', 'b'], 'a'))
      && ['booked', 'no', 'wrong-number', 'declined', 'callback', 'no-answer', 'other'].every(o => JSON.stringify(srvLists.applyOutcome(['a', 'b', 'c'], 'b', o)) === JSON.stringify(cliLists.applyOutcome(['a', 'b', 'c'], 'b', o)) && srvLists.outcomeRemoves(o) === cliLists.outcomeRemoves(o)) && srvLists.MAX_LIST_LEADS === cliLists.MAX_LIST_LEADS;
    check('lists-mirror', null, 'the server list helpers answer what src/lib/lists.js answers', sameHelpers);

    /* Moving a lead off a list Rob calls: the confirm, then the switch. */
    const noConfirm = await billy('POST', 'batch', { leadIds: [L(4)], op: 'list', listId: LIST(2) });
    check('rob-list-confirm', 'rob-list-confirm', 'moving a lead off a list Rob calls without confirm: true is refused, names the list, and moves nothing', noConfirm._status === 409 && noConfirm._json?.confirm === true && noConfirm._json?.onRobLists?.[0]?.list === 'Robs Tuesday' && lead(4).listId === LIST(1) && list(1).leadIds.includes(L(4)));
    _stores.team[0].moveOffRobLists = false;
    const lockedMove = await billy('POST', 'batch', { leadIds: [L(4)], op: 'list', listId: LIST(2), confirm: true });
    const lockedDecline = await billy('POST', 'batch', { leadIds: [L(4)], op: 'decline', reason: 'budget', confirm: true });
    check('rob-list-switch', 'rob-list-switch', 'with Move leads off your lists switched off the move is 403 even with the confirm', lockedMove._status === 403 && lockedDecline._status === 403 && lead(4).listId === LIST(1) && lead(4).stage === 'lead');
    _stores.team[0].moveOffRobLists = true;
    const moved = await billy('POST', 'batch', { leadIds: [L(4), L(12)], op: 'list', listId: LIST(2), confirm: true });
    check('lists-together', 'lists-together', 'a move writes both sides: the new list gains the leads, the old one loses them, each listId points at the new list', moved._status === 200 && moved._json?.added === 2 && list(2).leadIds.includes(L(4)) && list(2).leadIds.includes(L(12)) && !list(1).leadIds.includes(L(4)) && lead(4).listId === LIST(2) && lead(12).listId === LIST(2));
    check('batch-one-row', null, 'a batch is one write and one team_activity row carrying every lead', rows('sort').filter(r => r.detail?.op === 'list').length === 1 && rows('sort').find(r => r.detail?.op === 'list').leadIds.length === 2);

    /* The system list is untouchable, and a closed list is not a target. */
    const sysBefore = JSON.stringify(list(3));
    const toSystem = await billy('POST', 'batch', { leadIds: [L(1)], op: 'list', listId: LIST(3) });
    const renameSystem = await billy('POST', 'list', { op: 'rename', id: LIST(3), name: 'Mine now' });
    const skipSystem = await billy('POST', 'list', { op: 'skip', listId: LIST(3), leadId: L(1) });
    const asName = await billy('POST', 'list', { op: 'create', name: 'callbacks due', fill: { mode: 'empty' } });
    check('system-list', 'system-list', 'Callbacks due cannot be filled, renamed or reordered by the caller, and its name cannot be taken', toSystem._status === 400 && renameSystem._status === 404 && skipSystem._status === 404 && asName._status === 400 && JSON.stringify(list(3)) === sysBefore && lead(1).listId === '');
    check('closed-list', null, 'a finished list is not a target', (await billy('POST', 'batch', { leadIds: [L(1)], op: 'list', listId: LIST(4) }))._status === 400);

    /* Create: a filter leaves leads already on a list where they are; by hand moves them. */
    _stores.call_leads.push(plain(40, 'Fresh Barber One'), plain(41, 'Fresh Barber Two'));
    const homeBefore = (await billy('GET', 'home'))._json || {};
    const promised = roomLib.fillPreview(homeBefore.leads, homeBefore.lists, { types: ['Barber'], cities: ['Dover'] });
    const made = await billy('POST', 'list', { op: 'create', name: 'Dover barbers', callerId: 'billy', fill: { mode: 'filter', types: ['Barber'], cities: ['Dover'] } });
    const newList = _stores.lists.find(l => l.name === 'Dover barbers');
    check('fill-promise', null, 'the count the New list sheet shows before writing (fillPreview on the home response) is the count the server adds', made._status === 200 && promised.add === 2 && promised.onList > 0 && promised.add === made._json?.added && promised.match - promised.onList === promised.add && newList.leadIds.includes(L(40)) && newList.leadIds.includes(L(41)));
    check('list-create-filter', null, 'a list filled by a filter takes the leads that match and are on no list; one on a list already stays where it is', made._status === 200 && !!newList && newList.createdBy === 'billy' && newList.callerId === 'billy' && made._json?.added === newList.leadIds.length && !newList.leadIds.includes(L(4)) && !newList.leadIds.includes(L(2)) && lead(4).listId === LIST(2));
    const forRob = await billy('POST', 'list', { op: 'create', name: 'For Rob', callerId: 'rob', fill: { mode: 'empty' } });
    check('list-create-rob', null, 'a list Billy makes for Rob says Rob calls it and Billy made it', forRob._status === 200 && forRob._json?.list?.callerId === 'rob' && forRob._json?.list?.madeBy === 'billy');
    const renameRob = await billy('POST', 'list', { op: 'rename', id: LIST(1), name: 'Taken over' });
    const renameOwn = await billy('POST', 'list', { op: 'rename', id: LIST(2), name: 'Billys best' });
    check('rename-own', 'rename-own', 'Billy renames the lists he made, never one Rob made', renameRob._status === 403 && list(1).name === 'Robs Tuesday' && renameOwn._status === 200 && list(2).name === 'Billys best');
    const order = [...list(2).leadIds];
    const skip = await billy('POST', 'list', { op: 'skip', listId: LIST(2), leadId: order[0] });
    check('skip', null, 'Skip for now sends the lead to the end of the list', skip._status === 200 && list(2).leadIds[list(2).leadIds.length - 1] === order[0] && list(2).leadIds.length === order.length);

    /* The session record. */
    const sess = await billy('POST', 'session', { list: 'Billys best', startedAt: new Date(Date.now() - 3600e3).toISOString(), endedAt: new Date().toISOString(), stats: { calls: 12, talked: 5, booked: 1, callbacks: 2, noAnswer: 6, notInterested: 1, extra: 99 }, who: 'rob' });
    const row = rows('session')[0];
    check('session-record', 'activity', 'a session is one team_activity row, stamped Billy, with its six numbers', sess._status === 200 && rows('session').length === 1 && row.who === 'billy' && row.detail.calls === 12 && row.detail.booked === 1 && !('extra' in row.detail));
  });

  /* ── 4b. Booking: Rob's open times, the slot check, the write, the push, the draft ── */
  await section(async () => {
    await setUp();
    const t0 = Date.now();
    const nyOf = (iso) => { const t = new Date(iso).getTime(); const p = zone.zoneParts(t); const key = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; return { t, h: p.h, min: p.min, dow: new Date(`${key}T12:00:00Z`).getUTCDay(), date: key, time: `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}` }; };

    /* The weekly hours (the default source: no Calendly event type picked). */
    const ot = await billy('GET', 'open-times');
    const slots = ot._json?.slots || [];
    check('open-hours', null, 'with no event type picked the open times are Rob\'s weekly hours: 30 minute slots, Monday to Friday, 10:00 to 16:00 New York, an hour from now to 14 days out, soonest first',
      ot._status === 200 && ot._json?.source === 'hours' && slots.length > 40 && slots.every((x, i) => { const p = nyOf(x); return [1, 2, 3, 4, 5].includes(p.dow) && (p.min === 0 || p.min === 30) && p.h >= 10 && p.h < 16 && p.t >= t0 + 3600e3 - 5000 && p.t <= t0 + 14 * DAY + 5000 && (i === 0 || p.t > new Date(slots[i - 1]).getTime()); }));
    check('open-whitelist', null, 'the open times answer is the source and the instants, and nothing about who Rob is meeting', Object.keys(ot._json || {}).sort().join() === 'slots,source' && slots.every(x => typeof x === 'string') && !bytes(ot).includes(FORBID));

    /* Minus the meetings the CRM holds. */
    const taken = slots[3]; const pick = slots[5]; const second = slots[9];
    _stores.call_leads.push(plain(50, 'Has A Meeting', { stage: 'booked', meeting: { date: nyOf(taken).date, time: nyOf(taken).time, type: 'call' } }));
    const ot2 = await billy('GET', 'open-times');
    check('open-minus-crm', 'open-minus-crm', 'a time the CRM already holds a meeting at is not offered', ot2._status === 200 && !(ot2._json?.slots || []).includes(taken) && (ot2._json?.slots || []).includes(pick) && (ot2._json?.slots || []).length === slots.length - 1);

    /* The slot is checked at the write. */
    const bookTaken = await billy('POST', 'book', { leadId: L(12), at: taken, notes: 'x' });
    check('slot-check', 'slot-check', 'the slot is checked at the write: a time that was taken since answers 409 and nothing is written', bookTaken._status === 409 && bookTaken._json?.taken === true && lead(12).stage === 'lead' && !lead(12).bookedBy && rows('booked').length === 0);
    const offGrid = await billy('POST', 'book', { leadId: L(12), at: new Date(new Date(pick).getTime() + 7 * 60e3).toISOString() });
    const past = await billy('POST', 'book', { leadId: L(12), at: new Date(Date.now() - 3600e3).toISOString() });
    const junk = await billy('POST', 'book', { leadId: L(12), at: 'tomorrow' });
    check('slot-open-only', 'slot-check', 'a time that is not one of Rob\'s open times is 409; one in the past or unreadable is 400', offGrid._status === 409 && past._status === 400 && junk._status === 400 && lead(12).stage === 'lead' && rows('booked').length === 0);
    const onRob = await billy('POST', 'book', { leadId: L(4), at: slots[7] });
    check('book-rob-list', 'outcome-rob-list', 'a lead on a list Rob calls cannot be booked by Billy until he moves it', onRob._status === 403 && lead(4).stage === 'lead');

    /* The write: the console's booked outcome, stamped Billy. */
    _stores.push_subscriptions = [{ _id: 'o1', subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } }, updatedAt: new Date() }];
    pushStub.calls.length = 0;
    const before = JSON.parse(JSON.stringify(lead(1)));
    const model = callOutcomeSet(before, 'booked', { note: 'Wants a new sign and a site', meeting: { date: nyOf(pick).date, time: nyOf(pick).time, type: 'call', location: '' } }).set;
    const booked = await billy('POST', 'book', { leadId: L(1), at: pick, notes: 'Wants a new sign and a site', who: 'rob', bookedBy: { who: 'rob', at: '2020-01-01' }, stage: 'client', deal: { invoices: [{ amount: 1 }] } });
    const after = lead(1);
    const lastLog = (after.callLog || [])[(after.callLog || []).length - 1] || {};
    check('book-write', 'book-write', 'a booking sets stage booked, the meeting in New York, the booked call entry with his note, and bookedBy { who: billy, at } from the server',
      booked._status === 200 && after.stage === 'booked' && after.callStatus === 'booked' && after.meeting?.date === nyOf(pick).date && after.meeting?.time === nyOf(pick).time && after.meeting?.type === 'call' && lastLog.outcome === 'booked' && lastLog.by === 'billy' && lastLog.note === 'Wants a new sign and a site' && after.bookedBy?.who === 'billy' && Math.abs(new Date(after.bookedBy?.at || 0).getTime() - Date.now()) < 60e3 && after.callerStamp?.by === 'billy');
    check('book-parity', null, 'it writes what the console\'s booked outcome writes (src/lib/callOutcome.js): the stage, the meeting, the call status, the after call line and the deal it starts',
      after.stage === model.stage && after.callStatus === model.callStatus && JSON.stringify(after.meeting) === JSON.stringify(model.meeting) && after.afterCall?.meeting === model.afterCall?.meeting && JSON.stringify(after.deal) === JSON.stringify(before.deal || model.deal) && lastLog.meeting === model.callLog[model.callLog.length - 1].meeting);
    check('book-whitelist', null, 'the request cannot name who booked it, the stage or the deal: only the lead, the time and the notes are read', after.bookedBy?.who === 'billy' && after.bookedBy?.at !== '2020-01-01' && after.stage === 'booked' && JSON.stringify(after.deal) === JSON.stringify(before.deal));
    check('book-answer', null, 'the answer is the business, the word Booked, the time and Rob\'s three ticks, and none of the record', booked._status === 200 && Object.keys(booked._json || {}).sort().join() === 'booked,ok,rob' && Object.keys(booked._json?.booked || {}).sort().join() === 'at,business,word' && Object.keys(booked._json?.rob || {}).sort().join() === 'draft,notes,push' && !bytes(booked).includes(FORBID));
    const row = rows('booked')[0] || {};
    check('book-activity', 'activity', 'a booking is one team_activity row of kind booked with the lead, the time and his note', rows('booked').length === 1 && row.who === 'billy' && String((row.leadIds || [])[0]) === L(1) && row.detail?.at === pick && row.detail?.note === 'Wants a new sign and a site');

    /* It crossed the line: gone from Billy's side, a status word on Me. */
    const homeAfter = (await billy('GET', 'home'))._json || {};
    const again = await billy('POST', 'book', { leadId: L(1), at: second });
    const logAfter = await billy('POST', 'outcome', { leadId: L(1), outcome: 'no-answer' });
    check('book-crosses', 'write-line', 'once booked the lead is Rob\'s: it leaves the home read, every write on it is 404, and Me shows it as the word Booked',
      !(homeAfter.leads || []).some(l => l.id === L(1)) && (homeAfter.booked || []).some(x => x.business === 'Kims Cafe' && x.word === 'Booked') && again._status === 404 && logAfter._status === 404 && lead(1).meeting?.time === nyOf(pick).time);
    const ot3 = await billy('GET', 'open-times');
    check('book-takes-slot', 'open-minus-crm', 'the time he booked is gone from the open times on the next read', ot3._status === 200 && !(ot3._json?.slots || []).includes(pick) && (ot3._json?.slots || []).includes(second));

    /* Rob's push: a booking is a meeting, and it tells him to add it (nothing writes to Calendly). */
    const sent = pushStub.calls.map(c => { try { return JSON.parse(c.payload); } catch { return {}; } });
    const routeSrc = fs.readFileSync(path.join(api, '_routes', 'caller.js'), 'utf8');
    const bookSrc = routeSrc.slice(routeSrc.indexOf("if (a === 'book')"), routeSrc.indexOf("if (a === 'session')", routeSrc.indexOf("if (a === 'book')")));
    check('book-push', 'book-push', 'Rob gets one push for the booking: who, the business, the time in New York and "Add it to your calendar", under the meetings category',
      sent.length === 1 && /Billy booked Kims Cafe/.test(sent[0].title || '') && /Add it to your calendar\./.test(sent[0].body || '') && (sent[0].body || '').includes(String(((nyOf(pick).h + 11) % 12) + 1) + ':' + String(nyOf(pick).min).padStart(2, '0')) && booked._json?.rob?.push === true && /category: 'meetings'/.test(bookSrc));
    pushStub.calls.length = 0;
    await admin('team', 'PATCH', { body: { set: { prefs: { booked: false, session: false } } } });
    const quiet = await billy('POST', 'book', { leadId: L(12), at: second, notes: '' });
    check('book-push-pref', 'book-push-pref', 'with "Books a lead" switched off the booking still lands and no push goes', quiet._status === 200 && lead(12).stage === 'booked' && pushStub.calls.length === 0 && quiet._json?.rob?.push === false && quiet._json?.rob?.notes === false);

    /* The confirmation: a draft through the drafts path, never a send. */
    const drafts = (_stores.email_log || []).filter(e => String(e.recordId) === L(1));
    const d = drafts[0] || {};
    const task = (after.checklists || []).flatMap(c => c.items || []).find(i => String(i.emailId || '') === String(d._id));
    check('book-draft', 'book-draft', 'the confirmation email is one draft on the record (the custom template with Rob\'s words kept on it), with its task, and nothing was sent',
      booked._json?.rob?.draft === true && drafts.length === 1 && d.status === 'draft' && d.templateId === 'custom' && !d.approvedAt && !d.sentAt && !d.providerId && /You're set for/.test(d.subject || '') && Array.isArray(d.override?.blocks) && d.override.blocks.length >= 3 && !!task && (_stores.email_log || []).every(e => e.status === 'draft'));
    check('book-draft-words', null, 'the confirmation speaks as Rob in the first person, names Billy and the time, and its own words never say we', /Billy told me you two talked/.test(d.text || '') && /I'll call you then/.test(d.text || '') && !/\bwe\b|\bwe'|\bour\b|\bus\b/i.test([d.subject, ...(d.override?.blocks || []).map(b => b.text || '')].join(' ')) && !/undefined|null|\u2014/.test(d.text || ''));

    /* bookedBy is stamped once and never changed. */
    const old = '2026-01-05T15:00:00.000Z';
    _stores.call_leads.push(plain(51, 'Booked Before', { bookedBy: { who: 'billy', at: old } }));
    const third = (ot3._json?.slots || []).find(x => x !== second && x !== pick && new Date(x).getTime() > new Date(second).getTime() + 3600e3);
    const rebook = await billy('POST', 'book', { leadId: L(51), at: third });
    check('booked-by-once', 'booked-by-once', 'bookedBy is stamped once: a lead that already carries it keeps the first stamp when it is booked again', rebook._status === 200 && lead(51).stage === 'booked' && lead(51).bookedBy?.at === old);
    const adminPatch = await admin('call-leads', 'PATCH', { query: { id: L(51) }, body: { id: L(51), _id: L(51), bookedBy: { who: 'rob', at: '2020-01-01' }, notes: 'ok' } });
    check('booked-by-admin', null, 'and the admin\'s own lead route does not know the field, so no edit there changes it', lead(51).bookedBy?.who === 'billy' && lead(51).bookedBy?.at === old && adminPatch._status !== 599);

    /* Calendly as the source: the event type's available times, cached five minutes, read only; the weekly hours when it cannot answer. */
    const realFetch = globalThis.fetch;
    const fetched = [];
    const cal = [2, 3, 5, 9].map(d => new Date(Math.floor((Date.now() + d * DAY) / 1800e3) * 1800e3 + 1800e3).toISOString());
    let calFails = false;
    globalThis.fetch = async (url, opts = {}) => {
      fetched.push({ url: String(url), method: opts.method || 'GET', auth: opts.headers?.Authorization || '' });
      if (calFails) return { ok: false, status: 500, json: async () => ({}) };
      const q = new URL(String(url)).searchParams; const a = new Date(q.get('start_time')).getTime(); const z = new Date(q.get('end_time')).getTime();
      return { ok: true, status: 200, json: async () => ({ collection: [...cal.filter(x => new Date(x).getTime() >= a && new Date(x).getTime() <= z).map(x => ({ status: 'available', start_time: x })), { status: 'unavailable', start_time: new Date(a + 3600e3).toISOString() }] }) };
    };
    try {
      process.env.CALENDLY_TOKEN = 'test-calendly-token';
      const ET = 'https://api.calendly.com/event_types/ABC123';
      await admin('team', 'PATCH', { body: { set: { openTimes: { source: 'calendly', eventType: ET, eventTypeName: 'Intro call' } } } });
      const c1 = await billy('GET', 'open-times');
      const n1 = fetched.length;
      check('open-calendly', null, 'with an event type picked the open times are that event type\'s available times for 14 days (two weekly reads), unavailable ones left out',
        c1._status === 200 && c1._json?.source === 'calendly' && (c1._json?.slots || []).join() === cal.join() && n1 === 2 && fetched.every(f => f.url.startsWith('https://api.calendly.com/event_type_available_times?') && decodeURIComponent(f.url).includes(ET) && f.auth === 'Bearer test-calendly-token') && fetched.every(f => (new Date(new URL(f.url).searchParams.get('end_time')) - new Date(new URL(f.url).searchParams.get('start_time'))) <= 7 * DAY));
      const c2 = await billy('GET', 'open-times');
      const cacheDoc = _stores.settings.find(x => String(x._id).startsWith('rate:open:'));
      check('open-cache', 'open-cache', 'Calendly\'s answer is cached five minutes in settings under the rate: key pattern: a second read asks nothing', c2._status === 200 && (c2._json?.slots || []).join() === cal.join() && fetched.length === n1 && !!cacheDoc && !String(cacheDoc._id).includes('ABC123'));
      const viaCal = await billy('POST', 'book', { leadId: L(5), at: cal[1], notes: 'Calendly slot' });
      check('open-read-only', 'open-read-only', 'booking from a Calendly slot writes the CRM and never writes to Calendly: every request there is a GET', viaCal._status === 200 && lead(5).stage === 'booked' && fetched.length >= 2 && fetched.every(f => f.method === 'GET'));
      const c3 = await billy('GET', 'open-times');
      check('open-calendly-minus', 'open-minus-crm', 'and the time just booked is taken out of Calendly\'s list too', c3._status === 200 && !(c3._json?.slots || []).includes(cal[1]) && (c3._json?.slots || []).includes(cal[0]));
      /* Past the cache, with Calendly refusing: the weekly hours. */
      if (cacheDoc) cacheDoc.at = Date.now() - 6 * 60e3;
      calFails = true;
      const c4 = await billy('GET', 'open-times');
      check('open-fallback', 'open-fallback', 'when Calendly cannot answer, the open times fall back to the weekly hours instead of an empty screen', c4._status === 200 && c4._json?.source === 'hours' && (c4._json?.slots || []).length > 40 && fetched.length > n1);
    } finally { globalThis.fetch = realFetch; delete process.env.CALENDLY_TOKEN; }
  });

  /* ── 4c. Rob's controls: Who calls it, Billy's day, the event types ─── */
  await section(async () => {
    await setUp();
    const toBilly = await admin('lists', 'PATCH', { body: { id: LIST(1), set: { callerId: 'billy' } } });
    const homeNow = (await billy('GET', 'home'))._json || {};
    check('who-calls-set', null, 'Rob sets who calls a list (callerId) and Billy sees it as his to dial', toBilly._status === 200 && list(1).callerId === 'billy' && (homeNow.lists || []).find(l => l.id === LIST(1))?.callerId === 'billy');
    const odd = await admin('lists', 'PATCH', { body: { id: LIST(1), set: { callerId: 'someone' } } });
    check('who-calls-two', null, 'a list is called by Rob or by Billy and nobody else', odd._status === 200 && list(1).callerId === 'rob');
    const sys = await admin('lists', 'PATCH', { body: { id: LIST(3), set: { callerId: 'billy' } } });
    check('who-calls-system', null, 'Callbacks due cannot be assigned', sys._status === 400 && list(3).callerId === undefined);
    const madeByRob = await admin('lists', 'POST', { body: { name: 'Made by Rob' } });
    const fresh = _stores.lists.find(l => l.name === 'Made by Rob');
    check('who-calls-default', null, 'a list defaults to whoever made it: one Rob makes is Rob\'s, one Billy makes is Billy\'s', madeByRob._status < 300 && !!fresh && view.callerIdOf(fresh) === 'rob' && view.callerIdOf(list(2)) === 'billy' && view.callerIdOf({ createdBy: 'billy' }) === 'billy' && view.callerIdOf({}) === 'rob');

    /* Billy's day, from Rob's side. */
    await billy('POST', 'outcome', { leadId: L(12), outcome: 'no-answer' });
    await billy('POST', 'triage', { leadId: L(2), decision: 'decline', reason: 'budget', note: 'Not for them' });
    const day = await admin('team', 'GET', { query: { view: 'day', range: 'today' } });
    const drows = day._json?.rows || [];
    check('day-view', null, 'Billy\'s day answers today\'s rows newest first with the day\'s numbers and whether Billy is set up',
      day._status === 200 && drows.length >= 2 && drows.every(r => r.who === 'billy' && typeof r.id === 'string' && !!r.at) && drows.every((r, i) => i === 0 || r.at <= drows[i - 1].at) && day._json.stats?.calls === 1 && day._json.billy?.exists === true && day._json.billy?.name === 'Billy');
    const secretKeys = ['passHash', 'passSalt', 'version'];
    const types = await admin('team', 'GET', { query: { view: 'event-types' } });
    const allKeys = [...keysDeep(day._json), ...keysDeep(types._json), ...keysDeep((await admin('team', 'GET'))._json)];
    check('day-secrets', 'team-secrets', 'none of Rob\'s team reads (his access, his day, the event types) carries the hash, the salt or the version', secretKeys.every(k => !allKeys.includes(k)) && allKeys.includes('lastSeenAt'));
    check('event-types-off', null, 'with no Calendly token the event type list says so and is empty', types._status === 200 && types._json?.configured === false && Array.isArray(types._json?.items) && types._json.items.length === 0);
    const dayAsBilly = await raw('team', 'GET', { cookie: billyCookie, query: { view: 'day' } });
    check('day-admin-only', 'admin-refuses-caller', 'Billy\'s cookie cannot read his own day from the admin route', dayAsBilly._status === 401);

    /* Undo puts a declined lead back to the stage it had. */
    const drow = drows.find(r => r.kind === 'sort' && r.detail?.op === 'decline');
    const undo = await admin('team', 'POST', { body: { action: 'undo-decline', rowId: drow?.id, leadId: L(2) } });
    const twice = await admin('team', 'POST', { body: { action: 'undo-decline', rowId: drow?.id, leadId: L(2) } });
    const wrong = await admin('team', 'POST', { body: { action: 'undo-decline', rowId: drow?.id, leadId: L(12) } });
    check('undo-decline', null, 'Undo on a batch row puts that one lead back to the stage it had, once; a lead the row never held is 404', undo._status === 200 && undo._json?.stage === 'triage' && lead(2).stage === 'triage' && !lead(2).declined && twice._status === 409 && wrong._status === 404 && (_stores.team_activity.find(r => String(r._id) === String(drow?.id))?.undone || []).includes(L(2)));
  });

  /* ── 5. Static: nothing destructive, nothing that sends ─────────────── */
  await section(async () => {
    const read = (rel) => fs.readFileSync(path.join(api, rel), 'utf8');
    const routeSrc = read('_routes/caller.js');
    const files = ['_routes/caller.js', '_lib/callerView.js', '_lib/team.js', '_lib/openTimes.js', '_lib/booking.js'].filter(f => fs.existsSync(path.join(api, f)));
    check('no-destructive', 'no-destructive', 'the caller route has no hard delete, no merge and no import', !/deleteOne\(|deleteMany\(|findOneAndDelete|dropCollection|\.drop\(|insertMany\(|mergedInto|leads-import|deleted:\s*true/.test(routeSrc));
    const SEND = /sendComposed|sendDraft|sendEmail\b|approvalStamp|resend\.com|web3forms|email\/send|email\/approve|twilio|\bnodemailer\b/i;
    check('no-send', 'no-send', `nothing in the caller files sends an email or a text (${files.length} files)`, files.length === 5 && files.every(f => !SEND.test(read(f))));
    const idx = read('admin/index.js');
    check('one-route', null, 'every caller endpoint is the one route file behind route({ role: caller }) plus its door', /'caller': route\(caller, \{ role: 'caller'/.test(idx) && /'caller-door': route\(callerDoor, \{ role: 'public'/.test(idx) && /from '\.\.\/_routes\/caller\.js'/.test(idx) && (idx.match(/_routes\/caller\.js/g) || []).length === 1);
    const funcs = (function walk(dir, rel = '') { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name), `${rel}${e.name}/`) : [rel + e.name])); })(api).filter(n => n.endsWith('.js') && !n.split('/').some(seg => seg.startsWith('_')));
    check('no-new-function', null, `the Call Room adds no Vercel function (${funcs.length})`, funcs.length === 10);
    const bk = read('_routes/backup.js');
    check('backup-whitelist', null, 'team and team_activity are not in the backup\'s collection list', !/'team'|'team_activity'/.test(bk.slice(bk.indexOf('const COLLECTIONS'), bk.indexOf('];', bk.indexOf('const COLLECTIONS')))));
  });

  /* ── 6. The service worker: /api/caller/ is network only ────────────── */
  await section(async () => {
    const src = fs.readFileSync(sw, 'utf8');
    /* The proof has to hold whatever the cache lists say, so the copy under test has a caller URL put on the cached list. */
    const rigged = src.replace("const API_CACHED = [", "const API_CACHED = ['/api/caller/home', ");
    const run = (source, url, mode = 'cors') => {
      const listeners = {}; const log = { responded: 0, puts: 0 };
      const self = { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: 'https://admin.visualizeclients.com' }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() }, registration: {} };
      const ctx = vm.createContext({ self, caches: { open: async () => ({ addAll: async () => {}, put: async () => { log.puts++; } }), keys: async () => [], match: async () => undefined, delete: async () => true }, fetch: async () => ({ ok: true, clone() { return this; } }), URL, Response, Promise, JSON, console, setTimeout });
      vm.runInContext(source, ctx);
      listeners.fetch({ request: { method: 'GET', url, mode, cache: 'default', headers: { get: () => null } }, respondWith: () => { log.responded++; }, waitUntil: () => {} });
      return log;
    };
    const callerHit = run(rigged, 'https://admin.visualizeclients.com/api/caller/home');
    const adminHit = run(rigged, 'https://admin.visualizeclients.com/api/admin/call-leads');
    check('sw-no-cache', 'sw-no-cache', 'the service worker never answers or stores a /api/caller/ request, even with one on its cached list', rigged !== src && callerHit.responded === 0 && callerHit.puts === 0 && adminHit.responded === 1);
  });

  for (const [k, v] of [['VAPID_PUBLIC_KEY', envBefore.pub], ['VAPID_PRIVATE_KEY', envBefore.priv]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}
