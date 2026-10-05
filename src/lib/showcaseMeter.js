/* The showcase completeness rule (UX audit, item 7): what the public page
 * will have and what it is still missing. One function, read by the editor's
 * meter and by the client record's Showcase card, so "ready" means the same
 * thing in both places. Items that are switched off do not count. */
export function completeness(sh, lead) {
  const b = sh.brand || {}; const w = sh.website || {}; const ig = sh.instagram || {}; const c = sh.cards || {}; const p = sh.print || {};
  const logo = sh.logoUrl || b.logo?.dark || b.logo?.light;
  const items = [
    { id: 'cover', label: 'Cover image', ok: !!sh.cover, block: 'fields' },
    { id: 'blurb', label: 'Blurb', ok: !!sh.blurb, block: 'fields' },
    { id: 'type', label: 'Type', ok: !!(sh.type || lead.industry), block: 'fields' },
    ...(b.enabled !== false ? [
      { id: 'logo', label: 'Logo', ok: !!logo, block: 'Brand identity' },
      { id: 'gallery', label: 'Brand images', ok: (b.images || []).length > 0, block: 'Brand identity' },
    ] : []),
    ...(w.enabled !== false ? [
      { id: 'site', label: 'Website URL', ok: !!(w.url || lead.socials?.website || lead.links?.website), block: 'Website' },
      { id: 'shots', label: 'Website screenshots', ok: (w.screenshots || []).length > 0, block: 'Website' },
    ] : []),
    ...(ig.enabled ? [
      { id: 'ig', label: 'Instagram posts', ok: (ig.posts || []).length > 0, block: 'Instagram' },
    ] : []),
    ...(c.enabled !== false ? [{ id: 'cards', label: 'Card front', ok: !!c.front, block: 'Business cards' }] : []),
    ...(p.enabled !== false ? [{ id: 'print', label: 'Print items', ok: (p.items || []).length > 0, block: 'Print and product' }] : []),
    { id: 'quote', label: 'A testimonial', ok: (lead.reviews?.testimonials || []).some(t => t.published), block: 'testimonials' },
  ];
  return { items, done: items.filter(i => i.ok).length, total: items.length };
}

/** Every distinct image the public page would show: the cover, the logo, the brand images, the website screenshots, the Instagram posts,
 * the card faces and the print items, each only while its block is on. One count, read by the Showcase card, so "images" means what the
 * page has and not just the two galleries. */
export function imageCount(sh) {
  const b = sh?.brand || {}; const w = sh?.website || {}; const ig = sh?.instagram || {}; const c = sh?.cards || {}; const p = sh?.print || {};
  const urls = [
    sh?.cover, b.logo?.dark || b.logo?.light || sh?.logoUrl,
    ...(b.enabled !== false && Array.isArray(b.images) ? b.images : []),
    ...(w.enabled !== false && Array.isArray(w.screenshots) ? w.screenshots : []),
    ...(ig.enabled && Array.isArray(ig.posts) ? ig.posts.map(x => x?.image) : []),
    ...(c.enabled !== false ? [c.front, c.back] : []),
    ...(p.enabled !== false && Array.isArray(p.items) ? p.items.map(x => x?.image) : []),
  ].map(u => (typeof u === 'string' ? u : u?.url || '').trim()).filter(Boolean);
  return new Set(urls).size;
}
