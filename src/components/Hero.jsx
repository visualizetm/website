import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Reveal, Parallax } from '../marketing/motion';

const DEFAULT_COVER = '/hero-default.svg';

/* Site Prompt 4: the hero image is the page's LCP element. It shows the
 * default studio graphic immediately (no blank box while the CRM fetch is
 * in flight, and the honest fallback once we know landing.work is empty),
 * then swaps to the first featured client's cover as soon as Home's one
 * fetchShowcase() call resolves with one. A <link rel="preload"> is added
 * the moment that real URL is known, since by then the browser has already
 * spent a beat painting the default image instead of discovering this one
 * from the parsed HTML. width/height plus the aspect-ratio on the wrapper
 * reserve the box before either image loads, so nothing shifts. */
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
    <section className="hero">
      <Reveal as="div" className="wrap hero-copy">
        <h1 className="hero-title display">
          Branding and websites for local businesses that deserve better than a logo from a template.
        </h1>
        <p className="hero-sub">Solo studio in Delaware. Brand, website, print, all in one place.</p>
        <div className="hero-cta">
          <a href="/book" className="btn btn-primary">Book a Meeting</a>
          <Link to="/clients" className="btn btn-secondary">See client work</Link>
        </div>
      </Reveal>

      <div className="hero-image-wrap">
        <Parallax as="div" className="hero-image" factor={0.08}>
          <img src={src} alt={alt} width={1600} height={1000} fetchpriority="high" />
        </Parallax>
      </div>

      <style>{`
        .hero { position: relative; padding: var(--space-24) 0 0; overflow: visible; }
        @media (max-width: 768px) { .hero { padding: var(--space-16) 0 0; } }

        .hero-copy { max-width: 720px; margin: 0 auto; text-align: center; }
        .hero-title {
          font-size: clamp(2.1rem, 5vw, 3.5rem);
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
        .hero-cta {
          display: flex; justify-content: center; flex-wrap: wrap;
          gap: var(--space-3); margin-bottom: var(--space-16);
        }

        .hero-image-wrap { width: 100%; }
        .hero-image {
          display: block; width: 100%; aspect-ratio: 16 / 10;
          background: var(--bg-elevated);
          overflow: hidden;
        }
        .hero-image img { width: 100%; height: 100%; object-fit: cover; display: block; }

        @media (min-width: 901px) {
          .hero-image-wrap {
            padding: 0 var(--space-10);
            margin-bottom: -96px;
            position: relative; z-index: 2;
          }
          .hero-image {
            max-width: 1200px; margin: 0 auto;
            border-radius: var(--radius-lg);
            box-shadow: 0 40px 100px rgba(0,0,0,0.45);
          }
        }
      `}</style>
    </section>
  );
}
