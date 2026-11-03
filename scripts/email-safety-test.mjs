#!/usr/bin/env node
/* Email safety, the Drafts rule (prompt 1 of 3): no email leaves the CRM unless Rob tapped Send on a screen that showed him the
 * recipient, the subject and the body of that exact email. Against the real handlers with the in memory mongo, fetch stubbed (Resend
 * and Gmail never reached) and the push door recorded.
 *   1. email/send writes a draft and sends nothing; sendComposed without the stamp drafts, a forged stamp drafts too
 *   2. the queue never sends a queued entry that lacks the stamp: it becomes a draft and waits
 *   3. the rules draft in every mode, including a saved 'send': zero sends, zero fetches
 *   4. the old log door with send: true answers 403 and nothing moves
 *   5. approve is the one door: it stamps approvedAt and approvedBy 'rob', sends now, or queues with the stamp and the cron sends that
 *   6. a text draft is a row; approve marks it sent by hand, no transport
 *   7. the stamp has one writer: approvalStamp in approve.js; the string that makes it appears nowhere else in api/; no client file
 *      posts send: true to the log; the approve action is called from the preview sheet alone
 *   8. Draft into Gmail: off and unconnected nothing happens; on and connected a draft is mirrored with the token used once, never
 *      stored; the Connect flow (the consent URL, a forged state, a refused code, the good code stored encrypted with the address,
 *      the status without a token, the mirror on the stored token, the variable override, Disconnect),
 *      stored on the row or in an error; a Gmail failure leaves the draft untouched
 *   node scripts/email-safety-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ROOT = process.env.SAFETY_ROOT ? path.resolve(process.env.SAFETY_ROOT) : repoRoot; // a copy with one guard cut (the proof)
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);
const dump = (v) => JSON.stringify(v);
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { return this; } });

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'safety-')); const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(ROOT, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), "export const ownerSubs = async () => [];\nexport const clientSubs = async () => [];\nexport async function sendPush(db, msg) { (globalThis.__vzPushes ||= []).push({ ...msg }); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }\nexport async function sendClientPush() { return { attempted: 0, delivered: 0, removed: 0, errors: ['no-devices'] }; }\n");
process.env.SESSION_SECRET = 'test-not-real'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL; delete process.env.RESEND_API_KEY;
for (const k of ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']) delete process.env[k];
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset, getDb } = await load('_lib/mongo.js');
const S = await load('_lib/email/send.js');
const Q = await load('_lib/email/queue.js');
const RU = await load('_lib/email/rules.js');
const L = await load('_lib/email/log.js');
const G = await load('_lib/email/gmail.js');
const A = await load('_lib/email/approve.js');
const TR = await load('_lib/taskRules.js');
const adminIndex = (await load('admin/index.js')).default;
const { signSession } = await load('_lib/auth.js');
const cookie = `vz_admin=${signSession()}`;
const admin = async (a, method = 'GET', body, extra = {}) => { const req = { method, query: { r: 'email', a, ...(extra.query || {}) }, body, headers: { cookie, 'x-forwarded-for': '203.0.113.9' }, url: `/api/admin/index?r=email&a=${a}`, socket: {} }; const res = fakeRes(); await adminIndex(req, res); return res; };
const db = await getDb();

/* fetch: every call recorded; Resend answers ok; Google answers a token then a draft. Nothing real is reached. */
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url); let body = null; try { body = init.body && String(init.body).startsWith('{') ? JSON.parse(init.body) : String(init.body || ''); } catch { body = null; }
  calls.push({ url: u, body, auth: init.headers?.Authorization || '' });
  const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
  if (u.includes('api.resend.com')) return json({ id: 'em_ok' });
  if (u.includes('oauth2.googleapis.com')) {
    if (globalThis.__gmailRefuse) return json({ error: 'invalid_grant' }, 400);
    /* The Connect flow: a code becomes a refresh token (never real); a refresh token becomes an access token. */
    if (/grant_type=authorization_code/.test(String(body))) return /code=good-code/.test(String(body)) ? json({ access_token: 'ya29.test-access-token-not-real', refresh_token: '1//from-google-not-real', expires_in: 3600 }) : json({ error: 'invalid_grant' }, 400);
    return json({ access_token: 'ya29.test-access-token-not-real', expires_in: 3600 });
  }
  if (u.includes('/users/me/profile')) return json({ emailAddress: 'rob@visualize.example' });
  if (u.includes('gmail.googleapis.com')) return json({ id: 'r-draft-1', message: { id: '18f00abc' } });
  return json({}, 404);
};
const resendCalls = () => calls.filter(c => c.url.includes('api.resend.com'));
const gmailCalls = () => calls.filter(c => c.url.includes('googleapis.com'));

