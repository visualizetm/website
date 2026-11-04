import { runsText } from '../shared/docBlocks.js';

/* The doc reading view's pure helpers (prompt 3 of 3, milestone 3): the section strip, the text size and a tick in read mode. */
export const SIZE_KEY = 'vz_doc_size';
/* Three steps: the body size and line height in px (17 on 28 is the default, the reading size). */
export const READ_SIZES = [{ id: 's', label: 'Small', px: 15, lh: 25 }, { id: 'm', label: 'Medium', px: 17, lh: 28 }, { id: 'l', label: 'Large', px: 20, lh: 32 }];
export const sizeOf = (id) => READ_SIZES.find(s => s.id === id) || READ_SIZES[1];
/** The step this device remembers (storage may be off or blocked: the default then). */
export function readSize() { try { return sizeOf(localStorage.getItem(SIZE_KEY)).id; } catch { return 'm'; } }
export function saveReadSize(id) { try { localStorage.setItem(SIZE_KEY, sizeOf(id).id); } catch { /* the step lasts for this visit */ } }

/** The headings the strip lists: [{ id, level (1 or 2), text }] in order, empty headings left out. */
export const sectionsOf = (blocks) => (blocks || []).filter(b => (b?.type === 'h1' || b?.type === 'h2') && runsText(b.runs).trim()).map(b => ({ id: b.id, level: b.type === 'h1' ? 1 : 2, text: runsText(b.runs).trim() }));

/** A tick in read mode is the same block patch the editor makes: the block's checked flag, nothing else, everything else untouched. */
export const tickBlock = (blocks, id) => (blocks || []).map(b => (b.id === id && b.type === 'check' ? { ...b, checked: !b.checked } : b));

/* A doc made a moment ago opens in Edit; one opened from a list on a phone opens in Read. The mark is a timestamp, so a double mount in
 * development reads it twice and gets the same answer. */
const fresh = new Map();
export const markFresh = (id) => { fresh.set(String(id), Date.now()); };
export const isFresh = (id, now = Date.now()) => now - (fresh.get(String(id)) || 0) < 15000;
export const startMode = (id, phone) => (phone && !isFresh(id) ? 'read' : 'edit');
