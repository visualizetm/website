/* Site Prompt 3, Part 2: the marketing site's only connection to the CRM.
 * fetchShowcase() and fetchClient(slug) read /api/showcase (Site Prompt 2),
 * each cached in memory for 60 seconds so navigating between the list and a
 * few detail pages in one visit does not refetch every time. Reusable on
 * Home (Site Prompt 4) alongside ClientCard, TestimonialCard, and LogoItem,
 * exported below.
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

/** The list/preview card: displayName, type, blurb, cover with a monogram fallback. Identical markup to the old hardcoded version. */
export function ClientCard({ client }) {
  return (
    <Link to={`/clients/${client.slug}`} className="wk-card">
      <div className="wk-card-media">
        {client.cover ? (
          <img src={client.cover} alt={`${client.displayName} brand`} loading="lazy" />
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

/** One logo strip item (Site Prompt 4, Home): a client's logo with a text fallback, linking to their page. */
export function LogoItem({ client }) {
  return (
    <Link to={`/clients/${client.slug}`} className="li-item" aria-label={client.displayName}>
      {client.logo ? <img src={client.logo} alt="" loading="lazy" className="li-logo" /> : <span className="li-fallback">{client.displayName}</span>}
    </Link>
  );
}

export const testimonialCardStyles = `
  .tc-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
  .tc-stars { display: flex; gap: 2px; }
  .tc-star { color: var(--border-light); font-size: 0.9rem; }
  .tc-star.is-on { color: var(--brand); }
  .tc-quote { margin: 0; font-size: 1.0625rem; line-height: 1.6; color: var(--text); }
  .tc-attr { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; font-size: 0.875rem; color: var(--text-secondary); }
  .tc-name { font-weight: 700; color: var(--text); }
  .tc-business { color: var(--brand); text-decoration: none; }
  .tc-business:hover { text-decoration: underline; }
`;

export const logoItemStyles = `
  .li-item { display: flex; align-items: center; justify-content: center; height: 56px; padding: 0 var(--space-4); opacity: 0.7; transition: opacity 0.2s; filter: grayscale(1); }
  .li-item:hover { opacity: 1; filter: grayscale(0); }
  .li-logo { max-height: 100%; max-width: 140px; object-fit: contain; }
  .li-fallback { font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); white-space: nowrap; }
`;
