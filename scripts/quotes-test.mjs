#!/usr/bin/env node
/* The Quotes page, the store and the pure half (docs/ARCHITECTURE.md, "Quotes").
 *   1  the mirror: api/_lib/quoteLines.js is src/shared/quoteLines.js byte for byte
 *   2  the route against the real handlers (api/admin/index.js on the in-memory Mongo): admin only, the atomic
 *      number, the line guard, custom lines and their caps, $set only, the status stamps, a lead attached,
 *      the lists, a duplicate, the soft delete, sent read off the email log, nothing that sends
 *   3  saved items in settings
 *   4  deal.quote through the real call-leads handler: every field the summary carries lands, nothing it kept is lost
 *   5  the pure half (src/lib/quote.js): totals with cents, the package check, the line edits, the picker, what a
 *      client reads (no cost, no supplier, nothing off list, no private note), the old path's redirect
 * Run: node scripts/quotes-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, '..');
const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'quotes-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
process.env.SESSION_SECRET = 'test-not-real';
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const src = async (rel) => import(pathToFileURL(path.join(repoRoot, 'src', rel)).href);
const { _stores, _reset } = await load('_lib/mongo.js');
const adminIndex = (await load('admin/index.js')).default;
const { signSession } = await load('_lib/auth.js');

let fails = 0; let count = 0;
const ok = (pass, desc) => { count++; if (!pass) fails++; console.log((pass ? 'ok   ' : 'FAIL ') + desc); };
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; return this; }, getHeader(k) { return this._headers[k]; }, end() { this.headersSent = true; return this; } });
const cookie = `vz_admin=${signSession()}`;
const call = async (r, method, body, query = {}, withCookie = true) => {
  const req = { method, query: { r, ...query }, body, headers: { ...(withCookie ? { cookie } : {}), 'x-forwarded-for': '198.51.100.9' }, url: `/api/admin/${r}`, socket: {} };
  const res = fakeRes();
  try { await adminIndex(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
  return res;
};
const Q = (method, body, query, withCookie) => call('quotes', method, body, query, withCookie);
const A = '507f1f77bcf86cd799439141'; const B = '507f1f77bcf86cd799439142';
const E1 = '507f1f77bcf86cd799439151'; const E2 = '507f1f77bcf86cd799439152';
function seed() {
  _reset();
  _stores.call_leads = [{ _id: A, business: 'Dana Detailing', askFor: 'Dana Reyes', stage: 'lead' }, { _id: B, business: 'Kims Cafe', askFor: 'Kim', stage: 'client' }];
  _stores.quotes = []; _stores.settings = []; _stores.email_log = [];
}
const stored = (id) => _stores.quotes.find(d => String(d._id) === String(id)) || {};
const logo = { kind: 'item', id: 'logo', label: 'x', qty: 1, unit: 250, listUnit: 250, free: false };
const yard = { kind: 'custom', id: 'c1', label: 'Yard signs', qty: 10, unit: 12.5, free: false, cost: 4.25, supplierUrl: 'https://signs.example/order', note: 'Two sided' };

/* ── 1. The mirror ─────────────────────────────────────────────────────────────────────────────────────────── */
ok(fs.readFileSync(path.join(repoRoot, 'src/shared/quoteLines.js'), 'utf8') === fs.readFileSync(path.join(repoRoot, 'api/_lib/quoteLines.js'), 'utf8'), 'api/_lib/quoteLines.js mirrors src/shared/quoteLines.js byte for byte');

/* ── 2. The route ──────────────────────────────────────────────────────────────────────────────────────────── */
seed();
const anon = [(await Q('GET', undefined, {}, false))._status, (await Q('POST', {}, {}, false))._status, (await Q('PATCH', { id: A, set: { note: 'x' } }, {}, false))._status, (await Q('DELETE', undefined, { id: A }, false))._status];
ok(anon.every(s => s === 401) && _stores.quotes.length === 0, `every method without the admin cookie is 401 and nothing is written (${anon.join(',')})`);

let r = await Q('POST', {});
const q1 = r._json?.item || {};
ok(r._status === 200 && q1.number === 'Q-0001' && q1.status === 'draft' && q1.by?.who === 'rob' && q1.by.at && q1.validDays === 30 && q1.retainerPitch === true && Array.isArray(q1.lines) && q1.lines.length === 0 && q1.deleted === false && q1.sentAt === '' && q1.decidedAt === '', 'a new quote: Q-0001, a draft by rob, good for 30 days, the retainer pitch on, no lines');
r = await Q('POST', { leadId: A, evil: 1, number: 'Q-9999', status: 'accepted', by: { who: 'billy' }, business: 'Typed', sentAt: 'x' });
const q2 = r._json?.item || {};
ok(q2.number === 'Q-0002' && q2.business === 'Dana Detailing' && q2.person === 'Dana Reyes' && q2.leadId === A && q2.status === 'draft' && q2.by.who === 'rob' && !('evil' in stored(q2._id)) && stored(q2._id).sentAt === '', 'a quote for a lead takes the next number and the lead\'s own names; a typed number, status, author, name or unknown key is not written');
const three = await Promise.all([Q('POST', {}), Q('POST', {}), Q('POST', {})]);
ok(new Set(three.map(x => x._json?.item?.number)).size === 3 && three.every(x => /^Q-000[345]$/.test(x._json.item.number)), `three at once each get their own number (${three.map(x => x._json?.item?.number).join(' ')})`);
r = await Q('POST', { leadId: '507f1f77bcf86cd7994391ff' });
ok(r._status === 400 && _stores.quotes.length === 5, 'a quote for a lead that does not exist is 400');

