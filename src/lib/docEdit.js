import { blockId, TEXT_BLOCKS, LIMITS } from '../shared/docBlocks';

/* The doc editor's block operations (docs job, milestone 3): pure functions from blocks to blocks, so the editor's keys, its menu and its
 * formatting bar all do the same thing and scripts/docs-edit-test.mjs can drive them without a browser. A block is
 * { id, type, runs, checked?, url?, text?, alt?, ref?, label? } (src/shared/docBlocks.js); runs are { t, b?, i?, a? }. Nothing here touches
 * the DOM; the one place text is read out of the page is src/components/docs/RichText.jsx. */
export const isText = (b) => !!b && TEXT_BLOCKS.includes(b.type);
export const isList = (b) => !!b && (b.type === 'ul' || b.type === 'ol' || b.type === 'check');
export const textOf = (runs) => (runs || []).map(r => r.t).join('');
const sameMarks = (a, b) => !!a.b === !!b.b && !!a.i === !!b.i && (a.a || '') === (b.a || '');

/** Runs with no empty piece and no two neighbours that share their marks. */
export function normalizeRuns(runs) {
  const out = [];
  for (const r of runs || []) {
    if (!r || !r.t) continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last, r)) last.t += r.t; else out.push({ ...r });
  }
  return out;
}
/** [before, after] at a character offset. */
export function splitRuns(runs, at) {
  const a = []; const b = []; let n = 0;
  for (const r of runs || []) {
    const len = r.t.length;
    if (n + len <= at) a.push(r);
    else if (n >= at) b.push(r);
    else { a.push({ ...r, t: r.t.slice(0, at - n) }); b.push({ ...r, t: r.t.slice(at - n) }); }
    n += len;
  }
  return [normalizeRuns(a), normalizeRuns(b)];
}
export const joinRuns = (a, b) => normalizeRuns([...(a || []), ...(b || [])]);

export const newBlock = (type, extra = {}) => ({ id: blockId(), type, ...(isText({ type }) ? { runs: [] } : {}), ...(type === 'check' ? { checked: false } : {}), ...extra });
export const indexOfBlock = (blocks, id) => blocks.findIndex(b => b.id === id);

export function insertAfter(blocks, id, block) {
  const at = indexOfBlock(blocks, id);
  if (blocks.length >= LIMITS.blocks) return blocks;
  const next = [...blocks]; next.splice(at < 0 ? next.length : at + 1, 0, block);
  return next;
}
export const removeBlock = (blocks, id) => blocks.filter(b => b.id !== id);
export const patchBlock = (blocks, id, set) => blocks.map(b => (b.id === id ? { ...b, ...set } : b));
export const setRuns = (blocks, id, runs) => patchBlock(blocks, id, { runs: normalizeRuns(runs) });

/** Move one place: dir -1 up, 1 down. */
export function moveBlock(blocks, id, dir) {
  const at = indexOfBlock(blocks, id); const to = at + dir;
  if (at < 0 || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks]; const [b] = next.splice(at, 1); next.splice(to, 0, b);
  return next;
}
/** Move to a position (the drag): `to` is the index the block ends at. */
export function moveTo(blocks, id, to) {
  const at = indexOfBlock(blocks, id);
  if (at < 0) return blocks;
  const clamped = Math.max(0, Math.min(blocks.length - 1, to));
  if (clamped === at) return blocks;
  const next = [...blocks]; const [b] = next.splice(at, 1); next.splice(clamped, 0, b);
  return next;
}
export function duplicateBlock(blocks, id) {
  const at = indexOfBlock(blocks, id);
  if (at < 0 || blocks.length >= LIMITS.blocks) return blocks;
  const next = [...blocks]; next.splice(at + 1, 0, { ...blocks[at], id: blockId(), runs: blocks[at].runs ? blocks[at].runs.map(r => ({ ...r })) : undefined });
  return next;
}
/** Turn a text block into another text type; the words stay. A checklist keeps nothing but its tick; a quote or heading drops it. */
export function convertBlock(blocks, id, type) {
  const b = blocks.find(x => x.id === id);
  if (!isText(b) || !TEXT_BLOCKS.includes(type) || b.type === type) return blocks;
  const { checked, ...rest } = b;
  return blocks.map(x => (x.id === id ? { ...rest, type, ...(type === 'check' ? { checked: !!checked } : {}) } : x));
}

