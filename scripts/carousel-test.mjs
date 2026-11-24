#!/usr/bin/env node
/* Carousel posts (carousel job, milestone 1): the data, against the real handlers on the shared in-memory Mongo
 * (scripts/fake-mongo.js): the slidesOf rule and its byte for byte mirror, slides written by the posts route (7 in order, the
 * cover mirrored into imageUrl, a reorder moving it, 21 refused, an unsafe url dropped, an empty array, alt trimmed, an ad or a
 * story never carrying slides, a post turning into a story dropping them), versions keeping the old slides, send-review with
 * 0 and with 1 or more slides, and the client's read of /api/planner (signed in through scripts/client-signin.mjs) carrying
 * slides through slidesOf.
 *
 *   node scripts/carousel-test.mjs
 *   API_SRC=/a/cut/copy/of/api node scripts/carousel-test.mjs   (scripts/carousel-guard-proof.mjs) */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { clientSignIn } from './client-signin.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'carousel-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(process.env.API_SRC || path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
fs.writeFileSync(path.join(apiDst, '_lib', 'notify.js'), `export const _sent = { rob: [], client: [] };
export async function sendPush(db, m) { _sent.rob.push(m); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }
export async function sendClientPush(db, leadId, m) { _sent.client.push({ leadId: String(leadId), ...m }); return { attempted: 1, delivered: 1, removed: 0, errors: [] }; }
export const ownerSubs = () => [];
export const clientSubs = () => [];
`);

let fails = 0; let passes = 0;
const failed = [];
const ok = (c, m, id = '') => { if (c) { passes++; console.log(`ok   ${m}`); } else { fails++; failed.push(id || m); console.log(`FAIL ${id ? `[${id}] ` : ''}${m}`); } };
process.env.SESSION_SECRET = 'test-secret-not-real';
delete process.env.VERCEL;

const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const posts = (await load('_routes/posts.js')).handler;
const planner = (await load('planner.js')).default;
const shared = await import(pathToFileURL(path.join(repoRoot, 'src/shared/slides.js')).href);
const server = await load('_lib/slides.js');

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { return this; } });
async function call(fn, method, { query = {}, body, cookie = '' } = {}) {
  const res = fakeRes();
  try { await fn({ method, query, body, headers: { 'x-forwarded-for': '203.0.113.30', ...(cookie ? { cookie } : {}) }, url: '/api/x', socket: {} }, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.stack || e) }; }
  return res;
}
const signIn = clientSignIn({ load, stores: _stores });

const LEAD = '507f1f77bcf86cd799439071';
const TOKEN = 'plnr_carousel_token_abcdefghij';
const MONTH = '2026-12';
const img = (n) => `https://res.cloudinary.com/demo/image/upload/handy-${n}.jpg`;
const seven = Array.from({ length: 7 }, (_, i) => ({ url: img(i + 1), alt: `Slide ${i + 1} alt` }));
function seed() {
  _reset();
  _stores.call_leads = [{ _id: LEAD, business: '5 Handy Bros', askFor: 'Sam Handy', stage: 'client', planner: { enabled: true, token: TOKEN, postsPerMonth: 8 }, portal: { token: 'prtl_carousel_token_abcdefghij' } }];
  _stores.posts = [];
  _stores.settings = [];
  _stores.suggestions = [];
  _stores.push_subscriptions = [];
}
const P = (id) => _stores.posts.find(p => String(p._id) === String(id));
const create = async (set) => { const r = await call(posts, 'POST', { body: { leadId: LEAD, month: MONTH, date: `${MONTH}-07`, caption: 'Before and after', ...set } }); return r._json?.item ? { res: r, id: String(r._json.item._id) } : { res: r, id: '' }; };
const patch = (id, set) => call(posts, 'PATCH', { body: { id, set } });

