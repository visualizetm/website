import { PACKAGES, CATALOG, PACKAGE_ITEMS, PRINT_PRODUCTS, catalogOf, packageOf, SINGLE_CAP, DEPOSIT_PCT, REVISION_ROUNDS, retainerOf, defaultRetainer, planFor, money } from '../shared/pricing.js';
import { money2 } from '../shared/format.js';
import { validLine, validLines, listEntry, listLine, lineKey, qtyOf, cents, lineTotal, lineList, chargedUnit, listUnitFor, quoteSums, dealQuoteOf, QUOTE_CAPS, QUOTE_STATUS_IDS, VALID_DAYS, CLIENT_LINE_KEYS } from '../shared/quoteLines.js';
import { newInvoice } from './invoices.js';
import { quoteRedirect } from '../shell/backTree.js';

/* The quote and the price presenter's pure logic (prompt 2 of 3, milestone 4). Every price here is read from
 * src/shared/pricing.js (a package, a catalog item, the deposit percent, a retainer); nothing is typed. A quote is
 * lines over the catalog and the packages, each line's price editable or Free, saved on the deal (deal.quote) and
 * fed to the deposit invoice and the quote email. `validQuote` is the guard: a line whose id is not in pricing.js,
 * or whose list price is not the catalog's, is refused (close-test cuts it and watches the check fail). The guard
 * itself is `validLine` in src/shared/quoteLines.js, the rules the Quotes page and its store share; the second half
 * of this file is that page's own logic. */

/* The print and a la carte items the quote builder lists first (the catalog holds the rest). */
export const PRINT_IDS = ['logo', 'logo-alt', 'card-design', 'facebook-banner', 'instagram-kit', 'stickers', 'google-business', 'one-page-site', 'vinyl', 'nfc-card'];