const LEAD = '507f1f77bcf86cd799439071';
const seed = () => {
  _reset(); calls.length = 0; globalThis.__vzPushes = [];
  _stores.settings = [{ _id: 'emails', sender: { name: 'Rob at Visualize', address: 'contact@visualizeclients.com' }, automation: {} }, { _id: 'profile', name: 'Rob', calendlyLink: 'https://calendly.com/visualize/call' }];
  _stores.call_leads = [{ _id: LEAD, business: "Mike's Tacos", askFor: 'Mike', email: 'mike@mikestacos.example', phone: '(302) 555-0100', stage: 'deal', callStatus: 'booked', contactLog: [], checklists: [], deal: { checkpoints: { concepts: null, introSent: null, callDone: null, onboardingSent: { at: new Date(Date.now() - 4 * 864e5).toISOString() }, formReceived: null, contractSent: null, contractAgreed: null, invoiceSent: null, paid: null }, packageId: 'launch-plan', addonIds: [], plan: { months: 6, monthly: 200 }, invoices: [], contractLink: 'https://docs.example/contract', metAt: '', stalledSince: '' }, updatedAt: new Date() }];
  _stores.projects = []; _stores.concept_sets = []; _stores.email_log = [];
};
const rows = () => _stores.email_log;
const byId = (id) => rows().find(e => String(e._id) === String(id)) || {};

section('1. a send without the stamp is a draft');
seed();
{
  let r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, override: { subject: 'Welcome aboard, {{firstName}}' } });
  ok(r._status === 200 && r._json.draft === true && r._json.needsApproval === true && !!r._json.logId, `email/send answers draft: true with the entry (${dump(r._json)})`);
  const d = byId(r._json.logId);
  ok(d && d.status === 'draft' && !d.approvedAt && !d.approvedBy && d.subject === 'Welcome aboard, Mike' && d.override?.subject === 'Welcome aboard, {{firstName}}', `the entry is a draft with the edits kept and no stamp (${dump({ status: d?.status, approvedAt: d?.approvedAt, override: d?.override })})`);
  ok(resendCalls().length === 0 && !_stores.call_leads[0].contactLog.length && !_stores.call_leads[0].deal.checkpoints.onboardingSent?.by, 'nothing left and nothing was stamped');
  process.env.RESEND_API_KEY = 're_test_not_a_real_key';
  r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, confirmDuplicate: true, sendAt: new Date(Date.now() + 3600e3).toISOString() });
  ok(r._status === 200 && r._json.draft === true && byId(r._json.logId).status === 'draft' && byId(r._json.logId).sendAt === '' && resendCalls().length === 0, 'connected, with a sendAt and a confirm on the request: still a draft, no queue, nothing sent');
  const ctx = await S.loadContext(db, { recordId: LEAD });
  let direct = await S.sendComposed(db, ctx, { templateId: 'onboarding' }, { auto: true });
  ok(direct.status === 200 && direct.body.draft === true && resendCalls().length === 0, 'sendComposed called straight, as a rule would: a draft');
  direct = await S.sendComposed(db, ctx, { templateId: 'onboarding' }, { approval: { approvedAt: new Date().toISOString(), approvedBy: 'someone' } });
  ok(direct.status === 200 && direct.body.draft === true && resendCalls().length === 0, 'a stamp by anyone but rob is no stamp: a draft');
  direct = await S.sendComposed(db, ctx, { templateId: 'onboarding' }, { approval: { approvedBy: 'rob' } });
  ok(direct.status === 200 && direct.body.draft === true && resendCalls().length === 0, 'a stamp with no time is no stamp: a draft');
  delete process.env.RESEND_API_KEY;
  r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, testToSelf: true });
  ok(r._status === 200 && r._json.toSelf === true && byId(r._json.logId).toSelf === true && byId(r._json.logId).status === 'test', 'a test to Rob\'s own address is the one send that needs no tap');
}

