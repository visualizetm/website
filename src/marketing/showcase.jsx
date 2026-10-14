/* Site Prompt 3, Part 2: the marketing site's only connection to the CRM.
 * fetchShowcase() and fetchClient(slug) read /api/showcase (Site Prompt 2),
 * each cached in memory for 60 seconds so navigating between the list and a
 * few detail pages in one visit does not refetch every time. Reusable on
 * Home (Site Prompt 4) alongside ClientCard and TestimonialCard, exported
 * below. (LogoItem, also built here in Site Prompt 3, was retired in Site
 * Prompt 5, Part 2: Home's logo strip, Trust.jsx, needed a theme-aware
 * light/dark logo pick LogoItem never did, so it built its own markup
 * instead and LogoItem stayed unused through two prompts.)
 */
import { Link } from 'react-router-dom';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import { Parallax, ScaleIn } from './motion';
import { normalizeBrandColor } from '../shared/color';
import { safeHref } from '../lib/safeUrl';
import { logoSrc } from '../ui/logo.data';

const CACHE_MS = 60000;
let listCache = null; // { at, data: { clients, landing } }
const clientCache = new Map(); // slug -> { at, data }

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`showcase request failed (${res.status})`);
  return res.json();
}

/** { clients: [...], landing: {...} }, sorted by featured.order then updatedAt (as the endpoint returns it). */
export async function fetchShowcase({ force = false } = {}) {
  if (!force && listCache && Date.now() - listCache.at < CACHE_MS) return listCache.data;
  const data = await getJson('/api/showcase');
  listCache = { at: Date.now(), data };
  return data;
}

/** One client's full public object, or throws (a 404 from the endpoint included). */
export async function fetchClient(slug, { force = false } = {}) {
  const hit = clientCache.get(slug);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await getJson(`/api/showcase?slug=${encodeURIComponent(slug)}`);
  clientCache.set(slug, { at: Date.now(), data });
  return data;
}

/** Clears both caches; call after an admin action if a fresher read matters (not required for normal browsing). */
export function clearShowcaseCache() { listCache = null; clientCache.clear(); }

/* The width each context actually needs (the upload prompt, check 5). A
 * client's cover is one file; the hero deck wants it at 1600 and a card in
 * the list wants it at 800, and asking for the same 1600 in both is a
 * megabyte of phone data to draw a thumbnail. Named rather than passed as
 * bare numbers so a call site says what it is, not what it measured to. */
export const IMG_W = {
  heroCover: 1600,
  cardCover: 800,
  gallery: 1600,
  screenshot: 1600,
  card: 1200,
  print: 1600,
  instagramPost: 600,
  avatar: 400,
  logo: 400,
};

/* Site Prompt 4, Part 4: caps a showcase image request at `width`. A
 * Cloudinary URL gets the transform inserted after /image/upload/; any
 * other URL (a fixture, a Drive link) is returned unchanged, since there is
 * no transform endpoint to append it to. c_limit only ever scales down, so
 * a small original is never blown up. */
export function capImageWidth(url, width = IMG_W.gallery) {
  // Defensive: a record written before a shape change (brand.logo was an
  // object until Site Prompt 7) must degrade to a broken image, never take
  // the whole page down with a TypeError.
  if (!url || typeof url !== 'string') return '';
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i === -1 || !url.includes('res.cloudinary.com')) return url;
  const cut = i + marker.length;
  if (/^[a-z]_[^/]*\d+\/?/i.test(url.slice(cut))) return url; // already transformed
  return `${url.slice(0, cut)}c_limit,w_${width}/${url.slice(cut)}`;
}

/* The delivery transform (the faster landing prompt): every Cloudinary image is asked for at a width with
 * f_auto (the browser's best format) and q_auto (the quality the picture needs), on top of the bare width
 * cap above; a non Cloudinary URL (a fixture, a Drive link) passes through as capImageWidth passes it. */
