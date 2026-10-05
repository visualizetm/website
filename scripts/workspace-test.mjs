#!/usr/bin/env node
/* The client workspace cards' logic (src/lib/workspace.js, src/lib/showcaseMeter.js, src/lib/docs.js): the Showcase state and image count
 * (a published page with a cover and a logo is not "0 images"; a published page with truly none is the nudge, never a plain Published),
 * the Concepts card's direction rows, the Docs card's count and rows (pinned first, then the latest edit), and the docs list helpers
 * (sort, group, search, snippet).   node scripts/workspace-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(path.join(repoRoot, '.tmp-verify'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'wslib-'));
const entry = path.join(tmp, 'entry.js');
fs.writeFileSync(entry, `export * from ${JSON.stringify(path.join(repoRoot, 'src/lib/workspace.js'))}; export * from ${JSON.stringify(path.join(repoRoot, 'src/lib/showcaseMeter.js'))}; export * from ${JSON.stringify(path.join(repoRoot, 'src/lib/docs.js'))};`);
const out = path.join(tmp, 'bundle.mjs');
await build({ entryPoints: [entry], outfile: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' } });
const L = await import(pathToFileURL(out).href);
fs.rmSync(tmp, { recursive: true, force: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const lead = (showcase) => ({ _id: 'L1', business: 'Kims', showcase });

/* Showcase */
ok(L.showcaseStatus(lead(undefined)).state === 'none' && L.showcaseStatus(lead({})).state === 'none', 'no showcase is none');
const cover = L.showcaseStatus(lead({ published: true, slug: 'kims', cover: 'https://res.cloudinary.com/x/a.png', brand: { logo: { dark: 'https://res.cloudinary.com/x/logo.png' } } }));
ok(cover.state === 'published' && cover.images === 2 && cover.empty === false, `a published page with a cover and a logo has 2 images, not 0 (${cover.images})`);
const none = L.showcaseStatus(lead({ published: true, slug: 'kims' }));
ok(none.state === 'published' && none.images === 0 && none.empty === true && none.label === 'published, no images yet', 'published with truly none is the nudge: empty, "published, no images yet"');
const draft = L.showcaseStatus(lead({ published: false, blurb: 'x' }));
ok(draft.state === 'draft' && draft.images === 0 && draft.empty === false, 'a draft with none is a Draft, never published and never the nudge');
const many = L.showcaseStatus(lead({ published: true, slug: 'k', cover: 'u1', brand: { logo: { dark: 'u1' }, images: ['u2', 'u3', 'u2'] }, website: { screenshots: ['u4'] }, instagram: { enabled: true, posts: [{ image: 'u5' }, { image: '' }] }, cards: { front: 'u6', back: '' }, print: { items: [{ image: 'u7' }] } }));
ok(many.images === 7, `distinct images across the cover, logo, brand, website, Instagram, cards and print count once each (${many.images})`);
const off = L.showcaseStatus(lead({ published: true, slug: 'k', brand: { enabled: false, images: ['a', 'b'] }, website: { enabled: false, screenshots: ['c'] }, instagram: { enabled: false, posts: [{ image: 'd' }] }, cards: { enabled: false, front: 'e' }, print: { enabled: false, items: [{ image: 'f' }] } }));
ok(off.images === 0 && off.empty === true, 'a block that is switched off does not count its images');

/* Concepts rows */
const dir = (id, name, over = {}) => ({ id, name, order: 0, needsDecision: true, ...over });
const review = { _id: 's1', leadId: 'L1', status: 'sent', approvalMode: 'review', directions: [dir('a', 'Logo', { order: 0, decision: { status: 'approved' } }), dir('b', 'Card', { order: 1, decision: { status: 'changes', note: 'x' } }), dir('c', 'Site', { order: 2 }), dir('d', 'Board', { order: 3, needsDecision: false })] };
const cr = L.directionRows(review);
ok(cr.length === 3 && cr.map(r => r.state).join() === 'approved,changes,waiting', `a Review each set shows the first three directions with the client's answers (${cr.map(r => r.state)})`);
ok(L.directionRows({ ...review, directions: [review.directions[3]] })[0].state === 'reference', 'a For reference direction says so');
const pick = { _id: 's2', leadId: 'L1', status: 'approved', approvedDirectionId: 'b', directions: [dir('a', 'One'), dir('b', 'Two')] };
ok(L.directionRows(pick).map(r => r.state).join() === 'waiting,picked', 'a Pick one set marks the one they picked');
ok(L.directionRows({ directions: [dir('a', '')] })[0].name === 'Direction A', 'an unnamed direction reads Direction A');
ok(L.conceptsStatus([review], 'L1').rows.length === 3 && L.conceptsStatus([], 'L1').rows.length === 0, 'the concepts card carries the rows, none with no set');

/* Docs card */
const d = (id, over) => ({ _id: id, leadId: 'L1', type: 'brief', title: id, pinned: false, text: '', updatedAt: '2026-10-01T10:00:00Z', createdAt: '2026-09-01T10:00:00Z', ...over });
const docs = [d('old', { updatedAt: '2026-09-02T10:00:00Z' }), d('new', { updatedAt: '2026-10-04T10:00:00Z' }), d('mid', { updatedAt: '2026-10-02T10:00:00Z' }), d('pin', { pinned: true, updatedAt: '2026-08-01T10:00:00Z' }), d('other', { leadId: 'L2' })];
const st = L.docsStatus(docs, 'L1');
ok(st.count === 4 && st.rows.map(r => r._id).join() === 'pin,new,mid' && st.more === 1 && st.pinned === 1, `the card counts this client's docs and shows three, pinned first then the latest edit (${st.rows.map(r => r._id)})`);
ok(L.docsStatus(docs, 'L9').count === 0 && L.docsStatus(docs, 'L9').rows.length === 0 && L.docsStatus(docs, 'L9').label === 'none yet', 'a client with none has an empty card');
ok(L.docsStatus([], 'L1').count === 0 && L.docsStatus(undefined, 'L1').count === 0, 'no list at all is none');

/* List helpers */
ok(L.sortDocs(docs.slice(0, 4), 'created').map(r => r._id)[0] === 'pin', 'pinned stays first under any sort');
const g = L.groupByType([d('a', { type: 'contract' }), d('b', { type: 'brief' }), d('c', { type: 'brief', updatedAt: '2026-10-03T10:00:00Z' })]);
ok(g.map(x => x.id).join() === 'brief,contract' && g[0].docs.map(x => x._id).join() === 'c,b', 'groups follow the type order, newest edit first inside');
ok(L.matchDoc(d('x', { title: 'Kims brief', text: 'a logo and a menu' }), 'menu logo') && !L.matchDoc(d('x', { title: 'Kims brief', text: 'a logo' }), 'menu') && L.matchDoc(d('x', { type: 'call-notes' }), 'call notes'), 'search matches the title, the type and the block text, every word');
ok(L.snippetFor(d('x', { title: 'Brief', text: 'we talked about the menu redesign for spring' }), 'menu').includes('menu') && L.snippetFor(d('x', { title: 'The menu' }), 'menu') === '', 'a block text match shows a snippet, a title match does not');
ok(L.editedLabel(d('x', { updatedAt: new Date(Date.now() - 2 * 3600e3).toISOString() })) === 'Edited 2h ago', `"Edited 2h ago" (${L.editedLabel(d('x', { updatedAt: new Date(Date.now() - 2 * 3600e3).toISOString() }))})`);

console.log(fails ? `\n${fails} failing.` : '\nAll workspace checks pass.');
process.exit(fails ? 1 : 0);
