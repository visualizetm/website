#!/usr/bin/env node
/* The guard that stays (docs/SECURITY-AUDIT.md, Part 8). Runs the real
 * handlers under api/ against an in memory MongoDB fake (the same trick
 * scripts/planner-endpoint-test.mjs uses: api/ is copied into a temp dir
 * inside the repo with _lib/mongo.js swapped) and asserts the things an
 * attacker with the public bundle would try:
 *
 *   - operator injection: { "$gt": "INJECT" } as slug, token, month, postId,
 *     id, ids, leadId, status, type, q, days, kind, eventId, and the login
 *     password, on every public and admin query, is refused or cast. The
 *     fake records every filter and update it is handed and the sentinel
 *     must appear in none of them; a fake that meets an operator it does not
 *     know throws, which the route wrapper turns into a 500, which fails.
 *   - a javascript: URL, a data: URL, a protocol relative URL and a URL with
 *     a newline in every image and link field store as '', while https://
 *     and a root relative path store unchanged
 *   - a <script> tag in every text field that reaches a public page is
 *     stored verbatim and comes back out of the public endpoints as a JSON
 *     string, never as HTML
 *   - the planner: a malformed token, a disabled planner's token, an unknown
 *     token and no token answer identical bytes; a cross client postId is
 *     that same answer; a revoked token stops on the next call
 *   - the admin guard: no cookie, a cookie signed with the wrong secret, and
 *     an expired cookie are 401; the login limiter locks the eleventh wrong
 *     password out and a right one after the window gets in
 *   - the form limiter and the field normaliser: the eleventh contact in an
 *     hour is 429, nested fields flatten to strings, and a reserved Web3Forms
 *     key in the fields never reaches the notification request
 *
 *   node scripts/security-test.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'security-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);

/* ── The in-memory MongoDB fake ──────────────────────────────────────── */
const FAKE = `
import crypto from 'node:crypto';
export const _stores = {};
export const _log = [];
export const _reset = () => { for (const k of Object.keys(_stores)) delete _stores[k]; _log.length = 0; };
const store = (n) => (_stores[n] = _stores[n] || []);
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp) && v.constructor && (v.constructor.name === 'Object');
const norm = (v) => (v instanceof Date ? v.getTime() : (v && typeof v === 'object' && typeof v.toHexString === 'function') ? v.toHexString() : v);
const getPath = (o, k) => k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);
function setPath(o, k, v) { const parts = k.split('.'); let cur = o; for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]]; } cur[parts[parts.length - 1]] = v; }
function delPath(o, k) { const parts = k.split('.'); let cur = o; for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]]) return; cur = cur[parts[i]]; } delete cur[parts[parts.length - 1]]; }
function cmp(actual, v) {
  const a = norm(actual), b = norm(v);
  if (v instanceof RegExp) return v.test(String(actual ?? ''));
  if (isPlain(v)) {
    for (const [op, arg] of Object.entries(v)) {
      if (op === '$ne') { if (String(a) === String(norm(arg))) return false; continue; }
      if (op === '$in') { if (!arg.some(x => String(norm(x)) === String(a))) return false; continue; }
      if (op === '$nin') { if (arg.some(x => String(norm(x)) === String(a))) return false; continue; }
      if (op === '$exists') { if ((actual !== undefined) !== !!arg) return false; continue; }
      if (op === '$gt') { if (!(a > norm(arg))) return false; continue; }
      if (op === '$gte') { if (!(a >= norm(arg))) return false; continue; }
      if (op === '$lt') { if (!(a < norm(arg))) return false; continue; }
      if (op === '$lte') { if (!(a <= norm(arg))) return false; continue; }
      if (op === '$regex') { if (!new RegExp(arg, v.$options || '').test(String(actual ?? ''))) return false; continue; }
      if (op.startsWith('$')) throw new Error('fake mongo: unsupported operator ' + op);
      // a plain sub-document: exact match on its keys
      return JSON.stringify(actual) === JSON.stringify(v);
    }
    return true;
  }
  if (Array.isArray(actual) && !Array.isArray(v)) return actual.some(x => String(norm(x)) === String(b));
  return String(a) === String(b);
}
function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, v]) => {
    if (k === '$or') return v.some(f => matches(doc, f));
    if (k === '$and') return v.every(f => matches(doc, f));
    if (k.startsWith('$')) throw new Error('fake mongo: unsupported top level ' + k);
    return cmp(getPath(doc, k), v);
  });
}
function applyUpdate(doc, update) {
  for (const [k, v] of Object.entries(update.$set || {})) setPath(doc, k, v);
  for (const k of Object.keys(update.$unset || {})) delPath(doc, k);
  for (const [k, v] of Object.entries(update.$push || {})) {
    const cur = getPath(doc, k); const arr = Array.isArray(cur) ? cur : [];
    const items = v && typeof v === 'object' && '$each' in v ? v.$each : [v];
    let next = [...arr, ...items];
    if (v && typeof v === 'object' && typeof v.$slice === 'number') next = v.$slice < 0 ? next.slice(v.$slice) : next.slice(0, v.$slice);
    setPath(doc, k, next);
  }
}
function collection(name) {
  const list = store(name);
  const rec = (op, filter, update) => _log.push({ collection: name, op, filter, update });
  const cursor = (items) => {
    let out = [...items]; let proj = null;
    const api = {
      sort(spec) { const keys = Object.keys(spec || {}); out.sort((a, b) => { for (const k of keys) { const x = String(getPath(a, k) ?? ''); const y = String(getPath(b, k) ?? ''); if (x !== y) return (x < y ? -1 : 1) * (spec[k] < 0 ? -1 : 1); } return 0; }); return api; },
      limit(n) { out = out.slice(0, n); return api; },
      project(p) { proj = p; return api; },
      async toArray() { return proj ? out.map(d => Object.fromEntries(Object.entries(d).filter(([k]) => k === '_id' || proj[k]))) : out; },
    };
    return api;
  };
  return {
    async findOne(filter) { rec('findOne', filter); return list.find(d => matches(d, filter)) || null; },
    find(filter, opts) { rec('find', filter); const c = cursor(list.filter(d => matches(d, filter))); if (opts?.projection) c.project(opts.projection); return c; },
    async countDocuments(filter) { rec('count', filter); return list.filter(d => matches(d, filter || {})).length; },
    aggregate() { return { async toArray() { return []; } }; },
    async createIndex() { return 'ok'; },
    async insertOne(doc) { rec('insertOne', null, doc); const d = { _id: doc._id || crypto.randomBytes(12).toString('hex'), ...doc }; list.push(d); return { insertedId: d._id }; },
    async insertMany(docs) { for (const d of docs) await this.insertOne(d); return { insertedCount: docs.length }; },
    async updateOne(filter, update, opts) {
      rec('updateOne', filter, update);
      let doc = list.find(d => matches(d, filter));
      if (!doc && opts?.upsert) { doc = { _id: filter._id }; for (const [k, v] of Object.entries(update.$setOnInsert || {})) setPath(doc, k, v); list.push(doc); }
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      applyUpdate(doc, update); return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany(filter, update) { rec('updateMany', filter, update); let n = 0; for (const d of list) if (matches(d, filter)) { applyUpdate(d, update); n++; } return { matchedCount: n, modifiedCount: n }; },
    async findOneAndUpdate(filter, update, opts) { await this.updateOne(filter, update, opts); return { value: list.find(d => matches(d, filter)) || null }; },
    async deleteOne(filter) { rec('deleteOne', filter); const i = list.findIndex(d => matches(d, filter)); if (i >= 0) list.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
    async deleteMany(filter) { rec('deleteMany', filter); const before = list.length; for (let i = list.length - 1; i >= 0; i--) if (matches(list[i], filter)) list.splice(i, 1); return { deletedCount: before - list.length }; },
  };
}
export async function getDb() { return { collection }; }
`;
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), FAKE);

