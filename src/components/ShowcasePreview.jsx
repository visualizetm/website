import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import { fetchShowcase, ClientCard } from '../marketing/showcase';
import { workStyles } from '../pages/Clients';
import { Reveal, Stagger } from '../marketing/motion';

export default function ShowcasePreview() {
  const [clients, setClients] = useState(null); // null while loading, [] once resolved (even on error, so Home never blocks on this section)

  useEffect(() => {
    let alive = true;
    fetchShowcase()
      .then(({ clients: c }) => { if (alive) setClients(c.slice(0, 3)); })
      .catch(() => { if (alive) setClients([]); });
    return () => { alive = false; };
  }, []);

  if (!clients || !clients.length) return null;

  return (
    <section className="showcase-preview section section-dark">
      <div className="showcase-preview-bg" aria-hidden="true" />
      <div className="wrap">
        <Reveal as="div" className="showcase-preview-head">
          <div>
            <h2 className="section-title">My Work</h2>
            <p className="section-subtitle">
              Real businesses built end to end, brand, web, and print under one roof.
            </p>
          </div>
          <Link to="/clients" className="btn btn-secondary showcase-view-all">
            View All Work
            <ArrowRight width={15} height={15} className="showcase-arrow" />
          </Link>
        </Reveal>
        <Stagger className="showcase-preview-grid">
          {clients.map((c) => <ClientCard key={c.slug} client={c} />)}
        </Stagger>
      </div>
      <style>{workStyles}</style>
      <style>{`
        .showcase-preview { position: relative; }
        .showcase-preview-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,76,67,0.05) 0%, transparent 50%);
          pointer-events: none;
        }
        .showcase-preview .wrap { position: relative; z-index: 1; }
        .showcase-preview-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: var(--space-6); flex-wrap: wrap; margin-bottom: var(--space-12);
        }
        .showcase-view-all {
          display: inline-flex; align-items: center; gap: 7px;
          flex-shrink: 0; font-size: 0.875rem;
        }
        .showcase-arrow { transition: transform 0.2s; }
        .showcase-view-all:hover .showcase-arrow { transform: translateX(3px); }

        .showcase-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-5);
        }
        @media (max-width: 900px) { .showcase-preview-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .showcase-preview-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
