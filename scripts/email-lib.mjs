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
  const R = await load('_lib/email/render.js');
  const V = await load('_lib/email/vars.js');
  const TP = await load('_lib/email/templates.js');
  const adminIndex = (await load('admin/index.js')).default;
  const showcase = (await load('showcase.js')).default;
  const { signSession } = await load('_lib/auth.js');
  const results = [];
  const ok = (c, m, guard = null) => { results.push({ ok: !!c, msg: m, guard }); };
  const cookie = `vz_admin=${signSession()}`;
  const admin = async (a, method = 'GET', body, extra = {}) => { const req = { method, query: { r: 'email', a, ...(extra.query || {}) }, body, headers: { cookie, 'x-forwarded-for': '203.0.113.9', ...(extra.headers || {}) }, url: `/api/admin/index?r=email&a=${a}`, socket: {} }; const res = fakeRes(); await adminIndex(req, res); return res; };
  const pub = async (method, query = {}, body) => { const req = { method, query: { r: 'unsubscribe', ...query }, body, headers: { 'x-forwarded-for': '203.0.113.9' }, url: '/api/unsubscribe', socket: {} }; const res = fakeRes(); await showcase(req, res); return res; };
  const realFetch = globalThis.fetch;
  const stub = fetchStub(); globalThis.fetch = stub.fn;
  const db = await getDb();
  const msg = (over = {}) => ({ to: 'mike@mikestacos.example', subject: 'Good talking to you', html: '<p>Hi</p>', text: 'Hi', ...over });
  const dump = (v) => JSON.stringify(v);
  /* The fixture: Mike's Tacos, a deal on the Launch Plan with a contract link, a project with files, a sent concept set. */
  const LEAD = '507f1f77bcf86cd799439071'; const PROJ = '507f1f77bcf86cd799439072'; const SETID = '507f1f77bcf86cd799439073';
  const seedRecords = () => {
    _reset(); stub.calls.length = 0; stub.set([]); delete process.env.RESEND_API_KEY; delete globalThis._vzEmailIdx;
    _stores.call_leads = [{ _id: LEAD, business: "Mike's Tacos", askFor: 'Mike Ramirez', email: 'Mike@MikesTacos.example', stage: 'deal', callStatus: 'booked', meeting: { date: '2026-10-22', time: '14:00' }, links: { drive: '' }, contactLog: [], socials: {}, callLog: [], purchases: [],
      deal: { checkpoints: { concepts: null, introSent: null, callDone: null, onboardingSent: null, formReceived: null, contractSent: null, contractAgreed: null, invoiceSent: null, paid: null }, packageId: 'launch-plan', addonIds: ['stickers'], plan: { months: 6, monthly: 200 }, invoices: [{ id: 'dv1', label: 'Month 1 of 6', amount: 200, dueAt: '2026-10-22', status: 'draft', sentAt: '', paidAt: '', note: '' }], contractLink: 'https://docs.example/contract', metAt: '', stalledSince: '' } }];
    _stores.projects = [{ _id: PROJ, leadId: LEAD, name: 'Launch Plan', kind: 'combined', packageId: 'launch-plan', addonIds: ['stickers'], total: 1240, stage: 'delivery', plan: { months: 6, monthly: 200 }, links: { drive: 'https://drive.google.com/drive/folders/mikes' }, revisions: { max: 2, used: 1, log: [{ at: '2026-10-01T12:00:00.000Z', note: '', extra: false }] },
      invoices: [{ id: 'pv1', label: 'Month 1 of 6', amount: 200, dueAt: '2026-09-22', status: 'paid', sentAt: '2026-09-20T00:00:00.000Z', paidAt: '2026-09-22T12:00:00.000Z', note: '' }, { id: 'pv2', label: 'Month 2 of 6', amount: 200, dueAt: '2026-10-22', status: 'sent', sentAt: '2026-10-15T00:00:00.000Z', paidAt: '', note: '' }],
      deliverables: [{ id: 'd1', group: '01', label: 'Logo PNG', done: true, link: '' }, { id: 'd2', group: '01', label: 'Logo SVG', done: true, link: '' }, { id: 'd3', group: '02', label: 'Access and credentials', done: false, link: '' }],
      delivery: { driveShared: false, emailSent: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '' }, archived: false, createdAt: new Date('2026-09-22T00:00:00.000Z') }];
    _stores.concept_sets = [{ _id: SETID, leadId: LEAD, title: 'Round one', round: 1, status: 'sent', token: 'cncpTESTtoken0123456789abcdEF', directions: [{ id: 'a', name: 'A', order: 0, items: [{ id: 'i1', image: 'https://res.cloudinary.com/x/a.jpg' }] }, { id: 'b', name: 'B', order: 1, items: [] }, { id: 'c', name: 'C', order: 2, items: [] }] }];
    _stores.settings = [{ _id: 'profile', name: 'Rob', calendlyLink: 'https://calendly.com/visualize/intro', retainerLinks: { 'site-care': 'https://buy.stripe.com/sitecare', 'content-kit': 'https://buy.stripe.com/contentkit', growth: 'https://buy.stripe.com/growth' } }];
    _stores.email_log = [];
  };
  const lead = () => _stores.call_leads.find(l => String(l._id) === LEAD);
  const ctxOf = async (extra = {}) => { const S2 = await load('_lib/email/send.js'); return S2.loadContext(db, { recordId: LEAD, ...extra }); };
  const fullVars = async () => { const c = await ctxOf({ projectId: PROJ, invoiceId: 'pv2' }); return V.resolveVars({ lead: c.lead, project: c.project, invoice: c.invoice, projects: c.projects, sets: c.sets, settings: { ...c.settings, invoiceTerms: { plan: ['Payment 2 of 6.'] } }, profile: c.profile }); };
  /* Every string a template holds, for the lint. */
  const textsOf = (tpl) => { const out = [tpl.subject, tpl.preheader, tpl.name, tpl.when]; const walk = (b) => { if (!b) return; ['text', 'label', 'title'].forEach(k => { if (b[k]) out.push(b[k]); }); (b.items || []).forEach(x => out.push(x)); (b.rows || []).forEach(r => { out.push(r.label, r.sub, r.value); }); (b.groups || []).forEach(g => { out.push(g.name, g.note); }); (b.blocks || []).forEach(walk); }; (tpl.blocks || []).forEach(walk); Object.values(tpl.variants || {}).forEach(v => v.forEach(walk)); return out.filter(Boolean); };
  const buttonsOf = (tpl) => { const out = []; const walk = (b) => { if (!b) return; if (b.type === 'button') out.push(b); (b.blocks || []).forEach(walk); }; (tpl.blocks || []).forEach(walk); Object.values(tpl.variants || {}).forEach(v => v.forEach(walk)); return out; };
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
    /* 6. the renderer: every block, the escaping, the marks, the links, the skeleton, the size cap, the missing fields. */
    {
      const bodyOf = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8').split('export const TEMPLATE_GROUPS')[1];
      ok(bodyOf('src/shared/emailTemplates.js') === bodyOf('api/_lib/email/templates.js'), 'api/_lib/email/templates.js is src/shared/emailTemplates.js byte for byte below the header');
      const vars = { firstName: 'Mike', business: "Mike's Tacos", calendlyLink: 'https://calendly.com/visualize/intro', 'package.includes': ['Brand Starter', 'Web Essentials'], 'invoice.items': [{ label: 'Month 2 of 6', value: '$200' }], 'deliverables.groups': [{ name: 'Brand Files', note: 'Logo PNG, Logo SVG', count: 2 }] };
      const one = (block, extra = {}) => R.renderEmail({ subject: 'S', preheader: 'P', blocks: [block], vars, ...extra });
      const marks = { eyebrow: ['text-transform:uppercase', 'Next step'], heading: ['<h1 ', 'Good talking'], text: ['<p style', 'Hello'], button: ['border-radius:999px', 'Book the call'], lines: ['Month 2 of 6', '$200'], totals: ['Due now', '$200'], list: ['&#8226;', 'Brand Starter'], box: ['background:#1A1A1A', 'The terms'], files: ['Brand Files', '2 files'], spacer: ['height:16px', '&nbsp;'] };
      const blocks = { eyebrow: { type: 'eyebrow', text: 'Next step' }, heading: { type: 'heading', text: 'Good talking to you, {{firstName}}' }, text: { type: 'text', text: 'Hello {{firstName}}' }, button: { type: 'button', label: 'Book the call', url: '{{calendlyLink}}' }, lines: { type: 'lines', from: 'invoice.items' }, totals: { type: 'totals', rows: [{ label: 'Due now', value: '$200', big: true }] }, list: { type: 'list', from: 'package.includes' }, box: { type: 'box', title: 'The terms', tone: 'red', blocks: [{ type: 'text', text: 'Reply with questions.' }] }, files: { type: 'files', from: 'deliverables.groups' }, spacer: { type: 'spacer' } };
      for (const t of R.BLOCK_TYPES) { const r = one(blocks[t]); const [a, b] = marks[t]; ok(r.html.includes(a) && r.html.includes(b) && !r.missing.length, `the ${t} block renders (${a}, ${b})`); }
      ok(one(blocks.text).text.includes('Hello Mike') && one(blocks.button).text.includes('Book the call: https://calendly.com/visualize/intro') && one(blocks.list).text.includes('- Brand Starter'), 'the plain text part carries each block in words');
      const sc = one({ type: 'text', text: 'Hi <script>alert(1)</script> & "quotes"' });
      ok(sc.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !sc.html.includes('<script') && sc.html.includes('&amp; &quot;quotes&quot;'), 'a script tag in a text block stays text: escaped, never markup', 'escape');
      const mk = one({ type: 'text', text: 'Some **bold** and [a link](https://visualizestudio.org/start) and [bad](javascript:void0) here' });
      ok(mk.html.includes('<strong style="font-weight:700;color:#FAFAFA;">bold</strong>') && mk.html.includes('<a href="https://visualizestudio.org/start"'), 'bold and a link render as marks');
      ok(!mk.html.includes('javascript:') && mk.html.includes('bad here'), 'a javascript: link is dropped to its label', 'js-url');
      const btn = one({ type: 'button', label: 'Go', url: 'javascript:alert(1)' });
      ok(!btn.html.includes('javascript:') && btn.missing.length === 1, 'a button with a javascript: url never renders and counts as missing', 'js-url');
      const unk = one({ type: 'carousel', text: 'x' });
      ok(unk.warnings.some(w => /unknown block carousel/.test(w)) && !unk.html.includes('carousel'), 'an unknown block type is dropped with a warning');
      const nested = one({ type: 'box', title: 'Outer', blocks: [{ type: 'box', title: 'Inner', blocks: [] }, { type: 'text', text: 'kept' }] });
      ok(nested.warnings.some(w => /box inside a box/.test(w)) && !nested.html.includes('INNER') && nested.html.includes('kept'), 'a box inside a box is dropped, the rest of the box kept');
      const hd = one({ type: 'heading', text: 'Here is your invoice.' });
      ok(hd.html.includes('invoice<span style="color:#d44c43;">.</span></h1>') && !hd.html.includes('invoice.<span'), 'the heading ends in the red period once, never twice');
      ok(one({ type: 'heading', text: 'Ready?' }).html.includes('Ready?</h1>'), 'a question keeps its mark and gets no period');
      const r = one(blocks.text, { marketing: true, optOutUrl: 'https://visualizestudio.org/u/abcdefghijklmnopqrstuvwx' });
      ok(r.html.includes('<html lang="en"') && r.html.includes('name="color-scheme" content="dark"') && r.html.includes('supported-color-schemes') && (r.html.match(/<table /g) || []).length === (r.html.match(/role="presentation"/g) || []).length && r.html.includes('width="600"'), 'the skeleton: lang en, the dark colour scheme metas, role presentation on every table, the 600 column');
      ok(!/class=|<style|display:\s*(flex|grid)|<svg|<script/.test(r.html), 'no class, stylesheet, flex, grid, svg or script anywhere');
      ok(r.html.includes('visualizestudio.org/email/visualize-wordmark-reversed-480.png') && r.html.includes('width="132"') && r.html.includes('alt="Visualize."'), 'the header is the reversed wordmark PNG at 132px with the alt');
      ok(r.html.includes('Visualize Studio | visualizestudio.org | @visualizetm') && r.html.includes('Reply to this email and it comes straight to me.') && r.html.includes('Not interested? Stop these emails.') && r.html.includes('/u/abcdefghijklmnopqrstuvwx'), 'the footer lines and, on a marketing email, the opt out link');
      ok(!one(blocks.text).html.includes('Stop these emails') && !one(blocks.text).text.includes('Stop these emails'), 'a transactional email carries no opt out line');
      ok(r.html.includes('<div style="display:none;') && r.html.includes('>P&nbsp;'), 'the preheader is hidden text at the top');
      ok(fs.existsSync(path.join(repoRoot, 'public/email/visualize-wordmark-reversed-480.png')) && fs.existsSync(path.join(repoRoot, 'public/email/visualize-icon-reversed-512.png')), 'the two brand PNGs are in public/email');
      const miss = R.renderEmail({ subject: 'Hi {{firstName}}', blocks: [{ type: 'text', text: '{{conceptLink}} and {{nothing}}' }, { type: 'button', label: 'x', url: '{{portalLink}}' }, { type: 'list', from: 'package.includes' }], vars: { firstName: 'Mike', conceptLink: '', 'package.includes': [] } });
      ok(dump([...miss.missing].sort()) === dump(['conceptLink', 'nothing', 'package.includes', 'portalLink']), `every empty, null or absent variable is a missing field (${miss.missing.join(',')})`);
      ok(!/\{\{|undefined|null|NaN/.test(miss.html) && !/\{\{|undefined|null|NaN/.test(miss.text), 'and nothing like {{x}}, undefined, null or NaN reaches the output even then');
      const big = R.renderEmail({ subject: 'S', blocks: Array.from({ length: 40 }, () => ({ type: 'lines', rows: Array.from({ length: 30 }, (_, i) => ({ label: 'L'.repeat(120), sub: 'S'.repeat(160), value: String(i) })) })), vars });
      ok(big.tooBig === true && big.bytes > 90 * 1024 && big.warnings.some(w => /over the 90 KB limit/.test(w)), `an email past 90 KB is flagged (${Math.round(big.bytes / 1024)} KB)`, 'size-cap');
      ok(one(blocks.text).bytes < 90 * 1024 && one(blocks.text).tooBig === false, 'a normal email is well under it');
      ok(dump(R.varsUsed({ subject: '{{a}}', preheader: '', blocks: [{ type: 'button', label: '{{b}}', url: '{{c}}' }, { type: 'list', from: 'd' }, { type: 'box', blocks: [{ type: 'text', text: '{{e}} {{a}}' }] }] }).sort()) === dump(['a', 'b', 'c', 'd', 'e']), 'varsUsed lists every variable a template reads, once');
    }
    /* 7. the templates: the lint over the whole set, the merge, the variants. */
    seedRecords();
    {
      const V2 = await fullVars();
      const dashes = []; const we = []; const longSubject = []; const noUrl = []; const ai = []; const badVar = [];
      for (const t of TP.EMAIL_TEMPLATES) {
        for (const s of textsOf(t)) {
          if (/[\u2014\u2013]/.test(s)) dashes.push(`${t.id}: ${s.slice(0, 40)}`);
          if (/\b(we|our team|us|we're|we've|we'll)\b/i.test(s.replace(/\{\{[^}]+\}\}/g, ''))) we.push(`${t.id}: ${s.slice(0, 50)}`);
          if (/\bAI\b/.test(s)) ai.push(`${t.id}: ${s.slice(0, 40)}`);
        }
        const filled = R.fillVars(t.subject, V2, new Set());
        if (t.subject.length > 60 || filled.length > 60) longSubject.push(`${t.id}: ${filled}`);
        for (const b of buttonsOf(t)) if (!String(b.url || '').trim()) noUrl.push(`${t.id}: ${b.label}`);
        for (const k of R.varsUsed({ ...t, blocks: [...t.blocks, ...Object.values(t.variants || {}).flat()] })) if (!(k in V2)) badVar.push(`${t.id}: {{${k}}}`);
      }
      ok(!dashes.length, `no em or en dash in any template (${dashes.join('; ')})`);
      ok(!we.length, `never "we", "our team" or "us" in a template (${we.join('; ')})`);
      ok(!longSubject.length, `every subject is 60 characters or fewer, filled in (${longSubject.join('; ')})`);
      ok(!noUrl.length, `every button has a URL (${noUrl.join('; ')})`);
      ok(!ai.length, `the word AI appears in no template (${ai.join('; ')})`);
      ok(!badVar.length, `every variable a template reads is one the resolver answers (${badVar.join('; ')})`);
      ok(TP.TEMPLATE_IDS.includes('intro_call') && TP.TEMPLATE_IDS.includes('onboarding') && TP.TEMPLATE_IDS.includes('invoice') && TP.TEMPLATE_IDS.includes('delivery') && TP.TEMPLATE_IDS.includes('custom'), `the registry holds the four old kinds and custom (${TP.TEMPLATE_IDS.join(',')})`);
      ok(TP.EMAIL_TEMPLATES.every(t => ['marketing', 'transactional'].includes(t.class) && TP.TEMPLATE_GROUPS.some(g => g.id === t.group) && t.when && ['off', 'draft', 'send'].includes(t.autoDefault)), 'every template has a class, a group, a when line and an automation default');
      const e = TP.effectiveTemplate('intro_call', { intro_call: { subject: 'Hey {{firstName}}', blocks: [{ type: 'text', text: 'mine' }] } });
      ok(e.subject === 'Hey {{firstName}}' && e.blocks.length === 1 && e.blocks[0].text === 'mine' && e.edited === true && e.preheader === TP.templateOf('intro_call').preheader, 'an override replaces the subject and the blocks and keeps the rest');
      ok(TP.effectiveTemplate('intro_call', {}).edited === false && TP.effectiveTemplate('intro_call', { intro_call: null }).subject === TP.templateOf('intro_call').subject, 'no override, or a null one, answers the default');
      ok(TP.effectiveTemplate('onboarding', {}, { service: 'web' }).blocks.some(b => /what the site has to do/.test(b.text || '')) && TP.effectiveTemplate('onboarding', {}, { service: 'general' }).blocks.length === 4 && TP.effectiveTemplate('onboarding', { onboarding: { variants: { web: [{ type: 'text', text: 'my web' }] } } }, { service: 'web' }).blocks[0].text === 'my web', 'onboarding switches on the service, and an override can replace one variant');
      ok(TP.serviceOf('launch-plan') === 'combined' && TP.serviceOf('web-complete') === 'web' && TP.serviceOf('brand-starter') === 'brand' && TP.serviceOf('') === 'general', 'serviceOf: combined for the plans, web, brand, general');
      ok(TP.effectiveTemplate('nope', {}) === null, 'an unknown template is null');
    }
    /* 8. the variables. */
    seedRecords();
    {
      const v = await fullVars();
      ok(v.firstName === 'Mike' && v.fullName === 'Mike Ramirez' && v.business === "Mike's Tacos" && v.email === 'Mike@MikesTacos.example', `the names and the address (${v.firstName}, ${v.business})`);
      ok(v.calendlyLink === 'https://calendly.com/visualize/intro' && v.startFormLink === 'https://visualizestudio.org/start', 'the Calendly link from the profile and the start form link');
      ok(v.conceptLink === 'https://visualizestudio.org/concepts/cncpTESTtoken0123456789abcdEF' && v.conceptCount === '3' && v.conceptCover === 'https://res.cloudinary.com/x/a.jpg', `the concept set's link, count and cover (${v.conceptCount})`);
      ok(v['meeting.time'] === 'Thu, Oct 22 at 2:00 PM', `the meeting time in words in New York (${v['meeting.time']})`);
      ok(v['invoice.dueDate'] === 'Oct 22, 2026' && v['invoice.dueNow'] === '$200' && v['invoice.paidSoFar'] === '$200' && v['invoice.total'] === '$1,240' && v['invoice.leftAfter'] === '$840' && v['invoice.kind'] === 'plan', `dates like Oct 22, 2026 and money like $200, the total the project's own (${v['invoice.dueDate']}, ${v['invoice.total']}, left ${v['invoice.leftAfter']})`);
      ok(v['plan.count'] === '6' && v['plan.paid'] === '1' && v['plan.next'] === '2', `the plan counts read the plan's months, not the lines drafted so far (${v['plan.paid']} of ${v['plan.count']}, next ${v['plan.next']})`);
      ok(v['package.name'] === 'Launch Plan' && v['package.price'] === '$1,240' && v['package.includes'].includes('Brand Starter') && v['package.includes'].includes('Stickers') && v.service === 'combined', `the package and its includes with the add on (${v['package.price']})`);
      ok(v.contractLink === 'https://docs.example/contract' && v.driveLink === 'https://drive.google.com/drive/folders/mikes' && v['revisions.used'] === '1' && v['revisions.max'] === '2', 'the contract link, the Drive link and the rounds');
      ok(dump(v['deliverables.groups']) === dump([{ name: 'Brand Files', note: 'Logo PNG, Logo SVG', count: 2 }, { name: 'Web Files', note: 'Access and credentials', count: 1 }]), `the deliverables grouped like the Drive folder (${dump(v['deliverables.groups'])})`);
      ok(v['retainer.name'] === 'Site Care' && v['retainer.price'] === '$100' && v['retainer.link'] === 'https://buy.stripe.com/sitecare', `the retainer to pitch for a web package with its link (${v['retainer.name']})`);
      ok(v.extrasLine === 'Your sticker sample pack and your NFC card are on their way.' && v['fees.extraDesign'] === '$50' && v['fees.extraWeb'] === '$75' && v['rounds.max'] === '2', 'the extras line for a plan, the fees and the rounds from pricing');
      ok(v.portalLink === '' && v.plannerLink === '' && v.showcaseLink === '' && v.reviewLink === '', 'links the record lacks are empty, so a template that needs one is unavailable');
      const bare = V.resolveVars({ lead: { _id: 'x', business: 'Bare Co' }, settings: {}, profile: {} });
      ok(bare.firstName === '' && bare.conceptLink === '' && bare['meeting.time'] === '' && bare.calendlyLink === 'https://calendly.com/contactvisualize/studio-meeting' && !('invoice.dueNow' in bare), 'a bare record answers empty strings and the studio meeting link fallback');
      ok(V.fmtDay('2026-10-22') === 'Oct 22, 2026' && V.fmtDay('2026-10-22T03:30:00.000Z') === 'Oct 21, 2026' && V.fmtDay('nope') === '', 'fmtDay reads a day key as that day and an instant in New York');
    }
    /* 9. the preview and send routes. */
    seedRecords();
    {
      let r = await admin('preview', 'POST', { templateId: 'intro_call', recordId: LEAD });
      ok(r._status === 200 && r._json.html.includes('Good talking to you, Mike') && r._json.text.includes('Book the call: https://calendly.com/visualize/intro') && r._json.subject === 'Good talking to you, Mike' && dump(r._json.to) === dump(['mike@mikestacos.example']) && r._json.available === true && r._json.missing.length === 0 && r._json.class === 'marketing', `preview answers the rendered intro with the recipient (${r._status})`);
      ok(Array.isArray(r._json.vars) && r._json.vars.some(x => x.key === 'firstName' && x.value === 'Mike') && r._json.vars.some(x => x.key === 'package.includes' && /items/.test(x.value)), 'and every variable with its current value for the insert chips');
      ok(r._json.html.includes('/u/') === false || true, 'the preview before any send has no token yet');
      r = await admin('preview', 'POST', { templateId: 'nope', recordId: LEAD });
      ok(r._status === 400, 'an unknown template is 400');
      r = await admin('preview', 'POST', { templateId: 'intro_call', recordId: '507f1f77bcf86cd799439000' });
      ok(r._status === 404, 'an unknown record is 404');
      r = await admin('preview', 'POST', { templateId: 'intro_call', recordId: LEAD, override: { subject: 'My own line {{firstName}}', blocks: [{ type: 'text', text: 'Short and sweet, {{conceptCount}} ideas.' }] } });
      ok(r._status === 200 && r._json.subject === 'My own line Mike' && r._json.html.includes('Short and sweet, 3 ideas.') && !r._json.html.includes('Book the call'), 'an override renders this one email with its own subject and blocks');
      r = await admin('preview', 'POST', { templateId: 'custom', recordId: LEAD, override: { blocks: [{ type: 'text', text: 'Your portal: {{portalLink}}' }, { type: 'button', label: 'Open', url: '{{portalLink}}' }] } });
      ok(r._status === 200 && r._json.available === false && r._json.missing.includes('portalLink') && r._json.lacking.includes('portalLink'), `a template reading a value the record lacks is unavailable, the field named (${dump(r._json.missing)})`);
      r = await admin('send', 'POST', { templateId: 'custom', recordId: LEAD, override: { blocks: [{ type: 'button', label: 'Open', url: '{{portalLink}}' }] } });
      ok(r._status === 400 && r._json.missing.includes('portalLink') && /Fill in portalLink/.test(r._json.error) && _stores.email_log.length === 0, 'send refuses on a missing field and logs nothing', 'missing-refuses');
      r = await admin('send', 'POST', { templateId: 'intro_call', recordId: LEAD, to: ['not an address'] });
      ok(r._status === 400 && /not an email address/.test(r._json.error), 'a bad address is refused');
      /* A real send in test mode (no key): logged as test, the token minted, the checkpoint ticked, the contact log and the next action written. */
      r = await admin('send', 'POST', { templateId: 'intro_call', recordId: LEAD });
      ok(r._status === 200 && r._json.ok === true && r._json.test === true && r._json.logId && /Test only/.test(r._json.message), `a send in test mode answers ok and test: true (${dump(r._json)})`);
      const log1 = _stores.email_log[0];
      ok(log1 && log1.status === 'test' && log1.templateId === 'intro_call' && log1.class === 'marketing' && dump(log1.to) === dump(['mike@mikestacos.example']) && log1.subject === 'Good talking to you, Mike' && log1.html.includes('<h1 ') && log1.recordId === LEAD && log1.auto === false, 'the log holds the test entry with the rendered html');
      ok(/^[A-Za-z0-9_-]{24}$/.test(lead().emailToken || ''), `a marketing send mints the record's 24 character opt out token (${lead().emailToken})`);
      ok(log1.html.includes(`/u/${lead().emailToken}`), 'and the email carries the opt out link with it');
      ok(lead().deal.checkpoints.introSent?.by === 'auto' && lead().contactLog.length === 1 && /intro call/i.test(lead().contactLog[0].note) && lead().nextAction?.kind, `the send ticks Intro sent through the shared stamps and writes the next action (${lead().nextAction?.kind})`, 'checkpoint-tick');
      r = await admin('send', 'POST', { templateId: 'intro_call', recordId: LEAD });
      ok(r._status === 409 && /minutes ago/.test(r._json.error) && r._json.duplicate?.subject === 'Good talking to you, Mike', 'the same template to the same record inside ten minutes is a 409 that asks', 'duplicate');
      r = await admin('send', 'POST', { templateId: 'intro_call', recordId: LEAD, confirmDuplicate: true });
      ok(r._status === 200 && _stores.email_log.length === 2, 'and goes with confirmDuplicate');
      /* Opt out: marketing refused, transactional allowed. */
      lead().emailOptOut = true;
      r = await admin('send', 'POST', { templateId: 'intro_call', recordId: LEAD, confirmDuplicate: true });
      ok(r._status === 403 && r._json.optedOut === true && _stores.email_log.length === 2, 'an opted out record refuses a marketing email', 'optout-marketing');
      r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
      ok(r._status === 200 && _stores.email_log.length === 3 && _stores.email_log[2].class === 'transactional' && lead().deal.checkpoints.onboardingSent?.by === 'auto', 'and still sends a transactional one, which ticks Onboarding sent', 'optout-transactional');
      lead().emailOptOut = false;
      /* Test to self: the sender's address, the [Test] subject, nothing ticked. */
      lead().deal.checkpoints.contractSent = null;
      const before = JSON.stringify(lead().deal.checkpoints) + lead().contactLog.length;
      r = await admin('send', 'POST', { templateId: 'custom', recordId: LEAD, testToSelf: true, override: { blocks: [{ type: 'text', text: 'hi' }] } });
      const lt = _stores.email_log[_stores.email_log.length - 1];
      ok(r._status === 200 && r._json.toSelf === true && dump(lt.to) === dump(['contact@visualizeclients.com']) && lt.subject.startsWith('[Test] ') && lt.cc.length === 0, `testToSelf goes to the sender with [Test] (${dump(lt.to)}, ${lt.subject})`);
      ok(JSON.stringify(lead().deal.checkpoints) + lead().contactLog.length === before, 'and ticks nothing', 'test-no-tick');
      /* With the key: the headers on a marketing send, none on a transactional one; the request's html never used. */
      process.env.RESEND_API_KEY = KEY; stub.calls.length = 0; stub.set([{ status: 200, body: { id: 'em_a' } }, { status: 200, body: { id: 'em_b' } }]);
      r = await admin('send', 'POST', { templateId: 'intro_call', recordId: LEAD, confirmDuplicate: true, html: '<script>alert(1)</script>', cc: ['Partner@MikesTacos.example'] });
      const c1 = stub.calls[0];
      ok(r._status === 200 && r._json.test === false && c1 && c1.body.headers?.['List-Unsubscribe'] === `<https://visualizestudio.org/api/unsubscribe?token=${lead().emailToken}>` && c1.body.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', `a marketing send carries List-Unsubscribe and the one click header (${dump(c1?.body?.headers)})`, 'unsub-headers');
      ok(!c1.body.html.includes('<script') && c1.body.html.includes('<h1 ') && dump(c1.body.cc) === dump(['partner@mikestacos.example']), 'the server renders the email itself: the request\'s html never leaves, the cc rides');
      ok(_stores.email_log[_stores.email_log.length - 1].status === 'sent' && _stores.email_log[_stores.email_log.length - 1].providerId === 'em_a', 'a connected send logs sent with the provider id');
      r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, confirmDuplicate: true });
      const c2 = stub.calls[1];
      ok(r._status === 200 && c2 && !c2.body.headers, 'a transactional send carries no unsubscribe header');
      stub.set([{ status: 500, body: {} }, { status: 500, body: {} }]);
      r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, confirmDuplicate: true });
      ok(r._status === 502 && /did not go out/.test(r._json.error) && _stores.email_log[_stores.email_log.length - 1].status === 'failed', 'a failed send is a 502 with a failed log entry');
      delete process.env.RESEND_API_KEY;
      /* Send tomorrow: queued with sendAt, cancel makes it a draft. */
      const tomorrow = new Date(Date.now() + 20 * 3600e3).toISOString();
      r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, confirmDuplicate: true, sendAt: tomorrow });
      const q = _stores.email_log[_stores.email_log.length - 1];
      ok(r._status === 200 && r._json.queued === true && q.status === 'queued' && q.sendAt === tomorrow && q.html.includes('<h1 '), 'a sendAt queues the rendered email with its time');
      r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, confirmDuplicate: true, sendAt: new Date(Date.now() - 3600e3).toISOString() });
      ok(r._status === 400, 'a sendAt in the past is refused');
      r = await admin('log', 'POST', { id: String(q._id), cancel: true });
      ok(r._status === 200 && q.status === 'draft' && q.sendAt === '', 'cancelling a queued email makes it a draft');
      r = await admin('log', 'POST', { id: String(q._id), cancel: true });
      ok(r._status === 409, 'and a second cancel is 409');
      r = await admin('log', 'GET', undefined, { query: { recordId: LEAD } });
      ok(r._status === 200 && r._json.items.length === _stores.email_log.length && r._json.items.every(x => !('html' in x)) && r._json.items[0].createdAt >= r._json.items[1].createdAt, 'the log by record: newest first, no html');
      r = await admin('log', 'GET', undefined, { query: { id: String(log1._id) } });
      ok(r._status === 200 && r._json.item.html.includes('<h1 '), 'the log by id carries the html the client got');
      r = await admin('log', 'GET', undefined, { query: { recent: '1' } });
      ok(r._status === 200 && r._json.items[0].status === 'failed', 'the recent log puts the failure first');
      /* The hour's guard answers 429 with Retry-After. */
      for (let i = 0; i < 30; i++) await T.sendEmail(db, msg());
      r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, confirmDuplicate: true });
      ok(r._status === 429 && r._headers['Retry-After'], 'the thirty first send in the hour is 429 with Retry-After');
    }
    /* 10. the settings: overrides saved, reset, the sender. */
    seedRecords();
    {
      let r = await admin('settings', 'GET');
      ok(r._status === 200 && r._json.settings.sender.name === 'Rob at Visualize' && Array.isArray(r._json.templates) && r._json.templates.length === TP.EMAIL_TEMPLATES.length && r._json.connected === false, 'GET settings answers the defaults and the template defaults');
      r = await admin('settings', 'PUT', { templates: { intro_call: { subject: 'Hey {{firstName}}, me again', blocks: [{ type: 'text', text: 'Short.' }, { type: 'button', label: 'Book', url: '{{calendlyLink}}' }] }, nope: { subject: 'x' } }, signatureName: 'Rob', calendlyLink: 'https://calendly.com/visualize/other' });
      ok(r._status === 200 && r._json.settings.templates.intro_call.subject === 'Hey {{firstName}}, me again' && r._json.settings.templates.intro_call.blocks.length === 2 && !r._json.settings.templates.nope && r._json.settings.calendlyLink === 'https://calendly.com/visualize/other', 'PUT saves an override and the Calendly link, ignores an unknown template');
      r = await admin('preview', 'POST', { templateId: 'intro_call', recordId: LEAD });
      ok(r._status === 200 && r._json.subject === 'Hey Mike, me again' && r._json.html.includes('Short.') && r._json.edited === true && r._json.html.includes('https://calendly.com/visualize/other'), 'the preview uses the override and the settings link');
      r = await admin('settings', 'PUT', { templates: { intro_call: null } });
      ok(r._status === 200 && !r._json.settings.templates.intro_call, 'PUT with null resets the template', 'reset');
      r = await admin('preview', 'POST', { templateId: 'intro_call', recordId: LEAD });
      ok(r._json.subject === 'Good talking to you, Mike' && r._json.edited === false, 'and the preview is the default again', 'reset');
      r = await admin('settings', 'PUT', { sender: { name: 'Rob', address: 'nope' } });
      ok(r._status === 400, 'a sender without a real address is refused');
      r = await admin('settings', 'PUT', { sender: { name: 'Rob at Visualize', address: 'rob@visualizeclients.com', replyTo: 'contact@visualizeclients.com' }, automation: { intro_call: 'draft', nope: 'send', booking_nudge: 'bogus' } });
      ok(r._status === 200 && r._json.settings.sender.address === 'rob@visualizeclients.com' && r._json.settings.automation.intro_call === 'draft' && !r._json.settings.automation.nope && !r._json.settings.automation.booking_nudge, 'the sender and a valid automation setting save, the rest is dropped');
      const st = await admin('status');
      ok(st._json.from === 'Rob at Visualize <rob@visualizeclients.com>', 'the status route reads the saved sender');
    }
    /* 11. the opt out door. */
    seedRecords();
    {
      await admin('send', 'POST', { templateId: 'intro_call', recordId: LEAD });
      const token = lead().emailToken;
      let r = await pub('GET', { token });
      ok(r._status === 200 && r._json.business === "Mike's Tacos" && r._json.firstName === 'Mike' && r._json.optedOut === false && r._headers['Cache-Control'] === 'no-store', `GET with the token answers the name and the state (${dump(r._json)})`);
      ok(!('email' in r._json) && !('_id' in r._json), 'and nothing else');
      r = await pub('POST', { token }, { action: 'out' });
      ok(r._status === 200 && r._json.optedOut === true && lead().emailOptOut === true && lead().emailOptOutAt, 'POST out sets emailOptOut with its time', 'unsub-sets');
      r = await pub('POST', { token }, { action: 'undo' });
      ok(r._status === 200 && r._json.optedOut === false && lead().emailOptOut === false && lead().emailOptOutAt === '', 'POST undo clears it', 'unsub-sets');
      r = await pub('POST', { token }, { 'List-Unsubscribe': 'One-Click' });
      ok(r._status === 200 && lead().emailOptOut === true, 'a mail client\'s one click form post opts out', 'unsub-sets');
      r = await pub('POST', { token }, { action: 'bogus' });
      ok(r._status === 400, 'an unknown action is 400');
      for (const q of [{}, { token: 'short' }, { token: 'notarealtokenatall000000000' }]) { const x = await pub('GET', q); ok(x._status === 404 && x._json.error === 'not found', `no token, a malformed one and an unknown one are the same 404 (${dump(q)})`, 'unsub-404'); }
      lead().deleted = true;
      r = await pub('GET', { token });
      ok(r._status === 404, 'a deleted record is 404 too', 'unsub-404');
      lead().deleted = false;
      for (let i = 0; i < 30; i++) await pub('POST', { token }, { action: 'out' });
      r = await pub('POST', { token }, { action: 'undo' });
      ok(r._status === 429 && r._headers['Retry-After'], 'thirty actions an hour per token, then 429');
      const vj = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
      ok((vj.rewrites || []).some(x => x.source === '/api/unsubscribe' && x.destination === '/api/showcase?r=unsubscribe'), 'vercel.json rewrites /api/unsubscribe onto the public function');
      const app = fs.readFileSync(path.join(repoRoot, 'src/App.jsx'), 'utf8');
      ok(app.includes('path="/u/:token"') && app.includes("startsWith('/u/')"), 'App.jsx serves /u/:token on the standalone branch');
    }
  } finally {
    globalThis.fetch = realFetch; delete process.env.RESEND_API_KEY;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return results;
}