section('2. the queue never sends what Rob did not approve');
seed();
{
  const q = await L.writeLog(db, { recordId: LEAD, templateId: 'onboarding', class: 'transactional', to: ['mike@mikestacos.example'], subject: 'Old queue', text: 'q', html: '<p>q</p>', status: 'queued', sendAt: new Date(Date.now() - 60e3).toISOString() });
  process.env.RESEND_API_KEY = 're_test_not_a_real_key';
  const r = await Q.runQueuedSends(db, Date.now(), { byDay: false });
  ok(r.checked === 1 && r.sent === 0 && resendCalls().length === 0, `a queued entry from before the rule, with no stamp, is not sent (${dump(r)})`);
  ok(byId(q._id).status === 'draft' && byId(q._id).sendAt === '' && /Needs your tap/.test(byId(q._id).error), `it becomes a draft that says so (${dump({ status: byId(q._id).status, error: byId(q._id).error })})`);
  delete process.env.RESEND_API_KEY;
}

section('3. the rules only draft');
seed();
{
  const allOff = Object.fromEntries(TR.EMAIL_RULES.map(x => [x.template, 'off']));
  for (const mode of ['draft', 'send']) {
    seed();
    await admin('settings', 'PUT', { automation: { ...allOff, form_nudge: mode } });
    const stored = _stores.settings.find(x => x._id === 'emails').automation.form_nudge;
    const r = await RU.runEmailRules(db, Date.now());
    ok(stored === 'draft' && r.fired === 1 && r.drafted === 1 && r.sent === 0 && resendCalls().length === 0 && rows().length === 1 && rows()[0].status === 'draft' && !rows()[0].approvedAt, `automation '${mode}' is stored as draft and the run drafts, sends nothing (${dump(r)})`);
    ok((globalThis.__vzPushes || []).length === 1 && /\/drafts$/.test(globalThis.__vzPushes[0].url) && !(globalThis.__vzPushes || []).some(p => /went out/.test(p.title)), `one push to Drafts, never one that says it went out (${dump((globalThis.__vzPushes || []).map(p => p.title))})`);
  }
  ok(!('AUTO_SEND_CAP' in RU) && Array.isArray((await load('_lib/email/settings.js')).AUTOMATION_IDS) && !(await load('_lib/email/settings.js')).AUTOMATION_IDS.includes('send'), 'there is no send mode and no send cap left in the rules');
  const src = fs.readFileSync(path.join(apiDst, '_lib', 'email', 'rules.js'), 'utf8');
  ok(!/sendComposed|sendDraft|sendLogged/.test(src), 'rules.js imports no send door at all');
}

section('4. the old log door is shut');
seed();
{
  const r0 = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  const id = r0._json.logId;
  process.env.RESEND_API_KEY = 're_test_not_a_real_key';
  const r = await admin('log', 'POST', { id, send: true, confirmDuplicate: true });
  ok(r._status === 403 && r._json.needsApproval === true && byId(id).status === 'draft' && resendCalls().length === 0, `log { send: true } is refused and nothing moves (${r._status} ${dump(r._json)})`);
  delete process.env.RESEND_API_KEY;
}

