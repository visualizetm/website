import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import Palette from '@untitled-ui/icons-react/build/esm/Palette';
import Globe01 from '@untitled-ui/icons-react/build/esm/Globe01';
import CreditCard02 from '@untitled-ui/icons-react/build/esm/CreditCard02';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import Star01 from '@untitled-ui/icons-react/build/esm/Star01';
import { fetchShowcase, fetchClient, TestimonialCard, testimonialCardStyles } from '../marketing/showcase';
import { Reveal, Stagger, Parallax, ScaleIn, Tone } from '../marketing/motion';
import { useTheme } from '../marketing/useTheme';
import { useHead } from '../marketing/useHead';

// Labeled placeholder for any image slot the client's showcase leaves empty.
function Slot({ label, ratio = '16 / 10', children }) {
  return (
    <div className="cs-slot" style={{ aspectRatio: ratio }}>
      {children || <span className="cs-slot-label">{label}</span>}
    </div>
  );
}

function Media({ src, alt, label, ratio }) {
  return (
    <Slot label={label} ratio={ratio}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : null}
    </Slot>
  );
}

function SectionHead({ icon: IconEl, title }) {
  return (
    <div className="cs-sec-head">
      <span className="cs-sec-icon"><IconEl width={17} height={17} /></span>
      <h2 className="cs-sec-title display">{title}</h2>
    </div>
  );
}

/* Sets document.title, the meta description, and og:image for this client.
 * No prerender step exists in this build (see reports/SITE-03-REPORT.md,
 * "SEO approach"), so these land after the JS runs, not in the initial HTML
 * a crawler or a link-preview fetch sees; that gap is Site Prompt 5's to close. */
const hasBrand = (b) => !!(b?.logo?.light || b?.logo?.dark || b?.palette?.length || b?.typography?.length || b?.images?.length || b?.notes);
const hasWebsite = (w) => !!(w?.url || w?.screenshots?.length || w?.notes);
const hasCards = (c) => !!(c?.front || c?.back || c?.notes);
const hasPrint = (p) => !!(p?.items?.length || p?.notes);

// Untitled UI's free icon set has no brand marks (Instagram, Facebook), so
// every social link uses the same generic external-link glyph; the platform
// name still reads via aria-label and the link text itself is the URL host.

