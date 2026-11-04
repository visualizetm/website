#!/usr/bin/env node
/* Links in one tap (prompt 3 of 3, milestone 4): the pure half (the sms: link, the share payload, the "Sent Oct 12, text" line, a cancelled share)
 * and the server half against the real call-leads handler (sentAt and sentVia on the portal, the review link and the planner: stored,
 * a bad via becomes empty, a later save that does not name them carries them forward, the planner's enabled and count survive the stamp).
 * The no send scan: nothing in the link buttons posts send: true or to email/send.   node scripts/links-test.mjs
 * (LINKS_SRC=<dir> reads src and api from a copy, for the guard proof) */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const root = process.env.LINKS_SRC ? path.resolve(process.env.LINKS_SRC) : repoRoot;
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const L = await import(pathToFileURL(path.join(root, 'src', 'lib', 'linkSend.js')).href);

/* Pure */
ok(L.smsHref('(215) 555-0199', 'Hi there: https://x.test/r/abc?z=1') === 'sms:2155550199?&body=Hi%20there%3A%20https%3A%2F%2Fx.test%2Fr%2Fabc%3Fz%3D1', 'the sms link has the digits and the body, encoded');
ok(L.smsHref('+1 215 555 0199', 'a') === 'sms:+12155550199?&body=a', 'a leading plus stays');
ok(L.smsHref('', 'a') === 'sms:?&body=a' && L.smsHref(undefined, '') === 'sms:?&body=', 'no phone still opens Messages, with the body, to pick who');
const NOW = Date.parse('2026-11-04T12:00:00.000Z');
ok(L.sentLine('2026-10-12T15:00:00.000Z', 'text', NOW) === 'Sent Oct 12, text', `the line reads "Sent Oct 12, text" (${L.sentLine('2026-10-12T15:00:00.000Z', 'text', NOW)})`);
ok(L.sentLine('2025-12-30T15:00:00.000Z', 'text', NOW) === 'Sent Dec 30, 2025, text', 'a stamp from another year carries the year');
ok(L.sentLine('2026-10-12T15:00:00.000Z', 'share', NOW) === 'Sent Oct 12, share sheet' && L.sentLine('2026-10-12T15:00:00.000Z', '', NOW) === 'Sent Oct 12' && L.sentLine('', 'text', NOW) === '' && L.sentLine('garbage', 'text', NOW) === '', 'share sheet, no channel (an older stamp), not sent and a bad stamp');
const link = 'https://visualizestudio.org/r/abc';
ok(JSON.stringify(L.sharePayload('Leave a review', `Hey, here: ${link}`, link)) === JSON.stringify({ title: 'Leave a review', text: `Hey, here: ${link}` }), 'the url is not sent twice when the message holds it');
ok(L.sharePayload('T', 'no link here', link).url === link, 'and is sent when the message does not');
ok(L.shareWasCancelled({ name: 'AbortError' }) && !L.shareWasCancelled({ name: 'NotAllowedError', message: 'blocked' }) && !L.shareWasCancelled(null), 'a cancelled share sheet is not a send');
ok(L.canShare() === false, 'with no navigator.share Share is hidden');

/* The no send scan */
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
for (const f of ['src/components/LinkSend.jsx', 'src/lib/linkSend.js']) { const t = read(f); ok(!/send:\s*true|email\/send|email\/approve|fetch\(|apiFetch\(/.test(t), `${f} never posts a send`); }
ok(/openCompose\?\.\(lead, \{ templateId \}\)/.test(read('src/components/LinkSend.jsx')), 'Draft an email opens Compose on the template (a draft, never a send)');
for (const f of ['src/pages/AdminReviews.jsx', 'src/components/record/PortalSheet.jsx', 'src/pages/AdminPlanner.jsx']) ok(!/Mark as sent/.test(read(f)), `${f} has no Mark as sent tap`);

/* The server half */
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'links-')); const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(root, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
process.env.SESSION_SECRET = 'test-not-real'; delete process.env.VERCEL; delete process.env.VAPID_PRIVATE_KEY;
const load = (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const adminIndex = (await load('admin/index.js')).default;
const { signSession } = await load('_lib/auth.js');
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[String(k).toLowerCase()] = v; }, end() { this.headersSent = true; } });
const cookie = `vz_admin=${signSession()}`;
const LEAD = '507f1f77bcf86cd799439071';
const patch = async (set) => { const req = { method: 'PATCH', query: { r: 'call-leads' }, body: { id: LEAD, set }, headers: { cookie, 'x-forwarded-for': '203.0.113.9' }, url: '/api/admin/index', socket: {} }; const res = fakeRes(); await adminIndex(req, res); return res; };
const lead = () => _stores.call_leads.find(l => String(l._id) === LEAD);
_reset();
_stores.call_leads = [{ _id: LEAD, business: 'Link Test Co', stage: 'client', askFor: 'Dana', phone: '555-0100' }];
const T1 = '2026-10-12T15:00:00.000Z';

let r = await patch({ portal: { sentAt: T1, sentVia: 'text' } });
ok(r._status === 200 && lead().portal.sentAt === T1 && lead().portal.sentVia === 'text', `the portal link stamps sentAt and sentVia (${r._status})`);
await patch({ portal: { template: 'brand' } });
ok(lead().portal.sentAt === T1 && lead().portal.sentVia === 'text', 'a later portal write carries both forward');
await patch({ portal: { sentAt: T1, sentVia: '<script>' } });
ok(lead().portal.sentVia === '', 'a via the whitelist does not know is stored as empty');

await patch({ reviews: { visualize: {} } });
r = await patch({ reviews: { visualize: { sentAt: T1, sentVia: 'share' } } });
ok(r._status === 200 && lead().reviews.visualize.sentAt === T1 && lead().reviews.visualize.sentVia === 'share', 'the review link stamps sentAt and sentVia');
await patch({ reviews: { visualize: {} } });
ok(lead().reviews.visualize.sentAt === T1 && lead().reviews.visualize.sentVia === 'share', 'a later review write carries both forward');

r = await patch({ planner: { enabled: true, postsPerMonth: 12, welcome: 'Hello', sentAt: T1, sentVia: 'text' } });
const tok = lead().planner?.token;
ok(r._status === 200 && lead().planner.sentAt === T1 && lead().planner.sentVia === 'text' && lead().planner.enabled === true && lead().planner.postsPerMonth === 12, 'the planner link stamps sentAt and sentVia and keeps enabled and the count');
await patch({ planner: { enabled: true, postsPerMonth: 12, welcome: 'Changed' } });
ok(lead().planner.sentAt === T1 && lead().planner.sentVia === 'text' && lead().planner.token === tok && lead().planner.welcome === 'Changed', 'an editor save that does not name them carries both forward, and the token');
await patch({ planner: { enabled: true, postsPerMonth: 12, welcome: 'x', sentVia: 'carrier-pigeon' } });
ok(lead().planner.sentVia === '', 'a bad planner via is stored as empty');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nlinks-test: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