console.log('\n1. slidesOf and its mirror');
{
  ok(fs.readFileSync(path.join(repoRoot, 'src/shared/slides.js'), 'utf8') === fs.readFileSync(path.join(apiDst, '_lib/slides.js'), 'utf8'), 'api/_lib/slides.js is src/shared/slides.js byte for byte', 'mirror');
  for (const [name, m] of [['src', shared], ['api', server]]) {
    ok(JSON.stringify(m.slidesOf({ imageUrl: img(1) })) === JSON.stringify([{ url: img(1), alt: '' }]), `${name}: a legacy post is its one picture as one slide`);
    ok(JSON.stringify(m.slidesOf({ imageUrl: img(1), slides: seven })) === JSON.stringify(seven), `${name}: stored slides win, in order`);
    ok(m.slidesOf({}).length === 0 && m.slidesOf(null).length === 0 && m.slidesOf({ slides: [] }).length === 0, `${name}: no picture is no slides`);
    ok(m.SLIDES_MAX === 20 && m.carouselAllowed({}) && m.carouselAllowed({ kind: 'post', format: 'portrait' }) && !m.carouselAllowed({ kind: 'ad' }) && !m.carouselAllowed({ format: 'story' }) && !m.carouselAllowed({ format: 'video' }), `${name}: twenty at most, and only a portrait post carries a carousel`);
  }
}

console.log('\n2. writing slides');
{
  seed();
  const legacy = await create({ imageUrl: img(9) });
  ok(legacy.res._status === 200 && P(legacy.id).imageUrl === img(9) && P(legacy.id).slides === undefined, 'a post with one picture is written exactly as before, no slides field');
  const c = await create({ slides: seven });
  const s = P(c.id);
  ok(c.res._status === 200 && s.slides.length === 7 && s.slides.map(x => x.url).join(' ') === seven.map(x => x.url).join(' ') && s.slides[2].alt === 'Slide 3 alt', 'seven slides are stored in the order sent, with their alt', 'seven-order');
  ok(s.imageUrl === img(1), 'the cover (slide 1) is imageUrl', 'cover-mirror');
  const re = [seven[2], seven[0], seven[1], ...seven.slice(3)];
  const r1 = await patch(c.id, { slides: re });
  ok(r1._status === 200 && P(c.id).slides[0].url === img(3) && P(c.id).imageUrl === img(3), 'a reorder moving slide 3 to the front moves imageUrl with it', 'reorder-mirror');
  const r2 = await patch(c.id, { slides: re, imageUrl: img(7) });
  ok(r2._status === 200 && P(c.id).imageUrl === img(3), 'an imageUrl sent beside slides never wins over the first slide', 'reorder-mirror');
  const before = JSON.stringify(P(c.id));
  const many = Array.from({ length: 21 }, (_, i) => ({ url: img(i + 1), alt: '' }));
  const r3 = await patch(c.id, { slides: many });
  ok(r3._status === 400 && /20/.test(r3._json?.error || '') && JSON.stringify(P(c.id)) === before, `21 slides are a 400 with a plain message and nothing is written (${r3._status} ${r3._json?.error})`, 'max-21');
  const r4 = await create({ slides: many });
  ok(r4.res._status === 400 && _stores.posts.length === 2, 'a new post with 21 slides is refused too, nothing inserted', 'max-21');
  const twenty = many.slice(0, 20);
  ok((await patch(c.id, { slides: twenty }))._status === 200 && P(c.id).slides.length === 20, 'twenty is allowed');
  const dirty = [{ url: 'javascript:alert(1)', alt: 'x' }, { url: img(2), alt: 'a'.repeat(300) }, { url: '', alt: 'empty' }, null, { url: 'data:image/png;base64,AAAA' }, img(4), { url: '  ' }];
  await patch(c.id, { slides: dirty });
  const d = P(c.id).slides;
  ok(d.length === 2 && d[0].url === img(2) && d[1].url === img(4) && !JSON.stringify(d).includes('javascript:') && !JSON.stringify(d).includes('data:'), `a javascript: or data: url is dropped with its slide, empty entries dropped, a bare string is a url (${JSON.stringify(d.map(x => x.url))})`, 'unsafe-url');
  ok(d[0].alt.length === 200 && d[1].alt === '' && P(c.id).imageUrl === img(2), 'alt is trimmed to 200 characters, and the cover follows the cleaned list');
  const r5 = await patch(c.id, { slides: [] });
  ok(r5._status === 200 && Array.isArray(P(c.id).slides) && P(c.id).slides.length === 0 && P(c.id).imageUrl === img(2), 'an empty array clears the carousel and leaves imageUrl as it was', 'empty');
  await patch(c.id, { slides: [], imageUrl: '' });
  ok(shared.slidesOf(P(c.id)).length === 0, 'with the picture cleared too, the post has no picture');
}

