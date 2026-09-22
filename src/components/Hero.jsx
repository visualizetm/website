import { Link } from 'react-router-dom';
import { Scene } from '../marketing/motion';
import Wordmark from './Wordmark';
import { capImageWidth, IMG_W } from '../marketing/showcase';
import { CALENDLY_URL } from '../marketing/links';

const DEFAULT_COVER = '/hero-default.svg';

/* Scene 1, the hero (Site Prompt 11): three steps. The wordmark and the
 * headline at step 1, the line at step 2, the two buttons at step 3. The
 * cover deck (up to three real covers from the CRM, the default cover with
 * none) sits behind the text from step 1 and cycles one cover per step:
 * each cover is a data-step child with a custom reveal (fade and a small
 * settle from 1.06), stacked so the newest is on top and the earlier ones
 * stay underneath, which is what makes the change a cycle rather than a
 * swap. The deck fills the stage, so the stage is never empty. `items` is
 * null until the CRM answers; the default cover is what shows until then
 * and what shows when nothing is published. */
export default function Hero({ items, tone = 'a' }) {
  const covers = (items || []).filter(i => i?.cover).slice(0, 3);
  const deck = covers.length ? covers : [{ cover: DEFAULT_COVER, slug: '' }];
  return (
    <Scene
      steps={3} tone={tone} label="Visualize" className="hero"
      backdrop={(
        <div className="hero-deck">
                {deck.map((c, i) => (
                  <span key={c.slug || i} className="img-fit hero-cover" data-step={i + 1} data-reveal="custom" style={{ '--i': i }}>
                    <img
                      src={c.cover === DEFAULT_COVER ? c.cover : capImageWidth(c.cover, IMG_W.heroCover)}
                      alt="" width={1600} height={900}
                      fetchpriority={i === 0 ? 'high' : undefined}
                      loading={i === 0 ? undefined : 'lazy'}
                    />
                  </span>
                ))}
          {/* The cover's name, above the scrim, revealed with its cover. */}
          <div className="hero-names">
            {deck.map((c, i) => c.displayName && (
              <span key={`${c.slug || i}-name`} className="hero-cover-name" data-step={i + 1} data-reveal="custom">
                <span className="hero-cover-name-b">{c.displayName}</span>
                {c.type && <span className="hero-cover-name-t">{c.type}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    >
      <div className="wrap hero-copy">
        <div data-step="1" className="hero-mark"><Wordmark size={34} /></div>
        <h1 data-step="1" className="hero-title display">Branding and websites for local businesses.</h1>
        <p data-step="2" className="hero-sub">Solo studio in Delaware. Brand, website, print, all in one place.</p>
        <div data-step="3" className="hero-cta">
          <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
          <Link to="/clients" className="btn btn-secondary">See client work</Link>
        </div>
      </div>
      <style>{`
        .hero-deck { position: absolute; inset: 0; background: var(--bg); }
        /* The page is at the top while the hero is held, so the navbar is
           its unscrolled 84px (72px on a phone). */
        .m-scene--pinned.hero .m-scene-stage { padding-top: calc(84px + var(--space-3)); }
        @media (max-width: 768px) { .m-scene--pinned.hero .m-scene-stage { padding-top: calc(72px + var(--space-3)); } }
        /* Stacked by DOM order (a later cover paints over an earlier one),
           no z-index and no ground of its own: a layer with both would read
           as an overlay covering the page. */
        .hero-cover {
          position: absolute; inset: 0; background: transparent;
          opacity: var(--sr, 1);
          /* Settles from just under size, never over it: a cover scaled past
             the viewport is a box the layout audit reads as overflow. */
          transform: scale(calc(0.97 + 0.03 * var(--sr, 1)));
          transform-origin: center center;
        }
        .hero-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .hero-names { position: absolute; right: var(--space-4); bottom: var(--space-4); z-index: 11; display: grid; }
        /* One name at a time (Site Prompt 12, bug 4). The names share one
           corner, so they may never both be above zero: name n goes out
           over the first half of a 0.15 step window as cover n+1 arrives
           (--srn is cover n+1's own reveal), and name n+1 comes in over the
           second half. At no progress value are two names visible; the
           old version crossfaded them over 0.35 of a step and a phone
           caught both printed over each other. */
        .hero-cover-name {
          grid-area: 1 / 1; justify-self: end; display: flex; flex-direction: column; align-items: flex-end;
          padding: 6px 10px; border-radius: var(--radius); background: var(--chrome); border: 1px solid var(--glass-border);
          font-size: 0.8125rem; color: var(--text);
          --srn: clamp(0, calc((var(--scene-p, 0) - var(--step, 1) + 0.35) / 0.35), 1);
          --in: clamp(0, calc((var(--sr, 1) - 0.85) / 0.075), 1);
          --out: calc(1 - clamp(0, calc((var(--srn) - 0.775) / 0.075), 1));
          opacity: calc(var(--in) * var(--out));
        }
        .hero-cover-name:last-child { --srn: 0; }
        .m-scene--static .hero-cover-name:not(:last-child) { display: none; }
        .hero-cover-name-b { font-weight: 700; }
        .hero-cover-name-t { font-size: 0.75rem; color: var(--text-secondary); }
        @media (max-width: 767px) { .hero-names { bottom: var(--space-3); } }
        /* The scrim (Site Prompt 12, bug 4): a uniform 40 percent dim over
           the whole deck plus a vertical gradient from transparent at the
           top to the surface colour at the bottom. Together they are at
           least 55 percent of the surface behind every row the headline can
           occupy, which is what white text needs to read 4.5:1 over a pure
           white cover, the worst case (a busy light cover's own lettering
           showed through the headline on a phone). Static, never animated. */
        .hero-deck::after {
          content: ''; position: absolute; inset: 0; z-index: 10;
          background:
            linear-gradient(180deg, rgba(10, 10, 10, 0) 0%, rgba(10, 10, 10, 0.3) 22%, rgba(10, 10, 10, 0.55) 55%, rgba(10, 10, 10, 1) 100%),
            rgba(10, 10, 10, 0.4);
        }
        .hero-copy { display: flex; flex-direction: column; gap: clamp(12px, 3vh, 28px); }
        .hero-mark { display: flex; }
        .hero-title { max-width: 14ch; font-size: clamp(2.1rem, min(12vw, max(6vw, 7.5vh)), 5rem); line-height: 1.06; color: var(--text); }
        .hero-sub { max-width: 34ch; font-size: clamp(1.0625rem, 2.8vh, 1.375rem); line-height: 1.5; color: var(--text-secondary); }
        .hero-cta { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        @media (max-width: 767px) { .hero-cta .btn { flex: 1 1 100%; justify-content: center; } }
        /* A short phone (under 560px tall) puts the two buttons side by side. */
        @media (max-width: 767px) and (max-height: 560px) { .hero-cta .btn { flex: 1 1 40%; min-height: 40px; } .hero-sub { font-size: 0.9375rem; max-width: 40ch; } .hero-title { font-size: 1.85rem; } .hero-copy { gap: 8px; } .hero-mark .wordmark { font-size: 26px; } }
      `}</style>
    </Scene>
  );
}
