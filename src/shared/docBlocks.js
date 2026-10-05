/* Client docs, the block schema (docs job, milestone 1). Mirrored byte for
 * byte in api/_lib/docBlocks.js (a serverless function cannot import src/);
 * scripts/docs-test.mjs asserts it. Self contained: no imports, so plain
 * Node loads it for the tests.
 *
 * A doc is a title, a type and a list of blocks. A block is data, never
 * HTML: nothing here or anywhere that renders a doc reads a stored string as
 * markup. Text blocks carry `runs`, a flat list of { t, b, i, a } (text,
 * bold, italic, link), so the three inline marks are the only formatting a
 * paragraph can have.
 *
 *   h1 h2 p ul ol check quote   runs (a list item is one block; numbering is the run of consecutive ol blocks)
 *   check                       plus checked (doc only: it never becomes a task)
 *   divider                     nothing
 *   link                        url (http or https) and text
 *   image                       url (https, the Cloudinary host only), alt
 *   ref                         ref { kind, id }, a live chip of a record of the same client (label is a cached name)
 *
 * sanitizeBlocks() is the schema: a block type it does not know is dropped,
 * every string is capped, the count is capped, a URL that is not http or
 * https (an image: the Cloudinary host) is emptied. Whether a ref points at
 * this client's own record is the route's check (it needs the database). */
export const DOC_TYPES = [
  { id: 'brief', label: 'Brief' },
  { id: 'call-notes', label: 'Call notes' },
  { id: 'contract', label: 'Contract' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'brand-notes', label: 'Brand notes' },
  { id: 'general', label: 'General' },
];
export const DOC_TYPE_IDS = DOC_TYPES.map(t => t.id);
export const BLOCK_TYPES = ['h1', 'h2', 'p', 'ul', 'ol', 'check', 'quote', 'divider', 'link', 'image', 'ref'];
export const TEXT_BLOCKS = ['h1', 'h2', 'p', 'ul', 'ol', 'check', 'quote'];
export const REF_KINDS = ['concept', 'project', 'task', 'invoice', 'file'];
export const LIMITS = { blocks: 400, text: 4000, runs: 60, title: 160, url: 500, alt: 200, label: 200, id: 64, search: 6000 };
export const IMAGE_HOST = 'res.cloudinary.com';

const str = (v, max) => String(v ?? '').slice(0, max);
export const blockId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

/** http or https, no whitespace or control characters; '' for anything else. */
export function linkUrl(v, max = LIMITS.url) {
  const s = String(v ?? '').trim().slice(0, max);
  if (!s || /[\x00-\x20\x7f]/.test(s)) return '';
  return /^https?:\/\/[^\s/?#]+[^\s]*$/i.test(s) ? s : '';
}
/** https on the Cloudinary host only (the upload flow's host). */
export function imageUrl(v, max = LIMITS.url) {
  const s = linkUrl(v, max);
  if (!/^https:\/\//i.test(s)) return '';
  try { return new URL(s).hostname.toLowerCase() === IMAGE_HOST ? s : ''; } catch { return ''; }
}

/** The runs of a text block: at most LIMITS.runs, LIMITS.text characters in all, marks b, i and a only. */
export function sanitizeRuns(runs) {
  if (!Array.isArray(runs)) return [];
  const out = []; let left = LIMITS.text;
  for (const r of runs) {
    if (out.length >= LIMITS.runs || left <= 0) break;
    const t = str(r?.t, left);
    if (!t) continue;
    left -= t.length;
    const a = linkUrl(r?.a);
    out.push({ t, ...(r?.b ? { b: 1 } : {}), ...(r?.i ? { i: 1 } : {}), ...(a ? { a } : {}) });
  }
  return out;
}

export function sanitizeBlock(b) {
  if (!b || typeof b !== 'object' || !BLOCK_TYPES.includes(b.type)) return null;
  const id = str(b.id, LIMITS.id).replace(/[^A-Za-z0-9_-]/g, '') || blockId();
  const type = b.type;
  if (TEXT_BLOCKS.includes(type)) return { id, type, runs: sanitizeRuns(b.runs), ...(type === 'check' ? { checked: !!b.checked } : {}) };
  if (type === 'divider') return { id, type };
  if (type === 'link') return { id, type, url: linkUrl(b.url), text: str(b.text, LIMITS.label) };
  if (type === 'image') return { id, type, url: imageUrl(b.url), alt: str(b.alt, LIMITS.alt) };
  const kind = REF_KINDS.includes(b.ref?.kind) ? b.ref.kind : '';
  const rid = str(b.ref?.id, LIMITS.id);
  if (!kind || !rid) return null;
  return { id, type, ref: { kind, id: rid }, label: str(b.label, LIMITS.label) };
}

/** The stored blocks, from any input; ids stay unique. */
export function sanitizeBlocks(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set(); const out = [];
  for (const raw of list.slice(0, LIMITS.blocks)) {
    const b = sanitizeBlock(raw);
    if (!b) continue;
    while (seen.has(b.id)) b.id = blockId();
    seen.add(b.id); out.push(b);
  }
  return out;
}

export const sanitizeTitle = (v) => str(String(v ?? '').replace(/\s+/g, ' ').trim(), LIMITS.title).trim();
export const runsText = (runs) => (Array.isArray(runs) ? runs.map(r => r?.t || '').join('') : '');

/** One block as plain text (the copy as text export, search and the snippet). */
export function blockPlain(b, n = 0) {
  if (!b) return '';
  const t = runsText(b.runs);
  switch (b.type) {
    case 'h1': return `# ${t}`;
    case 'h2': return `## ${t}`;
    case 'ul': return `- ${t}`;
    case 'ol': return `${n || 1}. ${t}`;
    case 'check': return `${b.checked ? '[x]' : '[ ]'} ${t}`;
    case 'quote': return `> ${t}`;
    case 'divider': return '---';
    case 'link': return b.url ? `${b.text || b.url} (${b.url})` : (b.text || '');
    case 'image': return b.alt ? `[Image: ${b.alt}]` : '[Image]';
    case 'ref': return b.label ? `[${b.label}]` : '';
    default: return t;
  }
}

/** The whole doc as plain text: the title, then a line per block, numbered lists counted. */
export function docPlainText(doc) {
  const lines = [];
  if (doc?.title) lines.push(doc.title, '');
  let n = 0;
  for (const b of doc?.blocks || []) {
    n = b.type === 'ol' ? n + 1 : 0;
    lines.push(blockPlain(b, n));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** What global search matches a doc on: the block text, no markup, capped. */
export function searchTextOf(blocks) {
  return (blocks || []).map(b => (b.type === 'ref' ? b.label : b.type === 'link' ? `${b.text || ''} ${b.url || ''}` : b.type === 'image' ? b.alt : runsText(b.runs)) || '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.search);
}

/** Every reference a doc makes, for the route's same client check. */
export const refsOf = (blocks) => (blocks || []).filter(b => b?.type === 'ref' && b.ref).map(b => ({ kind: b.ref.kind, id: b.ref.id }));