/* The line guard. */
const before = _stores.quotes.length;
const bad = [
  ['a list price that is not the price list\'s', [{ ...logo, listUnit: 200 }]],
  ['an id the price list does not have', [{ kind: 'item', id: 'nope', label: 'x', qty: 1, unit: 5, listUnit: 5, free: false }]],
  ['a catalog id sent as a package', [{ ...logo, kind: 'package' }]],
  ['a print size that does not exist', [{ kind: 'print', id: 'vinyl:giant', label: 'x', qty: 1, unit: 15, listUnit: 15, free: false }]],
  ['a sized print product with no size', [{ kind: 'print', id: 'vinyl', label: 'x', qty: 1, unit: 15, listUnit: 15, free: false }]],
  ['a kind it does not know', [{ ...logo, kind: 'gift' }]],
  ['a custom line with no name', [{ ...yard, label: '   ' }]],
  ['the same line twice', [logo, { ...logo, unit: 100 }]],
  ['one bad line among good ones', [logo, yard, { ...logo, id: 'palette-type', listUnit: 1 }]],
];
const refusals = [];
for (const [, lines] of bad) refusals.push((await Q('POST', { lines }))._status, (await Q('PATCH', { id: q1._id, set: { lines } }))._status);
ok(refusals.every(s => s === 400) && _stores.quotes.length === before && stored(q1._id).lines.length === 0, `the guard refuses the whole save (${bad.map(b => b[0]).join('; ')}) and nothing is stored`);
r = await Q('PATCH', { id: q1._id, set: { lines: Array.from({ length: 41 }, (_, i) => ({ ...yard, id: `c${i}` })) } });
ok(r._status === 400 && stored(q1._id).lines.length === 0, 'more than 40 lines is refused');
r = await Q('PATCH', { id: q1._id, set: { lines: [
  { ...logo, unit: 199.999, qty: 3, evil: 1, cost: 5, supplierUrl: 'https://x.example', note: 'n' },
  { kind: 'item', id: 'card-design', label: 'Cards', qty: 1, unit: 30, listUnit: 30, free: true },
  { kind: 'package', id: 'brand-starter', label: 'x', qty: 9, unit: 300, listUnit: 350, free: false },
  { kind: 'print', id: 'vinyl:small', label: 'x', qty: 20000, unit: 15, listUnit: 15, free: false },
  { kind: 'print', id: 'cards-250', label: 'x', qty: 2, unit: 35, listUnit: 35, free: false },
] } });
const L = stored(q1._id).lines || [];
ok(r._status === 200 && L.length === 5 && L[0].label === 'Logo (primary and mark)' && L[0].unit === 200 && L[0].listUnit === 250 && L[0].qty === 3 && Object.keys(L[0]).sort().join() === 'free,id,kind,label,listUnit,qty,unit', 'a price list line keeps Rob\'s price to the cent, its quantity, pricing.js\'s label and list price, and no other key');
ok(L[1].free === true && L[1].unit === 0 && L[1].listUnit === 30, 'a free line is stored at 0 and keeps its list price');
ok(L[2].qty === 1 && L[2].unit === 300 && L[2].listUnit === 350, 'a package is one, at Rob\'s price');
ok(L[3].id === 'vinyl:small' && L[3].listUnit === 15 && L[3].qty === 10000 && /small/i.test(L[3].label) && L[4].id === 'cards-250' && L[4].listUnit === 35, 'printed cards and a vinyl size are lines of their own (the size in the id), a quantity is capped at 10,000');

/* Custom lines. */
r = await Q('PATCH', { id: q1._id, set: { lines: [
  { ...yard, evil: 1, listUnit: 99 },
  { kind: 'custom', id: 'c2', label: 'L'.repeat(200), qty: 0, unit: 999999, free: true, cost: -5, supplierUrl: 'javascript:alert(1)', note: 'n'.repeat(400) },
  { kind: 'custom', id: 'c3', label: 'Shirts', qty: 2.6, unit: 9.999, free: false, supplierUrl: 'http://shirts.example/a b' },
  { kind: 'custom', label: 'Banner', qty: 1, unit: 80, free: false },
] } });
const C = stored(q1._id).lines || [];
ok(r._status === 200 && C.length === 4 && C[0].label === 'Yard signs' && C[0].qty === 10 && C[0].unit === 12.5 && C[0].cost === 4.25 && C[0].supplierUrl === 'https://signs.example/order' && C[0].note === 'Two sided' && !('evil' in C[0]) && !('listUnit' in C[0]), 'a custom line keeps its name, quantity, price with cents, cost, supplier link and note, and nothing else');
ok(C[1].label.length === 120 && C[1].qty === 1 && C[1].unit === 100000 && C[1].free === true && C[1].cost === 0 && !('supplierUrl' in C[1]) && C[1].note.length === 200, 'a custom line is held to its caps (name 120, quantity 1 to 10,000, price 0 to 100,000, note 200) and a javascript: supplier link is dropped; a free custom line keeps its price');
ok(C[2].qty === 3 && C[2].unit === 10 && !('supplierUrl' in C[2]) && !('cost' in C[2]) && typeof C[3].id === 'string' && C[3].id.length > 0, 'a quantity is whole, a price is to the cent, a link with a space is dropped, a custom line with no id gets one');

