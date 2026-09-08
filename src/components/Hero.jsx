import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin, WordReveal, useScrollEngine } from '../marketing/motion';
import { getScrollEngine } from '../marketing/scroll';
import { capImageWidth } from '../marketing/showcase';
import { CALENDLY_URL } from '../marketing/links';

const DEFAULT_COVER = '/hero-default.svg';
const MAX_CARDS = 8;
// Viewports of hold per card. Enough scroll for one card to leave and the
// next to arrive without the flip feeling either abrupt or laborious.
const VH_PER_CARD = 0.8;

/* Site Prompt 7, Part 1: the hero is a deck of every showcased cover, and
 * scrolling flips through it.
 *
 * The whole animation is one number. Pin scrubs --pin-p from 0 to 1 across
 * the hold, and each card computes its own two derived values from it in
 * CSS, off its index:
 *
 *   --u = --pin-p * count - index     where it is in its own turn
 *   --t = clamp(0, --u, 1)            how far it has left
 *   --r = clamp(0, --u + 1, 1)        how far it has risen into place
 *
 * A card sits in place while --r is 1 and --t is 0, rises as the card
 * before it leaves (--r is the previous card's --t), and leaves by sliding
 * up while scaling to 0.96 and fading out. Because z-index descends with
 * the index and never changes, the card leaving is always painted above
 * the one arriving, so the two never cross incorrectly. No React state
 * changes while any of this happens.
 *
 * Without the engine (reduced motion, a failed import) or with one cover,
 * the deck is the first cover shown plainly with the rest as a horizontal
 * row beneath it: same links, same order, no motion and nothing pinned.
 * With no published clients at all it is the designed default graphic. */