/** Enter at an offset in a text block. Returns { blocks, focus: { id, at } }.
 *  An empty list item leaves the list (it becomes a paragraph); a heading or a quote continues as a paragraph; a list item continues the list. */
export function enterAt(blocks, id, at) {
  const b = blocks.find(x => x.id === id);
  if (!isText(b)) return { blocks, focus: null };
  const [before, after] = splitRuns(b.runs, at);
  if (isList(b) && !textOf(b.runs)) return { blocks: convertBlock(blocks, id, 'p'), focus: { id, at: 0 } };
  const type = isList(b) ? b.type : 'p';
  const nb = newBlock(type, { runs: after });
  const next = insertAfter(patchBlock(blocks, id, { runs: before }), id, nb);
  return { blocks: next, focus: { id: nb.id, at: 0 } };
}
/** Backspace at the very start of a text block. A list item, heading or quote becomes a paragraph; a paragraph joins the text block above it
 *  (or, if the one above is a divider, an image or a reference, removes that block). Returns { blocks, focus }. */
export function backspaceStart(blocks, id) {
  const at = indexOfBlock(blocks, id); const b = blocks[at];
  if (!isText(b)) return { blocks, focus: null };
  if (b.type !== 'p') return { blocks: convertBlock(blocks, id, 'p'), focus: { id, at: 0 } };
  const prev = blocks[at - 1];
  if (!prev) return { blocks, focus: null };
  if (isText(prev)) {
    const joinAt = textOf(prev.runs).length;
    return { blocks: removeBlock(patchBlock(blocks, prev.id, { runs: joinRuns(prev.runs, b.runs) }), id), focus: { id: prev.id, at: joinAt } };
  }
  /* an empty paragraph under a divider, image or reference removes itself; a full one removes the object above it */
  return textOf(b.runs) ? { blocks: removeBlock(blocks, prev.id), focus: { id, at: 0 } } : { blocks: removeBlock(blocks, id), focus: null };
}

/** Typing "# ", "## ", "- ", "* ", "1. ", "[] " or "> " into an empty-so-far paragraph turns it into that block, the marker gone. */
const MARKDOWN = [[/^#\s$/, 'h1'], [/^##\s$/, 'h2'], [/^[-*]\s$/, 'ul'], [/^1\.\s$/, 'ol'], [/^\[\]\s$/, 'check'], [/^>\s$/, 'quote']];
export function markdownShortcut(blocks, id) {
  const b = blocks.find(x => x.id === id);
  if (!b || b.type !== 'p') return null;
  const text = textOf(b.runs);
  const hit = MARKDOWN.find(([re]) => re.test(text));
  if (!hit) return null;
  return { blocks: patchBlock(convertBlock(blocks, id, hit[1]), id, { runs: [] }), focus: { id, at: 0 } };
}

/** The numbers a run of consecutive ol blocks shows. */
export function numbering(blocks) {
  let n = 0;
  return blocks.map(b => { n = b.type === 'ol' ? n + 1 : 0; return n; });
}
/** A doc with no block gets one empty paragraph to type in. */
export const ensureBlock = (blocks) => (blocks && blocks.length ? blocks : [newBlock('p')]);
/** Blocks as they are stored: an empty paragraph at the very end is not kept; ids stay. */
export function tidy(blocks) {
  const out = [...blocks];
  while (out.length && out[out.length - 1].type === 'p' && !textOf(out[out.length - 1].runs)) out.pop();
  return out;
}
