import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { showcaseCategories, showcaseProjects } from '../data/showcase';

export default function Showcase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const [filter, setFilter] = useState(
    showcaseCategories.includes(filterParam) ? filterParam : 'all'
  );

  useEffect(() => {
    if (showcaseCategories.includes(filterParam)) setFilter(filterParam);
  }, [filterParam]);

  const setFilterAndUrl = (value) => {
    setFilter(value);
    setSearchParams(value === 'all' ? {} : { filter: value });
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return showcaseProjects;
    return showcaseProjects.filter((p) => p.category === filter);
  }, [filter]);

  return (
    <>
      <section className="showcase-hero section">
        <div className="showcase-hero-bg" aria-hidden="true" />
        <div className="wrap showcase-hero-wrap">
          <div className="showcase-hero-content">
            <h1 className="section-title">Showcase</h1>
            <p className="section-subtitle">
              Websites and branding I've designed and built for clients.
            </p>
          </div>
          <div className="showcase-hero-visual" aria-hidden="true">
            <div className="showcase-hero-abstract" />
          </div>
        </div>
      </section>
      <section className="showcase-main section">
        <div className="showcase-main-bg" aria-hidden="true" />
        <div className="wrap">
          <div className="showcase-filters">
            <a
              href="/showcase"
              className={`showcase-filter-pill ${filter === 'all' ? 'is-active' : ''}`}
              onClick={(e) => { e.preventDefault(); setFilterAndUrl('all'); }}
            >
              All
            </a>
            {showcaseCategories.map((cat) => (
              <a
                key={cat}
                href={`/showcase?filter=${cat}`}
                className={`showcase-filter-pill ${filter === cat ? 'is-active' : ''}`}
                onClick={(e) => { e.preventDefault(); setFilterAndUrl(cat); }}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </a>
            ))}
          </div>
          {filtered.length > 0 ? (
            <div className="showcase-grid">
              {filtered.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="showcase-card"
                >
                  <img src={p.image} alt="" />
                  <div className="showcase-card-overlay">
                    <span className="showcase-card-title">{p.title}</span>
                    {p.description && (
                      <span className="showcase-card-desc">{p.description}</span>
                    )}
                    <span className="showcase-card-link">View site →</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="showcase-coming">
              <h2 className="showcase-coming-title">Nothing in this category yet</h2>
              <p className="showcase-coming-sub">
                More projects will appear here as they're added.
              </p>
            </div>
          )}
        </div>
      </section>
      <style>{`
        .showcase-hero {
          position: relative;
          background: var(--bg);
          padding-bottom: var(--space-12);
        }
        .showcase-hero-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212, 76, 67, 0.08) 0%, transparent 50%);
          pointer-events: none;
        }
        .showcase-hero .wrap { position: relative; z-index: 1; }
        .showcase-hero-wrap {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-12);
          align-items: center;
        }
        @media (max-width: 768px) {
          .showcase-hero-wrap { grid-template-columns: 1fr; }
        }
        .showcase-hero-visual {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .showcase-hero-abstract {
          width: 100%;
          max-width: 520px;
          height: 280px;
          border-radius: var(--radius-lg);
          background:
            radial-gradient(circle at 30% 30%, rgba(212, 76, 67, 0.18) 0%, transparent 55%),
            radial-gradient(circle at 70% 60%, rgba(212, 76, 67, 0.10) 0%, transparent 55%),
            linear-gradient(145deg, var(--bg-card) 0%, var(--bg-elevated) 100%);
          border: 1px solid var(--border);
          box-shadow: 0 24px 64px rgba(0,0,0,0.12);
        }
        .showcase-main {
          position: relative;
          background: var(--bg-elevated);
          border-top: 1px solid var(--border);
        }
        .showcase-main-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(212, 76, 67, 0.04) 0%, transparent 50%);
          pointer-events: none;
        }
        .showcase-main .wrap { position: relative; z-index: 1; }
        .showcase-filters {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-10);
        }
        .showcase-filter-pill {
          display: inline-block;
          padding: var(--space-2) var(--space-4);
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          transition: color var(--duration) var(--ease), border-color var(--duration) var(--ease), background var(--duration) var(--ease);
        }
        .showcase-filter-pill:hover {
          color: var(--text);
          border-color: rgba(0, 0, 0, 0.15);
        }
        .showcase-filter-pill.is-active {
          color: var(--text);
          background: var(--glass-bg-brand);
          border-color: var(--glass-border-brand);
        }
        .showcase-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: var(--space-8);
        }
        .showcase-card {
          position: relative;
          aspect-ratio: 4/3;
          border-radius: var(--radius-lg);
          overflow: hidden;
          display: block;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease);
        }
        .showcase-card:hover {
          border-color: rgba(0, 0, 0, 0.15);
          box-shadow: 0 20px 50px rgba(0,0,0,0.12);
        }
        .showcase-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s var(--ease);
        }
        .showcase-card:hover img {
          transform: scale(1.04);
        }
        .showcase-card-overlay {
          position: absolute;
          inset: 0;
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          background: linear-gradient(transparent 30%, rgba(0,0,0,0.85));
          color: #fff;
        }
        .showcase-card-title {
          font-weight: 700;
          font-size: 1.125rem;
          margin-bottom: var(--space-1);
        }
        .showcase-card-desc {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: var(--space-2);
          line-height: 1.4;
        }
        .showcase-card-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--brand-light);
          opacity: 0;
          transform: translateY(4px);
          transition: opacity var(--duration) var(--ease), transform var(--duration) var(--ease);
        }
        .showcase-card:hover .showcase-card-link {
          opacity: 1;
          transform: translateY(0);
        }
        .showcase-coming {
          max-width: 720px;
          margin: 0 auto;
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-12);
          text-align: center;
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }
        .showcase-coming-title {
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 800;
          color: var(--text);
          margin-bottom: var(--space-3);
        }
        .showcase-coming-sub {
          color: var(--text-secondary);
          font-size: 1rem;
          line-height: 1.7;
          margin: 0;
        }
      `}</style>
    </>
  );
}
