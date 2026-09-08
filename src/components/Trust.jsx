import { Link } from 'react-router-dom';
import { Marquee, Tone } from '../marketing/motion';
import { capImageWidth, IMG_W } from '../marketing/showcase';

/* Site Prompt 4, Part 1.2, restaged by Site Prompt 6, Part 2.2: the logo
 * strip, unchanged in data, now sitting on Home's first Tone shift so the
 * page lifts off the brand black here instead of meeting a hard edge.
 * Site Prompt 7, Part 5: the endpoint serves one logo string now that the
 * site is dark only, so there is no theme-correct pick left to make. clients is the full published
 * list (from the same one fetchShowcase() call Home makes), filtered here
 * to featured.logoStrip and ordered by featured.order. */
export default function Trust({ clients }) {
  const strip = (clients || [])
    .filter(c => c.featured?.logoStrip)
    .sort((a, b) => (a.featured?.order || 0) - (b.featured?.order || 0));

  if (!strip.length) return null;

  return (
    <Tone as="section" className="trust" from="var(--bg)" to="var(--bg-elevated)">
      <p className="trust-label">Trusted by local businesses</p>
      <Marquee duration={36}>
        {strip.map((c) => {
          const logo = c.brand?.logo || '';
          return (
            <Link key={c.slug} to={`/clients/${c.slug}`} className="trust-logo" aria-label={c.displayName}>
              {logo ? (
                <span className="img-fit img-fit--contain trust-logo-box">
                  <img src={capImageWidth(logo, IMG_W.logo)} alt="" loading="lazy" width={140} height={56} />
                </span>
              ) : (
                <span className="trust-logo-fallback">{c.displayName}</span>
              )}
            </Link>
          );
        })}
      </Marquee>
      <style>{`
        .trust { padding: var(--space-10) 0; }
        .trust-label {
          font-size: 0.8125rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.1em; color: var(--text-muted);
          text-align: center; margin-bottom: var(--space-6);
        }
        .trust-logo {
          display: flex; align-items: center; justify-content: center;
          height: 56px; padding: 0 var(--space-6);
          filter: grayscale(1); opacity: 0.65;
          transition: opacity 0.2s, filter 0.2s;
        }
        .trust-logo:hover { filter: grayscale(0); opacity: 1; }
        .trust-logo-box { width: 140px; height: 56px; }
        .trust-logo-fallback { font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); white-space: nowrap; }
      `}</style>
    </Tone>
  );
}