/** The list price pricing.js gives an id: a package's or a catalog item's; null when neither knows it. */
export function listPriceOf(id) {
  const p = packageOf(id); if (p) return p.price;
  const c = catalogOf(id); if (c) return c.price;
  return null;
}
export const labelOf = (id) => packageOf(id)?.label || catalogOf(id)?.label || id;
/** A fresh line for an id, at its list price. */
export function lineFor(id) {
  const listPrice = listPriceOf(id);
  if (listPrice === null) return null;
  return { id, label: labelOf(id), price: listPrice, listPrice, free: false, kind: packageOf(id) ? 'package' : 'item' };
}
export { validLine };
export const validQuote = validLines;
export function quoteTotals(lines) {
  const ls = (lines || []).filter(validLine);
  const total = ls.reduce((n, l) => n + (l.free ? 0 : Number(l.price)), 0);
  const givenFree = ls.reduce((n, l) => n + (l.free ? Number(l.listPrice) : Math.max(0, Number(l.listPrice) - Number(l.price))), 0);
  return { total, givenFree, deposit: Math.ceil((total * DEPOSIT_PCT) / 100), plan: planFor(total, ls.find(l => l.kind === 'package')?.id || '') };
}
export const addLine = (lines, id) => ((lines || []).some(l => l.id === id) || !lineFor(id) ? lines || [] : [...(lines || []), lineFor(id)]);
export const removeLine = (lines, id) => (lines || []).filter(l => l.id !== id);
export const toggleFree = (lines, id) => (lines || []).map(l => (l.id === id ? { ...l, free: !l.free, price: l.free ? l.listPrice : 0 } : l));
export const setPrice = (lines, id, price) => (lines || []).map(l => (l.id === id ? { ...l, price: Math.max(0, Math.round(Number(price) || 0)), free: Number(price) === 0 ? l.free : false } : l));
/** The package whose items the lines already cover (the biggest), so the builder can say "that's a Launch Plan". */
export function suggestPackageFor(lines) {
  const ids = new Set((lines || []).map(l => l.id));
  const fits = PACKAGES.filter(p => (PACKAGE_ITEMS[p.id] || []).length > 0 && PACKAGE_ITEMS[p.id].every(id => ids.has(id)));
  return fits.sort((a, b) => b.price - a.price)[0] || null;
}
/** The package the gap points at: the lead's recommended option first, then the words in what is missing. */
export function suggestPackage(lead, gap = {}) {
  const reco = (lead?.pricingOptions || []).find(o => o.recommended && packageOf(o.packageId));
  if (reco) return reco.packageId;
  const words = `${gap.missing || ''} ${(lead?.intel?.gaps || []).join(' ')}`.toLowerCase();
  const site = /site|web|page|phone|load|book|order/.test(words);
  const brand = /logo|brand|mark|look|sign|card/.test(words);
  const social = /instagram|social|post|facebook/.test(words);
  if (site && brand) return 'launch-plan';
  if (site) return 'web-essentials';
  if (brand) return 'brand-starter';
  if (social) return 'social-refresh';
  return 'web-essentials';
}
/** The ladder, highest first: Build Plan, Launch Plan, the fit package (at or under the cap), Social Refresh, then the brand review. */
export function ladderFor(fitId) {
  const ids = ['build-plan', 'launch-plan'];
  const fit = packageOf(fitId);
  if (fit && fit.price <= SINGLE_CAP && !ids.includes(fit.id)) ids.push(fit.id);
  if (!ids.includes('social-refresh')) ids.push('social-refresh');
  return [...ids.map(id => { const p = packageOf(id); const plan = planFor(p.price, p.id); return { id, label: p.label, price: p.price, line: plan ? `${p.label} is ${money(p.price)}. Most people do ${money(plan.monthly)} a month for ${plan.months} months.` : `${p.label} is ${money(p.price)}.`, fit: id === fitId }; }), { id: 'review', label: 'Brand review', price: 0, line: "Let's at least book a 30 minute brand review next week.", fit: false }];
}
/** The gap sentence: "You're here, you want to be here. The gap is X. That's Web Essentials, $500." */
export function gapSentence(gap = {}, pkgId = '') {
  const p = packageOf(pkgId);
  const now = String(gap.now || '').trim().replace(/\.$/, ''); const want = String(gap.want || '').trim().replace(/\.$/, ''); const missing = String(gap.missing || '').trim().replace(/\.$/, '');
  const a = now ? `You're here: ${now}.` : "You're here."; const b = want ? ` You want to be here: ${want}.` : ' You want to be here.';
  const c = missing ? ` The gap is ${missing.charAt(0).toLowerCase() + missing.slice(1)}.` : ' The gap is the piece that ties it together.';
  return `${a}${b}${c}${p ? ` That's ${p.label}, ${money(p.price)}.` : ''}`;
}
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][Math.min(n % 10, 4)] || 'th'}`;
/** Honest urgency: the real next open start from Settings (two builds a month). */
export function startSlotLine(nextOpenStart) {
  const m = String(nextOpenStart || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 'I take two builds a month.';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return `I take two builds a month, next open start is the ${ordinal(d.getUTCDate())}${d.getUTCMonth() !== new Date().getUTCMonth() ? ` of ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })}` : ''}.`;
}
export function retainerLine(pkgId) {
  const r = retainerOf(defaultRetainer(pkgId));
  return r ? `After launch most people keep me on for ${r.label}, ${money(r.price)} a month, so it stays fresh and the leads keep coming.` : '';
}
export const FREE_LINE = "The cards are on me since we'll keep working together.";
/** The quote the deal saves. */
export function quoteFromLines(lines, { packageId = '', retainerPitch = true } = {}, now = Date.now()) {
  const t = quoteTotals(lines);
  return { lines: (lines || []).filter(validLine).map(({ id, label, price, listPrice, free }) => ({ id, label, price, listPrice, free: !!free })), packageId: packageId || (lines || []).find(l => l.kind === 'package')?.id || suggestPackageFor(lines)?.id || '', retainerPitch: retainerPitch !== false, givenFree: t.givenFree, total: t.total, deposit: t.deposit, at: new Date(now).toISOString() };
}
/** The deposit invoice line the quote makes (the Stripe link is made when the invoice email sends, like every invoice). */
export function depositInvoice(quote, now = Date.now()) {
  const items = (quote?.lines || []).map(l => ({ label: l.label, amount: l.free ? 'Included' : Number(l.price) }));
  return newInvoice({ label: 'Deposit', amount: Number(quote?.deposit) || 0, kind: 'deposit', note: `${DEPOSIT_PCT}% of ${fmtMoney(quote?.total || 0, !Number.isInteger(Number(quote?.total) || 0))}`, items, now });
}
/** The quote email, drafted (never sent) through the custom template. */
export function quoteOverride(lead, quote, { nextOpenStart = '' } = {}) {
  const first = String(lead?.askFor || '').trim().split(/[\s,]+/)[0] || 'there';
  const pkg = packageOf(quote?.packageId);
  const lines = (quote?.lines || []).map(l => `${l.label}: ${l.free ? 'on me' : money(l.price)}`);
  const plan = planFor(quote?.total || 0, quote?.packageId || '');
  return {
    subject: `Your quote from Visualize, ${first}`,
    preheader: `${money(quote?.total || 0)}${plan ? `, or ${money(plan.monthly)} a month` : ''}. Deposit ${money(quote?.deposit || 0)} locks the start.`,
    blocks: [
      { type: 'eyebrow', text: 'Your quote' },
      { type: 'heading', text: `Here's what we talked about, ${first}` },
      { type: 'text', text: pkg ? `${pkg.label} for ${lead?.business || 'the shop'}:` : `For ${lead?.business || 'the shop'}:` },
      { type: 'text', text: lines.join('\n') },
      { type: 'text', text: `**Total ${money(quote?.total || 0)}.**${plan ? ` Or ${money(plan.monthly)} a month for ${plan.months} months.` : ''} The ${DEPOSIT_PCT}% deposit (${money(quote?.deposit || 0)}) locks the price and the start date. ${startSlotLine(nextOpenStart)}` },
      ...(quote?.retainerPitch ? [{ type: 'text', text: retainerLine(quote?.packageId) }] : []),
      { type: 'text', text: 'Reply here with any questions, or say go and I send the deposit invoice.' },
    ],
  };
}
export { money, CATALOG, PACKAGES, PACKAGE_ITEMS };