console.log('\n3. only a portrait post carries a carousel');
{
  seed();
  const ad = await create({ kind: 'ad', slides: seven, imageUrl: img(8) });
  ok(ad.res._status === 200 && P(ad.id).slides === undefined && P(ad.id).imageUrl === img(8), 'slides on a new ad are not written', 'eligible');
  const story = await create({ format: 'story', slides: seven, imageUrl: img(8) });
  ok(story.res._status === 200 && P(story.id).slides === undefined && P(story.id).imageUrl === img(8), 'slides on a new story are not written', 'eligible');
  await patch(ad.id, { slides: seven });
  await patch(story.id, { slides: seven });
  ok(P(ad.id).slides === undefined && P(story.id).slides === undefined && P(ad.id).imageUrl === img(8), 'slides sent to an existing ad or story are not written', 'eligible');
  const both = await create({ slides: seven });
  await patch(both.id, { kind: 'ad', slides: seven });
  ok(P(both.id).kind === 'ad' && Array.isArray(P(both.id).slides) && P(both.id).slides.length === 0 && P(both.id).imageUrl === img(1), 'a carousel turned into an ad drops its slides and keeps the cover as imageUrl', 'eligible');
  const st = await create({ slides: seven });
  await patch(st.id, { format: 'story' });
  ok(P(st.id).format === 'story' && P(st.id).slides.length === 0 && P(st.id).imageUrl === img(1), 'a carousel turned into a story drops its slides and keeps the cover');
  const cov = await create({ slides: seven });
  await patch(cov.id, { imageUrl: img(12) });
  ok(P(cov.id).slides.length === 7 && P(cov.id).slides[0].url === img(12) && P(cov.id).slides[0].alt === 'Slide 1 alt' && P(cov.id).slides[1].url === img(2) && P(cov.id).imageUrl === img(12), 'a new cover through imageUrl alone replaces slide 1 and keeps the rest');
}