export default function CaseStudy() {
  const { slug } = useParams();
  const theme = useTheme();
  const [state, setState] = useState({ status: 'loading', client: null, neighbors: null });

  const load = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const [client, { clients }] = await Promise.all([fetchClient(slug), fetchShowcase()]);
      const i = clients.findIndex(c => c.slug === slug);
      const neighbors = i === -1 ? null : { prev: clients[(i - 1 + clients.length) % clients.length], next: clients[(i + 1) % clients.length] };
      setState({ status: 'ready', client, neighbors: clients.length > 1 ? neighbors : null });
    } catch {
      setState({ status: 'error', client: null, neighbors: null });
    }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const readyClient = state.status === 'ready' ? state.client : null;
  useHead(readyClient ? {
    title: `${readyClient.displayName} | Visualize.`,
    description: readyClient.blurb || '',
    ogImage: readyClient.cover || undefined,
  } : {});

  if (state.status === 'loading') {
    return (
      <div className="cs-loading" aria-busy="true">
        <div className="wrap"><div className="cs-skel" style={{ width: '40%', height: 48 }} /><div className="cs-skel" style={{ width: '70%', height: 20, marginTop: 16 }} /></div>
        <style>{csStyles}</style>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="cs-loading">
        <div className="wrap">
          <p className="wk-state-title">Could not load this client.</p>
          <button type="button" className="btn btn-secondary" onClick={load}>Retry</button>
        </div>
        <style>{csStyles}</style>
      </div>
    );
  }
  const client = state.client;
  if (!client || !client.slug) return <Navigate to="/clients" replace />;

  const { brand, website, cards, print, testimonials, socials, neighbors } = { ...client, neighbors: state.neighbors };
  const showBrand = brand?.enabled && hasBrand(brand);
  const showWebsite = website?.enabled && hasWebsite(website);
  const showCards = cards?.enabled && hasCards(cards);
  const showPrint = print?.enabled && hasPrint(print);
  const logoSrc = theme === 'light' ? (brand?.logo?.light || brand?.logo?.dark) : (brand?.logo?.dark || brand?.logo?.light);
  const socialEntries = Object.entries(socials || {}).filter(([, url]) => url);

  return (
    <>
      <article className="cs-page">
        {/* Header */}
        <header className="cs-hero">
          <div className="wrap">
            <Link to="/clients" className="cs-back">
              <ArrowLeft width={15} height={15} />
              All work
            </Link>
            <div className="cs-hero-meta">
              {client.type && <span className="wk-card-tag">{client.type}</span>}
              {client.year && <span className="cs-year">{client.year}</span>}
            </div>
            <Reveal as="h1" className="cs-title display">{client.displayName}</Reveal>
            <Reveal as="p" delay={60} className="section-subtitle">{client.blurb}</Reveal>
            {socialEntries.length > 0 && (
              <div className="cs-socials">
                {socialEntries.map(([key, url]) => (
                  <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="cs-social" aria-label={key}><ArrowUpRight width={16} height={16} /></a>
                ))}
              </div>
            )}
          </div>
        </header>

        {client.cover && (
          <div className="cs-cover">
            <ScaleIn as="div" className="cs-cover-scale">
              <Parallax className="cs-cover-inner"><img src={client.cover} alt={`${client.displayName} cover`} loading="lazy" /></Parallax>
            </ScaleIn>
          </div>
        )}

        <div className="wrap cs-body">
          {/* Brand Identity */}
          {showBrand && (
            <Reveal as="section" className="cs-section">
              <SectionHead icon={Palette} title="Brand Identity" />
              <div className="cs-brand-grid">
                <Media src={logoSrc} alt={`${client.displayName} logo`} label="Logo" ratio="4 / 3" />
                <div className="cs-brand-side">
                  {brand.palette?.length > 0 && (
                    <div className="cs-palette">
                      {brand.palette.map((c, i) => (
                        <div key={c.hex + i} className="cs-swatch">
                          <span className="cs-swatch-chip" style={{ background: c.hex }} />
                          <span className="cs-swatch-name">{c.name}</span>
                          <span className="cs-swatch-hex">{c.hex}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {brand.typography?.length > 0 && (
                    <div className="cs-type-list">
                      {brand.typography.map((t, i) => (
                        <div key={t.family + i} className="cs-type-row">
                          <span className="cs-type-family">{t.family}</span>
                          <span className="cs-type-role">{t.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {brand.images?.length > 0 && (
                <div className="cs-media-grid">
                  {brand.images.map((img, i) => (
                    <Media key={img.link + i} src={img.link} alt={img.caption || `${client.displayName} brand`} label="Brand" />
                  ))}
                </div>
              )}
              {brand.notes && <p className="cs-notes">{brand.notes}</p>}
            </Reveal>
          )}

          {/* Website */}
          {showWebsite && (
            <Reveal as="section" className="cs-section">
              <SectionHead icon={Globe01} title="Website" />
              <div className="cs-browser">
                <div className="cs-browser-bar"><span /><span /><span /></div>
                {website.screenshots?.length > 0 ? (
                  website.screenshots.map((s, i) => (
                    <img key={s.link + i} src={s.link} alt={s.caption || `${client.displayName} website`} loading="lazy" className="cs-browser-shot" />
                  ))
                ) : (
                  <Slot label="Website screenshot" ratio="16 / 9" />
                )}
              </div>
              <div className="cs-sec-foot">
                {website.notes && <p className="cs-notes">{website.notes}</p>}
                {website.url && (
                  <a href={website.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary cs-live-btn">
                    Visit live site <ArrowUpRight width={15} height={15} />
                  </a>
                )}
              </div>
            </Reveal>
          )}

          {/* Business Cards */}
          {showCards && (
            <Reveal as="section" className="cs-section">
              <SectionHead icon={CreditCard02} title="Business Cards" />
              <div className="cs-cards-grid">
                <Media src={cards.front} alt={`${client.displayName} card front`} label="Card front" ratio="7 / 4" />
                <Media src={cards.back} alt={`${client.displayName} card back`} label="Card back" ratio="7 / 4" />
              </div>
              {cards.notes && <p className="cs-notes">{cards.notes}</p>}
            </Reveal>
          )}

          {/* Print & Product */}
          {showPrint && (
            <Reveal as="section" className="cs-section">
              <SectionHead icon={Package} title="Print & Product" />
              <div className="cs-media-grid">
                {(print.items || []).map((item, i) => (
                  <figure key={item.label + i} className="cs-print-item">
                    <Media src={item.image} alt={item.label} label={item.label} />
                    <figcaption className="cs-print-caption">{item.label}</figcaption>
                  </figure>
                ))}
              </div>
              {print.notes && <p className="cs-notes">{print.notes}</p>}
            </Reveal>
          )}

          {/* Testimonial(s), and the page's one Tone shift (Site Prompt 6, Part 5) */}
          {testimonials?.length > 0 && (
            <Tone as="section" className="cs-section cs-testimonials" from="var(--bg)" to="var(--bg-elevated)">
              <SectionHead icon={Star01} title="What they said" />
              {testimonials.length === 1 ? (
                <TestimonialCard testimonial={testimonials[0]} />
              ) : (
                <Stagger className="cs-testimonials-grid">
                  {testimonials.map((t, i) => <TestimonialCard key={i} testimonial={{ ...t, business: null }} />)}
                </Stagger>
              )}
            </Tone>
          )}

          {/* Start your own */}
          <Reveal as="section" className="cs-cta">
            <h2 className="cs-cta-title display">Start your own</h2>
            <p className="cs-cta-sub">Same process, your business. Tell me what we're building.</p>
            <Link to="/start" className="btn btn-primary cs-cta-btn">
              Start a Project <ArrowRight width={16} height={16} />
            </Link>
          </Reveal>

          {/* Previous / next */}
          {neighbors && (
            <nav className="cs-neighbors" aria-label="Other clients">
              <Link to={`/clients/${neighbors.prev.slug}`} className="cs-neighbor cs-neighbor--prev">
                <ArrowLeft width={16} height={16} />
                <span><span className="cs-neighbor-label">Previous</span>{neighbors.prev.displayName}</span>
              </Link>
              <Link to={`/clients/${neighbors.next.slug}`} className="cs-neighbor cs-neighbor--next">
                <span><span className="cs-neighbor-label">Next</span>{neighbors.next.displayName}</span>
                <ArrowRight width={16} height={16} />
              </Link>
            </nav>
          )}
        </div>
      </article>

      <style>{csStyles + testimonialCardStyles}</style>
    </>
  );
}

const csStyles = `
  .cs-loading { min-height: 60vh; display: flex; align-items: center; padding: var(--space-16) 0; }
  .cs-skel { background: var(--bg-elevated); border-radius: 8px; position: relative; overflow: hidden; }
  .cs-skel::after { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 38%, var(--surface) 50%, transparent 62%); background-size: 240% 100%; animation: csShimmer 1.4s linear infinite; }
  @keyframes csShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  @media (prefers-reduced-motion: reduce) { .cs-skel::after { animation: none; } }

  .cs-hero {
    padding: var(--space-16) 0 var(--space-12);
    border-bottom: 1px solid var(--border);
    background: var(--bg-deep);
  }
  .cs-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.84rem; font-weight: 600; color: var(--text-muted);
    margin-bottom: var(--space-8); transition: color 0.2s;
    min-height: 44px;
  }
  .cs-back:hover { color: var(--text); }
  .cs-hero-meta { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
  .cs-year { font-size: 0.8rem; color: var(--text-muted); }
  .cs-title {
    font-size: clamp(3rem, 8vw, 5.5rem);
    color: var(--text);
    margin-bottom: var(--space-4);
  }
  .cs-socials { display: flex; gap: var(--space-2); margin-top: var(--space-5); }
  .cs-social {
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; border-radius: 999px;
    background: var(--glass-bg); border: 1px solid var(--border);
    color: var(--text-secondary); transition: color 0.2s, border-color 0.2s;
  }
  .cs-social:hover { color: var(--text); border-color: var(--border-light); }

  .cs-cover { background: var(--bg-deep); border-bottom: 1px solid var(--border); overflow: hidden; }
  .cs-cover-scale { display: block; }
  .cs-cover-inner { aspect-ratio: 21 / 9; max-height: 520px; }
  .cs-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .cs-body { display: flex; flex-direction: column; gap: var(--space-20); padding: var(--space-16) var(--space-6) var(--space-20); }

  .cs-sec-head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); }
  .cs-sec-icon {
    width: 36px; height: 36px; border-radius: var(--radius);
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--brand); background: var(--glass-bg-brand);
    border: 1px solid var(--glass-border-brand); flex-shrink: 0;
  }
  .cs-sec-title { font-size: clamp(1.6rem, 3.5vw, 2.4rem); color: var(--text); }

  .cs-slot {
    width: 100%; border-radius: var(--radius-lg); overflow: hidden;
    background: var(--bg-card); border: 1px dashed var(--border-light);
    display: flex; align-items: center; justify-content: center;
  }
  .cs-slot:has(img) { border-style: solid; border-color: var(--border); }
  .cs-slot img { width: 100%; height: 100%; object-fit: cover; }
  .cs-slot-label {
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--text-faint);
  }

  .cs-brand-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: var(--space-6); align-items: start; }
  @media (max-width: 760px) { .cs-brand-grid { grid-template-columns: 1fr; } }
  .cs-brand-side { display: flex; flex-direction: column; gap: var(--space-5); }

  .cs-palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-3); }
  .cs-swatch {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-3);
    display: flex; flex-direction: column; gap: 6px;
  }
  .cs-swatch-chip { height: 44px; border-radius: 6px; border: 1px solid var(--border); }
  .cs-swatch-name { font-size: 0.8rem; font-weight: 700; color: var(--text); }
  .cs-swatch-hex { font-size: 0.7rem; font-family: monospace; color: var(--text-muted); text-transform: uppercase; }

  .cs-type-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .cs-type-row {
    display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4);
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-3) var(--space-4);
  }
  .cs-type-family { font-size: 1rem; font-weight: 800; color: var(--text); }
  .cs-type-role { font-size: 0.78rem; color: var(--text-muted); }

  .cs-browser {
    border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden; background: var(--bg-card);
  }
  .cs-browser-bar {
    display: flex; gap: 6px; padding: 10px 14px;
    border-bottom: 1px solid var(--border); background: var(--bg-elevated);
  }
  .cs-browser-bar span { width: 10px; height: 10px; border-radius: 50%; background: var(--surface); }
  .cs-browser-bar span:nth-child(1) { background: var(--dot-close); }
  .cs-browser-bar span:nth-child(2) { background: var(--dot-min); }
  .cs-browser-bar span:nth-child(3) { background: var(--dot-max); }
  .cs-browser .cs-slot { border: none; border-radius: 0; }
  .cs-browser-shot { width: 100%; display: block; }

  .cs-sec-foot {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: var(--space-6); margin-top: var(--space-5); flex-wrap: wrap;
  }
  .cs-live-btn { display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; }

  .cs-cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
  @media (max-width: 640px) { .cs-cards-grid { grid-template-columns: 1fr; } }

  .cs-media-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-4); margin-top: var(--space-2);
  }
  .cs-print-item { display: flex; flex-direction: column; gap: var(--space-2); }
  .cs-print-caption { font-size: 0.8125rem; color: var(--text-secondary); }

  .cs-notes {
    margin-top: var(--space-5); max-width: 620px;
    font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.7;
  }
  .cs-sec-foot .cs-notes { margin-top: 0; }

  .cs-testimonials-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
  @media (max-width: 760px) { .cs-testimonials-grid { grid-template-columns: 1fr; } }

  .cs-cta {
    text-align: center; padding: var(--space-16) var(--space-6);
    background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }
  .cs-cta-title { font-size: clamp(2.2rem, 6vw, 3.6rem); color: var(--text); margin-bottom: var(--space-3); }
  .cs-cta-sub { color: var(--text-secondary); margin-bottom: var(--space-6); }
  .cs-cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: var(--space-3) var(--space-8); }

  .cs-neighbors { display: flex; justify-content: space-between; gap: var(--space-4); border-top: 1px solid var(--border); padding-top: var(--space-8); }
  .cs-neighbor {
    display: inline-flex; align-items: center; gap: var(--space-2);
    font-size: 0.9rem; font-weight: 700; color: var(--text); min-height: 44px;
    max-width: 45%;
  }
  .cs-neighbor--next { text-align: right; flex-direction: row-reverse; margin-left: auto; }
  .cs-neighbor-label { display: block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
`;
