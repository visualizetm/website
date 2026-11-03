import { PACKAGES, CATALOG, PACKAGE_ITEMS, catalogOf, packageOf, SINGLE_CAP, DEPOSIT_PCT, retainerOf, defaultRetainer, planFor, money } from '../shared/pricing.js';
import { newInvoice } from './invoices.js';

/* The quote and the price presenter's pure logic (prompt 2 of 3, milestone 4). Every price here is read from
 * src/shared/pricing.js (a package, a catalog item, the deposit percent, a retainer); nothing is typed. A quote is
 * lines over the catalog and the packages, each line's price editable or Free, saved on the deal (deal.quote) and
 * fed to the deposit invoice and the quote email. `validQuote` is the guard: a line whose id is not in pricing.js,
 * or whose list price is not the catalog's, is refused (close-test cuts it and watches the check fail). */

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
export function validLine(l) {
  if (!l || typeof l !== 'object') return false;
  const list = listPriceOf(l.id);
  if (list === null || Number(l.listPrice) !== list) return false;
  const price = Number(l.price);
  if (!Number.isFinite(price) || price < 0) return false;
  if (l.free && price !== 0) return false;
  return true;
}
export const validQuote = (lines) => Array.isArray(lines) && lines.length > 0 && lines.every(validLine) && new Set(lines.map(l => l.id)).size === lines.length;
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
  return newInvoice({ label: 'Deposit', amount: Number(quote?.deposit) || 0, kind: 'deposit', note: `${DEPOSIT_PCT}% of ${money(quote?.total || 0)}`, items, now });
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
