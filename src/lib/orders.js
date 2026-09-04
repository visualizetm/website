/* Print orders (Prompt 11). Pure helpers; the screen renders and writes.
 * parseItemsString mirrors api/_lib/orders.js (serverless cannot import src/). */
import { PRINT_PRODUCTS, RUSH_FEE, TURNAROUND_DAYS, printProductOf } from '../shared/pricing';
import { PRINT_ORDER_STATUS_IDS } from '../shared/semantics';
import { dayKey, localDate, DAY, uid } from './projects';

export { uid };
export const STEPPER = ['new', 'designed', 'cut', 'packed', 'delivered'];
export const nextOrderStatus = (o) => { const i = STEPPER.indexOf(o.status); return i >= 0 && i < STEPPER.length - 1 ? STEPPER[i + 1] : null; };
export const isOpenOrder = (o) => !o.archived && o.status !== 'delivered' && o.status !== 'cancelled';

/** Line total for an item: priceTotal is already the line (qty included). */
export const lineTotal = (i) => (i.quote || i.priceTotal == null ? 0 : Number(i.priceTotal) || 0);
export const itemsTotal = (o) => (o.items || []).reduce((n, i) => n + lineTotal(i), 0);
/** Subtotal = items plus the rush line when rush is on. */
export const orderSubtotal = (o) => itemsTotal(o) + (o.rush ? RUSH_FEE : 0);
export const hasQuoteItems = (o) => (o.items || []).some(i => i.quote || i.priceTotal == null);

/** "2 x Custom stickers, 1 x NFC card" */
export function itemSummary(o) {
  const items = o.items || [];
  if (!items.length) return 'No items yet';
  const s = items.slice(0, 3).map(i => `${i.qty || 1} x ${i.name || 'item'}`).join(', ');
  return items.length > 3 ? `${s}, +${items.length - 3} more` : s;
}
export const hasStickerItems = (o) => (o.items || []).some(i => printProductOf(i.productId)?.sticker || /sticker|vinyl|decal/i.test(i.name || ''));
export const PACKAGING_STEPS = [['polyBag', 'Poly bag'], ['headerCard', 'Header card'], ['usageGuide', 'Usage guide card']];

/** Due date from the turnaround rules: 7 days, 3 with rush, from the created date. */
export const dueDateFor = (createdAt, rush) => dayKey((localDate(createdAt) || new Date()).getTime() + (rush ? TURNAROUND_DAYS.rush : TURNAROUND_DAYS.standard) * DAY);

export const customerName = (o, leads) => (o.leadId && leads?.find(l => String(l._id) === String(o.leadId))?.business) || o.customer?.name || 'Walk in';
export const customerOf = (o, leads) => { const l = o.leadId ? leads?.find(x => String(x._id) === String(o.leadId)) : null; return { name: customerName(o, leads), email: o.customer?.email || l?.email || '', phone: o.customer?.phone || l?.phone || '', lead: l || null }; };

/** A picker line from the product catalog: sizes set the price for vinyl. */
export function lineFromProduct(productId, { sizeId, qty = 1, custom } = {}) {
  if (custom) return { id: uid(), productId: '', name: custom.name || 'Custom line', label: '', qty: qty || 1, options: {}, artworkLink: '', priceTotal: custom.priceTotal == null ? null : Number(custom.priceTotal) || 0, quote: custom.priceTotal == null };
  const p = printProductOf(productId); if (!p) return null;
  const size = p.sizes ? (p.sizes.find(s => s.id === sizeId) || p.sizes[0]) : null;
  const unit = size ? size.price : p.price;
  return { id: uid(), productId: p.id, name: p.label, label: size ? size.label : '', qty, options: size ? { size: size.label } : {}, artworkLink: '', priceTotal: unit * qty, quote: false };
}
export { PRINT_PRODUCTS, RUSH_FEE };

/* ── List filters ───────────────────────────────────────────────── */
export const ORDER_FILTERS = [['all', 'All'], ...PRINT_ORDER_STATUS_IDS.map(id => [id, null]), ['rush', 'Rush'], ['week', 'Due this week']];
export function orderPasses(o, f, now = Date.now()) {
  if (f === 'all') return !o.archived;
  if (f === 'rush') return !!o.rush && isOpenOrder(o);
  if (f === 'week') { const t = localDate(o.dueAt)?.getTime(); return !!t && isOpenOrder(o) && t >= now - DAY && t <= now + 7 * DAY; }
  return o.status === f;
}
export function matchesOrder(o, q, leads) {
  const n = String(q || '').trim().toLowerCase(); if (!n) return true;
  const c = customerOf(o, leads);
  return [c.name, c.email, c.phone, o.notes, ...(o.items || []).map(i => `${i.name} ${i.label}`)].join(' ').toLowerCase().includes(n);
}

