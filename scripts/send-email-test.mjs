#!/usr/bin/env node
/* The four branded emails (CRM revamp, step 6): the route's whitelist, the
 * four payload shapes, the 503 and 502 paths, the checkpoint, invoice,
 * delivery and contact log stamps, the rate limit, and that a hook URL
 * never leaks, against the real handler with the in-memory mongo and a
 * local catch hook that records what it receives.
 *   node scripts/send-email-test.mjs */
process.env.TZ = 'America/New_York';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
const body = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8').split('\n').filter(l => !l.startsWith(' *') && !l.startsWith('/*')).join('\n');

section('0. the mirrors');
ok(body('api/_lib/pricing.js').trim() === body('src/shared/pricing.js').trim(), 'api/_lib/pricing.js is src/shared/pricing.js byte for byte below the header');
{
  const norm = (t) => t.split('\n').map(l => l.trimEnd()).filter(l => l.trim() && !l.includes('CALENDLY_URL') && !l.includes('meetingLink()')).join('\n');
  const a = norm(body('src/lib/emailPayload.js').split('export function buildEmailPayload')[1]);
  const b = norm(body('api/_lib/email.js').split('export function buildEmailPayload')[1].split('export function samplePayload')[0]);
  ok(a.trim() === b.trim(), 'the modal preview builds the same fields as the server (outside the meeting link source)');
}

/* A local catch hook: records every POST, answers what it is told. */
const received = [];
let answer = 200;
const hook = http.createServer((req, res) => { let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => { received.push({ path: req.url, body: JSON.parse(raw || '{}') }); res.statusCode = answer; res.end('{}'); }); });
await new Promise(r => hook.listen(0, '127.0.0.1', r));
const HOOK = `http://127.0.0.1:${hook.address().port}`;
const SECRET_PATH = '/hooks/catch/123456/abcdefSECRET';
process.env.ZAPIER_HOOK_INTRO = `${HOOK}${SECRET_PATH}/intro`;
process.env.ZAPIER_HOOK_ONBOARDING = `${HOOK}${SECRET_PATH}/onboarding`;
process.env.ZAPIER_HOOK_INVOICE = `${HOOK}${SECRET_PATH}/invoice`;
delete process.env.ZAPIER_HOOK_DELIVERY;

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'email-')); const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
process.env.SESSION_SECRET = 'test-secret-not-real'; delete process.env.VERCEL;
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const sendEmail = (await load('_routes/send-email.js')).handler;
const settings = (await load('_routes/settings.js')).handler;
const E = await load('_lib/email.js');
const logs = [];
const origLog = console.log; const origErr = console.error;
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; } });
const call = async (body, ip = '203.0.113.9') => {
  const res = fakeRes();
  console.log = (...a) => logs.push(a.join(' ')); console.error = (...a) => logs.push(a.join(' '));
  try { await sendEmail({ method: 'POST', query: {}, body, headers: { 'x-forwarded-for': ip }, url: '/api/admin/send-email', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  finally { console.log = origLog; console.error = origErr; }
  return res;
};
const L = '507f1f77bcf86cd799439091', PJ = '507f1f77bcf86cd799439092';
const lead = () => _stores.call_leads.find(l => String(l._id) === L);
const project = () => _stores.projects.find(p => String(p._id) === PJ);
const seed = () => {
  _reset();
  _stores.call_leads = [{ _id: L, business: 'Bay Ridge Bakery', askFor: 'Sam', email: 'sam@bakery.example', stage: 'deal', callStatus: 'booked', meeting: { date: '2026-09-01', time: '10:00' }, links: { drive: 'https://drive.google.com/drive/folders/lead' }, contactLog: [], socials: {}, callLog: [],
    deal: { checkpoints: { concepts: null, introSent: null, callDone: { at: '2026-09-01T15:00:00.000Z', by: 'rob' }, onboardingSent: null, formReceived: null, contractSent: null, contractAgreed: null, invoiceSent: null, paid: null }, packageId: 'launch-plan', addonIds: ['rush'], plan: { months: 6, monthly: 200 }, invoices: [{ id: 'dv1', label: 'Month 1 of 6', amount: 200, dueAt: '2026-10-01', status: 'draft', sentAt: '', paidAt: '', note: '' }], contractLink: '', metAt: '', stalledSince: '' } }];
  _stores.projects = [{ _id: PJ, leadId: L, name: 'Web Complete', kind: 'web', packageId: 'web-complete', stage: 'delivered', plan: null, links: { drive: 'https://drive.google.com/drive/folders/project' }, invoices: [{ id: 'pv1', label: 'Full payment', amount: 750, dueAt: '2026-10-01', status: 'draft', sentAt: '', paidAt: '', note: '' }], delivery: { driveShared: true, emailSent: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '' }, archived: false }];
  _stores.settings = []; _stores.concept_sets = []; _stores.stripe_events = [];
  received.length = 0; logs.length = 0; answer = 200;
};

section('1. the whitelist and the missing pieces');
{
  seed();
  let r = await call({ leadId: L, kind: 'newsletter' });
  ok(r._status === 400, 'an unknown kind is refused');
  r = await call({ kind: 'intro' });
  ok(r._status === 400 && /leadId/.test(r._json.error), 'no leadId, no send');
  r = await call({ leadId: 'nope', kind: 'intro' });
  ok(r._status === 400, 'a bad leadId is refused before any lookup');
  r = await call({ leadId: '507f1f77bcf86cd799439000', kind: 'intro' });
  ok(r._status === 404, 'an unknown lead is 404');
  lead().email = 'not-an-email';
  r = await call({ leadId: L, kind: 'intro' });
  ok(r._status === 400 && /email/i.test(r._json.error), 'a lead without a real email is refused with a plain message');
  seed();
  r = await call({ leadId: L, kind: 'invoice' });
  ok(r._status === 400 && /invoiceId/.test(r._json.error), 'the invoice kind needs an invoiceId that exists');
  r = await call({ leadId: L, kind: 'invoice', invoiceId: 'dv1', projectId: '507f1f77bcf86cd799439000' });
  ok(r._status === 404, 'a projectId that is not this lead\'s project is 404');
  ok(received.length === 0, 'nothing reached the hook for any of those');
}

section('2. the four payload shapes');
{
  seed();
  let r = await call({ leadId: L, kind: 'intro' });
  ok(r._status === 200 && r._json.ok === true && r._json.sentAt, `intro answers ok with sentAt (${r._status} ${JSON.stringify(r._json)})`);
  let p = received[0]?.body;
  ok(received[0]?.path === `${SECRET_PATH}/intro`, 'the intro hook got it');
  ok(p && p.kind === 'intro' && p.test === false && p.name === 'Sam' && p.business === 'Bay Ridge Bakery' && p.email === 'sam@bakery.example', 'intro: kind, test false, name from askFor, business, email');
  ok(p.packageLabel === 'Launch Plan' && p.packageIncluded.includes('Brand Starter') && p.packageIncluded.includes('Rush delivery') && /\$200 a month for 6 months/.test(p.planLine) && /calendly\.com/.test(p.calendlyLink) && p.sentAt === r._json.sentAt, `intro: package, included (with the add-on), plan line, meeting link, sentAt (${p.packageIncluded.join('|')})`);
  ok(!('variant' in p) && !('invoice' in p) && !('driveLink' in p), 'intro carries no variant, invoice or drive link');
  r = await call({ leadId: L, kind: 'onboarding' });
  p = received[1]?.body;
  ok(r._status === 200 && p.kind === 'onboarding' && p.variant === 'combined', 'onboarding: the Launch Plan is the combined variant');
  ok(E.variantOf('brand-starter') === 'brand' && E.variantOf('web-complete') === 'web' && E.variantOf('build-plan') === 'combined' && E.variantOf('') === 'general' && E.variantOf('nope') === 'general', 'variants: brand, web, combined, general');
  r = await call({ leadId: L, kind: 'invoice', invoiceId: 'dv1' });
  p = received[2]?.body;
  ok(r._status === 200 && p.kind === 'invoice' && p.invoice.label === 'Month 1 of 6' && p.invoice.amount === 200 && p.invoice.dueAt === '2026-10-01', 'invoice: the deal invoice\'s label, amount and due date');
  process.env.ZAPIER_HOOK_DELIVERY = `${HOOK}${SECRET_PATH}/delivery`;
  r = await call({ leadId: L, kind: 'delivery' });
  ok(r._status === 400 && /projectId/.test(r._json.error), 'delivery needs a projectId');
  r = await call({ leadId: L, kind: 'delivery', projectId: PJ });
  p = received[3]?.body;
  ok(r._status === 200 && p.kind === 'delivery' && p.driveLink === 'https://drive.google.com/drive/folders/project' && p.packageLabel === 'Launch Plan', 'delivery: the project\'s Drive link, the deal\'s package');
  delete process.env.ZAPIER_HOOK_DELIVERY;
  const s = E.samplePayload('invoice');
  ok(s.test === true && s.kind === 'invoice' && s.invoice.amount === 200 && s.business === 'Bay Ridge Bakery' && E.samplePayload('onboarding').variant === 'combined' && E.samplePayload('delivery').driveLink.includes('drive.google.com'), 'the fixed samples carry test: true and every field');
  ok(JSON.stringify(E.emailsConfigured()) === JSON.stringify({ intro: true, onboarding: true, invoice: true, delivery: false }), 'emailsConfigured says which variables exist, booleans only');
}

section('3. the stamps');
{
  seed();
  let r = await call({ leadId: L, kind: 'intro' });
  const l = lead();
  ok(l.deal.checkpoints.introSent?.by === 'auto' && l.deal.checkpoints.introSent.at === r._json.sentAt, 'intro ticks introSent by auto at sentAt');
  ok(l.contactLog.length === 1 && l.contactLog[0].type === 'email' && l.contactLog[0].note === 'Sent the intro email' && l.contactLog[0].at === r._json.sentAt, 'the contact log gets the entry');
  ok(l.nextAction?.kind === 'send-onboarding', `the next action is recomputed (${l.nextAction?.kind})`);
  r = await call({ leadId: L, kind: 'onboarding' });
  ok(lead().deal.checkpoints.onboardingSent?.by === 'auto' && lead().nextAction?.kind !== 'send-onboarding', 'onboarding ticks onboardingSent and moves the next action on');
  r = await call({ leadId: L, kind: 'invoice', invoiceId: 'dv1' });
  const inv = lead().deal.invoices[0];
  ok(inv.status === 'sent' && inv.sentAt === r._json.sentAt && lead().deal.checkpoints.invoiceSent?.by === 'auto', 'the deal invoice is marked sent with sentAt and invoiceSent ticks');
  ok(lead().contactLog.length === 3 && lead().contactLog[2].note === 'Sent the invoice email', 'three sends, three entries');
  const again = await call({ leadId: L, kind: 'intro' });
  ok(again._status === 200 && lead().deal.checkpoints.introSent.at === r._json.sentAt || lead().deal.checkpoints.introSent.by === 'auto', 'sending the intro again keeps the first tick');
  ok(lead().contactLog.length === 4, 'and still logs the send');
  // a project invoice and the delivery flag
  r = await call({ leadId: L, kind: 'invoice', invoiceId: 'pv1', projectId: PJ });
  ok(r._status === 200 && project().invoices[0].status === 'sent' && project().invoices[0].sentAt === r._json.sentAt, 'a project invoice is marked sent on the project');
  process.env.ZAPIER_HOOK_DELIVERY = `${HOOK}${SECRET_PATH}/delivery`;
  r = await call({ leadId: L, kind: 'delivery', projectId: PJ });
  ok(r._status === 200 && project().delivery.emailSent === true && project().delivery.driveShared === true, 'delivery flips delivery.emailSent on the project and keeps the rest');
  ok(lead().contactLog[lead().contactLog.length - 1].note === 'Sent the delivery email', 'the delivery send is logged on the lead');
  delete process.env.ZAPIER_HOOK_DELIVERY;
  // a test send stamps nothing
  seed();
  r = await call({ kind: 'intro', test: true });
  ok(r._status === 200 && r._json.test === true && received[0].body.test === true && received[0].body.business === 'Bay Ridge Bakery' && lead().deal.checkpoints.introSent === null && lead().contactLog.length === 0, 'a test send posts the sample flagged test: true and stamps nothing');
}

section('4. 503 and 502');
{
  seed();
  let r = await call({ leadId: L, kind: 'delivery', projectId: PJ });
  ok(r._status === 503 && r._json.error === 'That email is not connected yet.' && received.length === 0, 'no hook for the kind: 503 with the plain message, nothing posted');
  ok(project().delivery.emailSent === false && lead().contactLog.length === 0, 'and nothing stamped');
  answer = 500;
  r = await call({ leadId: L, kind: 'intro' });
  ok(r._status === 502 && typeof r._json.error === 'string' && r._json.error.length > 0 && received.length === 1, 'Zapier not 2xx: 502 with an error message');
  ok(lead().deal.checkpoints.introSent === null && lead().contactLog.length === 0 && !lead().nextAction, 'and nothing stamped');
  answer = 200;
  const saved = process.env.ZAPIER_HOOK_INTRO;
  process.env.ZAPIER_HOOK_INTRO = 'http://127.0.0.1:1/nothing-listens-here';
  r = await call({ leadId: L, kind: 'intro' });
  ok(r._status === 502 && lead().contactLog.length === 0, 'a hook that cannot be reached is a 502 too, nothing stamped');
  process.env.ZAPIER_HOOK_INTRO = saved;
}

section('5. the rate limit');
{
  seed();
  let last = null;
  for (let i = 0; i < 60; i++) last = await call({ leadId: L, kind: 'intro' }, '198.51.100.7');
  ok(last._status === 200, 'sixty sends in an hour go through');
  const over = await call({ leadId: L, kind: 'intro' }, '198.51.100.7');
  ok(over._status === 429 && over._headers['Retry-After'] && received.length === 60, 'the sixty first is 429 with Retry-After and never reaches the hook');
  const other = await call({ leadId: L, kind: 'intro' }, '198.51.100.8');
  ok(other._status === 200, 'the limiter is per sender');
  answer = 500;
  const before = received.length;
  const failed = await call({ leadId: L, kind: 'onboarding' }, '198.51.100.9');
  ok(failed._status === 502 && received.length === before + 1, 'a failed attempt still counts');
  answer = 200;
}

section('6. the hook URL never leaks');
{
  seed();
  const dumps = [];
  for (const body of [{ leadId: L, kind: 'intro' }, { kind: 'intro', test: true }, { leadId: L, kind: 'newsletter' }]) { const r = await call(body); dumps.push(JSON.stringify(r._json), JSON.stringify(r._headers)); }
  answer = 500; const bad = await call({ leadId: L, kind: 'intro' }); dumps.push(JSON.stringify(bad._json)); answer = 200;
  dumps.push(JSON.stringify(lead()), JSON.stringify(_stores.settings), logs.join('\n'));
  const sres = fakeRes();
  await settings({ method: 'GET', query: {}, headers: {}, url: '/api/admin/settings', socket: {} }, sres).catch(() => {});
  dumps.push(JSON.stringify(sres._json));
  ok(dumps.every(d => !d.includes('abcdefSECRET') && !d.includes(HOOK)), 'no response, header, record, settings document, settings GET or log carries the hook URL');
  ok(sres._json?.emails && sres._json.emails.intro === true && sres._json.emails.delivery === false && Object.values(sres._json.emails).every(v => typeof v === 'boolean'), 'the settings GET reports which hooks exist as booleans');
}

hook.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} checks passed, ${fails} failed.`);
console.log(fails ? 'Send email tests FAILED.' : 'All send email tests pass.');
process.exit(fails ? 1 : 0);