section('5. approve is the one door out');
seed();
{
  const r0 = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD, override: { subject: 'Welcome aboard, {{firstName}}' } });
  const id = r0._json.logId;
  process.env.RESEND_API_KEY = 're_test_not_a_real_key';
  let r = await admin('approve', 'POST', { id: 'not-an-id' });
  ok(r._status === 400, 'approve needs an id');
  r = await admin('approve', 'POST', { id });
  const d = byId(id);
  ok(r._status === 200 && r._json.ok === true && d.status === 'sent' && d.approvedBy === 'rob' && /^\d{4}-\d{2}-\d{2}T/.test(d.approvedAt) && resendCalls().length === 1, `approve sends it, once, with the stamp on the entry (${r._status} ${dump({ status: d.status, approvedBy: d.approvedBy })})`);
  ok(resendCalls()[0].body.subject === 'Welcome aboard, Mike' && rows().length === 1, 'what went is the draft Rob saw, edits and all, on the same entry');
  ok(_stores.call_leads[0].contactLog.length === 1 && /onboarding/i.test(_stores.call_leads[0].contactLog[0].note || ''), 'and the stamps of a real send follow (the contact log)');
  r = await admin('approve', 'POST', { id });
  ok(r._status === 409, 'a sent entry cannot be approved again');
  /* Later: the stamp and the time, then the cron sends it. */
  const r1 = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  const later = new Date(Date.now() + 3600e3).toISOString();
  r = await admin('approve', 'POST', { id: r1._json.logId, sendAt: later, confirmDuplicate: true });
  const q = byId(r1._json.logId);
  ok(r._status === 200 && r._json.queued === true && q.status === 'queued' && q.sendAt === later && q.approvedBy === 'rob' && resendCalls().length === 1, `approve with a time queues it with the stamp (${dump({ status: q.status, sendAt: q.sendAt, approvedBy: q.approvedBy })})`);
  r = await admin('approve', 'POST', { id: r1._json.logId, sendAt: new Date(Date.now() - 3600e3).toISOString() });
  ok(r._status === 400, 'a time in the past is refused');
  const run = await Q.runQueuedSends(db, Date.parse(later) + 60e3, { byDay: false });
  ok(run.sent === 1 && byId(r1._json.logId).status === 'sent' && resendCalls().length === 2, `the cron sends the approved queued entry (${dump(run)})`);
  /* An edit after approval clears the stamp: what Rob saw is no longer what would go. */
  const r2 = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  await admin('approve', 'POST', { id: r2._json.logId, sendAt: later, confirmDuplicate: true });
  r = await admin('log', 'POST', { id: r2._json.logId, edit: { subject: 'Changed my mind, {{firstName}}' } });
  const e = byId(r2._json.logId);
  ok(r._status === 200 && e.status === 'draft' && e.approvedAt === '' && e.approvedBy === '' && e.subject === 'Changed my mind, Mike', `an edited queued email is a draft again with no stamp (${dump({ status: e.status, approvedAt: e.approvedAt, subject: e.subject })})`);
  r = await admin('log', 'POST', { id: r2._json.logId, cancel: true });
  ok(r._status === 409, 'and cancel has nothing queued to cancel');
  delete process.env.RESEND_API_KEY;
}

section('6. a text is a row Rob sends from Messages');
seed();
{
  let r = await admin('drafts', 'POST', { channel: 'text', recordId: LEAD, body: 'Hey Mike, your concepts are up: https://visualizestudio.org/concepts/x', reason: 'Concepts sent' });
  ok(r._status === 200 && !!r._json.logId, `a text draft is written (${r._status})`);
  const t = byId(r._json.logId);
  ok(t.channel === 'text' && t.status === 'draft' && t.phone === '3025550100' && /concepts are up/.test(t.text), `with the record's phone and the body (${dump({ channel: t.channel, phone: t.phone })})`);
  r = await admin('drafts', 'POST', { channel: 'email', recordId: LEAD, body: 'x' });
  ok(r._status === 400, 'only a text can be written this way');
  process.env.RESEND_API_KEY = 're_test_not_a_real_key';
  r = await admin('approve', 'POST', { id: t._id });
  ok(r._status === 200 && r._json.text === true && byId(t._id).status === 'sent' && byId(t._id).approvedBy === 'rob' && resendCalls().length === 0, 'Text it marks it sent by hand: the stamp, no transport');
  delete process.env.RESEND_API_KEY;
  r = await admin('drafts', 'GET');
  ok(r._status === 200 && Array.isArray(r._json.items) && r._json.items.some(x => String(x._id) === String(t._id)) && r._json.items.every(x => !('html' in x)), 'the Drafts list carries it, without html');
}