/* ── Shop-order Items string (client copy of api/_lib/orders.js) ── */
export function parseItemsString(str) {
  const out = [];
  for (const raw of String(str || '').split('|')) {
    const part = raw.trim(); if (!part) continue;
    const bits = part.split(/\s+(?:—|–|-)\s+/).map(x => x.trim());
    const name = bits[0] || part;
    const label = bits.length > 2 ? bits.slice(1, -1).join(', ') : (bits[1] || '');
    const priceText = bits.length > 1 ? bits[bits.length - 1] : '';
    const priceMatch = priceText.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
    const quote = !priceMatch || /quote/i.test(priceText);
    const priceTotal = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;
    const qtyMatch = `${label} ${bits.length <= 2 ? priceText : ''}`.match(/(?:qty|quantity|x)\s*:?\s*(\d{1,5})/i) || label.match(/^(\d{1,5})\b/);
    const qty = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : 1;
    out.push({ id: uid(), productId: '', name: name.slice(0, 160), label: label.slice(0, 200), qty, options: {}, artworkLink: '', priceTotal: quote ? null : priceTotal, quote });
  }
  return out;
}

/* ── One time localStorage import (vz_print_orders) ─────────────── */
/** Dedupe key: email plus day plus subtotal. */
export const importKey = (o) => `${String(o.customer?.email || o.email || '').trim().toLowerCase()}|${dayKey(o.createdAt || o.date || Date.now())}|${Math.round(Number(o.subtotal ?? o.estimatedSubtotal) || 0)}`;
/** A vz_print_orders entry (Prints.jsx checkout shape) as an orders document with source import. */
export function fromLocalOrder(raw) {
  const items = (raw.cartItems || []).map(c => ({
    id: uid(), productId: '', name: String(c.productName || 'Item').slice(0, 160), label: String(c.label || '').slice(0, 200),
    qty: Math.max(1, Number(String(c.vals?.qty || '').replace(/[^0-9]/g, '')) || 1),
    options: Object.fromEntries(Object.entries(c.vals || {}).filter(([k, v]) => v && k !== 'artworkFile' && k !== 'qty').map(([k, v]) => [k, String(v).slice(0, 200)])),
    artworkLink: '', priceTotal: c.priceMode === 'quote' || c.priceTotal == null ? null : Number(c.priceTotal) || 0, quote: c.priceMode === 'quote' || c.priceTotal == null,
  }));
  const createdAt = raw.date ? new Date(raw.date).toISOString() : new Date().toISOString();
  const subtotal = items.reduce((n, i) => n + lineTotal(i), 0);
  const status = ['new', 'designed', 'cut', 'packed', 'delivered', 'cancelled'].includes(raw.status) ? raw.status : (raw.status === 'completed' || raw.status === 'done' ? 'delivered' : 'new');
  return { source: 'import', status, customer: { name: String(raw.name || '').slice(0, 200), email: String(raw.email || '').slice(0, 200), phone: String(raw.phone || '').slice(0, 60) }, items, subtotal, rush: false, dueAt: dueDateFor(createdAt, false), notes: raw.summary ? `Imported from this device. ${String(raw.summary).slice(0, 500)}` : 'Imported from this device.', paid: null, importKey: '', createdAt, localId: raw.id };
}
export function readLocalOrders() {
  try { const v = JSON.parse(localStorage.getItem('vz_print_orders') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
/** Preview rows for the Settings import: which would be created and which skipped (duplicate by importKey). */
export function planImport(rawList, existing) {
  const have = new Set((existing || []).map(o => o.importKey || importKey(o)));
  const seen = new Set();
  return rawList.map(raw => { const doc = fromLocalOrder(raw); const key = importKey(doc); doc.importKey = key; const dup = have.has(key) || seen.has(key); seen.add(key); return { doc, key, skip: dup, reason: dup ? 'Already in Orders' : '' }; });
}