export function cloudinaryUrl(url, width = IMG_W.gallery) {
  const capped = capImageWidth(url, width);
  return capped.includes('/image/upload/c_limit,w_') ? capped.replace('/image/upload/c_limit,w_', '/image/upload/f_auto,q_auto,c_limit,w_') : capped;
}
/** A srcset at each width, for a Cloudinary URL; '' for anything else (one src is all it can offer). */
export function srcSetOf(url, widths) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return '';
  if (/\/image\/upload\/[a-z]_[^/]*\d+\/?/i.test(url)) return '';
  return widths.map(w => `${cloudinaryUrl(url, w)} ${w}w`).join(', ');
}
/** The list/preview card: displayName, type, blurb, cover with a monogram
 * fallback. The cover settles in with ScaleIn wherever the card is used
 * (the light set, Site Prompt 6, Part 5); `parallax` adds a drift on top,
 * which Home and the list leave off. */
export function ClientCard({ client, parallax = false }) {
  const media = client.cover ? (
    <Pic src={client.cover} alt={`${client.displayName} brand`} w={IMG_W.cardCover} widths={[480, 800, 1200]} sizes="(max-width: 900px) 82vw, 33vw" width={800} height={500} />
  ) : (
    <span className="wk-card-mono" aria-hidden="true">
      <span className="display">{(client.displayName || '?').charAt(0)}</span>
    </span>
  );

  return (
    <Link to={`/projects/${client.slug}`} className="wk-card">
      <span className="img-fit img-fit--16x10 wk-card-media">
        <ScaleIn as="span" className="wk-card-scale">
          {parallax ? <Parallax as="span" className="wk-card-shift" factor={0.06}>{media}</Parallax> : media}
        </ScaleIn>
      </span>
      <div className="wk-card-body">
        <div className="wk-card-top">
          <h2 className="wk-card-name">{client.displayName}</h2>
          <span className="wk-card-arrow"><ArrowUpRight width={16} height={16} /></span>
        </div>
        {client.type && <span className="wk-card-tag">{client.type}</span>}
        <p className="wk-card-blurb">{client.blurb}</p>
      </div>
    </Link>
  );
}

/* One image, sized: the transform at `w`, a srcset at `widths` with `sizes`, explicit width and height so
 * nothing shifts, lazy and async below the first screen (`eager` for the one image above it). */
export function Pic({ src, alt = '', w = IMG_W.gallery, widths = null, sizes = '100vw', width, height, eager = false, className, fetchPriority }) {
  const set = widths ? srcSetOf(src, widths) : '';
  return (
    <img
      src={cloudinaryUrl(src, w)} srcSet={set || undefined} sizes={set ? sizes : undefined} alt={alt} className={className}
      width={width} height={height} loading={eager ? undefined : 'lazy'} decoding={eager ? undefined : 'async'} fetchPriority={fetchPriority || (eager ? 'high' : undefined)}
    />
  );
}

