import { PACKAGES, CATALOG, PRINT_PRODUCTS, DEPOSIT_PCT } from './pricing.js';

/* A quote's lines, the one set of rules the Quotes page and its store share. This file is mirrored byte for byte in
 * api/_lib/quoteLines.js (quotes-test asserts it): the editor draws with it, api/_routes/quotes.js stores with it.
 *
 * A line is one of two things.
 *   From the price list: { kind: 'package' | 'item' | 'print', id, label, qty, unit, listUnit, free }
 *     listUnit is pricing.js's price for that id and nothing else; unit is Rob's price for one; free charges nothing
 *     and keeps listUnit, so what was given away can still be counted. A package's qty is 1.
 *   Custom: { kind: 'custom', id, label, qty, unit, free, cost?, supplierUrl?, note? }
 *     anything Rob types (yard signs, shirts, a banner). unit is his price for one and its own list price. cost,
 *     supplierUrl and note are Rob's only: nothing a client receives may carry them (CLIENT_LINE_KEYS is the list
 *     that may).
 *
 * validLine is the guard: a price list line whose id is not in pricing.js, or whose list price is not pricing.js's,
 * is refused (close-guard-proof cuts that line and close-test must fail); a custom line is held to its own caps. */

export const QUOTE_STATUS_IDS = ['draft', 'sent', 'accepted', 'declined'];
export const LINE_KINDS = ['package', 'item', 'print', 'custom'];
export const QUOTE_CAPS = { lines: 40, label: 120, qty: 10000, unit: 100000, lineNote: 200, note: 500, validDays: 365, savedItems: 100 };
export const VALID_DAYS = 30;
/* What a client may read of a line. Everything else on a line is Rob's. */
export const CLIENT_LINE_KEYS = ['label', 'qty', 'unit', 'free'];

export const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isMoney = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= QUOTE_CAPS.unit && cents(n) === n;
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const httpUrl = (u) => /^https?:\/\/[^\s]+$/i.test(String(u || ''));

/** The price list's entry for a kind and an id, { id, label, price }, or null. A sized print product carries its
 *  size in the id (vinyl:small). A line from before kinds existed (no kind) is a package or a catalog item. */
export function listEntry(kind, id) {
  const key = String(id || '');
  if (kind === 'print') {
    const [pid, size] = key.split(':');
    const p = PRINT_PRODUCTS.find(x => x.id === pid);
    if (!p) return null;
    if (!p.sizes) return size === undefined ? { id: p.id, label: p.label, price: p.price } : null;
    const s = p.sizes.find(x => x.id === size);
    return s ? { id: `${p.id}:${s.id}`, label: `${p.label}, ${s.label.toLowerCase()}`, price: s.price } : null;
  }
  const pkg = kind === 'item' ? null : PACKAGES.find(x => x.id === key);
  const hit = pkg || (kind === 'package' ? null : CATALOG.find(x => x.id === key));
  return hit ? { id: hit.id, label: hit.label, price: hit.price } : null;
}
export const listUnitOf = (kind, id) => { const e = listEntry(kind, id); return e ? e.price : null; };

/* A line saved before this page reads price and listPrice; a line saved by it reads unit and listUnit. */
const unitIn = (l) => (l.unit !== undefined ? l.unit : l.price);
const listIn = (l) => (l.listUnit !== undefined ? l.listUnit : l.listPrice);
export const qtyOf = (l) => { const n = Math.round(Number(l && l.qty)); return Number.isFinite(n) && n >= 1 ? Math.min(QUOTE_CAPS.qty, n) : 1; };
export const lineKey = (l) => `${l.kind || 'item'}:${l.id}`;

function validCustom(l) {
  const label = String(l.label ?? '').trim();
  if (!label || label.length > QUOTE_CAPS.label) return false;
  if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > QUOTE_CAPS.qty) return false;
  if (!isMoney(l.unit)) return false;
  if (l.cost !== undefined && l.cost !== null && !isMoney(l.cost)) return false;
  if (l.supplierUrl && !httpUrl(l.supplierUrl)) return false;
  if (l.note !== undefined && String(l.note).length > QUOTE_CAPS.lineNote) return false;
  return true;
}