section('7. the stamp has one writer, and no screen reaches the old door');
{
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const api = walk(path.join(ROOT, 'api')).filter(f => f.endsWith('.js'));
  const makers = api.filter(f => /approvedBy:\s*APPROVED_BY|approvedBy:\s*['"]rob['"]|approvalStamp\s*=/.test(fs.readFileSync(f, 'utf8')) && !f.endsWith(path.join('email', 'send.js')));
  ok(makers.length === 1 && makers[0].endsWith(path.join('email', 'approve.js')), `the stamp is made in approve.js and nowhere else in api/ (${makers.map(f => path.relative(ROOT, f)).join(', ') || 'none'})`);
  ok(typeof A.approvalStamp === 'function' && A.APPROVED_BY === 'rob' && A.approvalStamp().approvedBy === 'rob', 'approve.js exports the one stamp maker');
  const sendJs = fs.readFileSync(path.join(ROOT, 'api', '_lib', 'email', 'send.js'), 'utf8');
  ok(/if \(!testToSelf && !approval\)/.test(sendJs) && /approvalOf\(opts\)/.test(sendJs), 'send.js gates every real send on the stamp it was handed');
  const srcFiles = walk(path.join(ROOT, 'src')).filter(f => /\.(js|jsx)$/.test(f));
  const oldDoor = srcFiles.filter(f => /send:\s*true/.test(fs.readFileSync(f, 'utf8')) && /email\/log/.test(fs.readFileSync(f, 'utf8')));
  ok(oldDoor.length === 0, `no client file posts send: true to the email log (${oldDoor.map(f => path.relative(ROOT, f)).join(', ') || 'none'})`);
  const approvers = srcFiles.filter(f => /email\/approve/.test(fs.readFileSync(f, 'utf8')));
  ok(approvers.length === 1 && approvers[0].endsWith(path.join('email', 'SendSheet.jsx')), `the approve action is called from the preview sheet alone (${approvers.map(f => path.relative(ROOT, f)).join(', ') || 'none'})`);
  const sheet = approvers[0] ? fs.readFileSync(approvers[0], 'utf8') : '';
  ok(/EmailPreview/.test(sheet) && /Subject/.test(sheet) && /\bTo\b/.test(sheet), 'and that sheet shows the recipient, the subject and the body before the tap');
}

section('8. Draft into Gmail');
seed();
{
  ok(G.gmailConnected() === false, 'without the three variables Gmail is not connected');
  let r = await admin('gmail', 'GET');
  ok(r._status === 200 && r._json.connected === false && r._json.enabled === false && dump(r._json.variables) === dump(['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']), `the status names the variables, never a value (${dump(r._json)})`);
  r = await admin('gmail', 'POST', { enabled: true });
  ok(r._status === 200 && _stores.settings.find(x => x._id === 'emails').gmailDrafts === true, 'the toggle saves');
  await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  ok(gmailCalls().length === 0 && !rows()[0].gmailDraftId, 'on but not connected: no call, no id');
  process.env.GMAIL_CLIENT_ID = 'cid.apps.googleusercontent.com'; process.env.GMAIL_CLIENT_SECRET = 'GOCSPX-not-real'; process.env.GMAIL_REFRESH_TOKEN = '1//refresh-not-real';
  ok(G.gmailConnected() === true, 'with all three it is connected');
  seed(); await admin('gmail', 'POST', { enabled: true });
  r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  const d = byId(r._json.logId);
  ok(gmailCalls().length === 2 && gmailCalls()[0].url.includes('oauth2.googleapis.com') && gmailCalls()[1].url.includes('/users/me/drafts') && gmailCalls()[1].auth === 'Bearer ya29.test-access-token-not-real', `a new draft is mirrored: the token once, then drafts.create (${gmailCalls().map(c => c.url.split('/')[2]).join(', ')})`);
  ok(d.gmailDraftId === 'r-draft-1' && d.gmailMessageId === '18f00abc' && !JSON.stringify(d).includes('ya29') && !JSON.stringify(d).includes('refresh-not-real') && !JSON.stringify(d).includes('GOCSPX'), 'the ids are on the row and no token or secret is');
  const raw = gmailCalls()[1].body?.message?.raw || '';
  ok(/^[A-Za-z0-9_-]+$/.test(raw) && Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8').includes('To: mike@mikestacos.example'), 'the message is base64url RFC 822 with the recipient');
  ok(G.gmailDraftUrl('18f00abc') === 'https://mail.google.com/mail/u/0/#drafts/18f00abc', 'Open points at the draft');
  globalThis.__gmailRefuse = true; seed(); await admin('gmail', 'POST', { enabled: true });
  r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  ok(r._status === 200 && byId(r._json.logId).status === 'draft' && !byId(r._json.logId).gmailDraftId, 'a refused token leaves the CRM draft exactly as it was');
  globalThis.__gmailRefuse = false;
  seed(); await admin('gmail', 'POST', { enabled: false });
  r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  ok(gmailCalls().length === 0, 'connected but off: nothing is mirrored');
  for (const k of ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']) delete process.env[k];

  /* The Connect button (prompt 1b): the token comes from Google through the callback, never pasted; GMAIL_REFRESH_TOKEN is an override only. */
  seed();
  r = await admin('gmail', 'POST', { action: 'connect' });
  ok(r._status === 409 && /GMAIL_CLIENT_ID/.test(r._json.error) && !('url' in r._json), `Connect without the app variables says which two are needed (${r._status})`);
  process.env.GMAIL_CLIENT_ID = 'cid.apps.googleusercontent.com'; process.env.GMAIL_CLIENT_SECRET = 'GOCSPX-not-real';
  r = await admin('gmail', 'GET');
  ok(r._status === 200 && r._json.connected === false && r._json.configured === true && r._json.source === '', 'with the two app variables alone: configured, not connected');
  r = await admin('gmail', 'POST', { action: 'connect' });
  const cu = new URL(r._json.url || 'https://x.invalid/');
  ok(r._status === 200 && cu.hostname === 'accounts.google.com' && cu.searchParams.get('redirect_uri') === 'https://admin.visualizeclients.com/api/settings/gmail/callback' && cu.searchParams.get('scope') === 'https://www.googleapis.com/auth/gmail.compose' && cu.searchParams.get('access_type') === 'offline' && cu.searchParams.get('prompt') === 'consent' && !!cu.searchParams.get('state') && !cu.searchParams.get('client_secret'), 'Connect answers the consent URL: the callback, the drafts scope, offline, a state, no secret');
  const state = cu.searchParams.get('state');
  const cb = async (query) => { const rq = await admin('gmail-callback', 'GET', undefined, { query }); return rq; };
  r = await cb({ code: 'good-code', state: 'forged' });
  ok(r._status === 302 && /gmail=failed$/.test(r._headers?.Location || r._headers?.location || '') && !_stores.settings.find(x => x._id === 'emails')?.gmail, `a forged state is refused and nothing is stored (${r._status})`);
  r = await cb({ code: 'bad-code', state });
  ok(r._status === 302 && /gmail=failed$/.test(r._headers?.Location || r._headers?.location || '') && !_stores.settings.find(x => x._id === 'emails')?.gmail, 'a code Google refuses stores nothing');
  r = await cb({ code: 'good-code', state });
  const stored = _stores.settings.find(x => x._id === 'emails')?.gmail;
  ok(r._status === 302 && /gmail=connected$/.test(r._headers?.Location || r._headers?.location || '') && !!stored?.token && stored.token !== '1//from-google-not-real' && !stored.token.includes('from-google') && stored.email === 'rob@visualize.example', 'the good code lands connected: the token stored encrypted with the address');
  ok(G.decryptToken(stored.token) === '1//from-google-not-real' && G.decryptToken('v1.garbage') === '', 'the stored token decrypts under the session secret and nothing else reads');
  r = await admin('gmail', 'GET');
  ok(r._status === 200 && r._json.connected === true && r._json.email === 'rob@visualize.example' && r._json.source === 'connect' && !JSON.stringify(r._json).includes('from-google') && !JSON.stringify(r._json).includes('v1.'), 'the status reads Connected with the address and carries no token');
  calls.length = 0; await admin('gmail', 'POST', { enabled: true });
  r = await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  ok(gmailCalls().length === 2 && /refresh_token=1%2F%2Ffrom-google-not-real/.test(String(gmailCalls()[0].body)) && byId(r._json.logId).gmailDraftId === 'r-draft-1', 'a draft is mirrored with the stored token');
  process.env.GMAIL_REFRESH_TOKEN = '1//override-not-real'; calls.length = 0;
  r = await admin('gmail', 'GET');
  ok(r._json.source === 'variable' && r._json.connected === true && r._json.email === '', 'GMAIL_REFRESH_TOKEN set: an override, the status says so');
  await admin('send', 'POST', { templateId: 'onboarding', recordId: LEAD });
  ok(/refresh_token=1%2F%2Foverride-not-real/.test(String(gmailCalls()[0]?.body || '')), 'and the mirror uses the override');
  delete process.env.GMAIL_REFRESH_TOKEN;
  r = await admin('gmail', 'POST', { action: 'disconnect' });
  ok(r._status === 200 && r._json.connected === false && !_stores.settings.find(x => x._id === 'emails')?.gmail && _stores.settings.find(x => x._id === 'emails')?.gmailDrafts === false, 'Disconnect clears the token and turns the toggle off');
  const src8 = fs.readFileSync(path.join(apiDst, '_lib', 'email', 'gmail.js'), 'utf8') + fs.readFileSync(path.join(apiDst, '_routes', 'email.js'), 'utf8');
  ok(!/console\.(log|error|warn)\(/.test(src8), 'nothing in the Gmail code logs');
  for (const k of ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']) delete process.env[k];
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