/** One testimonial: quote, author, role, stars, and the business name linking to that client. Used on the Clients page (Part 4) and reusable on Home. */
export function TestimonialCard({ testimonial }) {
  const t = testimonial;
  const brand = normalizeBrandColor(t.brandHex).hex;
  const logo = safeHref(t.logo);
  return (
    <figure className="tc-card" style={brand ? { '--tc-brand': brand } : undefined}>
      <div className="tc-top">
        {t.rating != null && (
          <div className="tc-stars" aria-label={`${t.rating} of 5 stars`}>
            {[1, 2, 3, 4, 5].map(n => <span key={n} className={`tc-star${n <= t.rating ? ' is-on' : ''}`}>&#9733;</span>)}
          </div>
        )}
        {/* The client's mark (review links): their logo on a paper panel, the brand colour as the card's seam only, never under text. */}
        {(logo || t.business) && (
          <span className={`img-fit img-fit--contain tc-mark${logo ? '' : ' tc-mark--fallback'}`} aria-hidden="true">
            {logo ? <Pic src={logo} alt="" className="tc-mark-img" w={96} width={32} height={32} /> : <img src={logoSrc('icon', 'reversed')} alt="" className="tc-mark-img tc-mark-img--icon" loading="lazy" width={32} height={32} />}
          </span>
        )}
      </div>
      <blockquote className="tc-quote">&ldquo;{t.quote}&rdquo;</blockquote>
      <figcaption className="tc-attr">
        <span className="tc-name">{t.author}</span>
        {t.role && <span className="tc-role">, {t.role}</span>}
        {t.business && t.slug ? <Link to={`/projects/${t.slug}`} className="tc-business">{t.business}</Link> : t.business ? <span className="tc-business tc-business--plain">{t.business}</span> : null}
      </figcaption>
    </figure>
  );
}

export const testimonialCardStyles = `
  .tc-card { background: var(--bg-card); border: 1px solid var(--border); border-left: 6px solid var(--tc-brand, var(--border-light)); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
  .tc-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .tc-card .tc-mark { width: 32px; height: 32px; padding: 4px; border-radius: var(--radius); background: var(--text); flex-shrink: 0; }
  .tc-card .tc-mark--fallback { background: var(--brand); padding: 6px; }
  .tc-card .tc-mark > .tc-mark-img { object-fit: contain; }
  .tc-business--plain { color: var(--text-secondary); }
  .tc-stars { display: flex; gap: 2px; }
  .tc-star { color: var(--border-light); font-size: 0.9rem; }
  .tc-star.is-on { color: var(--brand-text); }
  .tc-quote { margin: 0; font-size: 1.0625rem; line-height: 1.6; color: var(--text); }
  .tc-attr { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; font-size: 0.875rem; color: var(--text-secondary); }
  .tc-name { font-weight: 700; color: var(--text); }
  .tc-business { color: var(--brand-text); text-decoration: none; }
  .tc-business:hover { text-decoration: underline; }
`;

/* The client card (ClientCard above): one stylesheet for Home's Recent projects, the Projects list and anywhere else it renders. Flat: no outline, gradient or shadow (Brand v3). */
export const clientCardStyles = `
  .wk-card {
    display: flex; flex-direction: column;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: transform 0.25s var(--ease);
  }
  .wk-card:hover {
    transform: translateY(-4px);
  }
  @media (prefers-reduced-motion: reduce) {
    .wk-card, .wk-card:hover { transform: none; transition: border-color 0.25s; }
  }

  .wk-card-media { background: var(--surface); }
  /* The cover settles in from 8% oversized, which means the settling
     layer is briefly wider than the frame; .wk-card-media clips it, and
     the frame itself never moves. Same reason the parallax layer below
     is taller than the frame: the drift needs room inside it. */
  .wk-card-scale { display: block; width: 100%; height: 100%; }
  .wk-card-scale img { width: 100%; height: 100%; object-fit: cover; }
  .wk-card-shift { display: block; width: 100%; height: 112%; margin-top: -6%; }
  .wk-card-shift img { width: 100%; height: 100%; object-fit: cover; }
  .wk-card-mono {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-elevated);
  }
  .wk-card-mono .display {
    font-size: 5rem; color: var(--brand);
    opacity: 0.9;
  }

  .wk-card-body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-2); }
  .wk-card-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .wk-card-name { font-size: 1.125rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
  .wk-card-arrow {
    color: var(--text-muted); display: inline-flex;
    transition: color 0.2s, transform 0.25s var(--ease);
  }
  .wk-card:hover .wk-card-arrow { color: var(--brand); transform: translate(2px, -2px); }
  .wk-card-tag {
    align-self: flex-start;
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--text-secondary);
    background: var(--glass-bg); border: 1px solid var(--border);
    padding: 3px 10px; border-radius: 999px;
  }
  .wk-card-blurb { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; }

  .wk-card--skel { pointer-events: none; }
  .wk-skel { background: var(--bg-elevated); position: relative; overflow: hidden; border-radius: 6px; }
  .wk-skel::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 38%, var(--surface) 50%, transparent 62%);
    background-size: 240% 100%; animation: wkShimmer 1.4s linear infinite;
  }
  .wk-skel-line { margin-top: var(--space-1); }
  @keyframes wkShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  @media (prefers-reduced-motion: reduce) { .wk-skel::after { animation: none; } }

`;
