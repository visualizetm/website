/* ONE source of truth for what Visualize sells: packages, retainers, add-ons,
 * prices, and the pricing rules. The Booked pricing builder (Prompt 8) and
 * the Clients screen (Prompt 10) both read this; nothing else defines a price. */

export const SINGLE_CAP = 750;              // above this a payment plan is offered
export const EXTRA_ROUND = { design: 50, web: 75 };
export const REVISION_ROUNDS = 2;

/* kind: 'design' | 'web' decides the default retainer and the extra-round price. */
export const PACKAGES = [
  { id: 'social-refresh', label: 'Social Refresh', price: 150, kind: 'design', included: ['Profile and cover graphics', 'Highlight covers', 'Three post templates', `${REVISION_ROUNDS} revision rounds`] },
  { id: 'brand-starter', label: 'Brand Starter', price: 350, kind: 'design', included: ['Logo (primary and mark)', 'Color palette and type pair', 'Mini brand sheet', `${REVISION_ROUNDS} revision rounds`] },
  { id: 'web-essentials', label: 'Web Essentials', price: 500, kind: 'web', included: ['One-page website', 'Mobile first build', 'Contact form and map', 'Google Business link-up', `${REVISION_ROUNDS} revision rounds`] },
  { id: 'brand-complete', label: 'Brand Complete', price: 600, kind: 'design', included: ['Everything in Brand Starter', 'Full brand guide', 'Social media kit', 'Business card design', `${REVISION_ROUNDS} revision rounds`] },
  { id: 'web-complete', label: 'Web Complete', price: 750, kind: 'web', included: ['Up to five pages', 'Booking or quote form', 'Basic SEO setup', 'Google Business link-up', `${REVISION_ROUNDS} revision rounds`] },
  { id: 'launch-plan', label: 'Launch Plan', price: 1200, kind: 'web', plan: { months: 6, monthly: 200 }, included: ['Brand Starter', 'Web Essentials', 'Launch social graphics', 'NFC card', `${REVISION_ROUNDS} revision rounds per piece`] },
  { id: 'build-plan', label: 'Build Plan', price: 1800, kind: 'web', plan: { months: 6, monthly: 300 }, altPlan: { months: 12, monthly: 150 }, included: ['Brand Complete', 'Web Complete', 'Online shop or booking', 'Launch social graphics', 'NFC card', `${REVISION_ROUNDS} revision rounds per piece`] },
];

/* monthly: what the Clients retainer tab counts each month (Prompt 10). */
export const RETAINERS = [
  { id: 'site-care', label: 'Site Care', price: 100, included: ['Hosting and updates', 'Monthly content edits', 'Uptime and backups'], monthly: { count: 2, unit: 'hours', label: 'Up to 2 hours of site care' } },
  { id: 'content-kit', label: 'Content Kit', price: 250, included: ['Eight posts a month', 'Story templates', 'Monthly content plan'], monthly: { count: 8, unit: 'graphics', label: '8 graphics a month' } },
  { id: 'ad-creatives', label: 'Ad Creatives', price: 350, included: ['Four ad sets a month', 'Landing page tweaks', 'Performance check-in'], monthly: { count: 10, unit: 'creatives', label: '10 ad creatives a month' } },
  { id: 'growth', label: 'Growth', price: 500, included: ['Everything in Content Kit and Site Care', 'Ad creatives', 'Quarterly strategy call'], monthly: { count: 10, unit: 'creatives', label: '10 creatives a month plus Site Care and Google Business', extras: ['Site Care', 'Google Business'] } },
];

/* freeWith: package ids that include the add-on at no charge. 'any' = any package. */
export const ADDONS = [
  { id: 'card-design', label: 'Business card design', price: 30, freeWith: ['any'] },
  { id: 'cards-250', label: 'Printed cards, 250', price: 35 },
  { id: 'cards-500', label: 'Printed cards, 500', price: 50 },
  { id: 'nfc-card', label: 'NFC card', price: 25, freeWith: ['launch-plan', 'build-plan'] },
  { id: 'stickers', label: 'Stickers', price: 40 },
  { id: 'vinyl', label: 'Vinyl decals', price: 60 },
  { id: 'rush', label: 'Rush delivery', price: 20 },
];

export const packageOf = (id) => PACKAGES.find(p => p.id === id) || null;
export const retainerOf = (id) => RETAINERS.find(r => r.id === id) || null;
export const addonOf = (id) => ADDONS.find(a => a.id === id) || null;

/** Default retainer for a package: Site Care for web packages, Content Kit otherwise. */
export const defaultRetainer = (packageId) => (packageOf(packageId)?.kind === 'web' ? 'site-care' : 'content-kit');

/** Add-ons a package gives away. */
export function gifts(packageId) {
  return ADDONS.filter(a => a.freeWith && (a.freeWith.includes('any') || a.freeWith.includes(packageId)));
}
const isGift = (addonId, packageId) => gifts(packageId).some(g => g.id === addonId);

/** Payment plan for a total. Packages that carry a plan use it; anything else over the cap
 *  is split into 6 monthly payments (12 when the total is 1500 or more). Under the cap: null. */
export function planFor(total, packageId) {
  const p = packageOf(packageId);
  if (p?.plan && total >= p.price) return { ...p.plan, alt: p.altPlan || null, total };
  if (total <= SINGLE_CAP) return null;
  const months = total >= 1500 ? 12 : 6;
  return { months, monthly: Math.ceil(total / months), alt: null, total };
}

/** Everything the option card shows for { packageId, addonIds, retainerId }. */
export function priceOption(opt) {
  const pkg = packageOf(opt.packageId);
  const addons = (opt.addonIds || []).map(addonOf).filter(Boolean);
  const paid = addons.filter(a => !isGift(a.id, opt.packageId));
  const free = [...gifts(opt.packageId), ...addons.filter(a => isGift(a.id, opt.packageId))].filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i);
  const total = (pkg?.price || 0) + paid.reduce((n, a) => n + a.price, 0);
  const plan = planFor(total, opt.packageId);
  const retainer = retainerOf(opt.retainerId || defaultRetainer(opt.packageId));
  return { pkg, addons, paid, free, total, plan, retainer, included: [...(pkg?.included || []), ...paid.map(a => a.label)] };
}

/* Where the extra revision round fee comes from for a project kind. */
export const extraRoundFee = (kind) => (kind === 'web' || kind === 'combined' ? EXTRA_ROUND.web : EXTRA_ROUND.design);

export const money = (n) => `$${Number(n || 0).toLocaleString()}`;
/** "$1,200 as $200 a month for 6 months, first payment starts the project" */
export const planLine = (plan) => (plan ? `${money(plan.total)} as ${money(plan.monthly)} a month for ${plan.months} months, first payment starts the project${plan.alt ? ` (or ${money(plan.alt.monthly)} a month for ${plan.alt.months})` : ''}` : '');