/* ── The Quotes page (/quotes, /quotes/:id) ───────────────────────────────────────────────────────────────────
 * A quote is its own document (the quotes collection, api/_routes/quotes.js) with lines from the price list at
 * Rob's price, free lines, quantities and custom lines. Everything here is pure: the picker's groups, the line
 * edits, the totals, the honest package check and the three things a client can receive (the email, the text, the
 * invoice), which read a line through clientLine and so can never carry a cost, a supplier, what is off list or
 * the private note. */
export { validLines, listEntry, listLine, lineKey, qtyOf, cents, lineTotal, lineList, chargedUnit, listUnitFor, quoteSums, dealQuoteOf, QUOTE_CAPS, QUOTE_STATUS_IDS, VALID_DAYS, CLIENT_LINE_KEYS };

/** Money the way the page shows it: cents only when a line has cents. */
export const fmtMoney = (n, hasCents = false) => (hasCents ? money2(n) : money(n));
export const QUOTE_STATUS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined' };
export const quoteStatusOf = (q) => (QUOTE_STATUS_IDS.includes(q?.status) ? q.status : 'draft');

/** Everything Rob sells, grouped the way he looks for it. A catalog print item with a twin in the print products
 *  (the same thing at the same id) is listed once, as the print product. */
export function quoteCatalog(saved = []) {
  const row = (kind, e) => ({ key: `${kind}:${e.id}`, kind, id: e.id, label: e.label, price: e.price });
  const print = PRINT_PRODUCTS.flatMap(p => (p.sizes ? p.sizes.map(s => listEntry('print', `${p.id}:${s.id}`)) : [listEntry('print', p.id)]));
  const twin = (id) => PRINT_PRODUCTS.some(p => !p.sizes && (p.id === id || p.addonId === id));
  return [
    { id: 'brand', label: 'Brand', rows: CATALOG.filter(c => c.kind === 'design').map(c => row('item', c)) },
    { id: 'web', label: 'Web', rows: CATALOG.filter(c => c.kind === 'web').map(c => row('item', c)) },
    { id: 'print', label: 'Print', rows: [...print.map(e => row('print', e)), ...CATALOG.filter(c => c.kind === 'print' && !twin(c.id)).map(c => row('item', c))] },
    { id: 'packages', label: 'Packages', rows: PACKAGES.map(p => row('package', p)) },
    { id: 'saved', label: 'Saved items', rows: (saved || []).map(s => ({ key: `saved:${s.id}`, kind: 'saved', id: s.id, label: s.label, price: s.unit, saved: s })) },
  ];
}
/** The groups with only the rows every word of the search is in; a group with none is left out. */
export function searchCatalog(groups, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return groups.filter(g => g.rows.length);
  return groups.map(g => ({ ...g, rows: g.rows.filter(r => words.every(w => `${r.label} ${g.label}`.toLowerCase().includes(w))) })).filter(g => g.rows.length);
}

