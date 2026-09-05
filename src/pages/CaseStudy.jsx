import { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import Palette from '@untitled-ui/icons-react/build/esm/Palette';
import Globe01 from '@untitled-ui/icons-react/build/esm/Globe01';
import CreditCard02 from '@untitled-ui/icons-react/build/esm/CreditCard02';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import { getClient } from '../data/clients';

// Labeled placeholder for any image slot a client data file leaves empty.
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

export default function CaseStudy() {
  const { slug } = useParams();
  const client = getClient(slug);

  useEffect(() => {
    if (client) document.title = `${client.name}, Work, Visualize`;
  }, [client]);

  if (!client) return <Navigate to="/work" replace />;

  const { brand, website, cards, print } = client.sections || {};

  return (
    <>
      <article className="cs-page">
        {/* Header */}
        <header className="cs-hero grid-texture">
          <div className="wrap">
            <Link to="/work" className="cs-back">
              <ArrowLeft width={15} height={15} />
              All work
            </Link>
            <div className="cs-hero-meta">
              <span className="wk-card-tag">{client.type}</span>
              {client.year && <span className="cs-year">{client.year}</span>}
            </div>
            <h1 className="cs-title display">{client.name}</h1>
            <p className="section-subtitle">{client.blurb}</p>
          </div>
        </header>

        <div className="wrap cs-body">
          {/* Brand Identity */}
          {brand && (
            <section className="cs-section">
              <SectionHead icon={Palette} title="Brand Identity" />
              <div className="cs-brand-grid">
                <Media src={brand.logo} alt={`${client.name} logo`} label="Logo" ratio="4 / 3" />
                <div className="cs-brand-side">
                  {brand.palette?.length > 0 && (
                    <div className="cs-palette">
                      {brand.palette.map((c) => (
                        <div key={c.hex} className="cs-swatch">
                          <span className="cs-swatch-chip" style={{ background: c.hex }} />
                          <span className="cs-swatch-name">{c.name}</span>
                          <span className="cs-swatch-hex">{c.hex}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {brand.typography?.length > 0 && (
                    <div className="cs-type-list">
                      {brand.typography.map((t) => (
                        <div key={t.family} className="cs-type-row">
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
                  {brand.images.map((src) => (
                    <Media key={src} src={src} alt={`${client.name} brand`} label="Brand" />
                  ))}
                </div>
              )}
              {brand.notes && <p className="cs-notes">{brand.notes}</p>}
            </section>
          )}

          {/* Website */}
          {website && (
            <section className="cs-section">
              <SectionHead icon={Globe01} title="Website" />
              <div className="cs-browser">
                <div className="cs-browser-bar"><span /><span /><span /></div>
                {website.screenshots?.length > 0 ? (
                  website.screenshots.map((src) => (
                    <img key={src} src={src} alt={`${client.name} website`} loading="lazy" className="cs-browser-shot" />
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
            </section>
          )}

          {/* Business Cards */}
          {cards && (
            <section className="cs-section">
              <SectionHead icon={CreditCard02} title="Business Cards" />
              <div className="cs-cards-grid">
                <Media src={cards.front} alt={`${client.name} card front`} label="Card front" ratio="7 / 4" />
                <Media src={cards.back} alt={`${client.name} card back`} label="Card back" ratio="7 / 4" />
              </div>
              {cards.notes && <p className="cs-notes">{cards.notes}</p>}
            </section>
          )}

          {/* Print & Product */}
          {print && (
            <section className="cs-section">
              <SectionHead icon={Package} title="Print & Product" />
              <div className="cs-media-grid">
                {(print.items || []).map((item) => (
                  <figure key={item.label} className="cs-print-item">
                    <Media src={item.image} alt={item.label} label={item.label} />
                    <figcaption className="cs-print-caption">{item.label}</figcaption>
                  </figure>
                ))}
              </div>
              {print.notes && <p className="cs-notes">{print.notes}</p>}
            </section>
          )}

          {/* Start your own */}
          <section className="cs-cta grid-texture">
            <h2 className="cs-cta-title display">Start your own</h2>
            <p className="cs-cta-sub">Same process, your business. Tell me what we're building.</p>
            <Link to="/start" className="btn btn-primary cs-cta-btn">
              Start a Project <ArrowRight width={16} height={16} />
            </Link>
          </section>
        </div>
      </article>

      <style>{csStyles}</style>
    </>
  );
}

const csStyles = `
  .cs-hero {
    padding: var(--space-16) 0 var(--space-12);
    border-bottom: 1px solid var(--border);
    background: var(--bg-deep);
  }
  .cs-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.84rem; font-weight: 600; color: var(--text-muted);
    margin-bottom: var(--space-8); transition: color 0.2s;
  }
  .cs-back:hover { color: var(--text); }
  .cs-hero-meta { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
  .cs-year { font-size: 0.8rem; color: var(--text-muted); }
  .cs-title {
    font-size: clamp(3rem, 8vw, 5.5rem);
    color: var(--text);
    margin-bottom: var(--space-4);
  }

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

  .cs-cta {
    text-align: center; padding: var(--space-16) var(--space-6);
    background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }
  .cs-cta-title { font-size: clamp(2.2rem, 6vw, 3.6rem); color: var(--text); margin-bottom: var(--space-3); }
  .cs-cta-sub { color: var(--text-secondary); margin-bottom: var(--space-6); }
  .cs-cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: var(--space-3) var(--space-8); }
`;
