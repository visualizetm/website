import { useEffect, useState, useCallback } from 'react';
import { fetchShowcase, ClientCard, TestimonialCard, testimonialCardStyles } from '../marketing/showcase';
import { Reveal, Stagger, Tone } from '../marketing/motion';
import { useHead } from '../marketing/useHead';

export { ClientCard } from '../marketing/showcase';

function CardSkeleton() {
  return (
    <div className="wk-card wk-card--skel" aria-hidden="true">
      <div className="wk-card-media wk-skel" />
      <div className="wk-card-body">
        <div className="wk-skel wk-skel-line" style={{ width: '60%', height: 20 }} />
        <div className="wk-skel wk-skel-line" style={{ width: '35%', height: 14 }} />
        <div className="wk-skel wk-skel-line" style={{ width: '90%', height: 14 }} />
      </div>
    </div>
  );
}

export default function Clients() {
  const [state, setState] = useState({ status: 'loading', clients: [], testimonials: [] });
  useHead({
    title: 'Clients | Visualize.',
    description: 'Real businesses, built end to end, brand, web, and print under one roof.',
  });

  const load = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const { clients } = await fetchShowcase();
      const testimonials = [];
      for (const c of clients) for (const t of c.testimonials) testimonials.push({ ...t, business: c.displayName, slug: c.slug });
      setState({ status: 'ready', clients, testimonials });
    } catch {
      setState(s => ({ ...s, status: 'error' }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <section className="wk-hero">
        <div className="wrap">
          <p className="wk-eyebrow">Client Showcase</p>
          <h1 className="wk-title display">Clients</h1>
          <p className="section-subtitle">
            Real businesses, built end to end, brand, web, and print under one roof.
          </p>
        </div>
      </section>

      <section className="wk-grid-section section">
        <div className="wrap">
          {state.status === 'loading' ? (
            <div className="wk-grid">{[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}</div>
          ) : state.status === 'error' ? (
            <div className="wk-state">
              <p className="wk-state-title">Could not load the client showcase.</p>
              <p className="wk-state-body">Something went wrong reaching the server.</p>
              <button type="button" className="btn btn-secondary" onClick={load}>Retry</button>
            </div>
          ) : !state.clients.length ? (
            <div className="wk-state">
              <p className="wk-state-title">New work is being added. Check back soon.</p>
            </div>
          ) : (
            <Stagger className="wk-grid">
              {state.clients.map((c) => <ClientCard key={c.slug} client={c} />)}
            </Stagger>
          )}
        </div>
      </section>

      {/* The page's one Tone shift (Site Prompt 6, Part 5): the reviews
          lift off the page ground as they come up, so the list does not
          run into them on one flat surface. */}
      {state.status === 'ready' && state.testimonials.length > 0 && (
        <Tone as="section" className="wk-reviews section" from="var(--bg)" to="var(--bg-elevated)">
          <div className="wrap">
            <Reveal as="h2" className="section-title wk-reviews-title">What clients say</Reveal>
            <Stagger className="wk-reviews-grid">
              {state.testimonials.map((t, i) => <TestimonialCard key={t.id || i} testimonial={t} />)}
            </Stagger>
          </div>
        </Tone>
      )}

      <style>{workStyles}</style>
    </>
  );
}

export const workStyles = `
  .wk-hero {
    padding: var(--space-20) 0 var(--space-12);
    border-bottom: 1px solid var(--border);
    background: var(--bg-deep);
  }
  .wk-eyebrow {
    font-size: 0.72rem; font-weight: 800; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--brand-text);
    margin-bottom: var(--space-4);
  }
  .wk-title {
    font-size: clamp(3.5rem, 10vw, 6.5rem);
    color: var(--text);
    margin-bottom: var(--space-4);
  }

  .wk-grid-section { background: var(--bg); }
  .wk-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-5);
  }

  .wk-state { padding: var(--space-16) 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-4); }
  .wk-state-title { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0; }
  .wk-state-body { color: var(--text-secondary); margin: 0; }

  .wk-card {
    display: flex; flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: transform 0.25s var(--ease), border-color 0.25s, box-shadow 0.25s;
  }
  .wk-card:hover {
    transform: translateY(-4px);
    border-color: rgba(212, 76, 67, 0.5);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(212, 76, 67, 0.2);
  }
  @media (prefers-reduced-motion: reduce) {
    .wk-card, .wk-card:hover { transform: none; transition: border-color 0.25s; }
  }

  .wk-card-media { aspect-ratio: 16 / 10; background: var(--surface); overflow: hidden; }
  .wk-card-media img { width: 100%; height: 100%; object-fit: cover; }
  /* ClientCard's optional parallax cover (Home's Recent clients): the
     drift needs room to move inside the frame, so the shifting layer is
     taller than the frame that clips it. */
  .wk-card-shift { width: 100%; height: 112%; margin-top: -6%; }
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

  .wk-reviews { background: var(--bg-deep); border-top: 1px solid var(--border); }
  .wk-reviews-title { margin-bottom: var(--space-8); }
  .wk-reviews-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
  @media (max-width: 760px) { .wk-reviews-grid { grid-template-columns: 1fr; } }
` + testimonialCardStyles;