/** The guard. */
export function validLine(l) {
  if (!l || typeof l !== 'object') return false;
  if (l.kind === 'custom') return validCustom(l);
  if (l.kind !== undefined && !LINE_KINDS.includes(l.kind)) return false;
  const list = listUnitOf(l.kind, l.id);
  if (list === null || Number(listIn(l)) !== list) return false;
  const unit = Number(unitIn(l));
  if (!Number.isFinite(unit) || unit < 0 || unit > QUOTE_CAPS.unit) return false;
  if (l.free && unit !== 0) return false;
  if (l.qty !== undefined && (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > QUOTE_CAPS.qty)) return false;
  if (l.kind === 'package' && l.qty !== undefined && l.qty !== 1) return false;
  return true;
}
/** At least one line, every line passes the guard, no line twice. */
export const validLines = (lines) => Array.isArray(lines) && lines.length > 0 && lines.length <= QUOTE_CAPS.lines && lines.every(validLine) && new Set(lines.map(lineKey)).size === lines.length;

/** A new line from the price list at its list price, or null when the list has no such id. */
export function listLine(kind, id) {
  const e = listEntry(kind, id);
  return e ? { kind, id: e.id, label: e.label, qty: 1, unit: e.price, listUnit: e.price, free: false } : null;
}

/** One line as the store keeps it, or null when it may not be kept. safeUrl is the caller's own (api/_lib/url.js on
 *  the server): the supplier link is the one URL on a line. A custom line that came with no id takes fallbackId. */
export function cleanLine(l, safeUrl, fallbackId = '') {
  if (!l || typeof l !== 'object') return null;
  const free = l.free === true;
  if (l.kind === 'custom') {
    const out = { kind: 'custom', id: text(l.id, 40).replace(/[^A-Za-z0-9_-]/g, '') || fallbackId, label: text(l.label, QUOTE_CAPS.label), qty: qtyOf(l), unit: Math.max(0, Math.min(QUOTE_CAPS.unit, cents(l.unit))), free };
    if (!out.label || !out.id) return null;
    if (l.cost !== undefined && l.cost !== null && l.cost !== '' && Number.isFinite(Number(l.cost))) out.cost = Math.max(0, Math.min(QUOTE_CAPS.unit, cents(l.cost)));
    const url = typeof safeUrl === 'function' ? safeUrl(l.supplierUrl, 400) : '';
    if (url) out.supplierUrl = url;
    const note = text(l.note, QUOTE_CAPS.lineNote);
    if (note) out.note = note;
    return out;
  }
  if (!['package', 'item', 'print'].includes(l.kind)) return null;
  const e = listEntry(l.kind, l.id);
  if (!e || Number(l.listUnit) !== e.price) return null;
  const unit = free ? 0 : Math.max(0, Math.min(QUOTE_CAPS.unit, cents(l.unit)));
  return { kind: l.kind, id: e.id, label: e.label, qty: l.kind === 'package' ? 1 : qtyOf(l), unit, listUnit: e.price, free };
}
/** Every line through cleanLine: { lines, refused } where refused counts the lines that may not be kept and the
 *  second copy of a line already there. The store refuses the whole save when refused is not 0. */
export function cleanLines(lines, safeUrl) {
  const out = []; const seen = new Set(); let refused = 0;
  const list = (Array.isArray(lines) ? lines : []).slice(0, QUOTE_CAPS.lines);
  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i];
    const l = cleanLine(raw, safeUrl, `line${i + 1}`);
    if (!l || seen.has(lineKey(l))) { refused += 1; continue; }
    seen.add(lineKey(l)); out.push(l);
  }
  return { lines: out, refused };
}