console.log('\n4. versions keep the old slides');
{
  seed();
  const c = await create({ slides: seven, status: 'review' });
  Object.assign(P(c.id), { status: 'making', clientNote: 'Slide 4: the photo is blurry', clientNoteAt: new Date(Date.now() - 60000).toISOString() });
  const swapped = [...seven.slice(0, 3), { url: img(44), alt: '' }, ...seven.slice(4)];
  await patch(c.id, { slides: swapped });
  const v = P(c.id).versions || [];
  ok(v.length === 1 && v[0].slides?.length === 7 && v[0].slides[3].url === img(4) && v[0].imageUrl === img(1) && v[0].note === 'Slide 4: the photo is blurry', 'a slide changed after a client note keeps the old seven slides, the cover and the note in versions', 'versions');
  await patch(c.id, { slides: swapped.slice().reverse() });
  ok((P(c.id).versions || []).length === 1, 'the next save for the same request does not stack a second copy');
  seed();
  const r = await create({ slides: seven });
  Object.assign(P(r.id), { clientNote: 'Order please', clientNoteAt: new Date(Date.now() - 60000).toISOString() });
  await patch(r.id, { slides: [seven[1], seven[0], ...seven.slice(2)] });
  ok((P(r.id).versions || []).length === 1 && P(r.id).versions[0].slides[0].url === img(1), 'a reorder alone counts as a picture change', 'versions');
  const huge = await create({ slides: Array.from({ length: 20 }, (_, i) => ({ url: img(i + 1), alt: '' })) });
  Object.assign(P(huge.id), { clientNote: 'More', clientNoteAt: new Date(Date.now() - 60000).toISOString() });
  await patch(huge.id, { caption: 'New words' });
  ok(P(huge.id).versions?.[0]?.slides?.length === 20, 'a version of a twenty slide carousel keeps all twenty');
  const legacy = await create({ imageUrl: img(5) });
  Object.assign(P(legacy.id), { clientNote: 'Other photo', clientNoteAt: new Date(Date.now() - 60000).toISOString() });
  await patch(legacy.id, { imageUrl: img(6) });
  ok(P(legacy.id).versions?.[0]?.imageUrl === img(5) && P(legacy.id).versions[0].slides === undefined, 'a single picture post keeps its version exactly as before');
}

console.log('\n5. send-review');
{
  seed();
  const none = await create({});
  const one = await create({ imageUrl: img(1) });
  const car = await create({ slides: seven });
  const vid = await create({ format: 'video', video: { url: 'https://res.cloudinary.com/demo/video/upload/a.mp4', durationSec: 10 } });
  const noWords = await create({ slides: seven, caption: '' });
  const r = await call(posts, 'POST', { body: { action: 'send-review', leadId: LEAD, ids: [none.id, one.id, car.id, vid.id, noWords.id] } });
  const moved = r._json?.ids || [];
  ok(!moved.includes(none.id) && P(none.id).status === 'making', 'a post with no slide and no video stays in making', 'send-review');
  ok(moved.includes(car.id) && P(car.id).status === 'review' && moved.includes(one.id) && moved.includes(vid.id), 'a carousel, a single picture and a video go for approval', 'send-review');
  ok(!moved.includes(noWords.id), 'a carousel with no caption stays in making (the caption rule is unchanged)');
}

console.log('\n6. the client reads slides');
{
  seed();
  const car = await create({ slides: seven, status: 'review' });
  const legacy = await create({ imageUrl: img(9), status: 'review' });
  const bare = await create({ status: 'making' });
  const cookie = await signIn(TOKEN);
  const read = await call(planner, 'GET', { query: { month: MONTH }, cookie });
  const by = (id) => (read._json?.posts || []).find(p => p.id === id);
  ok(read._status === 200 && by(car.id)?.slides?.length === 7 && by(car.id).slides.map(x => x.url).join(' ') === seven.map(x => x.url).join(' ') && by(car.id).slides[6].alt === 'Slide 7 alt', 'the planner read carries the seven slides in order, with alt', 'planner-read');
  ok(JSON.stringify(by(legacy.id)?.slides) === JSON.stringify([{ url: img(9), alt: '' }]) && (by(bare.id)?.slides || ['x']).length === 0, 'a legacy post reads as one slide, a post with no picture as none', 'planner-read');
  ok((read._json?.posts || []).every(p => p.slides.every(x => Object.keys(x).sort().join(',') === 'alt,url')), 'each slide is exactly { url, alt }');
  ok(by(car.id)?.imageUrl === img(1), 'imageUrl is still the cover for anything that reads it');
}

