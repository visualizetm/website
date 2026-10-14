/* The Projects page's shaping (the Projects prompt), pure: what the page shows is read from the public clients
 * list (/api/showcase) and nothing else. A section counts only when it is enabled and holds a real asset; a track
 * with no real project behind it does not render; a pull quote is only ever a card the public endpoint shaped. */
import { normalizeBrandColor } from '../shared/color.js';

export const SECTION_LABELS = { brand: 'Brand', website: 'Website', cards: 'Business cards', print: 'Print', instagram: 'Social' };
export const SECTION_KEYS = Object.keys(SECTION_LABELS);

const links = (list, keys) => (Array.isArray(list) ? list : []).map(x => (typeof x === 'string' ? x : keys.map(k => x?.[k]).find(Boolean) || '')).filter(Boolean);

/** The real assets a section holds, in the order the page shows them. */
export function sectionAssets(client, key) {
  const s = client?.[key];
  if (!s) return [];
  if (key === 'brand') return [s.logo, ...links(s.images, ['link', 'image'])].filter(Boolean);
  if (key === 'website') return links(s.screenshots, ['link', 'image']);
  if (key === 'cards') return [s.front, s.back].filter(Boolean);
  if (key === 'print') return links(s.items, ['image', 'link']);
  if (key === 'instagram') return links(s.posts, ['image']);
  return [];
}

/** Enabled and holding something to look at. */
export function hasSection(client, key) {
  const s = client?.[key];
  if (!s || s.enabled === false) return false;
  return sectionAssets(client, key).length > 0;
}

/** The services a project shows, as chip labels, from its real sections. */
export const servicesOf = (client) => SECTION_KEYS.filter(k => hasSection(client, k)).map(k => SECTION_LABELS[k]);

export const TRACKS = [
  { id: 'brand', title: 'Brand', line: 'A logo and a look that hold together everywhere you put them.', sections: ['brand'] },
  { id: 'websites', title: 'Websites', line: 'Built to be opened on a phone and acted on.', sections: ['website'] },
  { id: 'print', title: 'Print', line: 'Cards, stickers and signs, the things you hand someone.', sections: ['cards', 'print'] },
  { id: 'social', title: 'Social and ads', line: 'Posts and ads that look like the brand, not like a template.', sections: ['instagram'] },
];

/** The four tracks with the projects behind each as logo chips; a track with none does not render. */
export function tracksFor(clients) {
  const picks = (Array.isArray(clients) ? clients : []).filter(c => c && c.slug);
  return TRACKS.map(t => {
    const has = (c) => t.sections.some(k => hasSection(c, k));
    const chips = picks.filter(c => has(c));
    return { ...t, chips: chips.map(c => ({ slug: c.slug, displayName: c.displayName || c.slug, logo: c.brand?.logo || '' })) };
  }).filter(t => t.chips.length > 0);
}

/** Where a chip goes: the project's spotlight on this page when it has one, else its showcase. */
export const chipHref = (slug, picks) => ((picks || []).some(p => p.slug === slug) ? `#spot-${slug}` : `/projects/${slug}`);

/** The brand colours as chips: valid hex only, no repeats, six at most; the first is the panel's ground. */
export function brandColorsOf(client) {
  const out = []; const seen = new Set();
  for (const p of (Array.isArray(client?.brand?.palette) ? client.brand.palette : [])) {
    const c = normalizeBrandColor(p && typeof p === 'object' ? p.hex : p);
    if (!c.hex || seen.has(c.hex)) continue;
    seen.add(c.hex); out.push({ name: (p && typeof p === 'object' && p.name) || '', hex: c.hex });
    if (out.length === 6) break;
  }
  return out;
}

/** One approved pull quote, or nothing: only a card the public endpoint shaped (it has a quote) can ever show. */
export function spotlightQuote(client) {
  const list = Array.isArray(client?.testimonials) ? client.testimonials : [];
  return list.find(t => t && t.quote) || null;
}

const FIT = { website: 'img-fit--16x10', cards: 'img-fit--7x4', print: 'img-fit--1x1', instagram: 'img-fit--1x1' };
/** The applications a chapter shows, each its own block: website shots, the cards, print, Instagram posts, six at most. */
export function applicationsOf(client) {
  const name = client?.displayName || 'the project';
  const out = [];
  const push = (kind, src, alt) => { if (src && out.length < 6) out.push({ kind, src, alt, fit: FIT[kind] }); };
  if (hasSection(client, 'website')) sectionAssets(client, 'website').slice(0, 2).forEach((s, i) => push('website', s, `${name} website, screen ${i + 1}`));
  if (hasSection(client, 'cards')) { push('cards', client.cards.front, `${name} business card, front`); push('cards', client.cards.back, `${name} business card, back`); }
  if (hasSection(client, 'print')) (client.print.items || []).filter(it => it?.image).slice(0, 2).forEach(it => push('print', it.image, it.label || `${name} print`));
  if (hasSection(client, 'instagram')) sectionAssets(client, 'instagram').slice(0, 3).forEach((s, i) => push('instagram', s, `${name} on Instagram, post ${i + 1}`));
  return out;
}

/** The intro's numbers, only the real ones: how many projects are published, and the years only when the landing stat is on. */
export function introNumbers(clients, stats) {
  const n = (Array.isArray(clients) ? clients : []).filter(c => c && c.slug).length;
  const out = [];
  if (n > 0) out.push({ n, label: n === 1 ? 'project' : 'projects' });
  const years = Number(stats?.years);
  if (Number.isFinite(years) && years > 0) out.push({ n: years, label: years === 1 ? 'year' : 'years' });
  return out;
}

/** Everyone I have worked with: every published client featured in the work row, in display order. */
export const everyone = (clients) => (Array.isArray(clients) ? clients : []).filter(c => c && c.slug && c.featured?.work).sort((a, b) => (Number(a.featured?.order) || 0) - (Number(b.featured?.order) || 0));
