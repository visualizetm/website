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
