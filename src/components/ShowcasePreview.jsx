import { Link } from 'react-router-dom';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import { clients } from '../data/clients';
import { ClientCard, workStyles } from '../pages/Work';

export default function ShowcasePreview() {
  const featured = clients.slice(0, 3);

  return (
    <section className="showcase-preview section section-dark">
      <div className="showcase-preview-bg" aria-hidden="true" />
      <div className="wrap">
        <div className="showcase-preview-head reveal">
          <div>
            <h2 className="section-title">My Work</h2>
            <p className="section-subtitle">
              Real businesses built end to end, brand, web, and print under one roof.
            </p>
          </div>
          <Link to="/work" className="btn btn-secondary showcase-view-all">
            View All Work
            <ArrowRight width={15} height={15} className="showcase-arrow" />
          </Link>
        </div>
        <div className="showcase-preview-grid stagger">
          {featured.map((c) => <ClientCard key={c.slug} client={c} />)}
        </div>
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
