import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pin, ScaleIn, WordReveal } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

const DEFAULT_COVER = '/hero-default.svg';

/* Site Prompt 6, Part 2.1: the hero holds for an extra 1.5 viewports while
 * the headline fades up and out and the cover grows to fill the screen.
 * Both are driven off --pin-p, the progress Pin scrubs onto the sticky
 * panel, read straight from CSS inside transform and opacity, so a whole
 * hero's worth of scroll costs zero React renders.
 *
 * The cover is the page's LCP element. It shows the default studio graphic
 * immediately (no blank box while the CRM fetch is in flight, and the
 * honest fallback once we know landing.work is empty), then swaps to the
 * first featured client's cover as soon as Home's one fetchShowcase() call
 * resolves with one. A <link rel="preload"> is added the moment that real
 * URL is known, since by then the browser has already spent a beat
 * painting the default instead of discovering this one from the HTML.
 * width/height plus aspect-ratio reserve the box, so nothing shifts.
 *
 * Without the engine (reduced motion, a failed import) nothing pins: the
 * copy sits above the cover at full opacity and natural size, which is
 * exactly the --pin-p: 0 state the rules below already describe. */
export default function Hero({ cover }) {
  const src = cover?.src || DEFAULT_COVER;
  const alt = cover?.alt || '';

  useEffect(() => {
    if (!cover?.src) return undefined;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = cover.src;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [cover?.src]);

  return (
    <Pin height={1.5} className="hero" innerClassName="hero-inner">
      <div className="wrap hero-copy">
        <WordReveal as="h1" className="hero-title display" start="top 90%" end="top 55%">
          Branding and websites for local businesses.
        </WordReveal>
        <p className="hero-sub">Delaware based. Brand, website, print. The first call is free.</p>
        <div className="hero-cta">
          <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
          <Link to="/clients" className="btn btn-secondary">See client work</Link>
        </div>
      </div>

      <div className="hero-image-wrap">
        <ScaleIn as="div" className="hero-image" threshold={0}>
          <img src={src} alt={alt} width={1600} height={1000} fetchpriority="high" />
        </ScaleIn>
      </div>

      <style>{`
        .hero { position: relative; }
        /* var(--space-24) of top padding clears the floating navbar, which
           sits over the top of the panel once the hero is pinned. */
        .hero-inner { gap: var(--space-8); padding: var(--space-24) 0 var(--space-10); }

        /* Pinned, the whole hero has exactly one viewport to live in, so
           the cover takes whatever height the copy leaves and crops to it.
           Unpinned (reduced motion, no engine) it keeps its natural 16/10
           and the section is simply as tall as its content. */
        .m-pin--active .hero-copy { flex: 0 0 auto; }
        .m-pin--active .hero-image-wrap { flex: 1 1 auto; min-height: 160px; display: flex; }
        .m-pin--active .hero-image { height: 100%; aspect-ratio: auto; }

        .hero-copy {
          max-width: 780px; margin: 0 auto; text-align: center;
          opacity: clamp(0, calc(1 - var(--pin-p, 0) * 2.4), 1);
          transform: translate3d(0, calc(var(--pin-p, 0) * -80px), 0);
          will-change: transform, opacity;
        }
        .hero-title {
          font-size: clamp(2.1rem, 5.4vw, 3.75rem);
          color: var(--text);
          margin-bottom: var(--space-5);
        }
        .hero-sub {
          font-size: clamp(1rem, 1.6vw, 1.15rem);
          color: var(--text-secondary);
          max-width: 46ch;
          margin: 0 auto var(--space-8);
          line-height: 1.6;
        }
        .hero-cta { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--space-3); }

        .hero-image-wrap {
          width: 100%;
          transform: scale(calc(1 + var(--pin-p, 0) * 0.34));
          will-change: transform;
        }
        .hero-image {
          display: block; width: 100%; aspect-ratio: 16 / 10;
          background: var(--bg-elevated);
          overflow: hidden;
        }
        .hero-image img { width: 100%; height: 100%; object-fit: cover; display: block; }

        @media (min-width: 901px) {
          .hero-image-wrap { padding: 0 var(--space-10); }
          .m-pin--active .hero-image { width: 100%; max-width: 1100px; }
          .hero-image {
            max-width: 1100px; margin: 0 auto;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-chrome-strong);
          }
        }
      `}</style>
    </Pin>
  );
}
