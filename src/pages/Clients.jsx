import { useEffect, useState, useCallback } from 'react';
import { fetchShowcase, ClientCard, TestimonialCard, testimonialCardStyles, clientCardStyles } from '../marketing/showcase';
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

  .wk-reviews { background: var(--bg-deep); border-top: 1px solid var(--border); }
  .wk-reviews-title { margin-bottom: var(--space-8); }
  .wk-reviews-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
  @media (max-width: 760px) { .wk-reviews-grid { grid-template-columns: 1fr; } }
` + clientCardStyles + testimonialCardStyles;
