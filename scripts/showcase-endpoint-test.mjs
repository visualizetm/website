#!/usr/bin/env node
/* Node test for api/showcase.js (Site Prompt 2): asserts the response keys
 * are exactly the public whitelist (no phone, email, contact names,
 * pricing, purchases, projects, callLog, notes, or any other private
 * field), that a draft (unpublished) client never appears, and that
 * api/_routes/call-leads.js's PATCH slug logic auto-generates a unique slug
 * on first publish and rejects a manually chosen slug that collides with
 * another published client.
 *
 * No real MongoDB in this environment: copies api/ into a temp dir inside
 * the repo (so node_modules resolves) with _lib/mongo.js replaced by an
 * in-memory fake, then imports the real handlers unmodified.
 *   node scripts/showcase-endpoint-test.mjs
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.rmSync(tmpBase, { recursive: true, force: true });
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'showcase-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });

// ── Fixtures ──────────────────────────────────────────────────────────
const now = new Date();
// Valid 24 hex-char ids: the real handler casts _id through ObjectId().
const fullClient = {
  _id: '507f1f77bcf86cd799439011', business: 'Full Client Co', industry: 'Coffee Shop',
  phone: '555-0100', email: 'owner@fullclient.example', notes: 'private internal notes',
  askFor: 'Jamie', purchases: [{ label: 'Website', amount: 4000 }], callLog: [{ at: now.toISOString(), outcome: 'booked' }],
  stage: 'client', clientSince: '2024-06-01',
  links: { website: 'https://fullclient.example' },
  brand: { primary: '#d44c43', colors: ['#111111', '#eeeeee'], fontDisplay: 'Barlow Condensed', fontBody: 'Inter', logoLink: 'https://drive.example/logo', notes: 'internal brand notes' },
  socials: { instagram: 'https://instagram.com/full', facebook: 'https://facebook.com/full', website: 'https://fullclient.example', tiktok: 'https://tiktok.com/@full' },
  showcase: {
    published: true, slug: 'full-client', displayName: 'Full Client Co', type: 'Coffee Shop', blurb: 'A full showcase example.', cover: 'https://img.example/full-cover.jpg', year: '2026',
    brand: { enabled: true, logo: { light: 'https://img.example/full-logo-light.png', dark: 'https://img.example/full-logo-dark.png' }, images: [{ link: 'https://img.example/full-1.jpg', caption: 'Signage' }], notes: 'showcase brand notes' },
    // Site Prompt 7: ten posts and an @-prefixed handle, to prove the cap and the strip.
    instagram: { enabled: true, handle: '@fullclient', url: '', profileImage: 'https://img.example/full-avatar.jpg',
      posts: Array.from({ length: 10 }, (_, i) => ({ link: `https://instagram.example/p/${i}`, image: `https://img.example/ig-${i}.jpg`, caption: '' })), notes: '' },
    website: { enabled: true, url: 'https://fullclient.example', screenshots: [{ link: 'https://img.example/full-shot.jpg', caption: 'Homepage' }], notes: '' },
    cards: { enabled: true, front: 'https://img.example/full-card-front.jpg', back: 'https://img.example/full-card-back.jpg', notes: '' },
    print: { enabled: true, items: [{ label: 'Menu', image: 'https://img.example/full-menu.jpg', caption: '' }], notes: '' },
    featured: { landing: true, logoStrip: true, work: true, order: 1 },
    updatedAt: now,
  },
  reviews: {
    googleLink: 'https://g.page/r/full-client/review',
    nfcCard: true,
    testimonials: [
      { id: 't1', quote: 'Great work.', author: 'Jamie Owner', role: 'Owner', rating: 5, source: 'text', published: true, featured: true, order: 0, at: now.toISOString() },
      { id: 't2', quote: 'Hidden draft quote.', author: 'Someone', role: '', rating: 3, source: 'email', published: false, featured: false, order: 1, at: now.toISOString() },
    ],
  },
  updatedAt: now,
};
const brandOnlyClient = {
  _id: '507f1f77bcf86cd799439012', business: 'Brand Only Co', industry: 'Bakery',
  phone: '555-0200', email: 'owner@brandonly.example', notes: 'private',
  stage: 'client', clientSince: '2025-01-01',
  brand: { primary: '#222222', colors: [], fontDisplay: '', fontBody: '' },
  socials: {},
  showcase: {
    published: true, slug: 'brand-only', displayName: 'Brand Only Co', type: 'Bakery', blurb: 'Only the brand section is set up.', cover: '', year: '',
    brand: { enabled: true, logo: { light: '', dark: '' }, images: [], notes: '' },
    website: { enabled: false, url: '', screenshots: [], notes: '' },
    cards: { enabled: false, front: '', back: '', notes: '' },
    print: { enabled: false, items: [], notes: '' },
    featured: { landing: false, logoStrip: false, work: false, order: 2 },
    updatedAt: now,
  },
  reviews: {
    testimonials: [
      { id: 't3', quote: 'Featured second testimonial.', author: 'Sam', role: 'Manager', rating: 4, source: 'website', published: true, featured: true, order: 0, at: now.toISOString() },
    ],
  },
  updatedAt: new Date(now.getTime() - 1000),
};
const draftClient = {
  _id: '507f1f77bcf86cd799439013', business: 'Draft Co', industry: 'Salon',
  phone: '555-0300', email: 'owner@draft.example', notes: 'private',
  stage: 'client',
  brand: {}, socials: {},
  showcase: { published: false, slug: '', displayName: 'Draft Co', type: 'Salon', blurb: 'Not published yet.', cover: '', year: '', brand: { enabled: true, logo: {}, images: [], notes: '' }, website: { enabled: false, url: '', screenshots: [], notes: '' }, cards: { enabled: false, front: '', back: '', notes: '' }, print: { enabled: false, items: [], notes: '' }, featured: { landing: false, logoStrip: false, work: false, order: 0 }, updatedAt: now },
  reviews: { testimonials: [] },
  updatedAt: now,
};

// Two never-published clients for the slug generation/collision tests below,
// seeded up front: the fake mongo module is written out as static source
// (see below) so a later store.set() from this script cannot reach it.
const newClient1 = { _id: '507f1f77bcf86cd799439021', business: 'New Client LLC', showcase: { published: false, slug: '' }, reviews: { testimonials: [] }, updatedAt: now };
const newClient2 = { _id: '507f1f77bcf86cd799439022', business: 'New Client LLC', showcase: { published: false, slug: '' }, reviews: { testimonials: [] }, updatedAt: now };
const settingsStore = new Map();
const projectsStore = [];

function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, v]) => {
    const actual = getPath(doc, k);
    if (v && typeof v === 'object' && '$ne' in v) return String(actual) !== String(v.$ne);
    if (v && typeof v === 'object' && '$in' in v) return v.$in.some(x => String(x) === String(actual));
    // _id (and any ObjectId-typed value) compares by string form, since the
    // real handler casts ids through ObjectId() but fixtures store plain
    // hex strings.
    return k === '_id' ? String(actual) === String(v) : actual === v;
  });
}
function getPath(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function collection(name) {
  if (name === 'settings') return {
    async findOne(filter) { return settingsStore.get(filter._id) || null; },
  };
  if (name === 'projects') return {
    async countDocuments(filter) { return projectsStore.filter(d => matches(d, filter)).length; },
  };
  const docs = () => [...store.values()];
  return {
    async findOne(filter) { return docs().find(d => matches(d, filter)) || null; },
    find(filter) { const items = docs().filter(d => matches(d, filter)); return { async toArray() { return items; } }; },
    async countDocuments(filter) { return docs().filter(d => matches(d, filter)).length; },
    aggregate() {
      // Mirrors api/showcase.js's computeStats() pipeline: average rating
      // across published testimonials with a non-null rating.
      const ratings = docs().flatMap(d => (d.reviews?.testimonials || [])).filter(t => t.published && t.rating != null).map(t => t.rating);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      return { async toArray() { return ratings.length ? [{ avg, n: ratings.length }] : []; } };
    },
    async updateOne(filter, update, opts) {
      const doc = docs().find(d => matches(d, filter));
      if (!doc && !opts?.upsert) return { matchedCount: 0 };
      if (update.$set) for (const [k, v] of Object.entries(update.$set)) setPath(doc, k, v);
      if (update.$unset) for (const k of Object.keys(update.$unset)) setPath(doc, k, undefined, true);
      return { matchedCount: doc ? 1 : 0 };
    },
  };
}
function setPath(obj, key, value, del) {
  const parts = key.split('.'); let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]]; }
  const last = parts[parts.length - 1];
  if (del) delete cur[last]; else cur[last] = value;
}
// The fake module is written as source text (not the live closures above,
// which cannot cross the module boundary) so the real, unmodified handlers
// import a self-contained getDb() with the same fixtures baked in.
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), `
const fixtures = ${JSON.stringify([fullClient, brandOnlyClient, draftClient, newClient1, newClient2])};
const store = new Map(fixtures.map(d => [d._id, d]));
const settingsStore = new Map();
const projectsStore = [];
${matches.toString()}
${getPath.toString()}
${setPath.toString()}
${collection.toString()}
export async function getDb() { return { collection }; }
`);

const showcaseUrl = pathToFileURL(path.join(apiDst, 'showcase.js')).href;
const { default: showcaseHandler } = await import(showcaseUrl);
process.env.SESSION_SECRET = 'test-not-real';

function fakeRes() {
  return { _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader(k, v) { this._headers[k] = v; } };
}
async function callShowcase(query = {}) {
  const req = { method: 'GET', query };
  const res = fakeRes();
  await showcaseHandler(req, res);
  return res;
}

let fails = 0;
const ok = (c, m, extra = '') => { console.log((c ? 'ok   ' : 'FAIL ') + m + (extra ? `  ${extra}` : '')); if (!c) fails++; };

const WHITELIST = ['slug', 'displayName', 'type', 'blurb', 'cover', 'year', 'brand', 'website', 'instagram', 'cards', 'print', 'featured', 'testimonials', 'socials', 'googleReview'].sort();
// Key names to check are absent entirely (showcase.*.notes is a real,
// intentionally public whitelisted field, so "notes" itself is checked by
// value below, not by key).
const PRIVATE_LEAK_KEYS = ['phone', 'email', 'askFor', 'purchases', 'callLog', 'clientSince', 'links', 'primary', 'colors', 'fontDisplay', 'fontBody', 'logoLink', 'tiktok'];
// Private VALUES that must never appear anywhere in the public object, even
// under a legitimately-whitelisted key like showcase.brand.notes.
const PRIVATE_LEAK_VALUES = ['private internal notes', '555-0100', 'owner@fullclient.example'];

{
  const res = await callShowcase();
  ok(res._status === 200, 'GET /api/showcase -> 200');
  ok(Array.isArray(res._json?.clients), 'response has a clients array');
  ok(res._json.clients.length === 2, `exactly 2 published clients returned (got ${res._json.clients.length})`);
  ok(!res._json.clients.some(c => c.slug === '' || c.displayName === 'Draft Co'), 'the draft client never appears in clients[]');

  const full = res._json.clients.find(c => c.slug === 'full-client');
  ok(!!full, 'the full fixture client is present');
  const keys = Object.keys(full).sort();
  ok(JSON.stringify(keys) === JSON.stringify(WHITELIST), `client keys are exactly the whitelist (got ${JSON.stringify(keys)})`);
  const dump = JSON.stringify(full);
  for (const leak of PRIVATE_LEAK_KEYS) ok(!dump.includes(`"${leak}"`), `private field "${leak}" is not present anywhere in the client object`);
  for (const leak of PRIVATE_LEAK_VALUES) ok(!dump.includes(leak), `private value "${leak}" never leaks, even under a whitelisted key`);
  ok(full.brand.palette.length === 3 && full.brand.palette[0].hex === '#d44c43', 'brand.palette computed live from lead.brand (primary + colors[]), not stored on showcase.brand');
  ok(full.brand.typography.some(t => t.family === 'Barlow Condensed' && t.role === 'Display'), 'brand.typography computed live from lead.brand');
  ok(full.testimonials.length === 1 && full.testimonials[0].quote === 'Great work.', 'only the PUBLISHED testimonial is returned, the draft one is excluded');
  ok(Object.keys(full.socials).sort().join(',') === 'facebook,instagram,website', 'socials whitelist is exactly instagram, facebook, website (tiktok excluded)');
  // The review prompt: the Google review link is public (it is the link the
  // client hands their own customers), and nothing else from reviews is.
  ok(full.googleReview === 'https://g.page/r/full-client/review', `googleReview carries the client's Google link (got ${JSON.stringify(full.googleReview)})`);
  ok(!dump.includes('nfcCard') && !dump.includes('asks'), 'the rest of the reviews record (NFC card, asks, counts) stays private');
  // Site Prompt 7, Part 5: one logo string, migrated at read from the old pair.
  ok(typeof full.brand.logo === 'string', `brand.logo is a single string, not a light/dark pair (got ${typeof full.brand.logo})`);
  ok(full.brand.logo === 'https://img.example/full-logo-dark.png', 'brand.logo prefers the stored dark logo for a record written before the change');
  // Site Prompt 7, Part 2: the instagram block, and its own whitelist.
  ok(Object.keys(full.instagram).sort().join(',') === 'enabled,handle,notes,posts,profileImage,url', `instagram whitelist is exactly enabled, handle, url, profileImage, posts, notes (got ${Object.keys(full.instagram).sort().join(',')})`);
  ok(full.instagram.enabled === true && full.instagram.handle === 'fullclient', `instagram is served with the @ stripped from the handle (got ${JSON.stringify(full.instagram.handle)})`);
  ok(full.instagram.posts.length === 9, `instagram posts are capped at nine (got ${full.instagram.posts.length})`);

  ok(!!res._json.landing, 'response has a landing object');
  ok(res._json.landing.logoStrip.some(c => c.slug === 'full-client'), 'logoStrip includes the client with featured.logoStrip true');
  ok(res._json.landing.work.some(c => c.slug === 'full-client'), 'work includes the client with featured.work true');
  ok(res._json.landing.testimonials.length === 2, 'landing.testimonials includes every published+featured testimonial across all clients');
  ok(res._json.landing.stats.averageRating === 4.5, `landing.stats.averageRating is the live average of published ratings (got ${res._json.landing.stats.averageRating})`);
}
{
  const res = await callShowcase({ slug: 'brand-only' });
  ok(res._status === 200 && res._json.slug === 'brand-only', 'GET /api/showcase?slug=brand-only -> 200, the right client');
  ok(res._json.website.enabled === false, 'a disabled section reports enabled:false so the public page can hide it');
}
{
  const res = await callShowcase({ slug: 'draft-co-does-not-exist' });
  ok(res._status === 404, 'GET /api/showcase?slug=<unknown> -> 404');
}
{
  // A slug matching the DRAFT client's showcase.slug ('') must never resolve
  // even if somehow queried; more importantly, published:false must never
  // leak via slug lookup even with a guessed slug.
  const res = await callShowcase({ slug: '' });
  ok(res._status === 200 && Array.isArray(res._json.clients), 'an empty slug query param falls back to the full list, not a single-client lookup');
}

// ── slug generation and uniqueness (api/_routes/call-leads.js PATCH) ──
const callLeadsUrl = pathToFileURL(path.join(apiDst, '_routes', 'call-leads.js')).href;
const { handler: callLeadsHandler } = await import(callLeadsUrl);
async function patchLead(id, set) {
  const req = { method: 'PATCH', body: { id, set } };
  const res = fakeRes();
  await callLeadsHandler(req, res);
  return res;
}
{
  // A brand new client, never published, no slug yet (seeded as newClient1 above).
  const res = await patchLead('507f1f77bcf86cd799439021', { showcase: { published: true, slug: '', displayName: 'New Client LLC' } });
  ok(res._status === 200, `first publish with no slug -> 200 (got ${res._status} ${JSON.stringify(res._json)})`);
  ok(res._json?.slug === 'new-client-llc', `slug auto-generated from displayName (got "${res._json?.slug}")`);
}
{
  // A second client (seeded as newClient2 above) whose generated slug would collide with the one just published.
  const res = await patchLead('507f1f77bcf86cd799439022', { showcase: { published: true, slug: '', displayName: 'New Client LLC' } });
  ok(res._status === 200 && res._json?.slug === 'new-client-llc-2', `auto-generated slug collision gets a numeric suffix (got "${res._json?.slug}")`);
}
{
  // Explicitly typing a slug that collides with another PUBLISHED client is rejected, not silently mangled.
  const res = await patchLead('507f1f77bcf86cd799439012', { showcase: { ...brandOnlyClient.showcase, slug: 'full-client' } });
  ok(res._status === 409, `manually typed slug colliding with another published client -> 409 (got ${res._status})`);
}
{
  // Re-saving a client's OWN existing slug unchanged must not 409 against itself.
  const res = await patchLead('507f1f77bcf86cd799439011', { showcase: { ...fullClient.showcase, blurb: 'Updated blurb, same slug.' } });
  ok(res._status === 200, `re-saving a client's own unchanged slug does not collide with itself (got ${res._status} ${JSON.stringify(res._json)})`);
}

fs.rmSync(tmpBase, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing` : '\nAll showcase endpoint tests pass.');
process.exit(fails ? 1 : 0);
