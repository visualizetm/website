import { useEffect, useRef, useState } from 'react';
import { Stagger, WordReveal } from '../marketing/motion';
import { TestimonialCard, testimonialCardStyles } from '../marketing/showcase';

/* Site Prompt 4, Part 1.6: landing.testimonials (already published, featured,
 * capped at 6 by the endpoint). A three-up grid on desktop; on mobile the
 * same cards become a swipeable single-card row (scroll-snap, dot
 * indicators tracking scroll position via IntersectionObserver, no
 * autoplay, since dragging is the only motion here). Hidden when empty. */
export default function HomeTestimonials({ testimonials }) {
  const items = testimonials || [];
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length < 2) return undefined;
    const cards = [...track.children];
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(cards.indexOf(visible.target));
    }, { root: track, threshold: 0.6 });
    cards.forEach(c => obs.observe(c));
    return () => obs.disconnect();
  }, [items.length]);

  if (!items.length) return null;

  const goTo = (i) => {
    const track = trackRef.current;
    if (!track) return;
    track.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <section className="ht section">
      <div className="wrap">
        <WordReveal as="h2" className="section-title">What clients say</WordReveal>
        <div className="ht-track" ref={trackRef}>
          {items.map(t => (
            <div key={`${t.slug}-${t.author}`} className="ht-slide">
              <TestimonialCard testimonial={t} />
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div className="ht-dots" role="tablist" aria-label="Testimonials">
            {items.map((t, i) => (
              <button
                key={`${t.slug}-${t.author}-dot`}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Testimonial ${i + 1} of ${items.length}`}
                className={`ht-dot ${i === active ? 'is-active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </div>
      <style>{`
        .ht-track {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5);
          margin-top: var(--space-10);
        }
        .ht-dots { display: none; }
        @media (max-width: 860px) {
          .ht-track {
            display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
            gap: var(--space-4); margin: var(--space-8) calc(-1 * var(--space-4)) 0;
            padding: 0 var(--space-4);
            scrollbar-width: none;
          }
          .ht-track::-webkit-scrollbar { display: none; }
          .ht-slide { flex: 0 0 100%; scroll-snap-align: center; }
          .ht-dots {
            display: flex; justify-content: center; gap: var(--space-2);
            margin-top: var(--space-6);
          }
          .ht-dot {
            width: 44px; height: 44px; padding: 0;
            border: none; background: transparent; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          }
          .ht-dot::after {
            content: ''; width: 7px; height: 7px; border-radius: 50%;
            background: var(--border-light); transition: background 0.2s, transform 0.2s;
          }
          .ht-dot.is-active::after { background: var(--brand); transform: scale(1.3); }
        }
      `}</style>
      <style>{testimonialCardStyles}</style>
    </section>
  );
}
