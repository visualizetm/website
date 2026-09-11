/* GET /api/showcase (Site Prompt 2). Public, no auth, GET only. Serves only
 * clients with showcase.published true, and only the fields whitelisted
 * below; nothing private (phone, email, contact names, pricing, purchases,
 * projects, callLog, notes) ever leaves this file. Same origin only: no
 * Access-Control-Allow-Origin header is set, so only the marketing site's
 * own same-origin fetch can read the response; a cross-origin fetch is
 * blocked by the browser's default CORS policy.
 *
 * /api/showcase           -> { clients: [...], landing: {...} }
 * /api/showcase?slug=x    -> one client's full object, or 404
 *
 * brand.palette and brand.typography are never stored on showcase.brand;
 * they are read from the lead's own top-level brand block at serve time
 * (never duplicated into a second, driftable copy).
 */
import { getDb } from './_lib/mongo.js';

const strOrNull = (v) => (v ? String(v) : null);
// Mirror of src/lib/socials.js instagramHandle(): the handle inside an Instagram URL, or ''.
const igHandle = (url) => { const m = String(url || '').match(/instagram\.com\/([A-Za-z0-9._]+)/i); return m ? m[1].replace(/^@+/, '') : ''; };

function paletteOf(brand) {
  const b = brand || {};
  const out = [];
  if (b.primary) out.push({ name: 'Primary', hex: b.primary });
  (Array.isArray(b.colors) ? b.colors : []).forEach((hex, i) => { if (hex) out.push({ name: `Accent ${i + 1}`, hex }); });
  return out;
}
function typographyOf(brand) {
  const b = brand || {};
  return [
    b.fontDisplay ? { family: b.fontDisplay, role: 'Display' } : null,
    b.fontBody ? { family: b.fontBody, role: 'Body' } : null,
  ].filter(Boolean);
}

function publicTestimonials(list) {
  return (Array.isArray(list) ? list : [])
    .filter(t => t?.published)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(t => ({ quote: t.quote || '', author: t.author || '', role: t.role || '', rating: t.rating ?? null, source: t.source || 'text' }));
}

function publicSocials(socials) {
  const s = socials || {};
  return { instagram: strOrNull(s.instagram), facebook: strOrNull(s.facebook), website: strOrNull(s.website) };
}

// The exact, whitelisted shape of one client in the public response. Adding
// a field here means adding it to the node test's whitelist assertion too.
function publicClient(lead) {
  const sh = lead.showcase || {};
  return {
    slug: sh.slug || '',
    displayName: sh.displayName || lead.business || '',
    type: sh.type || lead.industry || '',
    blurb: sh.blurb || '',
    cover: sh.cover || '',
    year: sh.year || '',
    brand: {
      enabled: sh.brand?.enabled !== false,
      /* Site Prompt 7, Part 5: one logo string, not a light/dark pair, now
       * that the public site is dark only. Records written before the
       * editor changed still carry the pair, so they migrate at read: dark
       * first, then light, then the single field the editor writes (which
       * blanks the pair, so it wins for anything saved since). */
      logo: sh.brand?.logo?.dark || sh.brand?.logo?.light || sh.logoUrl || '',
      palette: paletteOf(lead.brand),
      typography: typographyOf(lead.brand),
      images: Array.isArray(sh.brand?.images) ? sh.brand.images : [],
      notes: sh.brand?.notes || '',
    },
    website: {
      enabled: sh.website?.enabled !== false,
      /* UX audit, D3: the lead's own socials.website is the source; a
       * showcase URL is an override a record may still hold. */
      url: sh.website?.url || lead.socials?.website || lead.links?.website || '',
      screenshots: Array.isArray(sh.website?.screenshots) ? sh.website.screenshots : [],
      notes: sh.website?.notes || '',
    },
    // Site Prompt 7, Part 2. Hidden by the page unless enabled and there is
    // something to show; the url falls back to the lead's own socials entry.
    instagram: {
      enabled: !!sh.instagram?.enabled,
      /* UX audit, D4: the URL is the lead's socials.instagram unless the
       * showcase holds its own, and the handle is parsed out of whichever
       * URL wins unless one was typed. */
      handle: (sh.instagram?.handle || igHandle(sh.instagram?.url || lead.socials?.instagram)).replace(/^@+/, ''),
      url: sh.instagram?.url || lead.socials?.instagram || '',
      profileImage: sh.instagram?.profileImage || '',
      posts: Array.isArray(sh.instagram?.posts) ? sh.instagram.posts.slice(0, 9) : [],
      // Story highlights, the row of circles above the post grid.
      highlights: Array.isArray(sh.instagram?.highlights) ? sh.instagram.highlights.slice(0, 10) : [],
      notes: sh.instagram?.notes || '',
    },
    cards: {
      enabled: sh.cards?.enabled !== false,
      front: sh.cards?.front || '', back: sh.cards?.back || '',
      notes: sh.cards?.notes || '',
    },
    print: {
      enabled: sh.print?.enabled !== false,
      items: Array.isArray(sh.print?.items) ? sh.print.items : [],
      notes: sh.print?.notes || '',
    },
    featured: {
      landing: !!sh.featured?.landing, logoStrip: !!sh.featured?.logoStrip, work: !!sh.featured?.work,
      order: Number(sh.featured?.order) || 0,
    },
    testimonials: publicTestimonials(lead.reviews?.testimonials),
    socials: publicSocials(lead.socials),
    /* The review prompt: the client's own Google review link, so /review/<slug>
     * can offer "Leave one on Google too" after a four or five star review.
     * It is a link meant to be handed to that business's customers, which is
     * the only reason it is public; nothing else from reviews is. */
    googleReview: strOrNull(lead.reviews?.googleLink) || '',
  };
}