const newLineId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const clampUnit = (n) => Math.max(0, Math.min(QUOTE_CAPS.unit, cents(n)));
const clampQty = (n) => { const q = Math.round(Number(n)); return Number.isFinite(q) && q >= 1 ? Math.min(QUOTE_CAPS.qty, q) : 1; };
const blank = (v) => v === undefined || v === null || v === '';
/** A custom line from what Rob typed, or null when it has no name. cost, supplierUrl and note are his only. */
export function customLine(f = {}, id = newLineId()) {
  const label = String(f.label ?? '').replace(/\s+/g, ' ').trim().slice(0, QUOTE_CAPS.label);
  if (!label) return null;
  const note = String(f.note ?? '').trim().slice(0, QUOTE_CAPS.lineNote);
  const url = String(f.supplierUrl ?? '').trim().slice(0, 400);
  return { kind: 'custom', id, label, qty: clampQty(f.qty), unit: clampUnit(f.unit), free: f.free === true, ...(blank(f.cost) || !Number.isFinite(Number(f.cost)) ? {} : { cost: clampUnit(f.cost) }), ...(/^https?:\/\/[^\s]+$/i.test(url) ? { supplierUrl: url } : {}), ...(note ? { note } : {}) };
}
/** Tap a row of the picker: a new line at its list price; a line already there gets one more (a package stays at
 *  one); a saved item becomes a custom line with its price copied, never linked. */
export function addRow(lines, row, id) {
  const ls = lines || [];
  if (!row || (ls.length >= QUOTE_CAPS.lines && !ls.some(l => lineKey(l) === row.key))) return ls;
  if (row.kind === 'saved') { const l = customLine({ label: row.saved?.label, unit: row.saved?.unit, cost: row.saved?.cost, supplierUrl: row.saved?.supplierUrl, qty: 1 }, id); return l ? [...ls, l] : ls; }
  const at = ls.findIndex(l => lineKey(l) === `${row.kind}:${row.id}`);
  if (at >= 0) return row.kind === 'package' ? ls : ls.map((l, i) => (i === at ? { ...l, qty: clampQty(qtyOf(l) + 1) } : l));
  const l = listLine(row.kind, row.id);
  return l ? [...ls, l] : ls;
}
export function addCustom(lines, fields, id) {
  const l = customLine(fields, id);
  return l && (lines || []).length < QUOTE_CAPS.lines ? [...(lines || []), l] : lines || [];
}
/** One edit to one line. Free on a price list line charges 0 and keeps the list price; off, it goes back to list.
 *  A custom line keeps its price while it is free, so what was given can be counted. A typed price ends Free. */
export function patchLine(lines, key, patch = {}) {
  return (lines || []).map((l) => {
    if (lineKey(l) !== key) return l;
    const custom = l.kind === 'custom';
    let n = { ...l };
    if (patch.qty !== undefined && l.kind !== 'package') n.qty = clampQty(patch.qty);
    if (patch.unit !== undefined) { n.unit = clampUnit(patch.unit); if (!custom) n.free = false; }
    if (patch.free !== undefined) { n.free = patch.free === true; if (!custom) n.unit = n.free ? 0 : l.free ? l.listUnit : n.unit; }
    if (custom) {
      const c = customLine({ ...n, ...['label', 'cost', 'supplierUrl', 'note'].reduce((o, k) => (patch[k] !== undefined ? { ...o, [k]: patch[k] } : o), {}) }, l.id);
      n = c ? { ...c, free: n.free } : n;
    }
    return n;
  });
}
export const dropLine = (lines, key) => (lines || []).filter(l => lineKey(l) !== key);
/** What a line is under its list price, for one line (0 for a custom line, which is its own list). */
export const lineOffList = (l) => Math.max(0, cents(lineList(l) - lineTotal(l)));
/** A line as a saved item (settings.quoteItems): the name and Rob's price for one, his cost and supplier if any. */
export function savedFromLine(l, id = newLineId()) {
  const unit = l.kind === 'custom' ? cents(l.unit) : l.free ? cents(l.listUnit) : cents(l.unit);
  return { id, label: l.label, unit, ...(l.cost !== undefined ? { cost: l.cost } : {}), ...(l.supplierUrl ? { supplierUrl: l.supplierUrl } : {}) };
}

/** The honest package check: with no package in the quote, the biggest package the lines already cover, when it
 *  costs less than those lines do. null when there is nothing to say. */
