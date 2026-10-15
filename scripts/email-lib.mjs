/* The email system's checks (milestone 1 onward), as one function over an api/ tree so
 * scripts/email-test.mjs runs them on the real source and scripts/email-guard-proof.mjs
 * runs them on a copy with one guard cut out. Every check carries the guard it proves, or
 * null for a plain assertion. The in-memory mongo stands in for the database and a stub
 * stands in for fetch, so nothing reaches Resend and no key is ever needed. */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { this.headersSent = true; } });
const KEY = 're_test_not_a_real_key_0000';

/* A fetch stub: a queue of answers, each { status, body } or { throw: 'message' }; every call is recorded. */
function fetchStub() {
  const calls = []; let queue = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init?.body || '{}'), auth: init?.headers?.Authorization || '' });
    const next = queue.shift() || { status: 200, body: { id: 'em_ok' } };
    if (next.throw) throw new Error(next.throw);
    return { status: next.status, ok: next.status >= 200 && next.status < 300, json: async () => next.body };
  };
  return { fn, calls, set: (list) => { queue = [...list]; } };
}

export async function runEmail(apiSrc = path.join(repoRoot, 'api')) {
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'email-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(apiSrc, apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-not-real'; delete process.env.VERCEL; delete process.env.RESEND_API_KEY;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const { getDb } = await load('_lib/mongo.js');
  const T = await load('_lib/email/transport.js');
  const L = await load('_lib/email/log.js');
  const S = await load('_lib/email/settings.js');
  const adminIndex = (await load('admin/index.js')).default;
  const { signSession } = await load('_lib/auth.js');
  const results = [];
  const ok = (c, m, guard = null) => { results.push({ ok: !!c, msg: m, guard }); };
  const cookie = `vz_admin=${signSession()}`;
  const admin = async (a, method = 'GET', body, extra = {}) => { const req = { method, query: { r: 'email', a }, body, headers: { cookie, 'x-forwarded-for': '203.0.113.9', ...(extra.headers || {}) }, url: `/api/admin/index?r=email&a=${a}`, socket: {} }; const res = fakeRes(); await adminIndex(req, res); return res; };
  const realFetch = globalThis.fetch;
  const stub = fetchStub(); globalThis.fetch = stub.fn;
  const db = await getDb();
  const msg = (over = {}) => ({ to: 'mike@mikestacos.example', subject: 'Good talking to you', html: '<p>Hi</p>', text: 'Hi', ...over });
  const dump = (v) => JSON.stringify(v);
  try {
    /* 1. test mode: without the key nothing leaves, the answer says so, and fetch is never called. */
    _reset(); stub.calls.length = 0; delete process.env.RESEND_API_KEY;
    {
      const r = await T.sendEmail(db, msg());
      ok(r.ok === true && r.test === true && r.status === 'test' && r.attempts === 0, `test mode without the key answers ok and test: true with status test (${dump(r)})`, 'test-mode');
      ok(stub.calls.length === 0, 'test mode calls nothing: no request leaves the server', 'test-mode');
      ok(T.emailConnected() === false, 'emailConnected is false without the key');
      const st = await admin('status');
      ok(st._status === 200 && st._json.connected === false && st._json.sender.address === 'contact@visualizeclients.com' && st._json.sender.name === 'Rob at Visualize' && st._json.from === 'Rob at Visualize <contact@visualizeclients.com>', `the status route reports not connected with the default sender (${dump(st._json)})`);
      ok(st._json.sentLastHour === 1 && st._json.limit === 30, `the status route counts the test send against the hour and names the limit (${st._json.sentLastHour} of ${st._json.limit})`, 'rate-count');
    }
    /* 2. connected: the request shape, the retry on a 5xx or a network error, never on a 4xx, one retry at most. */
    _reset(); stub.calls.length = 0; process.env.RESEND_API_KEY = KEY;
    {
      _stores.settings = [{ _id: 'emails', sender: { name: 'Rob at Visualize', address: 'contact@visualizeclients.com', replyTo: 'rob@visualizeclients.com' } }];
      const sender = (await S.readEmailSettings(db)).sender;
      stub.set([{ status: 200, body: { id: 'em_123' } }]);
      const r = await T.sendEmail(db, msg({ cc: ['Partner@MikesTacos.example', 'mike@mikestacos.example'], sender, headers: { 'List-Unsubscribe': '<https://visualizestudio.org/u/abc>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'Bad Header\r\n': 'x' } }));
      const c = stub.calls[0];
      ok(r.ok && r.status === 'sent' && r.providerId === 'em_123' && r.attempts === 1 && r.test === false, `a 200 is sent with the provider id in one attempt (${dump(r)})`);
      ok(c && c.url === 'https://api.resend.com/emails' && c.init.method === 'POST' && c.auth === `Bearer ${KEY}`, 'the request is a POST to Resend with the bearer key');
      ok(c.body.from === 'Rob at Visualize <contact@visualizeclients.com>' && dump(c.body.to) === dump(['mike@mikestacos.example']) && dump(c.body.cc) === dump(['partner@mikestacos.example']) && c.body.reply_to === 'rob@visualizeclients.com', `from, to, cc (lowercased, the to address dropped from cc) and reply_to come from settings and the request (${dump({ from: c.body.from, to: c.body.to, cc: c.body.cc, reply_to: c.body.reply_to })})`);
      ok(c.body.subject === 'Good talking to you' && c.body.html === '<p>Hi</p>' && c.body.text === 'Hi', 'subject, html and text ride as given');
      ok(dump(Object.keys(c.body.headers)) === dump(['List-Unsubscribe', 'List-Unsubscribe-Post']), `only well formed headers ride (${dump(c.body.headers)})`);
      stub.set([{ status: 500, body: { message: 'boom' } }, { status: 200, body: { id: 'em_2' } }]); stub.calls.length = 0;
      const r2 = await T.sendEmail(db, msg());
      ok(r2.ok && r2.attempts === 2 && stub.calls.length === 2 && r2.providerId === 'em_2', `a 5xx is retried once and the second answer wins (${dump(r2)})`, 'retry-5xx');
      stub.set([{ throw: 'fetch failed' }, { status: 200, body: { id: 'em_3' } }]); stub.calls.length = 0;
      const r3 = await T.sendEmail(db, msg());
      ok(r3.ok && r3.attempts === 2 && stub.calls.length === 2, `a network error is retried once (${dump(r3)})`, 'retry-5xx');
      stub.set([{ status: 503, body: {} }, { status: 502, body: {} }, { status: 200, body: { id: 'never' } }]); stub.calls.length = 0;
      const r4 = await T.sendEmail(db, msg());
      ok(!r4.ok && r4.status === 'failed' && r4.attempts === 2 && stub.calls.length === 2 && r4.httpStatus === 502, `two 5xx answers fail after exactly one retry, never a third try (${dump(r4)})`, 'one-retry');
      stub.set([{ status: 422, body: { message: `Invalid to address for key ${KEY}` } }, { status: 200, body: { id: 'never' } }]); stub.calls.length = 0;
      const r5 = await T.sendEmail(db, msg());
      ok(!r5.ok && r5.status === 'failed' && r5.attempts === 1 && stub.calls.length === 1, `a 4xx fails at once and is never retried (${dump(r5)})`, 'no-retry-4xx');
      ok(r5.error.includes('Invalid to address') && !r5.error.includes(KEY) && !dump(r5).includes(KEY), `the error carries Resend's message and never the key (${r5.error})`, 'scrub-key');
      const r6 = await T.sendEmail(db, msg({ to: 'not an address' }));
      ok(!r6.ok && r6.attempts === 0 && /address/.test(r6.error), 'a bad address never reaches the network');
      const r7 = await T.sendEmail(db, msg({ subject: '  ' }));
      ok(!r7.ok && r7.attempts === 0 && /subject/.test(r7.error), 'an empty subject never reaches the network');
      const st = await admin('status');
      ok(st._status === 200 && st._json.connected === true && st._json.sender.replyTo === 'rob@visualizeclients.com' && !dump(st._json).includes(KEY), `connected with the key, the reply to from settings, the key nowhere in the answer (${dump(st._json)})`, 'status-no-key');
    }
    /* 3. the rate guard: thirty in the hour, the thirty first refused with a retry after, counted in test mode too. */
    _reset(); stub.calls.length = 0; delete process.env.RESEND_API_KEY;
    {
      let last = null;
      for (let i = 0; i < 30; i++) last = await T.sendEmail(db, msg());
      ok(last && last.ok && last.test, 'thirty test mode sends in an hour go through');
      const over = await T.sendEmail(db, msg());
      ok(!over.ok && over.limited === true && over.retryAfter > 0 && over.error === T.LIMIT_MESSAGE, `the thirty first is refused with a retry after (${dump(over)})`, 'rate-guard');
      ok((await T.sendsThisHour(db)) === 30, 'the hour counts thirty, the refused one not among them', 'rate-count');
      process.env.RESEND_API_KEY = KEY; stub.calls.length = 0;
      const stillOver = await T.sendEmail(db, msg());
      ok(!stillOver.ok && stillOver.limited === true && stub.calls.length === 0, 'the guard holds once the key is in, with no request made', 'rate-guard');
      delete process.env.RESEND_API_KEY;
      const doc = _stores.settings.find(s => String(s._id).startsWith('rate:esend:'));
      ok(!!doc && Array.isArray(doc.hits) && doc.hits.length === 30 && /^rate:esend:[0-9a-f]{32}$/.test(String(doc._id)), 'the guard lives in the settings collection under the rate: key pattern, the key a hash');
    }
    /* 4. the log: the two indexes, the capped shape, the duplicate window, the hour, the queue. */
    _reset();
    {
      const specs = []; delete globalThis._vzEmailIdx;
      const fakeDb = { collection: () => ({ createIndex: async (s) => { specs.push(s); return 'ok'; } }) };
      const made = await L.ensureEmailIndexes(fakeDb);
      ok(made === true && dump(specs) === dump([{ recordId: 1, createdAt: -1 }, { status: 1, createdAt: -1 }]), `ensureEmailIndexes creates recordId+createdAt and status+createdAt (${dump(specs)})`, 'log-indexes');
      ok((await L.ensureEmailIndexes(fakeDb)) === false && specs.length === 2, 'and only once per warm instance');
      delete globalThis._vzEmailIdx;
      const big = 'x'.repeat(200000);
      const e = L.logEntry({ recordId: '507f1f77bcf86cd799439011', templateId: 'intro_call', class: 'marketing', to: ['a@b.co', 'a@b.co', 'c@d.co'], subject: 's'.repeat(300), html: big, text: big, status: 'bogus', auto: 'yes', error: 'e'.repeat(400) });
      ok(e.html.length === L.HTML_CAP && e.text.length === 20000 && e.subject.length === 200 && e.error.length === 300 && e.status === 'draft' && e.auto === true && e.class === 'marketing' && e.to.length === 3 && e.createdAt instanceof Date, `the entry is capped and shaped (html ${e.html.length}, text ${e.text.length}, status ${e.status})`, 'log-cap');
      ok(L.logEntry({ class: 'spam', status: 'queued' }).class === 'transactional' && L.logEntry({ status: 'queued' }).status === 'queued', 'an unknown class reads transactional, a known status is kept');
      const w = await L.writeLog(db, { recordId: 'R1', templateId: 'intro_call', status: 'sent', to: ['a@b.co'], subject: 'one', html: '<p>1</p>', text: '1', sentAt: new Date().toISOString(), createdAt: new Date(Date.now() - 2000) });
      ok(!!w._id && _stores.email_log.length === 1 && _stores.email_log[0].status === 'sent', 'writeLog stores the entry in email_log');
      await L.writeLog(db, { recordId: 'R1', templateId: 'intro_call', status: 'failed', to: ['a@b.co'], subject: 'two', error: 'no', createdAt: new Date(Date.now() - 1000) });
      await L.writeLog(db, { recordId: 'R2', templateId: 'invoice', status: 'test', to: ['z@b.co'], subject: 'three' });
      const old = await L.writeLog(db, { recordId: 'R1', templateId: 'booking_nudge', status: 'sent', to: ['a@b.co'], subject: 'old', createdAt: new Date(Date.now() - 3 * 3600e3) });
      const dup = await L.sentWithin(db, { recordId: 'R1', templateId: 'intro_call' });
      ok(dup && dup.subject === 'one' && !('html' in dup), 'sentWithin finds the intro sent minutes ago (without its html)');
      ok((await L.sentWithin(db, { recordId: 'R1', templateId: 'booking_nudge' })) === null, 'and not one from three hours ago');
      ok((await L.sentWithin(db, { recordId: 'R2', templateId: 'intro_call' })) === null, 'and not another record\'s');
      ok((await L.sentLastHour(db)) === 2, `sentLastHour counts sent and test entries from the hour (${await L.sentLastHour(db)})`);
      const mine = await L.logFor(db, { recordId: 'R1' });
      ok(mine.length === 3 && mine[0].subject === 'two' && mine[2].subject === 'old' && mine.every(r => !('html' in r)), `logFor answers one record's entries newest first without html (${mine.map(r => r.subject).join(',')})`);
      const recent = await L.recentLog(db, { limit: 50 });
      ok(recent[0].status === 'failed' && recent.length === 4, `recentLog puts failures first (${recent.map(r => r.status).join(',')})`);
      await L.updateLog(db, old._id, { status: 'queued', sendAt: new Date(Date.now() - 60e3).toISOString() });
      const due = await L.dueQueued(db);
      ok(due.length === 1 && String(due[0]._id) === String(old._id), 'dueQueued answers the queued entry whose sendAt has passed');
      await L.updateLog(db, old._id, { sendAt: new Date(Date.now() + 3600e3).toISOString() });
      ok((await L.dueQueued(db)).length === 0, 'and not one still in the future');
    }
    /* 5. the route: methods and unknown actions, the admin guard. */
    _reset();
    {
      const post = await admin('status', 'POST', {});
      ok(post._status === 405 && post._headers.Allow === 'GET', 'POST on status is 405 with Allow GET', 'status-method');
      const nope = await admin('nothing');
      ok(nope._status === 404, 'an unknown action is 404');
      const req = { method: 'GET', query: { r: 'email', a: 'status' }, body: undefined, headers: { 'x-forwarded-for': '203.0.113.9' }, url: '/api/admin/index?r=email&a=status', socket: {} }; const res = fakeRes(); await adminIndex(req, res);
      ok(res._status === 401, 'without the admin cookie the status route is 401');
      const vj = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
      const rw = (vj.rewrites || []).find(r => r.source === '/api/admin/email/:action');
      ok(rw && rw.destination === '/api/admin/index?r=email&a=:action', 'vercel.json rewrites /api/admin/email/<action> onto the admin function with r=email and a=<action>');
      const funcs = fs.readdirSync(path.join(repoRoot, 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_')).length + fs.readdirSync(path.join(repoRoot, 'api', 'admin')).length + fs.readdirSync(path.join(repoRoot, 'api', 'cron')).length + fs.readdirSync(path.join(repoRoot, 'api', 'stripe')).length;
      ok(funcs === 10, `ten Vercel functions of the Hobby plan's twelve, no new one (${funcs})`);
    }
  } finally {
    globalThis.fetch = realFetch; delete process.env.RESEND_API_KEY;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return results;
}