process.env.SESSION_SECRET = 'test-secret-not-real';
process.env.WEB3FORMS_NOTIFY_KEY = 'w3f-test-key';
delete process.env.VERCEL;
delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;

const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _log, _reset } = await load('_lib/mongo.js');
const showcase = (await load('showcase.js')).default;
const planner = (await load('planner.js')).default;
const submissions = (await load('submissions.js')).default;
const login = (await load('admin/login.js')).default;
const adminIndex = (await load('admin/index.js')).default;
const routes = {};
for (const n of ['call-leads', 'submissions', 'posts', 'projects', 'concept-packs', 'orders', 'export', 'stripe-reconcile', 'settings']) routes[n] = (await load(`_routes/${n}.js`)).handler;
const { signSession, sessionCookie } = await load('_lib/auth.js');
const { rateKey } = await load('_lib/limit.js');

/* Capture every outbound fetch (the Web3Forms notification). */
const sent = [];
globalThis.fetch = async (url, init) => { sent.push({ url: String(url), body: JSON.parse(init?.body || '{}') }); return { ok: true, status: 200, json: async () => ({}) }; };

const fakeRes = () => ({ _status: 200, _json: null, _body: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; } });
async function call(fn, method, { query = {}, body, headers = {}, url = '/api/x' } = {}) {
  const req = { method, query, body, headers: { 'x-forwarded-for': headers.ip || '203.0.113.9', ...headers }, url, socket: {} };
  const res = fakeRes();
  try { await fn(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  return res;
}
const bytes = (res) => `${res._status} ${JSON.stringify(res._json ?? res._body)}`;

const SENTINEL = 'INJECT';
/* The sentinel may legitimately survive as a STRING (a note that says
 * "INJECT", a field stringified to '{"$gt":"INJECT"}'); what must never
 * happen is an object whose key starts with $ carrying it into a filter or
 * an update, because that is the operator MongoDB would run. */
const hasSentinel = (v) => {
  if (!v || typeof v !== 'object') return false;
  if (v instanceof RegExp) return v.source.includes(SENTINEL);
  if (Array.isArray(v)) return v.some(hasSentinel);
  for (const [k, x] of Object.entries(v)) {
    if (k.startsWith('$') && JSON.stringify(x, (kk, y) => (y instanceof RegExp ? y.source : y)).includes(SENTINEL)) return true;
    if (hasSentinel(x)) return true;
  }
  return false;
};
const injectionReached = () => _log.some(e => hasSentinel(e.filter) || hasSentinel(e.update));

const THIS_MONTH = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
const ON = 'plnr_on_token_abcdefghijklmno';
const OFF = 'plnr_off_token_abcdefghijklmn';
const LEAD_ON = '507f1f77bcf86cd799439031';
const LEAD_OFF = '507f1f77bcf86cd799439032';
const POST_MINE = '607f1f77bcf86cd799439001';
const POST_THEIRS = '607f1f77bcf86cd799439006';
function seed() {
  _reset();
  _stores.call_leads = [
    { _id: LEAD_ON, business: 'Kims Cafe', phone: '555-0100', email: 'owner@kims.example', stage: 'client',
      showcase: { published: true, slug: 'kims-cafe', displayName: 'Kims Cafe', blurb: 'b', cover: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg', brand: { enabled: true, logo: { light: '', dark: '' }, images: [], notes: '' }, website: { enabled: true, url: 'https://kims.example', screenshots: [], notes: '' }, cards: { enabled: true, front: '', back: '', notes: '' }, print: { enabled: true, items: [], notes: '' }, instagram: { enabled: false, handle: '', url: '', profileImage: '', posts: [], highlights: [], notes: '' }, featured: { landing: false, logoStrip: false, work: false, order: 0 } },
      reviews: { googleLink: 'https://g.page/r/x', testimonials: [{ id: 't1', quote: 'Great', author: 'A', role: '', rating: 5, source: 'text', published: true, featured: false, order: 0, at: '' }] },
      planner: { enabled: true, token: ON, tokenCreatedAt: '2026-08-01T10:00:00Z', lastViewedAt: '', postsPerMonth: 8, welcome: 'Hi' } },
    { _id: LEAD_OFF, business: 'Off Co', phone: '555-0200', email: 'x@off.example',
      planner: { enabled: false, token: OFF, tokenCreatedAt: '', lastViewedAt: '', postsPerMonth: 8, welcome: '' } },
  ];
  _stores.posts = [
    { _id: POST_MINE, leadId: LEAD_ON, month: THIS_MONTH, date: `${THIS_MONTH}-24`, time: '09:00', platforms: ['instagram'], platform: 'instagram', format: 'portrait', hashtags: '#a', imageUrl: 'https://img.example/a.jpg', caption: 'Peach', status: 'review', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false },
    { _id: POST_THEIRS, leadId: LEAD_OFF, month: THIS_MONTH, date: `${THIS_MONTH}-15`, time: '', platforms: ['instagram'], platform: 'instagram', format: 'portrait', hashtags: '', imageUrl: '', caption: 'Not yours', status: 'review', note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0, archived: false },
  ];
  _stores.submissions = [{ _id: '707f1f77bcf86cd799439001', type: 'contact', name: 'N', email: 'n@x.example', fields: { Message: 'hi' }, status: 'new', read: false, notes: '', createdAt: new Date() }];
  _stores.projects = [{ _id: '807f1f77bcf86cd799439001', leadId: LEAD_ON, name: 'Site', kind: 'web', stage: 'kickoff', schedule: [], deliverables: [], monthly: [], archived: false, createdAt: new Date() }];
  _stores.concept_packs = [{ _id: '907f1f77bcf86cd799439001', title: 'Pack', leadId: '', industryKey: '', kind: 'logo', prompts: [], images: [], tags: [], notes: '', usedFor: [], archived: false }];
  _stores.orders = [{ _id: 'a07f1f77bcf86cd799439001', source: 'walk-in', status: 'new', items: [], subtotal: 0, archived: false, createdAt: new Date() }];
  _stores.stripe_events = [{ _id: 'b07f1f77bcf86cd799439001', id: 'evt_1', type: 'charge.succeeded', amount: 10, at: '2026-09-01T00:00:00Z', description: 'x', matchedLeadId: '', ledgerId: '' }];
  _stores.settings = [];
}

/* ── 1. Operator injection ─────────────────────────────────────────── */
section('1. operator injection: the sentinel must reach no filter and no update');
const OP = { $gt: SENTINEL };
const OPS = [{ $gt: SENTINEL }, { $ne: SENTINEL }, { $regex: SENTINEL }];
async function injection(name, fn, method, opts, allowed) {
  for (const op of OPS) {
    seed(); _log.length = 0;
    const patched = JSON.parse(JSON.stringify(opts).replaceAll('"__OP__"', JSON.stringify(op)));
    const res = await call(fn, method, patched);
    const reached = injectionReached();
    const status = res._status;
    ok(!reached, `${name}: ${JSON.stringify(op)} reached a query: ${JSON.stringify(_log.filter(e => hasSentinel(e.filter) || hasSentinel(e.update)).slice(0, 2))}`);
    ok(status !== 599 && status !== 500, `${name}: ${JSON.stringify(op)} threw or answered 500 (${bytes(res)})`);
    ok(allowed.includes(status), `${name}: ${JSON.stringify(op)} answered ${status}, expected one of ${allowed.join('/')} (${bytes(res).slice(0, 120)})`);
  }
}
await injection('showcase ?slug', showcase, 'GET', { query: { slug: '__OP__' } }, [200, 404]);
{ seed(); const res = await call(showcase, 'GET', { query: { slug: OP } }); ok(!(res._json && res._json.slug), 'showcase ?slug operator does not return a client'); }
await injection('planner ?token', planner, 'GET', { query: { token: '__OP__' } }, [404]);
await injection('planner ?month', planner, 'GET', { query: { token: ON, month: '__OP__' } }, [200]);
await injection('planner POST postId', planner, 'POST', { query: { token: ON }, body: { postId: '__OP__', action: 'approve' } }, [404]);
await injection('planner POST action', planner, 'POST', { query: { token: ON }, body: { postId: POST_MINE, action: '__OP__' } }, [400]);
await injection('planner POST note', planner, 'POST', { query: { token: ON }, body: { postId: POST_MINE, action: 'request-change', note: '__OP__' } }, [200, 400]);
await injection('login password', login, 'POST', { body: { password: '__OP__' } }, [401]);
await injection('submissions POST fields', submissions, 'POST', { body: { type: 'contact', name: 'A', email: 'a@b.co', fields: { k: '__OP__' } } }, [200]);
await injection('submissions POST type', submissions, 'POST', { body: { type: '__OP__', name: 'A', email: 'a@b.co' } }, [200]);
await injection('admin call-leads GET ?deleted', routes['call-leads'], 'GET', { query: { deleted: '__OP__' } }, [200]);
await injection('admin call-leads PATCH id', routes['call-leads'], 'PATCH', { body: { id: '__OP__', set: { business: 'x' } } }, [400]);
await injection('admin call-leads PATCH set key', routes['call-leads'], 'PATCH', { body: { id: LEAD_ON, set: { business: '__OP__' } } }, [200]);
await injection('admin call-leads PATCH restore ids', routes['call-leads'], 'PATCH', { body: { action: 'restore', ids: ['__OP__'] } }, [400]);
await injection('admin call-leads DELETE ids', routes['call-leads'], 'DELETE', { query: { ids: '__OP__' } }, [400]);
await injection('admin submissions GET ?id', routes.submissions, 'GET', { query: { id: '__OP__' } }, [400]);
await injection('admin submissions GET ?status', routes.submissions, 'GET', { query: { status: '__OP__' } }, [200]);
await injection('admin submissions GET ?type', routes.submissions, 'GET', { query: { type: '__OP__' } }, [200]);
await injection('admin submissions GET ?q', routes.submissions, 'GET', { query: { q: '__OP__' } }, [200]);
await injection('admin submissions GET ?days', routes.submissions, 'GET', { query: { days: '__OP__' } }, [200]);
await injection('admin submissions PATCH id', routes.submissions, 'PATCH', { body: { id: '__OP__', set: { read: true } } }, [400]);
await injection('admin submissions PATCH set.status', routes.submissions, 'PATCH', { body: { id: '707f1f77bcf86cd799439001', set: { status: '__OP__' } } }, [400]);
await injection('admin submissions DELETE ids', routes.submissions, 'DELETE', { query: { ids: '__OP__' } }, [400]);
await injection('admin posts GET ?leadId', routes.posts, 'GET', { query: { leadId: '__OP__' } }, [200]);
await injection('admin posts GET ?month', routes.posts, 'GET', { query: { leadId: LEAD_ON, month: '__OP__' } }, [200]);
await injection('admin posts PATCH id', routes.posts, 'PATCH', { body: { id: '__OP__', set: { caption: 'x' } } }, [400]);
await injection('admin posts DELETE id', routes.posts, 'DELETE', { body: { id: '__OP__' } }, [400]);
await injection('admin projects GET ?leadId', routes.projects, 'GET', { query: { leadId: '__OP__' } }, [200]);
await injection('admin projects PATCH id', routes.projects, 'PATCH', { body: { id: '__OP__', set: { name: 'x' } } }, [400]);
await injection('admin concept-packs GET ?leadId', routes['concept-packs'], 'GET', { query: { leadId: '__OP__' } }, [200]);
await injection('admin concept-packs GET ?kind', routes['concept-packs'], 'GET', { query: { kind: '__OP__' } }, [200]);
await injection('admin concept-packs PATCH id', routes['concept-packs'], 'PATCH', { body: { id: '__OP__', set: { title: 'x' } } }, [400]);
await injection('admin orders GET ?status', routes.orders, 'GET', { query: { status: '__OP__' } }, [200]);
await injection('admin orders PATCH id', routes.orders, 'PATCH', { body: { id: '__OP__', set: { notes: 'x' } } }, [400]);
await injection('admin export ?status', routes.export, 'GET', { query: { status: '__OP__' } }, [200]);
await injection('admin export ?q', routes.export, 'GET', { query: { q: '__OP__' } }, [200]);
await injection('admin export ?days', routes.export, 'GET', { query: { days: '__OP__' } }, [200]);
await injection('admin stripe-reconcile eventId', routes['stripe-reconcile'], 'POST', { body: { eventId: '__OP__', leadId: LEAD_ON } }, [404]);
await injection('admin stripe-reconcile leadId', routes['stripe-reconcile'], 'POST', { body: { eventId: 'evt_1', leadId: '__OP__' } }, [400]);
await injection('admin settings PATCH profile', routes.settings, 'PATCH', { body: { set: { profile: { name: '__OP__' } } } }, [200]);

/* ── 2. URL fields ─────────────────────────────────────────────────── */
section('2. every image and link field: javascript:, data:, //host and a newline store as empty');
const BAD_URLS = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.example/x', 'https://ok.example/x\nhttps://evil', ' javascript:alert(1)', 'JAVASCRIPT:alert(1)'];
const GOOD_URLS = ['https://res.cloudinary.com/x/image/upload/v1/a.jpg', '/showcase/fixtures/square.svg', 'http://kims.example/menu'];
const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
async function urlField(name, fn, method, mk, read) {
  for (const u of BAD_URLS) {
    seed();
    const res = await call(fn, method, mk(u));
    const stored = read();
    ok(res._status === 200, `${name}: ${JSON.stringify(u).slice(0, 40)} answered ${res._status} (${bytes(res).slice(0, 100)})`);
    ok(stored === '', `${name}: ${JSON.stringify(u).slice(0, 40)} stored as ${JSON.stringify(stored)}, expected ''`);
  }
  for (const u of GOOD_URLS) {
    seed();
    await call(fn, method, mk(u));
    ok(read() === u, `${name}: ${u} should store unchanged, got ${JSON.stringify(read())}`);
  }
}
const lead = () => _stores.call_leads.find(l => String(l._id) === LEAD_ON);
const patchLead = (set) => ({ body: { id: LEAD_ON, set } });
const SC = (over) => ({ showcase: { ...lead().showcase, ...over } });
await urlField('showcase.cover', routes['call-leads'], 'PATCH', u => patchLead(SC({ cover: u })), () => lead().showcase.cover);
await urlField('showcase.logoUrl', routes['call-leads'], 'PATCH', u => patchLead(SC({ logoUrl: u })), () => lead().showcase.logoUrl);
await urlField('showcase.brand.logo.dark', routes['call-leads'], 'PATCH', u => patchLead(SC({ brand: { logo: { dark: u } } })), () => lead().showcase.brand.logo.dark);
await urlField('showcase.brand.images[].link', routes['call-leads'], 'PATCH', u => patchLead(SC({ brand: { images: [{ link: u, caption: 'c' }] } })), () => lead().showcase.brand.images[0].link);
await urlField('showcase.website.url', routes['call-leads'], 'PATCH', u => patchLead(SC({ website: { url: u } })), () => lead().showcase.website.url);
await urlField('showcase.website.screenshots[].link', routes['call-leads'], 'PATCH', u => patchLead(SC({ website: { screenshots: [{ link: u }] } })), () => lead().showcase.website.screenshots[0].link);
await urlField('showcase.cards.front', routes['call-leads'], 'PATCH', u => patchLead(SC({ cards: { front: u } })), () => lead().showcase.cards.front);
await urlField('showcase.cards.back', routes['call-leads'], 'PATCH', u => patchLead(SC({ cards: { back: u } })), () => lead().showcase.cards.back);
await urlField('showcase.print.items[].image', routes['call-leads'], 'PATCH', u => patchLead(SC({ print: { items: [{ label: 'l', image: u }] } })), () => lead().showcase.print.items[0].image);
await urlField('showcase.instagram.url', routes['call-leads'], 'PATCH', u => patchLead(SC({ instagram: { url: u } })), () => lead().showcase.instagram.url);
await urlField('showcase.instagram.profileImage', routes['call-leads'], 'PATCH', u => patchLead(SC({ instagram: { profileImage: u } })), () => lead().showcase.instagram.profileImage);
await urlField('showcase.instagram.posts[].link', routes['call-leads'], 'PATCH', u => patchLead(SC({ instagram: { posts: [{ link: u, image: '' }] } })), () => lead().showcase.instagram.posts[0].link);
await urlField('showcase.instagram.posts[].image', routes['call-leads'], 'PATCH', u => patchLead(SC({ instagram: { posts: [{ link: '', image: u }] } })), () => lead().showcase.instagram.posts[0].image);
await urlField('showcase.instagram.highlights[].image', routes['call-leads'], 'PATCH', u => patchLead(SC({ instagram: { highlights: [{ id: 'h', label: 'x', image: u, link: '' }] } })), () => lead().showcase.instagram.highlights[0].image);
await urlField('showcase.instagram.highlights[].link', routes['call-leads'], 'PATCH', u => patchLead(SC({ instagram: { highlights: [{ id: 'h', label: 'x', image: '', link: u }] } })), () => lead().showcase.instagram.highlights[0].link);
await urlField('concepts[].link', routes['call-leads'], 'PATCH', u => patchLead({ concepts: [{ id: 'c', label: 'L', status: 'ready', link: u }] }), () => lead().concepts[0].link);
await urlField('conceptsTracker.demoUrl', routes['call-leads'], 'PATCH', u => patchLead({ conceptsTracker: { items: [], demoUrl: u, driveUrl: '' } }), () => lead().conceptsTracker.demoUrl);
await urlField('conceptsTracker.driveUrl', routes['call-leads'], 'PATCH', u => patchLead({ conceptsTracker: { items: [], demoUrl: '', driveUrl: u } }), () => lead().conceptsTracker.driveUrl);
for (const k of ['website', 'drive', 'clickup', 'instagram']) await urlField(`links.${k}`, routes['call-leads'], 'PATCH', u => patchLead({ links: { [k]: u } }), () => lead().links[k]);
await urlField('brand.logoLink', routes['call-leads'], 'PATCH', u => patchLead({ brand: { logoLink: u } }), () => lead().brand.logoLink);
await urlField('reviews.googleLink', routes['call-leads'], 'PATCH', u => patchLead({ reviews: { ...lead().reviews, googleLink: u } }), () => lead().reviews.googleLink);
await urlField('posts.imageUrl', routes.posts, 'PATCH', u => ({ body: { id: POST_MINE, set: { imageUrl: u } } }), () => _stores.posts[0].imageUrl);
await urlField('concept-packs.images[].link', routes['concept-packs'], 'PATCH', u => ({ body: { id: '907f1f77bcf86cd799439001', set: { images: [{ id: 'i', label: 'l', link: u }] } } }), () => _stores.concept_packs[0].images[0].link);
await urlField('projects.links.drive', routes.projects, 'PATCH', u => ({ body: { id: '807f1f77bcf86cd799439001', set: { links: { drive: u, clickup: '' } } } }), () => _stores.projects[0].links.drive);
await urlField('projects.deliverables[].link', routes.projects, 'PATCH', u => ({ body: { id: '807f1f77bcf86cd799439001', set: { deliverables: [{ id: 'd', group: 'a', label: 'L', done: false, link: u }] } } }), () => _stores.projects[0].deliverables[0].link);
await urlField('orders.items[].artworkLink', routes.orders, 'PATCH', u => ({ body: { id: 'a07f1f77bcf86cd799439001', set: { items: [{ id: 'i', name: 'n', qty: 1, artworkLink: u }] } } }), () => _stores.orders[0].items[0].artworkLink);

/* ── 3. Script tags in text ─────────────────────────────────────────── */
section('3. a <script> in every public text field is stored verbatim and served as a JSON string');
const XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>';
{
  seed();
  await call(routes['call-leads'], 'PATCH', patchLead(SC({ blurb: XSS, displayName: XSS, brand: { notes: XSS, images: [{ link: GOOD_URLS[0], caption: XSS }] }, website: { notes: XSS }, instagram: { notes: XSS }, cards: { notes: XSS }, print: { notes: XSS, items: [{ label: XSS, image: '', caption: XSS }] } })));
  await call(routes['call-leads'], 'PATCH', patchLead({ planner: { enabled: true, postsPerMonth: 8, welcome: XSS }, reviews: { ...lead().reviews, testimonials: [{ id: 't', quote: XSS, author: XSS, role: XSS, rating: 5, source: 'text', published: true, featured: true, order: 0 }] } }));
  const sh = lead().showcase;
  for (const [k, v] of [['blurb', sh.blurb], ['displayName', sh.displayName], ['brand.notes', sh.brand.notes], ['brand image caption', sh.brand.images[0].caption], ['website.notes', sh.website.notes], ['instagram.notes', sh.instagram.notes], ['cards.notes', sh.cards.notes], ['print.notes', sh.print.notes], ['print item label', sh.print.items[0].label], ['planner.welcome', lead().planner.welcome], ['testimonial quote', lead().reviews.testimonials[0].quote]]) ok(v === XSS, `${k} stored verbatim (got ${JSON.stringify(v).slice(0, 60)})`);
  ok(lead().planner.token === ON, 'a planner PATCH from the admin carries the token forward, it cannot set or wipe it');
  const pub = await call(showcase, 'GET', { query: { slug: 'kims-cafe' } });
  ok(pub._status === 200 && pub._json.blurb === XSS && pub._json.brand.notes === XSS && pub._json.testimonials[0].quote === XSS, 'the public showcase serves the strings as JSON values');
  ok(!pub._headers['Content-Type'] || /json/.test(pub._headers['Content-Type']), 'the public showcase never sets an HTML content type');
  await call(routes.posts, 'PATCH', { body: { id: POST_MINE, set: { caption: XSS, hashtags: XSS, note: XSS } } });
  ok(_stores.posts[0].caption === XSS && _stores.posts[0].note === XSS, 'post caption and note stored verbatim');
  ok(_stores.posts[0].hashtags.startsWith('#<script>'), `hashtags normalised to tokens, never HTML (got ${JSON.stringify(_stores.posts[0].hashtags).slice(0, 50)})`);
  const pl = await call(planner, 'GET', { query: { token: ON } });
  ok(pl._status === 200 && pl._json.client.welcome === XSS && pl._json.posts[0].caption === XSS, 'the planner serves welcome and caption as JSON values');
  ok(pl._headers['Cache-Control'] === 'no-store', 'the planner answers with Cache-Control: no-store');
  const cr = await call(planner, 'POST', { query: { token: ON }, body: { postId: POST_MINE, action: 'request-change', note: XSS } });
  ok(cr._status === 200 && _stores.posts[0].clientNote === XSS, 'a change request note is stored verbatim');
  const rv = await call(submissions, 'POST', { body: { type: 'review', name: XSS, business: XSS, rating: 5, text: XSS, slug: 'kims-cafe' } });
  ok(rv._status === 200 && _stores.submissions.at(-1).fields.text === XSS && _stores.submissions.at(-1).name === XSS, 'a review submission is stored verbatim');
}

/* ── 4. The planner token ───────────────────────────────────────────── */
section('4. the planner token');
{
  seed();
  const noToken = await call(planner, 'GET', {});
  const malformed = await call(planner, 'GET', { query: { token: 'short' } });
  const malformed2 = await call(planner, 'GET', { query: { token: 'has spaces and $ signs in it!' } });
  const unknown = await call(planner, 'GET', { query: { token: 'plnr_unknown_abcdefghijklmnop' } });
  const disabled = await call(planner, 'GET', { query: { token: OFF } });
  const arr = await call(planner, 'GET', { query: { token: [ON, ON] } });
  const all = [noToken, malformed, malformed2, unknown, disabled, arr].map(bytes);
  ok(all.every(b => b === all[0]) && all[0].startsWith('404'), `no token, malformed, unknown, disabled and an array all answer the same bytes (${[...new Set(all)].join(' | ')})`);
  ok(_log.filter(e => e.op === 'findOne' && e.collection === 'call_leads').length === 2, `only the two well formed tokens reach the database, the empty, short, spaced and array ones never do (${_log.filter(e => e.collection === 'call_leads').length} lookups for 6 requests)`);
  ok(!_log.some(e => e.op === 'updateOne'), 'a miss writes nothing (no limiter, no lastViewedAt)');
  const cross = await call(planner, 'POST', { query: { token: ON }, body: { postId: POST_THEIRS, action: 'approve' } });
  ok(bytes(cross) === all[0], `another client's post is the same 404 (${bytes(cross)})`);
  ok(_stores.posts[1].status === 'review', 'and it was not changed');
  const filter = _log.find(e => e.op === 'findOne' && e.collection === 'posts')?.filter;
  ok(filter && String(filter.leadId) === LEAD_ON, `the ownership check is inside the query (${JSON.stringify(filter)})`);
  const mine = await call(planner, 'POST', { query: { token: ON }, body: { postId: POST_MINE, action: 'approve' } });
  ok(mine._status === 200 && _stores.posts[0].status === 'approved', 'their own post approves');
  // revoke: the admin regenerates, the old link stops on the next call
  lead().planner.token = 'plnr_new_token_abcdefghijklmnop';
  const revoked = await call(planner, 'GET', { query: { token: ON } });
  ok(bytes(revoked) === all[0], 'a revoked token is the same 404 on the very next call');
  const off = await call(routes['call-leads'], 'PATCH', patchLead({ planner: { enabled: false, postsPerMonth: 8, welcome: '' } }));
  const afterOff = await call(planner, 'GET', { query: { token: 'plnr_new_token_abcdefghijklmnop' } });
  ok(off._status === 200 && bytes(afterOff) === all[0], 'switching the planner off is the same 404 on the next call');
  // the action limiter: 30 in an hour, the 31st is 429, and the key is a hash
  seed();
  for (let i = 0; i < 30; i++) await call(planner, 'POST', { query: { token: ON }, body: { postId: 'nope', action: 'approve' } });
  const thirtyFirst = await call(planner, 'POST', { query: { token: ON }, body: { postId: POST_MINE, action: 'approve' } });
  ok(thirtyFirst._status === 429 && thirtyFirst._headers['Retry-After'], `the 31st action in an hour is 429 with Retry-After (${thirtyFirst._status})`);
  ok(_stores.settings.every(s => !String(s._id).includes(ON)), `the limiter key never carries the token (${_stores.settings.map(s => s._id).join(', ')})`);
}

/* ── 5. The admin guard and the login limiter ───────────────────────── */
section('5. the admin guard and the login limiter');
{
  seed();
  const none = await call(adminIndex, 'GET', { query: { r: 'call-leads' } });
  ok(none._status === 401, `no cookie is 401 (${none._status})`);
  const good = await call(adminIndex, 'GET', { query: { r: 'call-leads' }, headers: { cookie: `vz_admin=${signSession()}` } });
  ok(good._status === 200, `a cookie signed with SESSION_SECRET is 200 (${good._status})`);
  const exp = `${Date.now() - 1000}`;
  const expired = await call(adminIndex, 'GET', { query: { r: 'call-leads' }, headers: { cookie: `vz_admin=${exp}.${crypto.createHmac('sha256', process.env.SESSION_SECRET).update(exp).digest('base64url')}` } });
  ok(expired._status === 401, `an expired cookie with a valid signature is 401 (${expired._status})`);
  const fut = `${Date.now() + 86400000}`;
  const forged = await call(adminIndex, 'GET', { query: { r: 'call-leads' }, headers: { cookie: `vz_admin=${fut}.${crypto.createHmac('sha256', 'visualize-admin-session-fallback-2026').update(fut).digest('base64url')}` } });
  ok(forged._status === 401, `a cookie signed with the old fallback constant is 401 (${forged._status})`);
  const garbage = await call(adminIndex, 'GET', { query: { r: 'call-leads' }, headers: { cookie: 'vz_admin=%E0%A4%A' } });
  ok(garbage._status === 401, `a cookie that does not decode is 401, not 500 (${garbage._status})`);
  const unknownRoute = await call(adminIndex, 'GET', { query: { r: '../../etc/passwd' }, headers: { cookie: `vz_admin=${signSession()}` } });
  ok(unknownRoute._status === 404, `an unknown route name is 404 (${unknownRoute._status})`);

  // the login limiter
  seed();
  const attempts = [];
  for (let i = 0; i < 11; i++) attempts.push((await call(login, 'POST', { body: { password: 'wrong' + i }, headers: { ip: '198.51.100.7' } }))._status);
  ok(attempts.slice(0, 10).every(s => s === 401) && attempts[10] === 429, `ten wrong passwords are 401, the eleventh is 429 (${attempts.join(',')})`);
  const otherIp = await call(login, 'POST', { body: { password: 'wrong' }, headers: { ip: '198.51.100.8' } });
  ok(otherIp._status === 401, `another IP is not locked out (${otherIp._status})`);
  const rightButLocked = await call(login, 'POST', { body: { password: 'VISLIVE' }, headers: { ip: '198.51.100.7' } });
  ok(rightButLocked._status === 429, `the right password is refused while locked (${rightButLocked._status})`);
  ok(_stores.settings.every(s => !String(s._id).includes('198.51.100.7')), 'the limiter key never carries the address');
  // the window passes
  for (const s of _stores.settings) if (String(s._id).startsWith('rate:login:')) s.hits = s.hits.map(t => t - 16 * 60e3);
  const afterWindow = await call(login, 'POST', { body: { password: 'VISLIVE' }, headers: { ip: '198.51.100.7' } });
  ok(afterWindow._status === 200 && /^vz_admin=\d+\.[A-Za-z0-9_-]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/.test(String(afterWindow._headers['Set-Cookie'])), `after the window the right password signs in with an HttpOnly, Secure, SameSite=Lax cookie (${afterWindow._status} ${afterWindow._headers['Set-Cookie']})`);
  ok(!_stores.settings.some(s => s._id === rateKey('login', '198.51.100.7')), 'a successful sign in clears that address\'s count');
  const big = await call(login, 'POST', { body: { password: 'x' }, headers: { 'content-length': String(5 * 1024) } });
  ok(big._status === 413, `a body over 4KB is 413 (${big._status})`);
  // production refuses to sign without SESSION_SECRET
  process.env.VERCEL = '1'; const saved = process.env.SESSION_SECRET; delete process.env.SESSION_SECRET;
  const noSecret = await call(login, 'POST', { body: { password: 'VISLIVE' }, headers: { ip: '198.51.100.9' } });
  ok(noSecret._status === 500 && /SESSION_SECRET/.test(noSecret._json?.error || ''), `on Vercel without SESSION_SECRET the right password is a 500 that names the variable, not a cookie (${bytes(noSecret)})`);
  ok(!noSecret._headers['Set-Cookie'], 'and no cookie is set');
  process.env.SESSION_SECRET = saved; delete process.env.VERCEL;
}

/* ── 6. The form limiter and the field normaliser ───────────────────── */
section('6. /api/submissions: the limiter and the fields');
{
  seed(); sent.length = 0;
  const codes = [];
  for (let i = 0; i < 11; i++) codes.push((await call(submissions, 'POST', { body: { type: 'contact', name: 'A', email: 'a@b.example', fields: { Message: 'hi ' + i } }, headers: { ip: '192.0.2.4' } }))._status);
  ok(codes.slice(0, 10).every(c => c === 200) && codes[10] === 429, `ten contact forms in an hour are 200, the eleventh is 429 (${codes.join(',')})`);
  ok(_stores.submissions.length === 1 + 10, `the eleventh was not stored (${_stores.submissions.length - 1} stored)`);
  seed(); sent.length = 0;
  const rv = [];
  for (let i = 0; i < 4; i++) rv.push((await call(submissions, 'POST', { body: { type: 'review', name: 'A', rating: 5, text: 'good', slug: 'kims-cafe' }, headers: { ip: '192.0.2.5' } }))._status);
  ok(rv.join(',') === '200,200,200,429', `three reviews in an hour, the fourth is 429 (${rv.join(',')})`);
  const honey = await call(submissions, 'POST', { body: { type: 'contact', name: 'Bot', email: 'b@b.example', company: 'filled' } });
  ok(honey._status === 200 && honey._json?.ok === true && !('id' in (honey._json || {})), `the honeypot answers like a success and stores nothing (${bytes(honey)})`);

  seed(); sent.length = 0;
  const nested = await call(submissions, 'POST', { body: { type: 'start', name: 'N', email: 'n@n.example', fields: {
    Goal: 'A site', List: ['a', 'b'], Deep: { x: { y: 1 } }, 'bad$key': 'x', '<b>': 'x', access_key: 'stolen', email: 'attacker@evil.example', ccemail: 'victim@evil.example', subject: 'pwned', redirect: 'https://evil.example', _hidden: 'x', Long: 'x'.repeat(5000), Ctrl: 'a bc',
    ...Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`Extra${i}`, String(i)])),
  } }, headers: { ip: '192.0.2.6' } });
  const f = _stores.submissions.at(-1).fields;
  ok(nested._status === 200, `a start form with hostile fields is still accepted (${nested._status})`);
  ok(f.Goal === 'A site' && f.List === 'a, b' && f.Deep === '{"x":{"y":1}}', `arrays and objects flatten to strings (${JSON.stringify({ List: f.List, Deep: f.Deep })})`);
  ok(!('bad$key' in f) && !('<b>' in f), 'keys outside the alphabet are dropped');
  ok('_hidden' in f, 'an underscore key is an ordinary field in the record (only the email drops it)');
  ok(f.Long.length === 3000, `a value is capped at 3000 (${f.Long.length})`);
  ok(f.Ctrl === 'abc', `control characters are stripped (${JSON.stringify(f.Ctrl)})`);
  ok(Object.keys(f).length <= 40, `at most 40 fields are kept (${Object.keys(f).length})`);
  const mail = sent.find(s => /web3forms/.test(s.url));
  ok(mail, 'a notification email was attempted');
  ok(mail && mail.body.access_key === 'w3f-test-key', `the Web3Forms key is Rob's, not the form's (${mail?.body.access_key})`);
  ok(mail && mail.body.email === 'n@n.example', `the reply address is the submitter's own field, not fields.email (${mail?.body.email})`);
  ok(mail && !('ccemail' in mail.body) && !('redirect' in mail.body) && !('_hidden' in mail.body) && mail.body.subject.startsWith('New '), `ccemail, redirect, _hidden and subject from the form never reach the request (${Object.keys(mail?.body || {}).join(',')})`);
  ok(_stores.submissions.at(-1).name === 'N' && _stores.submissions.at(-1).email === 'n@n.example', 'the stored record keeps the real sender');
}