console.log('\n7. the editor\'s pure half (src/lib/carousel.js)');
{
  const L = await import(pathToFileURL(path.join(repoRoot, 'src/lib/carousel.js')).href);
  const u = seven.map(x => x.url);
  ok(L.moveSlide(seven, 1, 0).map(x => x.url).join(' ') === [u[1], u[0], ...u.slice(2)].join(' ') && L.moveSlide(seven, 0, -1).length === 7 && L.moveSlide(seven, 6, 7).map(x => x.url).join(' ') === u.join(' '), 'moveSlide moves one slide and refuses a move off either end');
  ok(L.removeSlide(seven, 2).map(x => x.url).join(' ') === [...u.slice(0, 2), ...u.slice(3)].join(' '), 'removeSlide takes out one slide, the rest in order');
  const a19 = L.addSlides(seven.concat(seven).concat(seven.slice(0, 5)), ['x1', 'x2', 'x3']);
  ok(a19.slides.length === 20 && a19.added === 1 && a19.skipped === 2 && a19.slides[19].url === 'x1', 'addSlides adds to the end until twenty and says how many did not fit');
  ok(L.ratioLabel(1080, 1080) === '1:1' && L.ratioLabel(1080, 1350) === '4:5' && L.ratioLabel(1920, 1080) === '16:9' && L.ratioLabel(1000, 700) === '1.43:1', 'ratioLabel names the common shapes and writes any other as n:1');
  ok(JSON.stringify(L.ratioWarning([{ w: 4, h: 5 }, { w: 8, h: 10 }, { w: 1, h: 1 }])) === '{"n":3,"label":"1:1"}' && L.ratioWarning([{ w: 4, h: 5 }, null, { w: 40, h: 50 }]) === null && L.ratioWarning([]) === null, 'ratioWarning names the first slide whose shape differs from slide 1, skipping unmeasured ones');
  ok(L.counterLine(1) === '1 slide' && L.counterLine(7) === '7 slides. Slide 1 is the cover.' && L.counterLine(20) === "20 of 20, Instagram's limit.", 'the counter says 1 slide, n slides with the cover, and the limit at twenty');
  ok(L.viewing(0, 300, 7) === 0 && L.viewing(610, 300, 7) === 2 && L.viewing(5000, 300, 7) === 6, 'viewing reads which slide a scroller rests on');
  const postCar = { kind: 'post', format: 'portrait', slides: seven, imageUrl: u[0] };
  ok(JSON.stringify(L.carouselNote(postCar, 3, { reason: 'photo', note: 'Brighter please' })) === '{"reason":"photo","note":"Slide 4: Brighter please"}', 'a change note on a carousel names the slide on view ("Slide 4: ..."), the reason kept, in the same body', 'change-prefix');
  ok(L.carouselNote({ kind: 'post', format: 'portrait', imageUrl: u[0] }, 3, { note: 'x' }).note === 'x' && L.carouselNote({ ...postCar, kind: 'ad' }, 1, { note: 'x' }).note === 'x' && L.carouselNote(postCar, 0, { note: 'x' }).note === 'Slide 1: x', 'one picture or an ad gets no prefix; slide 1 is named too', 'change-prefix');
  ok(L.carouselNote(postCar, 99, { note: 'y'.repeat(500) }).note.length === 500 && L.carouselNote(postCar, 99, { note: 'y' }).note === 'Slide 7: y', 'the slide is held to the carousel and the note to the server\'s 500', 'change-prefix');
  const V = await import(pathToFileURL(path.join(repoRoot, 'src/lib/plannerView.js')).href);
  ok(V.postItSteps({ kind: 'post', slides: seven })[0].available === true && V.postItSteps({ kind: 'post', slides: seven, allowDownload: false })[0].available === false, 'Post it can save a carousel that carries only slides, and allowDownload still rules', 'postit-slides');
  ok(V.hasPrevious({ previous: { slides: seven.slice(0, 2), caption: '' } }) === true && V.hasPrevious({ previous: { slides: [], caption: '' } }) === false, 'an earlier version with only slides counts as a previous draft', 'postit-slides');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.${failed.length ? ` Failed: ${[...new Set(failed)].join(', ')}` : ''}`);
process.exit(fails ? 1 : 0);
