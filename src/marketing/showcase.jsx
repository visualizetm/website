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

/* Site Prompt 4, Part 4: caps a showcase image request at 1600 wide. A
 * Cloudinary URL gets the width transform inserted after /upload/; any
 * other URL (a fixture, a Drive link) is returned unchanged, since there is
 * no transform endpoint to append it to. */
export function capImageWidth(url, width = 1600) {
  if (!url) return url;
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i === -1 || !url.includes('res.cloudinary.com')) return url;
  const cut = i + marker.length;
  if (/^[a-z]_[^/]*\d+\/?/i.test(url.slice(cut))) return url; // already transformed
  return `${url.slice(0, cut)}w_${width},c_limit/${url.slice(cut)}`;
}

/** The list/preview card: displayName, type, blurb, cover with a monogram fallback. Identical markup to the old hardcoded version. */
export function ClientCard({ client }) {
  return (
    <Link to={`/clients/${client.slug}`} className="wk-card">
      <div className="wk-card-media">
        {client.cover ? (
          <img src={capImageWidth(client.cover)} alt={`${client.displayName} brand`} loading="lazy" width={800} height={500} />
        ) : (
          <div className="wk-card-mono" aria-hidden="true">
            <span className="display">{(client.displayName || '?').charAt(0)}</span>
          </div>
        )}
      </div>
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

/** One testimonial: quote, author, role, stars, and the business name linking to that client. Used on the Clients page (Part 4) and reusable on Home. */
export function TestimonialCard({ testimonial }) {
  const t = testimonial;
  return (
    <figure className="tc-card">
      {t.rating != null && (
        <div className="tc-stars" aria-label={`${t.rating} of 5 stars`}>
          {[1, 2, 3, 4, 5].map(n => <span key={n} className={`tc-star${n <= t.rating ? ' is-on' : ''}`}>&#9733;</span>)}
        </div>
      )}
      <blockquote className="tc-quote">&ldquo;{t.quote}&rdquo;</blockquote>
      <figcaption className="tc-attr">
        <span className="tc-name">{t.author}</span>
        {t.role && <span className="tc-role">, {t.role}</span>}
        {t.business && t.slug && <Link to={`/clients/${t.slug}`} className="tc-business">{t.business}</Link>}
      </figcaption>
    </figure>
  );
}

export const testimonialCardStyles = `
  .tc-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
  .tc-stars { display: flex; gap: 2px; }
  .tc-star { color: var(--border-light); font-size: 0.9rem; }
  .tc-star.is-on { color: var(--brand-text); }
  .tc-quote { margin: 0; font-size: 1.0625rem; line-height: 1.6; color: var(--text); }
  .tc-attr { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; font-size: 0.875rem; color: var(--text-secondary); }
  .tc-name { font-weight: 700; color: var(--text); }
  .tc-business { color: var(--brand-text); text-decoration: none; }
  .tc-business:hover { text-decoration: underline; }
`;
