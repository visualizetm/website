import { useRef } from 'react';
import { Reveal, WordReveal, useScrollEngine, useScrollProgress } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* Site Prompt 9, Part 3: the packages ladder. The message is that you can
 * start with something small and keep going, so the four rungs are steps
 * up, each bar wider than the last (40, 60, 80, 100 percent of the
 * container). No price anywhere on Home: the answer to "how much" is
 * still the free call, which is the button under the four.
 *
 * Motion, desktop and phone alike: each rung's bar draws in from the
 * left as it arrives, its width scrubbed to scroll (a scaleX reading
 * --rung-p, written by useScrollProgress while the rung crosses the lower
 * third of the viewport), and the title and line fade in once the bar has
 * drawn. A vertical line down the left edge draws downward across the
 * whole section (--line-p) so the four read as one progression. Nothing
 * dims once it has arrived. Without the engine (reduced motion, admin
 * host, a failed import) every property's fallback is 1: every bar at its
 * final width, the line drawn, nothing animating.
 *
 * The progression is also in the text: an ordered list, each item
 * carrying "Step n of 4" for a screen reader, so the widths are never the
 * only thing saying which rung is the bigger one. */
const RUNGS = [
  { title: 'Social refresh', line: 'Your profile, your highlights, and a set of post templates that actually look like you.', width: 40 },
  { title: 'Brand starter', line: 'A logo, colors, and fonts. The foundation everything else sits on.', width: 60 },
  { title: 'Brand complete', line: 'The full identity, guidelines, social kit, and cards. Everything consistent, everywhere.', width: 80 },
  { title: 'Brand and website', line: 'The identity plus a site that turns a visitor into a booking.', width: 100 },
];

function Rung({ rung, index }) {
  const ref = useRef(null);
  useScrollProgress(ref, { start: 'top 88%', end: 'top 58%', cssVar: '--rung-p' });
  return (
    <li ref={ref} className="pk-rung" style={{ '--rung-w': `${rung.width}%` }}>
      <span className="visually-hidden">Step {index + 1} of {RUNGS.length}. </span>
      <span className="pk-bar" aria-hidden="true">
        <span className="pk-bar-fill" />
      </span>
      <div className="pk-text">
        <h3 className="pk-title">{rung.title}</h3>
        <p className="pk-line">{rung.line}</p>
      </div>
    </li>
  );
}

export default function Packages() {
  const listRef = useRef(null);
  const state = useScrollEngine();
  useScrollProgress(listRef, { start: 'top 80%', end: 'bottom 75%', cssVar: '--line-p' });

  return (
    <section className="pk section" id="packages" aria-labelledby="pk-title">
      <div className="wrap">
        <WordReveal as="h2" id="pk-title" className="section-title">Start small. Go as far as you want.</WordReveal>
        <Reveal as="p" className="pk-intro">
          Some people start with just their Instagram. Some want the whole thing. Both are fine.
        </Reveal>
        <ol ref={listRef} className={`pk-ladder ${state === 'on' ? 'pk-ladder--live' : 'pk-ladder--static'}`}>
          {RUNGS.map((r, i) => <Rung key={r.title} rung={r} index={i} />)}
        </ol>
        <Reveal as="div" className="pk-foot">
          <p className="pk-note">Not sure where to start? That is what the first call is for.</p>
          <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
        </Reveal>
      </div>

      <style>{`
        .pk-intro {
          margin-top: var(--space-4); max-width: 52ch;
          font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.6;
        }
        /* The ladder: the rungs down the right of a one pixel line, the
           line drawing downward with the section (a scaleY, top origin). */
        .pk-ladder {
          position: relative; list-style: none;
          margin-top: var(--space-12); padding-left: var(--space-8);
          display: flex; flex-direction: column; gap: var(--space-10);
        }
        .pk-ladder::before {
          content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 1px;
          background: var(--brand);
          transform: scaleY(var(--line-p, 1)); transform-origin: top center;
          will-change: transform;
        }
        .pk-rung { position: relative; }
        /* The rung's mark on the line: a small brand dot that sits where
           the rung meets it, shown as the bar draws. */
        .pk-rung::before {
          content: ''; position: absolute; left: calc(-1 * var(--space-8) - 4px); top: 4px;
          width: 9px; height: 9px; border-radius: 50%; background: var(--brand);
          opacity: clamp(0, calc(var(--rung-p, 1) * 3), 1);
        }
        /* The bar: its box is the final width (40, 60, 80, 100 percent of
           the ladder), its fill draws from the left by scaleX reading the
           rung's own scroll progress. Width is set, never animated. */
        .pk-bar {
          display: block; width: var(--rung-w); height: 10px; border-radius: 5px;
          background: var(--border); overflow: hidden;
        }
        .pk-bar-fill {
          display: block; width: 100%; height: 100%; border-radius: inherit;
          background: var(--brand);
          transform: scaleX(clamp(0, calc(var(--rung-p, 1) / 0.75), 1)); transform-origin: left center;
          will-change: transform;
        }
        /* Title and line fade in after the bar has drawn (the last quarter
           of the rung's progress) and rise a little into place. */
        .pk-text {
          --pt: clamp(0, calc((var(--rung-p, 1) - 0.7) / 0.3), 1);
          margin-top: var(--space-4);
          opacity: var(--pt);
          transform: translate3d(0, calc((1 - var(--pt)) * 8px), 0);
        }
        .pk-title { font-size: 1.1875rem; font-weight: 700; color: var(--text); }
        .pk-line {
          margin-top: var(--space-2); max-width: 48ch;
          font-size: 0.9875rem; color: var(--text-secondary); line-height: 1.6;
        }
        .pk-foot {
          margin-top: var(--space-12); display: flex; flex-wrap: wrap;
          align-items: center; gap: var(--space-5) var(--space-8);
        }
        .pk-note { font-size: 1.0625rem; color: var(--text); }
        /* Two resting states. No engine (reduced motion, the admin host,
           a failed import, and the frames before the import resolves):
           --rung-p and --line-p are never written, every fallback above
           is 1, and the static class pins the final look. Engine live:
           a rung the scroll has not reached yet starts at 0 (the class
           below), until ScrollTrigger writes the inline value. */
        .pk-ladder--static .pk-bar-fill,
        .pk-ladder--static .pk-text,
        .pk-ladder--static::before { transform: none; opacity: 1; }
        .pk-ladder--live { --line-p: 0; }
        .pk-ladder--live .pk-rung { --rung-p: 0; }
        @media (max-width: 767px) {
          .pk-ladder { margin-top: var(--space-10); gap: var(--space-8); padding-left: var(--space-6); }
          .pk-rung::before { left: calc(-1 * var(--space-6) - 4px); }
          .pk-bar { height: 8px; }
          .pk-foot { margin-top: var(--space-10); }
          .pk-foot .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </section>
  );
}
