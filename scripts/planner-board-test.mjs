#!/usr/bin/env node
/* Rob's side of Planner v2 (part 2, milestone 2.1), against the real
 * handlers on the shared in-memory Mongo (scripts/fake-mongo.js):
 *
 *   - the batch send: POST /api/admin/posts { action: 'send-review', leadId, ids } moves only that
 *     lead's posts that are being made and have a picture or a video and a caption, stamps reviewAt,
 *     answers the ids it moved, and leaves ads, other leads, half made posts and settled posts alone
 *   - hashtag sets on planner.hashtagSets through the call-leads PATCH: at most ten, every field capped,
 *     tags normalised, nothing else kept, carried forward by a planner save that does not name them,
 *     and the token never moved by it
 *   - an idea opened in the inbox is stamped seen (seenAt: true stamps now on the server)
 *
 *   node scripts/planner-board-test.mjs
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'board-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log('ok   ' + m); } else { fails++; console.log('FAIL ' + m); } };
process.env.SESSION_SECRET = 'test-secret-not-real';
delete process.env.VERCEL;

const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const posts = (await load('_routes/posts.js')).handler;
const callLeads = (await load('_routes/call-leads.js')).handler;
const suggestions = (await load('_routes/suggestions.js')).handler;

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; } });
async function call(fn, method, body, query = {}) {
  const res = fakeRes();
  try { await fn({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.9' }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.stack || e) }; }
  return res;
}

const LEAD = '507f1f77bcf86cd799439031', OTHER = '507f1f77bcf86cd799439032';
const P = (n) => `607f1f77bcf86cd7994390${String(n).padStart(2, '0')}`;
const post = (n, over = {}) => ({ _id: P(n), leadId: LEAD, month: '2026-12', date: `2026-12-${String(n).padStart(2, '0')}`, kind: 'post', status: 'making', imageUrl: 'https://img.example/a.jpg', caption: 'Ready to go', video: null, reviewAt: '', ...over });
function seed() {
  _reset();
  _stores.posts = [
    post(1), // ready
    post(2, { imageUrl: '', video: { url: 'https://vid.example/a.mp4' } }), // a video with a file and a caption: ready
    post(3, { caption: '   ' }), // no words yet
    post(4, { imageUrl: '', video: { url: '' } }), // nothing to look at yet
    post(5, { kind: 'ad' }), // an ad: never batch sent
    post(6, { status: 'approved' }), // already decided
    post(7, { leadId: OTHER }), // somebody else's
    post(8, { deleted: true }), // deleted
    post(9, { status: 'review', reviewAt: '2026-11-01T10:00:00.000Z' }), // already waiting
  ];
  _stores.call_leads = [
    { _id: LEAD, business: 'Kims Cafe', stage: 'client', clientSince: '2026-01-01T00:00:00Z', callStatus: 'booked', planner: { enabled: true, token: 'tok_kept_kept_kept_kept_kept_kept', tokenCreatedAt: '2026-08-01T10:00:00Z', lastViewedAt: '2026-11-20T10:00:00Z', postsPerMonth: 12, welcome: 'Hi' } },
  ];
  _stores.suggestions = [{ _id: '707f1f77bcf86cd799439001', leadId: LEAD, kind: 'post', subject: 'Friday special', status: 'new', seenAt: '' }];
}

/* ── The batch send ── */
seed();
{
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(P);
  const before = Date.now();
  const r = await call(posts, 'POST', { action: 'send-review', leadId: LEAD, ids });
  const by = (n) => _stores.posts.find(p => String(p._id) === P(n));
  ok(r._status === 200 && r._json.ok, `send-review answers 200 (got ${r._status} ${JSON.stringify(r._json).slice(0, 200)})`);
  ok(JSON.stringify(r._json.ids) === JSON.stringify([P(1), P(2)]), `it answers exactly the ids it moved, as strings (got ${JSON.stringify(r._json.ids)})`);
  ok(by(1).status === 'review' && by(2).status === 'review', 'a post with a picture and words, and a video with a file and words, go to review');
  ok(Date.parse(by(1).reviewAt) >= before - 5 && by(1).reviewAt === by(2).reviewAt, 'both are stamped reviewAt, the same instant');
  ok(by(3).status === 'making' && by(4).status === 'making', 'a post with no words, or nothing to look at, stays in making');
  ok(by(5).status === 'making', 'an ad is never batch sent');
  ok(by(6).status === 'approved', 'a decided post is left alone');
  ok(by(7).status === 'making', "another lead's post named in the ids is never moved");
  ok(by(8).status === 'making', 'a deleted post is never moved');
  ok(by(9).reviewAt === '2026-11-01T10:00:00.000Z', 'a post already waiting keeps its first reviewAt');
  const writes = (await load('_lib/mongo.js'))._log.filter(e => e.op === 'updateMany' && e.collection === 'posts');
  ok(writes.length === 1, `the send is one write (got ${writes.length})`);
  ok(writes.every(w => Object.keys(w.update).join() === '$set' && Object.keys(w.update.$set).sort().join() === 'reviewAt,status,updatedAt'), 'the write is $set of status, reviewAt and updatedAt only');
  const again = await call(posts, 'POST', { action: 'send-review', leadId: LEAD, ids });
  ok(again._status === 200 && again._json.ids.length === 0, 'sending again moves nothing (they are already waiting)');
  const none = await call(posts, 'POST', { action: 'send-review', leadId: LEAD, ids: [] });
  const noLead = await call(posts, 'POST', { action: 'send-review', ids: [P(3)] });
  ok(none._status === 400 && noLead._status === 400, 'no ids, or no lead, is a 400');
  const junk = await call(posts, 'POST', { action: 'send-review', leadId: { $ne: '' }, ids: [{ $gt: '' }, 'not-an-id'] });
  ok(junk._status === 400 || (junk._status === 200 && junk._json.ids.length === 0), 'an operator for the lead or an id moves nothing');
  ok(_stores.posts.length === 9, 'the send never creates a post (no post written from the action body)');
}