/* $set only, the caps on the notes, the status stamps. */
r = await Q('PATCH', { id: q1._id, set: { note: ` ${'n'.repeat(600)} `, privateNote: 'p'.repeat(600), validDays: 9999, retainerPitch: false, evil: 1, number: 'Q-7777', by: { who: 'x' }, createdAt: 'x', deleted: true } });
const s1 = stored(q1._id);
ok(r._status === 200 && s1.note.length === 500 && s1.privateNote.length === 500 && s1.validDays === 365 && s1.retainerPitch === false && s1.lines.length === 4 && s1.number === 'Q-0001' && s1.by.who === 'rob' && s1.deleted === false && !('evil' in s1), 'a PATCH sets only the keys sent: the notes cut at 500, the days capped, the lines untouched, and the number, the author and deleted not writable');
ok((await Q('PATCH', { id: q1._id, set: { evil: 1 } }))._status === 400 && (await Q('PATCH', { id: q1._id, set: { status: 'paid' } }))._status === 400 && (await Q('PATCH', { id: '507f1f77bcf86cd7994391ee', set: { note: 'x' } }))._status === 404 && (await Q('PATCH', { id: 'nope', set: { note: 'x' } }))._status === 400, 'nothing the whitelist knows is 400, an unknown status is 400, an unknown quote is 404');
r = await Q('PATCH', { id: q1._id, set: { status: 'sent' } });
const sentAt = stored(q1._id).sentAt;
ok(r._status === 200 && stored(q1._id).status === 'sent' && !Number.isNaN(Date.parse(sentAt)) && stored(q1._id).decidedAt === '', 'Mark sent stamps sentAt');
r = await Q('PATCH', { id: q1._id, set: { status: 'accepted' } });
ok(stored(q1._id).status === 'accepted' && !Number.isNaN(Date.parse(stored(q1._id).decidedAt)) && stored(q1._id).sentAt === sentAt, 'Mark accepted stamps decidedAt and keeps sentAt');
r = await Q('PATCH', { id: q1._id, set: { status: 'declined' } });
ok(stored(q1._id).status === 'declined' && stored(q1._id).decidedAt, 'Mark declined stamps decidedAt');
r = await Q('PATCH', { id: q1._id, set: { status: 'draft' } });
ok(stored(q1._id).status === 'draft' && stored(q1._id).decidedAt === '' && stored(q1._id).sentAt === '', 'back to a draft clears both times');
r = await Q('PATCH', { id: q1._id, set: { leadId: B } });
ok(r._status === 200 && stored(q1._id).leadId === B && stored(q1._id).business === 'Kims Cafe' && stored(q1._id).person === 'Kim', 'attaching a lead copies its names');
ok((await Q('PATCH', { id: q1._id, set: { leadId: '507f1f77bcf86cd7994391ff' } }))._status === 400 && stored(q1._id).leadId === B, 'attaching a lead that does not exist is 400');

/* Reads, a duplicate, the delete. */
r = await Q('GET');
ok(r._status === 200 && r._json.items.length === 5 && r._json.items.every(i => i.number), 'the list holds every quote');
r = await Q('GET', undefined, { leadId: A });
ok(r._json.items.length === 1 && r._json.items[0]._id === q2._id || String(r._json.items[0]?._id) === String(q2._id), 'the list for a lead holds that lead\'s quotes only');
ok((await Q('GET', undefined, { leadId: { $ne: '' } }))._json.items.length === 0, 'an operator in the lead filter matches nothing');
r = await Q('GET', undefined, { id: String(q1._id) });
ok(r._status === 200 && r._json.item.number === 'Q-0001' && (await Q('GET', undefined, { id: '507f1f77bcf86cd7994391ee' }))._status === 404 && (await Q('GET', undefined, { id: 'x' }))._status === 404, 'one quote reads by id; an unknown id is 404');
await Q('PATCH', { id: q1._id, set: { status: 'accepted' } });
r = await Q('POST', { from: String(q1._id) });
const d1 = r._json?.item || {};
ok(r._status === 200 && d1.number === 'Q-0006' && d1.status === 'draft' && d1.sentAt === '' && d1.decidedAt === '' && d1.lines.length === 4 && d1.leadId === B && d1.business === 'Kims Cafe' && d1.note.length === 500 && String(d1._id) !== String(q1._id), 'Duplicate is a new draft with the next number, the same lead, lines and notes');
ok((await Q('POST', { from: '507f1f77bcf86cd7994391ee' }))._status === 404, 'a duplicate of nothing is 404');
r = await Q('DELETE', undefined, { id: String(d1._id) });
ok(r._status === 200 && stored(d1._id).deleted === true && _stores.quotes.length === 6 && (await Q('GET'))._json.items.length === 5 && (await Q('GET', undefined, { id: String(d1._id) }))._status === 404 && (await Q('PATCH', { id: d1._id, set: { note: 'x' } }))._status === 404, 'a delete is soft: the document stays, the list, the read and a PATCH no longer find it');

