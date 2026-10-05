#!/usr/bin/env node
/* The doc editor's pure block operations (src/lib/docEdit.js): runs, split and join, Enter and Backspace in every block type, the markdown
 * shortcuts, move, duplicate, convert, numbering. The browser side (contentEditable, the formatting bar, drag) is the audits' and Rob's
 * phone's.   node scripts/docs-edit-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(path.join(repoRoot, '.tmp-verify'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'dedit-'));
const out = path.join(tmp, 'bundle.mjs');
await build({ entryPoints: [path.join(repoRoot, 'src/lib/docEdit.js')], outfile: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const E = await import(pathToFileURL(out).href);
fs.rmSync(tmp, { recursive: true, force: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const t = (s, x = {}) => ({ t: s, ...x });
const B = (id, type, runs = [], x = {}) => ({ id, type, runs, ...x });
const txt = (blocks) => blocks.map(b => `${b.type}:${E.textOf(b.runs)}`).join('|');

ok(JSON.stringify(E.normalizeRuns([t('a'), t('b'), t(''), t('c', { b: 1 }), t('d', { b: 1 })])) === JSON.stringify([t('ab'), t('cd', { b: 1 })]), 'normalizeRuns joins neighbours with the same marks and drops empties');
const [a, b] = E.splitRuns([t('hello '), t('world', { b: 1 })], 8);
ok(E.textOf(a) === 'hello wo' && E.textOf(b) === 'rld' && a[1].b === 1 && b[0].b === 1, 'splitRuns cuts inside a marked run and both halves keep the mark');
ok(E.splitRuns([t('ab')], 0)[0].length === 0 && E.splitRuns([t('ab')], 2)[1].length === 0, 'splitting at either end leaves one side empty');

let bl = [B('1', 'p', [t('one two')])];
let r = E.enterAt(bl, '1', 3);
ok(txt(r.blocks) === 'p:one|p: two' && r.focus.at === 0 && r.focus.id === r.blocks[1].id, 'Enter in a paragraph splits it and the caret goes to the start of the new one');
bl = [B('1', 'ul', [t('a b')])];
r = E.enterAt(bl, '1', 1);
ok(txt(r.blocks) === 'ul:a|ul: b', 'Enter in a list item continues the list');
r = E.enterAt([B('1', 'ul', [])], '1', 0);
ok(txt(r.blocks) === 'p:' && r.blocks[0].id === '1', 'Enter on an empty list item leaves the list');
r = E.enterAt([B('1', 'h1', [t('Title')])], '1', 5);
ok(txt(r.blocks) === 'h1:Title|p:', 'Enter at the end of a heading starts a paragraph');
r = E.enterAt([B('1', 'check', [t('x')], { checked: true })], '1', 1);
ok(r.blocks[1].type === 'check' && r.blocks[1].checked === false && r.blocks[0].checked === true, 'a new checklist item is not ticked');
ok(E.enterAt([B('1', 'divider')], '1', 0).focus === null, 'Enter on a divider does nothing');

r = E.backspaceStart([B('1', 'ul', [t('x')])], '1');
ok(txt(r.blocks) === 'p:x' && r.focus.at === 0, 'Backspace at the start of a list item makes it a paragraph');
r = E.backspaceStart([B('1', 'p', [t('abc')]), B('2', 'p', [t('def')])], '2');
ok(txt(r.blocks) === 'p:abcdef' && r.focus.id === '1' && r.focus.at === 3, 'Backspace at the start of a paragraph joins the one above and the caret sits at the join');
r = E.backspaceStart([B('1', 'divider'), B('2', 'p', [t('x')])], '2');
ok(txt(r.blocks) === 'p:x' && r.blocks.length === 1, 'Backspace under a divider removes the divider when the paragraph has text');
r = E.backspaceStart([B('1', 'divider'), B('2', 'p', [])], '2');
ok(r.blocks.length === 1 && r.blocks[0].type === 'divider', 'Backspace on an empty paragraph under a divider removes the paragraph');
ok(E.backspaceStart([B('1', 'p', [t('x')])], '1').focus === null, 'Backspace at the start of the first paragraph does nothing');

ok(E.markdownShortcut([B('1', 'p', [t('# ')])], '1').blocks[0].type === 'h1' && E.textOf(E.markdownShortcut([B('1', 'p', [t('# ')])], '1').blocks[0].runs) === '', '"# " makes a heading and the marker goes');
ok(['## |h2', '- |ul', '* |ul', '1. |ol', '[] |check', '> |quote'].every(s => { const [m, ty] = s.split('|'); return E.markdownShortcut([B('1', 'p', [t(m)])], '1')?.blocks[0].type === ty; }), 'the other markers: ##, -, *, 1., [], >');
ok(E.markdownShortcut([B('1', 'p', [t('#hello')])], '1') === null && E.markdownShortcut([B('1', 'h1', [t('# ')])], '1') === null, 'only a paragraph with exactly the marker converts');

const three = [B('a', 'p', [t('A')]), B('b', 'p', [t('B')]), B('c', 'p', [t('C')])];
ok(txt(E.moveBlock(three, 'b', -1)) === 'p:B|p:A|p:C' && txt(E.moveBlock(three, 'b', 1)) === 'p:A|p:C|p:B', 'move up and move down swap one place');
ok(E.moveBlock(three, 'a', -1) === three && E.moveBlock(three, 'c', 1) === three, 'the first cannot move up and the last cannot move down');
ok(txt(E.moveTo(three, 'a', 2)) === 'p:B|p:C|p:A' && txt(E.moveTo(three, 'c', 0)) === 'p:C|p:A|p:B' && E.moveTo(three, 'b', 1) === three, 'moveTo puts a block at an index (the drag)');
const dup = E.duplicateBlock(three, 'b');
ok(txt(dup) === 'p:A|p:B|p:B|p:C' && dup[1].id !== dup[2].id, 'duplicate adds a copy below with a new id');
ok(txt(E.convertBlock(three, 'a', 'h2')) === 'h2:A|p:B|p:C' && E.convertBlock(three, 'a', 'divider') === three && E.convertBlock([B('d', 'divider')], 'd', 'p')[0].type === 'divider', 'convert turns a text block into another text type and refuses the rest');
ok(E.convertBlock([B('1', 'check', [t('x')], { checked: true })], '1', 'p')[0].checked === undefined, 'a checklist item turned into a paragraph drops its tick');
ok(E.numbering([B('1', 'ol'), B('2', 'ol'), B('3', 'p'), B('4', 'ol')]).join() === '1,2,0,1', 'numbering counts a run of numbered items and restarts after anything else');
ok(E.ensureBlock([]).length === 1 && E.ensureBlock([]) [0].type === 'p' && E.ensureBlock(three) === three, 'an empty doc gets one paragraph to type in');
ok(txt(E.tidy([B('1', 'p', [t('x')]), B('2', 'p', []), B('3', 'p', [])])) === 'p:x', 'trailing empty paragraphs are not stored');
const many = Array.from({ length: 400 }, (_, i) => B(`x${i}`, 'p'));
ok(E.insertAfter(many, 'x0', B('n', 'p')).length === 400, 'the block cap holds in the editor too');

console.log(fails ? `\n${fails} failing.` : '\nAll doc edit checks pass.');
process.exit(fails ? 1 : 0);