/* ── Hashtag sets ── */
seed();
{
  const sets = [
    { id: 'hs-a', name: 'Coffee', tags: 'coffee #latte  latte #Latte', extra: 'dropped' },
    { id: 'bad id!*', name: 'N'.repeat(80), tags: '#a '.repeat(400) },
    { id: 'hs-empty', name: 'Nothing', tags: '   ' },
    ...Array.from({ length: 12 }, (_, i) => ({ id: `hs${i}`, name: `Set ${i}`, tags: `#tag${i}` })),
  ];
  const r = await call(callLeads, 'PATCH', { id: LEAD, set: { planner: { enabled: true, postsPerMonth: 12, welcome: 'Hi', hashtagSets: sets } } });
  const lead = _stores.call_leads[0];
  const hs = lead.planner.hashtagSets || [];
  ok(r._status === 200, `the planner PATCH with hashtag sets answers 200 (got ${r._status} ${JSON.stringify(r._json).slice(0, 160)})`);
  ok(hs.length === 10, `at most ten sets (got ${hs.length})`);
  ok(hs.every(x => Object.keys(x).sort().join() === 'id,name,tags'), 'each set is exactly id, name and tags');
  ok(hs[0].id === 'hs-a' && hs[0].name === 'Coffee' && hs[0].tags === '#coffee #latte', `tags are normalised like a post's (got ${JSON.stringify(hs[0])})`);
  ok(hs[1].id === 'badid' && hs[1].name.length === 40 && hs[1].tags.length <= 500, 'an id keeps only safe characters, a name stops at 40, tags at 500');
  ok(!hs.some(x => x.id === 'hs-empty'), 'a set with no tags is dropped');
  ok(new Set(hs.map(x => x.id)).size === hs.length, 'ids are unique');
  ok(lead.planner.token === 'tok_kept_kept_kept_kept_kept_kept' && lead.planner.lastViewedAt === '2026-11-20T10:00:00Z', 'the token and lastViewedAt are carried, never taken from the save');
  const keep = await call(callLeads, 'PATCH', { id: LEAD, set: { planner: { enabled: true, postsPerMonth: 10, welcome: 'Hello' } } });
  ok(keep._status === 200 && (lead.planner.hashtagSets || []).length === 10 && lead.planner.postsPerMonth === 10, 'a planner save that does not name the sets keeps them');
  await call(callLeads, 'PATCH', { id: LEAD, set: { planner: { enabled: true, postsPerMonth: 10, welcome: 'Hello', hashtagSets: [] } } });
  ok(Array.isArray(lead.planner.hashtagSets) && lead.planner.hashtagSets.length === 0, 'an empty list clears them');
  await call(callLeads, 'PATCH', { id: LEAD, set: { planner: { enabled: true, postsPerMonth: 10, welcome: 'Hello', hashtagSets: 'not a list' } } });
  ok(Array.isArray(lead.planner.hashtagSets) && lead.planner.hashtagSets.length === 0, 'a value that is not a list reads as none');
}

/* ── Seen on open ── */
seed();
{
  const before = Date.now();
  const r = await call(suggestions, 'PATCH', { id: '707f1f77bcf86cd799439001', set: { seenAt: true } });
  const s = _stores.suggestions[0];
  ok(r._status === 200 && Date.parse(s.seenAt) >= before - 5, `opening an idea stamps seenAt now on the server (got ${JSON.stringify(s.seenAt)})`);
  ok(s.status === 'new', 'seeing it does not answer it');
  const bad = await call(suggestions, 'PATCH', { id: '707f1f77bcf86cd799439001', set: { seenAt: { $gt: '' }, subject: 'rewritten' } });
  ok(bad._status === 200 && typeof s.seenAt === 'string' && s.subject === 'Friday special', 'an object for seenAt is a string, and nothing outside the whitelist is written');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing, ${passes} passing.` : `\nAll ${passes} planner board checks pass.`);
process.exit(fails ? 1 : 0);