/* Sent is read off the email log. */
_stores.email_log = [{ _id: E1, status: 'sent', sentAt: '2026-11-10T15:00:00.000Z' }, { _id: E2, status: 'draft' }];
await Q('PATCH', { id: q2._id, set: { emailLogId: E1 } });
const q3 = three[0]._json.item;
await Q('PATCH', { id: q3._id, set: { emailLogId: E2 } });
r = await Q('GET');
const g2 = r._json.items.find(i => String(i._id) === String(q2._id)); const g3 = r._json.items.find(i => String(i._id) === String(q3._id));
ok(g2.status === 'sent' && g2.sentAt === '2026-11-10T15:00:00.000Z' && stored(q2._id).status === 'sent' && g3.status === 'draft' && stored(q3._id).sentAt === '', 'a draft whose email went out through the send sheet reads sent with the email\'s own time; one whose email is still a draft stays a draft');
_stores.email_log[1].status = 'test';
ok((await Q('GET', undefined, { id: String(q3._id) }))._json.item.status === 'draft', 'a test send (no key, nothing left) does not make a quote sent');
ok((await Q('PATCH', { id: q3._id, set: { emailLogId: 'javascript:1' } }))._status === 200 && stored(q3._id).emailLogId === '', 'the email reference is a 24 character id or nothing');
const routeText = fs.readFileSync(path.join(repoRoot, 'api/_routes/quotes.js'), 'utf8');
ok(!/import[^\n]*(email\/|notify|transport|send)/.test(routeText) && !/sendComposed|sendDraft|sendPush|fetch\(/.test(routeText), 'the quotes route imports nothing that sends and calls no network');

/* ── 3. Saved items ────────────────────────────────────────────────────────────────────────────────────────── */
const S = (method, body) => call('settings', method, body);
r = await S('PATCH', { set: { quoteItems: [
  { id: 's1', label: 'Yard signs, 18 x 24', unit: 12.5, cost: 4.25, supplierUrl: 'https://signs.example/order', evil: 1 },
  { id: 's1', label: 'Twice', unit: 1 },
  { id: 's2', label: '', unit: 5 },
  { id: 's3', label: 'Shirts', unit: 999999, supplierUrl: 'javascript:alert(1)' },
  ...Array.from({ length: 120 }, (_, i) => ({ id: `n${i}`, label: `Item ${i}`, unit: i })),
] } });
const items = _stores.settings.find(d => d._id === 'quotes')?.quoteItems || [];
ok(r._status === 200 && items.length === 100 && items[0].label === 'Yard signs, 18 x 24' && items[0].unit === 12.5 && items[0].cost === 4.25 && items[0].supplierUrl === 'https://signs.example/order' && !('evil' in items[0]) && items[1].id === 's3' && items[1].unit === 100000 && !('supplierUrl' in items[1]), 'saved items: at most 100, each a name, a price, a cost and a safe supplier link; a second copy, a nameless one and a javascript: link are dropped');
r = await S('GET');
ok(r._status === 200 && r._json.quoteItems.length === 100 && r._json.quoteItems[0].id === 's1', 'the settings read answers the saved items');
r = await Q('POST', {});
ok(r._json.item.number === 'Q-0007' && (_stores.settings.find(d => d._id === 'quotes')?.quoteItems || []).length === 100, 'the counter and the saved items share a document and neither write touches the other');

/* ── 4. deal.quote ─────────────────────────────────────────────────────────────────────────────────────────── */
const ql = await src('shared/quoteLines.js');
const full = { _id: q1._id, number: 'Q-0001', status: 'sent', retainerPitch: false, lines: [{ kind: 'item', id: 'logo', label: 'Logo (primary and mark)', qty: 1, unit: 199.5, listUnit: 250, free: false }, { kind: 'print', id: 'cards-250', label: 'Business cards, 250', qty: 2, unit: 0, listUnit: 35, free: true }, yard] };
const mirror = ql.dealQuoteOf(full, Date.UTC(2026, 10, 16, 12));
ok(mirror.total === 324.5 && mirror.givenFree === 120.5 && mirror.deposit === 163 && mirror.lines[2].listPrice === 12.5 && mirror.lines[2].price === 12.5 && mirror.lines[2].qty === 10 && mirror.lines[1].price === 0 && mirror.lines[1].listPrice === 35 && mirror.packageId === '' && mirror.quoteId === String(q1._id) && mirror.number === 'Q-0001', `the summary a quote leaves on the deal: per line the price and list price for one with the quantity beside them, a custom line's list price its own (${mirror.total}, free ${mirror.givenFree}, deposit ${mirror.deposit})`);
r = await call('call-leads', 'PATCH', { id: A, set: { deal: { quote: { ...mirror, evil: 1, lines: [...mirror.lines.map(l => ({ ...l, evil: 1 })), { id: 'c9', label: 'Bad link', price: 1, listPrice: 1, free: false, kind: 'custom', qty: 1, supplierUrl: 'javascript:alert(1)' }] } } } });
const dq = _stores.call_leads.find(l => l._id === A)?.deal?.quote || {};
ok(r._status === 200 && dq.lines?.length === 4 && dq.total === 324.5 && dq.givenFree === 120.5 && dq.deposit === 163 && dq.retainerPitch === false && dq.packageId === '' && dq.at === mirror.at && dq.quoteId === String(q1._id) && dq.number === 'Q-0001' && dq.status === 'sent' && !('evil' in dq), 'deal.quote lands through the lead PATCH with its totals to the cent, the quote it came from, its number and status');
ok(dq.lines[0].price === 199.5 && dq.lines[0].listPrice === 250 && dq.lines[0].kind === 'item' && dq.lines[0].qty === 1 && dq.lines[1].free === true && dq.lines[1].qty === 2 && dq.lines[2].kind === 'custom' && dq.lines[2].qty === 10 && dq.lines[2].cost === 4.25 && dq.lines[2].supplierUrl === 'https://signs.example/order' && dq.lines[2].note === 'Two sided' && !('evil' in dq.lines[0]) && !('supplierUrl' in dq.lines[3]) && !('cost' in dq.lines[0]), 'each line keeps its kind and quantity, a custom line its cost, safe supplier link and note; a javascript: link and an unknown key are dropped');
r = await call('call-leads', 'PATCH', { id: A, set: { deal: { quote: { lines: [{ id: 'logo', label: 'Logo', price: 250, listPrice: 250, free: false }, { id: 'card-design', label: 'Cards', price: 0, listPrice: 30, free: true }], packageId: 'brand-starter', retainerPitch: true, givenFree: 30, total: 250, deposit: 125, at: '2026-11-01T00:00:00.000Z' } } } });
const old = _stores.call_leads.find(l => l._id === A)?.deal?.quote || {};
ok(r._status === 200 && JSON.stringify(old.lines) === JSON.stringify([{ id: 'logo', label: 'Logo', price: 250, listPrice: 250, free: false }, { id: 'card-design', label: 'Cards', price: 0, listPrice: 30, free: true }]) && old.packageId === 'brand-starter' && old.givenFree === 30 && old.total === 250 && old.deposit === 125 && old.at === '2026-11-01T00:00:00.000Z' && !('quoteId' in old) && !('status' in old), 'a quote saved before this page lands exactly as it did: every field it had, nothing added');

/* ── 5. The pure half ──────────────────────────────────────────────────────────────────────────────────────── */
const q = await src('lib/quote.js');
const { quoteRedirect } = await src('shell/backTree.js');
const pathFor = (leadId, quotes, pkg = '') => quoteRedirect(`/leads/${leadId}/quote`, pkg ? `?pkg=${pkg}` : '', q.newestQuoteFor(quotes, leadId)?._id || '');
const sums = q.quoteSums(full.lines);
ok(sums.total === 324.5 && sums.listTotal === 445 && sums.offList === 120.5 && sums.givenFree === 70 && sums.deposit === 163 && sums.hasCents === true, `totals with cents: 199.50 + 0 + 10 x 12.50 = 324.50, list 445, off list 120.50, given free 70, deposit rounded up to 163 (${JSON.stringify(sums)})`);
const third = [{ kind: 'custom', id: 'a', label: 'A', qty: 3, unit: 0.1, free: false }, { kind: 'custom', id: 'b', label: 'B', qty: 3, unit: 33.335, free: false }];
ok(q.lineTotal(third[0]) === 0.3 && q.lineTotal(third[1]) === 100.02 && q.quoteSums(third).total === 100.32 && q.quoteSums(third).deposit === 51, 'a line total is the quantity times the price rounded to the cent, and the lines add up to the total');
ok(q.quoteSums([]).total === 0 && q.quoteSums([]).deposit === 0 && q.quoteSums([q.listLine('item', 'logo')]).deposit === 125 && q.quoteSums([q.listLine('item', 'logo')]).hasCents === false && q.quoteSums([{ ...q.listLine('item', 'logo'), unit: 300 }]).offList === 0, 'no lines is 0; a whole dollar quote has no cents; a price over list is never a negative off list');
const big = q.quoteSummary({ lines: [q.listLine('item', 'five-pages'), q.listLine('item', 'one-page-site')] });
ok(big.total === 950 && big.plan?.months === 6 && big.plan.monthly === 159 && q.quoteSummary({ lines: [q.listLine('item', 'logo')] }).plan === null && q.quoteSummary({ lines: [q.listLine('package', 'launch-plan')] }).plan?.monthly === 200, 'over $750 shows the monthly plan from planFor; a plan package carries its own');
const starter = ['logo', 'palette-type', 'brand-sheet'].map(id => q.listLine('item', id));
const chk = q.packageCheck(starter);
ok(chk && chk.id === 'brand-starter' && chk.saves === 25 && chk.text === 'Brand Starter covers these for $350, $25 less.', `the honest package check (${chk?.text})`);
ok(q.packageCheck([...starter, yard])?.saves === 25 && q.packageCheck([...starter, q.listLine('package', 'social-refresh')]) === null && q.packageCheck(q.patchLine(starter, 'item:logo', { unit: 200 })) === null && q.packageCheck([starter[0]]) === null, 'a custom line does not change it; it is skipped when a package is in the quote, when the lines already cost less, and when no package covers them');
const swapped = q.swapForPackage([...starter, yard], 'brand-starter');
ok(swapped.length === 2 && swapped[0].kind === 'package' && swapped[0].unit === 350 && swapped[1].id === 'c1' && q.validLines(swapped), 'the check\'s action swaps the covered lines for the package and keeps the rest');

/* Line edits. */
const cat = q.quoteCatalog([{ id: 's1', label: 'Yard signs', unit: 12.5, cost: 4, supplierUrl: 'https://signs.example' }]);
ok(cat.map(g => g.label).join(',') === 'Brand,Web,Print,Packages,Saved items' && cat.every(g => g.rows.length > 0) && cat[2].rows.some(x => x.key === 'print:cards-250') && cat[2].rows.some(x => x.key === 'print:vinyl:large' && x.price === 40) && cat[2].rows.filter(x => /Business card design/.test(x.label)).length === 1 && cat[2].rows.some(x => x.key === 'item:vinyl'), 'the picker: Brand, Web, Print, Packages, Saved items; printed cards and the vinyl sizes are in Print and a twin is listed once');
ok(cat.flatMap(g => g.rows).filter(x => x.kind !== 'saved').every(x => q.validLine(q.listLine(x.kind, x.id)) && q.listLine(x.kind, x.id).unit === x.price), 'every row of the picker makes a line the guard passes, at its list price');
const found = q.searchCatalog(cat, 'cards 250');
ok(found.length === 1 && found[0].id === 'print' && found[0].rows.length === 1 && q.searchCatalog(cat, 'zzz').length === 0 && q.searchCatalog(cat, '').length === 5 && q.searchCatalog(cat, 'yard')[0].id === 'saved', 'search narrows every group and drops the empty ones');
const row = (key) => cat.flatMap(g => g.rows).find(x => x.key === key);
let ls = q.addRow([], row('item:logo'));
ls = q.addRow(ls, row('print:cards-250')); ls = q.addRow(ls, row('print:cards-250'));
ls = q.addRow(ls, row('package:brand-starter')); ls = q.addRow(ls, row('package:brand-starter'));
ok(ls.length === 3 && ls[1].qty === 2 && ls[2].qty === 1 && q.validLines(ls), 'tapping a row adds a line at list; again adds one more; a package stays at one');
ls = q.addRow(ls, row('saved:s1'), 'cs1');
ok(ls.length === 4 && ls[3].kind === 'custom' && ls[3].unit === 12.5 && ls[3].cost === 4 && ls[3].supplierUrl === 'https://signs.example' && ls[3].qty === 1 && !('savedId' in ls[3]), 'a saved item becomes a custom line with its price copied, not linked');
ls = q.patchLine(ls, 'item:logo', { unit: 199.999 });
ok(ls[0].unit === 200 && q.lineOffList(ls[0]) === 50, 'a price edit is Rob\'s price to the cent, and the line reads what it is off list');
ls = q.patchLine(ls, 'item:logo', { free: true });
ok(ls[0].free === true && ls[0].unit === 0 && ls[0].listUnit === 250 && q.validLines(ls), 'Free charges 0 and keeps the list price');
ls = q.patchLine(ls, 'item:logo', { free: false });
ok(ls[0].free === false && ls[0].unit === 250, 'Free off goes back to the list price');
ls = q.patchLine(ls, 'print:cards-250', { qty: 0 }); ls = q.patchLine(ls, 'package:brand-starter', { qty: 5 });
ok(ls[1].qty === 1 && ls[2].qty === 1, 'a quantity is at least 1 and a package stays at 1');
ls = q.patchLine(ls, 'custom:cs1', { qty: 10, free: true, note: 'Two sided', cost: '' });
ok(ls[3].qty === 10 && ls[3].free === true && ls[3].unit === 12.5 && ls[3].note === 'Two sided' && !('cost' in ls[3]) && q.quoteSums(ls).givenFree === 125 && q.validLines(ls), 'a free custom line keeps its price so what was given can be counted; an emptied cost is gone');
ok(q.addCustom([], { label: '  ', unit: 5 }).length === 0 && q.addCustom([], { label: 'Banner', qty: 2, unit: '80', supplierUrl: 'javascript:alert(1)' }, 'x')[0].unit === 80 && !('supplierUrl' in q.addCustom([], { label: 'Banner', supplierUrl: 'javascript:alert(1)' }, 'x')[0]), 'a custom item needs a name; a link that is not http is not kept');
const sv = q.savedFromLine(yard, 'n1');
ok(sv.label === 'Yard signs' && sv.unit === 12.5 && sv.cost === 4.25 && sv.supplierUrl === 'https://signs.example/order' && !('qty' in sv) && q.savedFromLine({ ...q.listLine('item', 'logo'), unit: 200 }, 'n2').unit === 200, 'Save as an item keeps the name, the price for one, the cost and the supplier');
ok(q.dropLine(ls, 'custom:cs1').length === 3, 'remove drops the one line');

/* The custom guard. */
const vc = (l) => q.validLine({ kind: 'custom', id: 'c', label: 'Signs', qty: 1, unit: 1, free: false, ...l });
ok(vc({}) && vc({ unit: 0 }) && vc({ unit: 100000, qty: 10000, cost: 0.01, note: 'n'.repeat(200), supplierUrl: 'https://a.example' }) && vc({ free: true, unit: 12.5 }), 'a custom line inside its caps passes the guard');
ok(!vc({ label: '' }) && !vc({ label: 'L'.repeat(121) }) && !vc({ qty: 0 }) && !vc({ qty: 1.5 }) && !vc({ qty: 10001 }) && !vc({ unit: -1 }) && !vc({ unit: 100000.01 }) && !vc({ unit: 1.005 }) && !vc({ unit: '5' }) && !vc({ cost: -1 }) && !vc({ note: 'n'.repeat(201) }) && !vc({ supplierUrl: 'javascript:alert(1)' }), 'a custom line outside them does not: no name, a name over 120, a quantity under 1, over 10,000 or not whole, a price under 0, over 100,000, past the cent or not a number, a cost under 0, a note over 200, a link that is not http');

/* What a client reads. */
const client = { ...full, number: 'Q-0001', business: 'Dana Detailing', person: 'Dana Reyes', note: 'Signs ship in a week.', privateNote: 'PRIVATE-MARGIN-NOTE', validDays: 14, retainerPitch: true };
const lead = { _id: A, business: 'Dana Detailing', askFor: 'Dana Reyes' };
const txt = q.quoteText(client, lead, { nextOpenStart: '2026-12-01' });
const em = q.quoteEmail(lead, client, { nextOpenStart: '2026-12-01' });
const inv = q.quoteInvoice(client, Date.UTC(2026, 10, 16));
const reads = { text: txt, email: JSON.stringify(em), invoice: JSON.stringify(inv) };
const leaks = (s) => /4\.25|signs\.example|PRIVATE-MARGIN-NOTE|Two sided|off list|120\.5|445|\bcost\b|supplier/i.test(s);
ok(!leaks(reads.text) && !leaks(reads.email) && !leaks(reads.invoice), 'the text, the email and the invoice carry no cost, no supplier, nothing off list and no private note');
ok(txt.includes('Logo (primary and mark): $199.50') && txt.includes('Business cards, 250 x 2: on me') && txt.includes('Yard signs x 10: $125.00') && txt.includes('Total $324.50.') && txt.includes('(Q-0001)') && txt.includes('good for 14 days') && txt.includes('2 revision rounds') && txt.includes('Signs ship in a week.') && txt.includes('deposit ($163)') && txt.startsWith('Hi Dana,'), 'Copy as text reads the names, the quantities, the prices with cents, on me for a free line, the total, the deposit, the terms and the client note');
ok(em.subject === 'Your quote from Visualize, Dana' && em.blocks.every(b => ['eyebrow', 'heading', 'text'].includes(b.type)) && em.blocks[3].text.split('\n').length === 3 && em.blocks.some(b => /keep me on/.test(b.text)) && !q.quoteEmail(lead, { ...client, retainerPitch: false }).blocks.some(b => /keep me on/.test(b.text)) && em.blocks.some(b => b.text === 'Signs ship in a week.'), 'the email is the custom template\'s blocks: one line per quote line, the client note, the retainer line unless it is switched off');
const voice = `${txt}\n${em.subject}\n${em.preheader}\n${em.blocks.map(b => b.text).join('\n')}`;
ok(!/\u2014/.test(voice) && !/\b(we|we'll|we're|our|us)\b/i.test(voice) && /\bI\b/.test(voice), 'it is Rob talking: I, never we, and no em dash');
ok(inv.amount === 163 && inv.kind === 'deposit' && inv.items.length === 3 && inv.items[1].amount === 'Included' && inv.items[2].label === 'Yard signs x 10' && inv.items[2].amount === 125 && inv.items[0].amount === 199.5 && /50% of \$324\.50/.test(inv.note), 'the deposit invoice: the deposit, a row per line with its quantity and total, Included for a free line');
ok(q.fmtMoney(350, false) === '$350' && q.fmtMoney(350, true) === '$350.00' && q.fmtMoney(12.5, true) === '$12.50', 'money shows cents only when a line has them');

/* The list and the old path. */
const many = [{ _id: 'a', number: 'Q-0001', business: 'Dana Detailing', person: 'Dana', status: 'draft', leadId: 'L8', createdAt: '2026-11-01', updatedAt: '2026-11-02' }, { _id: 'b', number: 'Q-0002', business: 'Kims Cafe', person: 'Kim', status: 'sent', leadId: 'L9', createdAt: '2026-11-03', updatedAt: '2026-11-03' }, { _id: 'c', number: 'Q-0003', business: 'Dana Detailing', person: 'Dana', status: 'accepted', leadId: 'L8', createdAt: '2026-11-05', updatedAt: '2026-11-05' }, { _id: 'd', number: 'Q-0004', business: 'Gone', status: 'draft', deleted: true, leadId: 'L8', createdAt: '2026-11-09' }];
const rows = q.quoteRows(many, { query: 'dana', status: 'all' });
ok(rows.total === 3 && rows.rows.map(x => x._id).join() === 'c,a' && rows.counts.all === 2 && rows.counts.draft === 1 && rows.counts.accepted === 1 && rows.counts.sent === 0 && q.quoteRows(many, { query: 'q-0002' }).rows[0]._id === 'b' && q.quoteRows(many, { status: 'sent' }).rows.length === 1 && q.quoteRows(many, { query: 'kim' }).rows.length === 1, 'the list: search by business, person or number, chips counted over the search, newest first, a deleted quote nowhere');
ok(pathFor('L8', many) === '/quotes/c?lead=L8' && pathFor('L9', many, 'brand-starter') === '/quotes/b?lead=L9' && pathFor('L7', many) === '/quotes/new?lead=L7' && pathFor('L7', many, 'brand-starter') === '/quotes/new?lead=L7&pkg=brand-starter' && q.newestQuoteFor(many, 'L8')._id === 'c', 'the old builder\'s path opens the lead\'s newest quote, or a new one for that lead with the package from the link');
const oldDeal = { lines: [{ id: 'brand-starter', label: 'Brand Starter', price: 300, listPrice: 350, free: false }, { id: 'card-design', label: 'Cards', price: 0, listPrice: 30, free: true }, { id: 'gone-item', label: 'Old thing', price: 40, listPrice: 40, free: false }], packageId: 'brand-starter', retainerPitch: false, total: 340 };
const movedQ = q.blankQuote({ ...lead, deal: { quote: oldDeal } }, 'web-essentials');
ok(movedQ.lines.length === 3 && movedQ.lines[0].kind === 'package' && movedQ.lines[0].unit === 300 && movedQ.lines[0].listUnit === 350 && movedQ.lines[1].kind === 'item' && movedQ.lines[1].free === true && movedQ.lines[1].unit === 0 && movedQ.lines[2].kind === 'custom' && movedQ.lines[2].unit === 40 && movedQ.retainerPitch === false && q.validLines(movedQ.lines) && q.quoteSums(movedQ.lines).total === 340, 'the move: a quote the old builder left on a deal opens as this page\'s lines, Rob\'s prices kept, before any package from the link');
ok(q.linesFromDeal({ ...oldDeal, quoteId: '507f1f77bcf86cd799439141' }).length === 0 && q.linesFromDeal(null).length === 0 && q.blankQuote({ ...lead, deal: { quote: { ...oldDeal, quoteId: '507f1f77bcf86cd799439141' } } }, 'brand-starter').lines[0].id === 'brand-starter', 'a summary that came from a quote document is not moved again');
const bq = q.blankQuote(lead, 'brand-starter');
ok(q.isBlankQuote({ status: 'draft', lines: [], leadId: '' }) && !q.isBlankQuote({ status: 'draft', lines: [], leadId: A }) && !q.isBlankQuote({ status: 'draft', lines: [yard] }) && !q.isBlankQuote({ status: 'sent', lines: [] }) && !q.isBlankQuote({ lines: [], note: 'x' }) && !q.isBlankQuote({ lines: [], deleted: true }), 'a blank draft (no lead, no lines, no notes) is the one New quote opens again');
const stale = q.relistLines([{ kind: 'item', id: 'logo', label: 'Old name', qty: 2, unit: 200, listUnit: 199, free: false }, { kind: 'item', id: 'card-design', label: 'x', qty: 1, unit: 7, listUnit: 7, free: true }, { kind: 'item', id: 'retired-thing', label: 'Retired thing', qty: 3, unit: 45, listUnit: 50, free: false }, yard]);
ok(stale.length === 4 && stale[0].listUnit === 250 && stale[0].unit === 200 && stale[0].label === 'Logo (primary and mark)' && stale[1].unit === 0 && stale[1].listUnit === 30 && stale[2].kind === 'custom' && stale[2].unit === 45 && stale[2].qty === 3 && stale[3] === yard && q.validLines(stale), 'a stored quote opens against today\'s price list: the list price refreshed, Rob\'s price kept, a line that left the list kept as a custom line');
ok(bq.leadId === A && bq.lines.length === 1 && bq.lines[0].kind === 'package' && bq.status === 'draft' && bq.validDays === 30 && bq.retainerPitch === true && q.blankQuote(null).lines.length === 0 && Object.keys(q.quoteBody(bq)).sort().join() === 'leadId,lines,note,privateNote,retainerPitch,validDays', 'a new quote starts blank (or on the package from the link) and the editor sends only the fields it owns');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing of ${count}.` : `\nAll ${count} quotes checks pass.`);
process.exit(fails ? 1 : 0);
