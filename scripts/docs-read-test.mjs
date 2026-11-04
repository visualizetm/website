/* The doc reading view's logic (prompt 3 of 3, milestone 3): Copy for Claude (docPlainText with format markdown), the section strip, the text size and a tick.
 *   markdown: the title, # and ##, dashes and numbers, [ ] and [x], > quotes, bold and italic, links, blank lines between blocks and none doubled,
 *   never a block id; the default text export is unchanged; the api mirror of docBlocks stays byte for byte (docs-test asserts it).
 * Run: node scripts/docs-read-test.mjs (DOCS_SRC=<dir> reads src from a copy, for the guard proof) */
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcRoot = process.env.DOCS_SRC ? path.resolve(process.env.DOCS_SRC) : path.join(repoRoot, 'src');
const src = (rel) => import(pathToFileURL(path.join(srcRoot, rel)).href);
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const D = await src('shared/docBlocks.js');
const R = await src('lib/docRead.js');

const blocks = [
  { id: 'aaa111bbb', type: 'h1', runs: [{ t: 'Goals' }] },
  { id: 'bbb222ccc', type: 'p', runs: [{ t: 'We need ' }, { t: 'a new logo', b: 1 }, { t: ' and a ' }, { t: 'site', i: 1, a: 'https://example.com/x' }, { t: '.' }] },
  { id: 'ccc333ddd', type: 'ul', runs: [{ t: 'One' }] }, { id: 'ddd444eee', type: 'ul', runs: [{ t: 'Two' }] },
  { id: 'eee555fff', type: 'ol', runs: [{ t: 'First' }] }, { id: 'fff666ggg', type: 'ol', runs: [{ t: 'Second' }] },
  { id: 'ggg777hhh', type: 'check', checked: true, runs: [{ t: 'Sent the form' }] }, { id: 'hhh888iii', type: 'check', checked: false, runs: [{ t: 'Book the call' }] },
  { id: 'iii999jjj', type: 'quote', runs: [{ t: 'Make it look like a real shop' }] },
  { id: 'jjj000kkk', type: 'h2', runs: [{ t: 'Next steps' }] },
  { id: 'kkk111lll', type: 'p', runs: [] },
  { id: 'lll222mmm', type: 'link', text: 'The brand folder', url: 'https://example.com/folder' },
  { id: 'mmm333nnn', type: 'divider' },
  { id: 'nnn444ooo', type: 'ref', label: 'Brand concepts', ref: { kind: 'concept', id: 'S1' } },
  { id: 'ooo555ppp', type: 'p', runs: [{ t: 'Last line' }] },
];
const doc = { title: 'Client brief', blocks };
const md = D.docPlainText(doc, { format: 'markdown' });
const lines = md.split('\n');
ok(lines[0] === '# Client brief', 'the title first, as #');
ok(lines.includes('# Goals') && lines.includes('## Next steps'), 'headings as # and ##');
ok(md.includes('We need **a new logo** and a [*site*](https://example.com/x).'), 'bold, italic and a link in a paragraph');
ok(lines.includes('- One') && lines.includes('- Two') && lines.includes('1. First') && lines.includes('2. Second'), 'lists as dashes and numbers');
ok(lines.includes('[x] Sent the form') && lines.includes('[ ] Book the call'), 'checklists as [ ] and [x]');
ok(lines.includes('> Make it look like a real shop'), 'quotes as >');
ok(lines.includes('[The brand folder](https://example.com/folder)') && lines.includes('---') && lines.includes('[Brand concepts]'), 'a link, a divider and a reference');
ok(!/\n{3,}/.test(md), 'no empty line is doubled');
ok(lines[lines.indexOf('- One') + 1] === '- Two' && lines[lines.indexOf('[x] Sent the form') + 1] === '[ ] Book the call', 'consecutive list items stay together');
ok(lines[lines.indexOf('- Two') + 1] === '' && lines[lines.indexOf('# Goals') + 1] === '', 'a blank line between blocks');
const leaked = blocks.filter(b => md.includes(b.id));
ok(leaked.length === 0, `no block id in the copy (${leaked.map(b => b.id).join(',') || 'none'})`);
ok(!/undefined|null|\[object/.test(md), 'no undefined or null in the copy');
ok(D.docPlainText(doc).split('\n')[0] === 'Client brief' && !D.docPlainText(doc).includes('**') && D.docPlainText(doc).includes('We need a new logo and a site.'), 'the default text export is unchanged (no marks)');
ok(D.docPlainText({ title: '', blocks: [] }, { format: 'markdown' }) === '' && D.docPlainText(null, { format: 'markdown' }) === '', 'an empty doc copies as nothing');
ok(D.docPlainText({ title: 'x', blocks: [{ id: 'z', type: 'image', url: 'javascript:alert(1)', alt: 'Hero' }, { id: 'y', type: 'link', text: 'bad', url: 'javascript:alert(1)' }] }, { format: 'markdown' }).includes('javascript') === false, 'an unsafe url never reaches the copy');

const secs = R.sectionsOf(blocks);
ok(secs.length === 2 && secs[0].text === 'Goals' && secs[0].level === 1 && secs[1].text === 'Next steps' && secs[1].level === 2 && secs[0].id === 'aaa111bbb', 'the section strip lists the h1 and h2 blocks in order');
ok(R.sectionsOf([{ id: 'x', type: 'h1', runs: [] }, { id: 'y', type: 'p', runs: [{ t: 'z' }] }]).length === 0, 'an empty heading and a paragraph are not sections');
ok(R.READ_SIZES.length === 3 && R.sizeOf('m').px === 17 && R.sizeOf('m').lh === 28 && R.sizeOf('nope').id === 'm', 'three text sizes, 17 on 28 the default');
ok(R.readSize() === 'm', 'with no storage (or blocked storage) the size is the default and nothing throws');
globalThis.localStorage = { _v: {}, getItem(k) { return this._v[k] ?? null; }, setItem(k, v) { this._v[k] = String(v); } };
R.saveReadSize('l'); ok(R.readSize() === 'l', 'the step is remembered per device');
globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
ok(R.readSize() === 'm' && (R.saveReadSize('s'), true), 'a throwing storage is survived');
const ticked = R.tickBlock(blocks, 'hhh888iii');
ok(ticked.find(b => b.id === 'hhh888iii').checked === true && ticked.find(b => b.id === 'ggg777hhh').checked === true && ticked.filter((b, i) => b !== blocks[i]).length === 1, 'a tick changes that one check block and nothing else');
ok(R.tickBlock(blocks, 'ggg777hhh').find(b => b.id === 'ggg777hhh').checked === false && R.tickBlock(blocks, 'aaa111bbb').every((b, i) => b === blocks[i]), 'a tick unticks, and a tick on a heading changes nothing');
console.log(`\ndocs-read-test: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