/* The money. Rounded to the cent line by line, so the lines always add up to the total a client reads. */
export const chargedUnit = (l) => (l.free ? 0 : cents(unitIn(l)));
export const listUnitFor = (l) => cents(l.kind === 'custom' ? unitIn(l) : listIn(l));
export const lineTotal = (l) => cents(qtyOf(l) * chargedUnit(l));
export const lineList = (l) => cents(qtyOf(l) * listUnitFor(l));
/** { total, listTotal, offList, givenFree, deposit, hasCents }: offList is the list total minus what is charged
 *  (free lines and price cuts together, never under 0), givenFree the list value of the free lines alone, deposit
 *  DEPOSIT_PCT of the total rounded up to the dollar. */
export function quoteSums(lines) {
  const ls = Array.isArray(lines) ? lines : [];
  const total = cents(ls.reduce((n, l) => n + lineTotal(l), 0));
  const listTotal = cents(ls.reduce((n, l) => n + lineList(l), 0));
  const givenFree = cents(ls.filter(l => l.free).reduce((n, l) => n + lineList(l), 0));
  const deposit = Math.ceil((Math.round(total * 100) * DEPOSIT_PCT) / 10000);
  return { total, listTotal, offList: Math.max(0, cents(listTotal - total)), givenFree, deposit, hasCents: ls.some(l => !Number.isInteger(lineTotal(l))) };
}

/** What a quote leaves on its lead's deal (deal.quote), in the shape the record and the price presenter already
 *  read: price and listPrice are for one, qty beside them; a custom line's listPrice is its own unit. */
export function dealQuoteOf(q, now = Date.now()) {
  const lines = Array.isArray(q && q.lines) ? q.lines : [];
  const s = quoteSums(lines);
  return {
    lines: lines.map(l => ({ id: l.id, label: l.label, price: chargedUnit(l), listPrice: listUnitFor(l), free: l.free === true, kind: l.kind, qty: qtyOf(l), ...(l.kind === 'custom' && l.cost !== undefined ? { cost: l.cost } : {}), ...(l.kind === 'custom' && l.supplierUrl ? { supplierUrl: l.supplierUrl } : {}), ...(l.kind === 'custom' && l.note ? { note: l.note } : {}) })),
    packageId: (lines.find(l => l.kind === 'package') || {}).id || '',
    retainerPitch: !q || q.retainerPitch !== false,
    givenFree: s.offList,
    total: s.total,
    deposit: s.deposit,
    at: new Date(now).toISOString(),
    quoteId: q && q._id ? String(q._id) : '',
    number: (q && q.number) || '',
    status: QUOTE_STATUS_IDS.includes(q && q.status) ? q.status : 'draft',
  };
}

/** A saved item (settings.quoteItems): what Rob keeps for the things he quotes again. Never in pricing.js. */
export function cleanSavedItem(it, safeUrl) {
  if (!it || typeof it !== 'object') return null;
  const out = { id: text(it.id, 40).replace(/[^A-Za-z0-9_-]/g, ''), label: text(it.label, QUOTE_CAPS.label), unit: Math.max(0, Math.min(QUOTE_CAPS.unit, cents(it.unit))) };
  if (!out.id || !out.label) return null;
  if (it.cost !== undefined && it.cost !== null && it.cost !== '' && Number.isFinite(Number(it.cost))) out.cost = Math.max(0, Math.min(QUOTE_CAPS.unit, cents(it.cost)));
  const url = typeof safeUrl === 'function' ? safeUrl(it.supplierUrl, 400) : '';
  if (url) out.supplierUrl = url;
  return out;
}
export function cleanSavedItems(items, safeUrl) {
  const out = []; const seen = new Set();
  for (const raw of Array.isArray(items) ? items : []) {
    const it = cleanSavedItem(raw, safeUrl);
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id); out.push(it);
    if (out.length >= QUOTE_CAPS.savedItems) break;
  }
  return out;
}