function sortClients(leads) {
  return [...leads].sort((a, b) => {
    const ao = Number(a.showcase?.featured?.order) || 0;
    const bo = Number(b.showcase?.featured?.order) || 0;
    if (ao !== bo) return ao - bo;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

async function computeStats(db, published) {
  const [landingDoc, projectsDelivered, ratings] = await Promise.all([
    db.collection('settings').findOne({ _id: 'landing' }),
    db.collection('projects').countDocuments({ stage: 'delivered' }),
    db.collection('call_leads').aggregate([
      { $unwind: '$reviews.testimonials' },
      { $match: { 'reviews.testimonials.published': true, 'reviews.testimonials.rating': { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$reviews.testimonials.rating' }, n: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const clientsServed = await db.collection('call_leads').countDocuments({ stage: 'client' });
  const clientSinceYears = published
    .map(l => l.clientSince && new Date(l.clientSince).getFullYear())
    .filter(y => Number.isFinite(y));
  const years = clientSinceYears.length ? Math.max(1, new Date().getFullYear() - Math.min(...clientSinceYears)) : 1;
  const toggles = landingDoc?.stats?.toggles || {};
  const overrides = landingDoc?.stats?.overrides || {};
  const live = {
    clientsServed,
    projectsDelivered,
    averageRating: ratings[0]?.n ? Math.round(ratings[0].avg * 10) / 10 : null,
    years,
  };
  const out = {};
  for (const key of ['clientsServed', 'projectsDelivered', 'averageRating', 'years']) {
    if (toggles[key] === false) continue;
    out[key] = Number.isFinite(Number(overrides[key])) ? Number(overrides[key]) : live[key];
  }
  return out;
}

async function buildLanding(db, published) {
  const logoStrip = published
    .filter(l => l.showcase?.featured?.logoStrip)
    .sort((a, b) => (Number(a.showcase?.featured?.order) || 0) - (Number(b.showcase?.featured?.order) || 0))
    .map(l => ({ slug: l.showcase.slug, displayName: l.showcase.displayName || l.business, logo: l.showcase?.brand?.logo?.dark || l.showcase?.brand?.logo?.light || l.showcase?.logoUrl || '' }));

  const work = published
    .filter(l => l.showcase?.featured?.work)
    .sort((a, b) => (Number(a.showcase?.featured?.order) || 0) - (Number(b.showcase?.featured?.order) || 0))
    .slice(0, 6)
    .map(l => ({ slug: l.showcase.slug, displayName: l.showcase.displayName || l.business, type: l.showcase.type || l.industry || '', blurb: l.showcase.blurb || '', cover: l.showcase.cover || '' }));

  const testimonials = [];
  for (const l of published) {
    for (const t of (l.reviews?.testimonials || [])) {
      if (t.published && t.featured) testimonials.push({ quote: t.quote || '', author: t.author || '', role: t.role || '', rating: t.rating ?? null, business: l.showcase.displayName || l.business, slug: l.showcase.slug, order: Number(t.order) || 0 });
    }
  }
  testimonials.sort((a, b) => a.order - b.order);
  const testimonialsOut = testimonials.slice(0, 6).map(({ order, ...t }) => t);

  // Fallback: nothing featured shows the newest published clients instead.
  const fallbackWork = work.length ? work : sortClients(published).slice(0, 6)
    .map(l => ({ slug: l.showcase.slug, displayName: l.showcase.displayName || l.business, type: l.showcase.type || l.industry || '', blurb: l.showcase.blurb || '', cover: l.showcase.cover || '' }));

  return {
    logoStrip,
    work: fallbackWork,
    testimonials: testimonialsOut,
    stats: await computeStats(db, published),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    const db = await getDb();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    const slug = typeof req.query?.slug === 'string' ? req.query.slug : '';
    if (slug) {
      const lead = await db.collection('call_leads').findOne({ 'showcase.published': true, 'showcase.slug': slug });
      if (!lead) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(publicClient(lead));
    }

    const published = await db.collection('call_leads').find({ 'showcase.published': true }).toArray();
    const sorted = sortClients(published);
    const [clients, landing] = await Promise.all([
      Promise.resolve(sorted.map(publicClient)),
      buildLanding(db, published),
    ]);
    return res.status(200).json({ clients, landing });
  } catch (err) {
    console.error('[api] GET /api/showcase', err?.stack || err);
    return res.status(500).json({ error: 'server error' });
  }
}
