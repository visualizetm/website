/* The Projects page's three spotlights (the Projects prompt). A published
 * client with showcase.featured.spotlight on is a spotlight; at most three
 * are on at once, and the empty spots are filled with the lowest
 * featured.order among the clients featured in the work row, so with
 * nothing switched on the page still opens on three real projects. The
 * CRM's toggle uses the same count: turning on a fourth asks which of the
 * three to replace. Pure: the public page passes the endpoint's clients,
 * the editor passes the CRM's leads (published ones only count). */
export const SPOTLIGHT_MAX = 3;

const orderOf = (c) => Number(c?.featured?.order) || 0;
const byOrder = (a, b) => orderOf(a) - orderOf(b);

/** The three for the page, from the public clients list: the spotlit ones by order, then the lowest ordered work clients. */
export function spotlightPicks(clients) {
  const list = (Array.isArray(clients) ? clients : []).filter(c => c && c.slug);
  const on = list.filter(c => c.featured?.spotlight).sort(byOrder).slice(0, SPOTLIGHT_MAX);
  if (on.length >= SPOTLIGHT_MAX) return on;
  const fill = list.filter(c => c.featured?.work && !on.includes(c)).sort(byOrder);
  return [...on, ...fill.slice(0, SPOTLIGHT_MAX - on.length)];
}

/** The CRM side: the published leads with the spotlight on, by order. */
export function spotlitLeads(leads) {
  return (Array.isArray(leads) ? leads : [])
    .filter(l => l && !l.deleted && l.showcase?.published && l.showcase?.featured?.spotlight)
    .sort((a, b) => (Number(a.showcase?.featured?.order) || 0) - (Number(b.showcase?.featured?.order) || 0));
}

/** Turning the spotlight on for `lead`: allowed outright under the limit; over it, the three it could replace. */
export function spotlightRoom(leads, lead) {
  const on = spotlitLeads(leads).filter(l => String(l._id) !== String(lead?._id));
  return { ok: on.length < SPOTLIGHT_MAX, replace: on.length >= SPOTLIGHT_MAX ? on : [] };
}

/** The patch that turns one lead's spotlight off (the whole featured object, the way the editor writes it). */
export const spotlightOffPatch = (lead) => ({ showcase: { ...(lead?.showcase || {}), featured: { ...(lead?.showcase?.featured || {}), spotlight: false } } });