export default function Hero({ items }) {
  const deck = (items || []).filter(i => i?.cover).slice(0, MAX_CARDS);
  const state = useScrollEngine();
  const stacked = state === 'on' && deck.length > 1;
  const first = deck[0];

  useEffect(() => {
    if (!first?.cover) return undefined;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = capImageWidth(first.cover);
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [first?.cover]);

  const copy = (
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
  );

  if (!stacked) {
    return (
      <section className="hero hero--static">
        {copy}
        <div className="hero-deck-wrap">
          <div className="hero-deck hero-deck--static">
            <HeroCard item={first} index={0} count={1} priority />
          </div>
        </div>
        {deck.length > 1 && (
          <ul className="hero-row" aria-label="More client work">
            {deck.slice(1).map((item, i) => (
              <li key={item.slug || i}><HeroCard item={item} index={i + 1} count={deck.length} small /></li>
            ))}
          </ul>
        )}
        <style>{heroStyles}</style>
      </section>
    );
  }

  return <HeroStack deck={deck} copy={copy} />;
}

/* The pinned deck. Separated so the hooks it needs (the active dot, the
 * jump-to-card handler) only exist when there is a deck to run them on. */
function HeroStack({ deck, copy }) {
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const count = deck.length;

  // Pin calls this every scroll frame; setState only when the card in
  // place actually changes, so this costs at most `count` renders.
  const onProgress = useCallback((p) => {
    const i = Math.max(0, Math.min(count - 1, Math.round(p * count)));
    setActive(prev => (prev === i ? prev : i));
  }, [count]);

  /* A dot scrolls to the point where its card is exactly in place, which
   * is --pin-p = index / count, measured from layout offsets rather than
   * the rect: Home wraps what follows in a Curtain whose transform moves
   * rects around, and the hero's own scale under it does the same. */
  const goTo = (i) => {
    const section = rootRef.current?.closest('.m-pin');
    if (!section) return;
    let top = i * VH_PER_CARD * window.innerHeight;
    for (let n = section; n; n = n.offsetParent) top += n.offsetTop;
    const eng = getScrollEngine();
    if (eng?.lenis) eng.lenis.scrollTo(top);
    else window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <Pin
      height={count * VH_PER_CARD}
      className="hero hero--stacked"
      innerClassName="hero-inner"
      onProgress={onProgress}
    >
      {copy}
      <div className="hero-deck-wrap">
        <div className="hero-deck" style={{ '--n': count }}>
          {deck.map((item, i) => (
            <HeroCard key={item.slug || i} item={item} index={i} count={count} priority={i === 0} last={i === count - 1} />
          ))}
        </div>
      </div>
      <div className="hero-dots" ref={rootRef} role="tablist" aria-label="Client work">
        {deck.map((item, i) => (
          <button
            key={item.slug || i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`${item.displayName || 'Client'}, ${i + 1} of ${count}`}
            className={`hero-dot ${i === active ? 'is-active' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
      <style>{heroStyles}</style>
    </Pin>
  );
}

function HeroCard({ item, index, count, priority = false, small = false, last = false }) {
  const src = item?.cover ? capImageWidth(item.cover) : DEFAULT_COVER;
  const name = item?.displayName || '';
  const inner = (
    <>
      <span className="img-fit img-fit--16x9 hero-card-media">
        <img
          src={src}
          alt=""
          width={1600}
          height={900}
          loading={priority ? undefined : 'lazy'}
          fetchpriority={priority ? 'high' : undefined}
        />
      </span>
      {name && (
        <span className="hero-card-label">
          <span className="hero-card-name">{name}</span>
          {item.type && <span className="hero-card-type">{item.type}</span>}
        </span>
      )}
    </>
  );

  const cls = `hero-card${small ? ' hero-card--small' : ''}${last ? ' hero-card--last' : ''}`;
  const style = { '--i': index, '--n': count };

  if (!item?.slug) return <span className={cls} style={style}>{inner}</span>;
  return <Link to={`/clients/${item.slug}`} className={cls} style={style}>{inner}</Link>;
}

const heroStyles = `
  .hero { position: relative; }
  /* var(--space-24) of top padding clears the floating navbar, which sits
     over the top of the panel once the hero is pinned. */
  .hero-inner { gap: var(--space-6); padding: var(--space-24) 0 var(--space-8); }
  .hero--static { padding: var(--space-24) 0 var(--space-12); }

  .hero-copy {
    max-width: 780px; margin: 0 auto; text-align: center;
    opacity: clamp(0, calc(1 - var(--pin-p, 0) * 2.4), 1);
    transform: translate3d(0, calc(var(--pin-p, 0) * -80px), 0);
    will-change: transform, opacity;
  }
  .m-pin--active .hero-copy { flex: 0 0 auto; }
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

  /* The deck: every card absolutely stacked on the same box, so the flip
     never reflows anything. max-height lets a short window crop the box
     rather than push the dots off screen; the image covers either way. */
  .hero-deck-wrap {
    display: flex; align-items: center; justify-content: center;
    width: 100%; padding: 0 var(--space-4);
  }
  .m-pin--active .hero-deck-wrap { flex: 1 1 auto; min-height: 0; }
  .hero-deck {
    position: relative;
    width: 100%; max-width: 1100px; max-height: 100%;
    aspect-ratio: 16 / 9;
  }
  .hero-deck--static { position: relative; }

  .hero-card {
    position: absolute; inset: 0;
    display: block;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-chrome-strong);
    z-index: calc(var(--n) - var(--i));
    --u: calc(var(--pin-p, 0) * var(--n) - var(--i));
    --t: clamp(0, var(--u), 1);
    --r: clamp(0, calc(var(--u) + 1), 1);
    transform:
      translate3d(0, calc((1 - var(--r)) * 26px + var(--t) * -112%), 0)
      scale(calc(0.96 + 0.04 * var(--r) - 0.04 * var(--t)));
    opacity: calc(0.35 + 0.65 * var(--r) - var(--t));
    will-change: transform, opacity;
  }
  /* The last card never leaves: it is what the Curtain of the next
     section arrives over, and an empty deck at the end of the hold would
     be a hole in the page. */
  .hero-card--last { --t: 0; }
  .hero-deck--static .hero-card { transform: none; opacity: 1; }
  .hero-card-media { height: 100%; border-radius: inherit; }
  .m-pin--active .hero-card-media { aspect-ratio: auto; }

  .hero-card-label {
    position: absolute; left: 0; bottom: 0; right: 0;
    display: flex; flex-direction: column; gap: 2px;
    padding: var(--space-8) var(--space-5) var(--space-4);
    background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.72) 100%);
    text-align: left;
  }
  /* This label sits on a dark scrim over somebody's photograph, so it
     reads light whatever the page ground is doing; --uc-* are the two
     theme-invariant light values already in the token block. */
  .hero-card-name { font-size: 1.0625rem; font-weight: 700; color: var(--uc-text); }
  .hero-card-type { font-size: 0.8125rem; color: var(--uc-text-secondary); }

  /* Fallback row: the rest of the covers, smaller, scrollable sideways. */
  .hero-row {
    display: flex; gap: var(--space-4); list-style: none;
    margin-top: var(--space-6); padding: 0 var(--space-4) var(--space-2);
    overflow-x: auto; scroll-snap-type: x proximity;
  }
  .hero-row > li { flex: 0 0 260px; scroll-snap-align: start; }
  .hero-card--small {
    position: relative; inset: auto;
    transform: none; opacity: 1; z-index: auto;
    box-shadow: none; border: 1px solid var(--border);
  }
  .hero-card--small .hero-card-label { padding: var(--space-6) var(--space-3) var(--space-3); }

  .hero-dots {
    display: flex; justify-content: center; flex-wrap: wrap; gap: 2px;
    margin-top: var(--space-4);
  }
  .hero-dot {
    width: 44px; height: 44px; padding: 0;
    background: none; border: none; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .hero-dot::after {
    content: ''; width: 8px; height: 8px; border-radius: 50%;
    background: var(--border-light);
    transition: background var(--m-dur) var(--m-ease), transform var(--m-dur) var(--m-ease);
  }
  .hero-dot.is-active::after { background: var(--brand); transform: scale(1.4); }

  @media (max-width: 700px) {
    .hero-inner { padding-top: var(--space-20); }
    .hero-card-label { padding: var(--space-6) var(--space-4) var(--space-3); }
  }
`;