export function packageCheck(lines) {
  const ls = lines || [];
  if (ls.some(l => l.kind === 'package')) return null;
  const pkg = suggestPackageFor(ls.filter(l => l.kind === 'item' || l.kind === 'print'));
  if (!pkg) return null;
  const ids = new Set(PACKAGE_ITEMS[pkg.id]);
  const covered = ls.filter(l => l.kind !== 'custom' && ids.has(l.id));
  const cost = cents(covered.reduce((n, l) => n + lineTotal(l), 0));
  if (!(pkg.price < cost)) return null;
  const saves = cents(cost - pkg.price);
  return { id: pkg.id, label: pkg.label, price: pkg.price, cost, saves, text: `${pkg.label} covers these for ${money(pkg.price)}, ${fmtMoney(saves, !Number.isInteger(saves))} less.` };
}
/** Swap the lines a package covers for the package itself (the check's one action). */
export function swapForPackage(lines, pkgId) {
  const ids = new Set(PACKAGE_ITEMS[pkgId] || []);
  const l = listLine('package', pkgId);
  return l ? [l, ...(lines || []).filter(x => x.kind === 'custom' || !ids.has(x.id))] : lines || [];
}
/** Everything the Check step and the pinned summary show. offList and givenFree are Rob's only. */
export function quoteSummary(q) {
  const lines = q?.lines || [];
  const s = quoteSums(lines);
  const packageId = lines.find(l => l.kind === 'package')?.id || '';
  return { ...s, count: lines.length, packageId, plan: planFor(s.total, packageId), check: packageCheck(lines), validDays: validDaysOf(q) };
}
export const validDaysOf = (q) => { const n = Math.round(Number(q?.validDays)); return Number.isFinite(n) && n >= 1 ? Math.min(QUOTE_CAPS.validDays, n) : VALID_DAYS; };
/** A new quote as the editor first holds it (nothing is stored until the first change). */
export function blankQuote(lead, pkgId = '') {
  const seed = pkgId ? listLine('package', pkgId) : null;
  return { leadId: lead ? String(lead._id) : '', business: lead?.business || '', person: lead?.askFor || '', status: 'draft', lines: seed ? [seed] : [], retainerPitch: true, note: '', privateNote: '', validDays: VALID_DAYS };
}
/** What the store is sent: the fields the editor owns and nothing else. */
export const quoteBody = (q) => ({ leadId: q.leadId || '', lines: q.lines || [], retainerPitch: q.retainerPitch !== false, note: q.note || '', privateNote: q.privateNote || '', validDays: validDaysOf(q) });
/** The newest quote of a lead that is still alive, or null. */
export const newestQuoteFor = (quotes, leadId) => (quotes || []).filter(q => !q.deleted && String(q.leadId || '') === String(leadId)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
/** Where the old builder's path lands now (quoteRedirect in src/shell/backTree.js is the rule): the lead's newest quote, or a new one for that lead. */
export const quotePathFor = (leadId, quotes, pkgId = '') => quoteRedirect(`/leads/${encodeURIComponent(leadId)}/quote`, pkgId ? `?pkg=${encodeURIComponent(pkgId)}` : '', newestQuoteFor(quotes, leadId)?._id || '');
/** A draft nobody has touched: no lead, no lines, no notes. New quote opens it again instead of making another. */
export const isBlankQuote = (q) => !!q && !q.deleted && quoteStatusOf(q) === 'draft' && !q.leadId && !(q.lines || []).length && !q.note && !q.privateNote;
/** A stored quote's lines against today's price list: the list price is pricing.js's as it stands, a free line stays at 0, and a line
 *  whose id has left the list is kept as a custom line at Rob's price, so nothing he quoted is lost and the guard still passes. */
export function relistLines(lines) {
  return (lines || []).map((l) => {
    if (!l || l.kind === 'custom') return l;
    const e = listEntry(l.kind, l.id);
    if (!e) return customLine({ label: l.label, qty: qtyOf(l), unit: l.free ? l.listUnit : l.unit, free: l.free === true }, `c${String(l.id).replace(/[^A-Za-z0-9_-]/g, '')}`);
    return { ...l, id: e.id, label: e.label, qty: l.kind === 'package' ? 1 : qtyOf(l), listUnit: e.price, unit: l.free ? 0 : l.unit };
  }).filter(Boolean);
}

/* What a client receives. One line reads: the name, the quantity when it is more than one, what it costs; a free
 * line reads "on me". clientLine takes nothing else off a line. */
export function clientLine(l, hasCents = false) {
  const qty = qtyOf(l);
  return `${qty > 1 ? `${l.label} x ${qty}` : l.label}: ${l.free ? 'on me' : fmtMoney(lineTotal(l), hasCents)}`;
}
const firstName = (lead, q) => String(lead?.askFor || q?.person || '').trim().split(/[\s,]+/)[0] || 'there';
const termsLine = (q) => `${REVISION_ROUNDS} revision rounds are included. This quote is good for ${validDaysOf(q)} days.`;
const moneyLine = (s, nextOpenStart) => `Total ${fmtMoney(s.total, s.hasCents)}.${s.plan ? ` Or ${money(s.plan.monthly)} a month for ${s.plan.months} months.` : ''} The ${DEPOSIT_PCT}% deposit (${money(s.deposit)}) locks the price and the start date. ${startSlotLine(nextOpenStart)}`;
/** Copy as text: the quote as Rob would text it. */
export function quoteText(q, lead, { nextOpenStart = '' } = {}) {
  const s = quoteSummary(q);
  const note = String(q?.note || '').trim();
  return [
    `Hi ${firstName(lead, q)}, here's your quote${q?.number ? ` (${q.number})` : ''} for ${q?.business || lead?.business || 'the shop'}:`,
    '',
    ...(q?.lines || []).map(l => clientLine(l, s.hasCents)),
    '',
    moneyLine(s, nextOpenStart),
    termsLine(q),
    ...(note ? [note] : []),
    ...(q?.retainerPitch !== false && retainerLine(s.packageId) ? [retainerLine(s.packageId)] : []),
    'Any questions, text me back. Say go and I send the deposit invoice.',
  ].join('\n');
}
/** The quote email, drafted (never sent) through the custom template, in Rob's voice. */
export function quoteEmail(lead, q, { nextOpenStart = '' } = {}) {
  const s = quoteSummary(q);
  const first = firstName(lead, q);
  const note = String(q?.note || '').trim();
  return {
    subject: `Your quote from Visualize, ${first}`,
    preheader: `${fmtMoney(s.total, s.hasCents)}${s.plan ? `, or ${money(s.plan.monthly)} a month` : ''}. Deposit ${money(s.deposit)} locks the start.`,
    blocks: [
      { type: 'eyebrow', text: q?.number ? `Quote ${q.number}` : 'Your quote' },
      { type: 'heading', text: `Here's your quote, ${first}` },
      { type: 'text', text: `For ${q?.business || lead?.business || 'the shop'}:` },
      { type: 'text', text: (q?.lines || []).map(l => clientLine(l, s.hasCents)).join('\n') },
      { type: 'text', text: `**${moneyLine(s, nextOpenStart).replace('. ', '.** ')}` },
      { type: 'text', text: termsLine(q) },
      ...(note ? [{ type: 'text', text: note }] : []),
      ...(q?.retainerPitch !== false && retainerLine(s.packageId) ? [{ type: 'text', text: retainerLine(s.packageId) }] : []),
      { type: 'text', text: 'Reply here with any questions, or say go and I send the deposit invoice.' },
    ],
  };
}
/** The deposit invoice a quote makes: depositInvoice over what the client reads of each line. */
export function quoteInvoice(q, now = Date.now()) {
  const s = quoteSums(q?.lines);
  return depositInvoice({ lines: (q?.lines || []).map(l => ({ label: qtyOf(l) > 1 ? `${l.label} x ${qtyOf(l)}` : l.label, price: lineTotal(l), free: l.free === true })), total: s.total, deposit: s.deposit }, now);
}
/** The list's rows, search and chips. */
export function quoteRows(quotes, { query = '', status = 'all' } = {}) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const alive = (quotes || []).filter(q => !q.deleted);
  const hit = alive.filter(q => words.every(w => `${q.business || ''} ${q.person || ''} ${q.number || ''}`.toLowerCase().includes(w)));
  const counts = { all: hit.length, ...Object.fromEntries(QUOTE_STATUS_IDS.map(id => [id, hit.filter(q => quoteStatusOf(q) === id).length])) };
  const rows = hit.filter(q => status === 'all' || quoteStatusOf(q) === status).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  return { rows, counts, total: alive.length };
}