/* ── 7. The backup ──────────────────────────────────────────────────── */
section('7. the backup leaves the plumbing out');
{
  seed();
  _stores.settings.push({ _id: 'rate:planner:abc', hits: [1] }, { _id: 'rate:login:def', hits: [1] }, { _id: 'client-log', items: [{ stack: 'x' }] }, { _id: 'profile', name: 'Rob' });
  _stores.push_subscriptions = [{ _id: 'p1', subscription: { endpoint: 'https://push.example/x' } }];
  _stores.stripe_events[0].raw = '{"secret":"x"}';
  const b = await call((await load('_routes/backup.js')).handler, 'GET', {});
  const out = JSON.parse(b._body);
  ok(!('push_subscriptions' in out.collections), 'push subscriptions are not in the backup');
  ok(out.collections.stripe_events.every(r => !('raw' in r)), 'raw Stripe payloads are not in the backup');
  ok(out.collections.settings.every(s => !/^rate:/.test(s._id) && s._id !== 'client-log') && out.collections.settings.some(s => s._id === 'profile'), `limiter documents and the client log are not in the backup (${out.collections.settings.map(s => s._id).join(',')})`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} checks passed, ${fails} failed.`);
if (fails) { console.log('Security tests FAILED.'); process.exit(1); }
console.log('All security tests pass.');
