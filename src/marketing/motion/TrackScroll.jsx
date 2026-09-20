// TrackScroll: a row of cards that moves sideways while the page scrolls
// down, the section held still until the row has run out.
//
// Desktop with a fine pointer only. The hold is position: sticky and the
// row is moved by a CSS transform reading --track-p, the same shape as Pin,
// rather than ScrollTrigger's own pin: true. That matters because Home puts
// this section inside a Curtain, and a Curtain carries a transform: a
// transformed ancestor becomes the containing block for position: fixed,
// which is what ScrollTrigger's pinning uses, so a pinned track inside one
// drifts out of the viewport. Sticky has no such problem.
//
// The wrapper's height is one viewport plus exactly the distance the row
// overflows, measured on every ScrollTrigger refresh, so a resize, a font
// swap or a late fetch never leaves the last card unreachable. Height is
// set, never animated.
//
// Site Prompt 9 (the business type reveal): the heading rides inside the
// sticky panel (`head`), the row is padded so the first and last card can
// both reach the centre, and every scroll frame writes each card's
// closeness to the centre (0 far, 1 dead centre) to --card-c on the card,
// which the card's own CSS turns into scale, opacity, the inset outline
// and the sequenced bullet reveal. Scrubbed, so scrolling back plays it in
// reverse. The card at the centre carries data-center; data-landed is added
// once as it arrives (the icon's single pulse) and cleared once it has
// clearly left, so it pulses again on the next landing. `segments` draws
// the progress strip under the row: one segment per card, the active one
// filling as its card holds the centre, each a button that scrolls to its
// card.
//
// Touch and reduced motion get a vertical stack instead: same cards, same
// order, no sideways motion and nothing held.
//
// Site Prompt 8, check 4: that stack used to put scroll-snap-type on
// <html> while it was mounted, so the whole page snapped on a phone. Even
// at proximity that fights a flick: the page decides where the reader
// meant to stop. Snapping now happens only inside a scroller that owns
// its own axis (the testimonial carousel, the hero's overflow row), never
// on the document.
import { useEffect, useRef, useState } from 'react';
import { getScrollEngine, scrubValue } from '../scroll';
import { cx } from './shared';
import { useScrollEngine } from './useScroll';

const DESKTOP_QUERY = '(min-width: 861px) and (pointer: fine)';
const CENTER_AT = 0.9;    // closeness at which a card counts as the one at the centre
const LAND_AT = 0.97;     // closeness at which the landing pulse fires
const LEAVE_AT = 0.5;     // closeness below which the landing is forgotten

export function TrackScroll({
  as: Tag = 'section',
  className = '',
  rowClassName = '',
  head = null,
  segments = null,
  progressLabel = 'Cards',
  children,
  ...rest
}) {
  const ref = useRef(null);
  const innerRef = useRef(null);
  const rowRef = useRef(null);
  const progressRef = useRef(null);
  const goToRef = useRef(null);
  const [active, setActive] = useState(0);
  const state = useScrollEngine();

  useEffect(() => {
    if (state !== 'on' || !ref.current) return undefined;
    const eng = getScrollEngine();
    if (!eng) return undefined;

    const section = ref.current;
    const inner = innerRef.current;
    const row = rowRef.current;
    const mm = eng.gsap.matchMedia();

    /* The horizontal layout is a media query in the stylesheet, so the
     * class that switches it on is added here rather than in render: only
     * inside this matchMedia does the app know the breakpoint, the pointer
     * and the engine all agree. Leaving the breakpoint reverts it. */
    mm.add(DESKTOP_QUERY, () => {
      const cards = Array.from(row.children);
      const segs = progressRef.current ? Array.from(progressRef.current.querySelectorAll('.m-track-seg')) : [];
      let distance = 0;
      let centers = [];    // each card's centre, in row coordinates, before the transform
      let span = 1;        // one card plus the gap: the distance over which closeness runs 1 to 0
      const lastC = cards.map(() => '');
      const landed = cards.map(() => false);
      let lastActive = -1;

      /* The distance is from the card centres, not scrollWidth: the row
       * is padded so its first and last card can both sit at the centre,
       * and a flex container's trailing padding is not part of its
       * scrollable overflow, so scrollWidth stopped short of the last
       * card by half a viewport. From the first centre (where the CSS
       * padding puts it, at the viewport's own centre) to the last. */
      const measure = () => {
        centers = cards.map(c => c.offsetLeft + c.offsetWidth / 2);
        const cw = inner.clientWidth;
        distance = cards.length ? Math.max(0, Math.round(centers[centers.length - 1] - cw / 2)) : 0;
        span = cards.length > 1 ? Math.max(1, centers[1] - centers[0]) : Math.max(1, cards[0]?.offsetWidth || 1);
        section.style.setProperty('--track-d', `${distance}px`);
        section.style.height = `${window.innerHeight + distance}px`;
      };

      /* Where the page has to be for card i to sit at the centre: the row
       * has moved p * distance, so p is the card's offset from the
       * viewport centre over the whole distance. Layout offsets, not
       * rects, for the reason given in onFocusIn below. */
      const progressFor = (i) => (distance ? Math.min(1, Math.max(0, (centers[i] - inner.clientWidth / 2) / distance)) : 0);
      const scrollToCard = (i) => {
        let top = progressFor(i) * distance;
        for (let n = section; n; n = n.offsetParent) top += n.offsetTop;
        if (eng.lenis) eng.lenis.scrollTo(top);
        else window.scrollTo({ top, behavior: 'smooth' });
      };
      goToRef.current = scrollToCard;

      /* Per frame: one closeness value per card, written only when it has
       * moved by a hundredth, and the two class flips. No layout reads:
       * everything comes from the numbers measured on refresh. */
      const paint = (p) => {
        const cx = inner.clientWidth / 2 + p * distance;
        let best = -1; let bestC = 0;
        cards.forEach((card, i) => {
          const c = Math.max(0, Math.min(1, 1 - Math.abs(centers[i] - cx) / span));
          const key = c.toFixed(2);
          if (key !== lastC[i]) {
            lastC[i] = key;
            card.style.setProperty('--card-c', key);
            if (segs[i]) segs[i].style.setProperty('--seg-p', key);
          }
          if (c > bestC) { bestC = c; best = i; }
          /* Data attributes rather than classes: the cards are React
           * elements (ScaleIn) that re-render their className once when
           * they enter the viewport, which would wipe a class set here. */
          if (c >= LAND_AT && !landed[i]) { landed[i] = true; card.setAttribute('data-landed', ''); }
          else if (c < LEAVE_AT && landed[i]) { landed[i] = false; card.removeAttribute('data-landed'); }
        });
        const current = bestC >= CENTER_AT ? best : lastActive;
        if (current !== lastActive && current >= 0) {
          cards[lastActive]?.removeAttribute('data-center');
          cards[current].setAttribute('data-center', '');
          lastActive = current;
          setActive(current);
        }
      };

      /* Tab moves focus through the cards in DOM order, but their position
       * on screen is a function of how far the page has scrolled, so the
       * browser's own "scroll the focused element into view" cannot reach a
       * card that is still off to the right. This puts the page exactly
       * where that card is centred. Without it the row is keyboard
       * reachable but not keyboard visible, which is worse than either.
       * Layout offsets, not getBoundingClientRect: Home wraps this section
       * in a Curtain, whose transform moves the rect by up to a sixth of a
       * viewport depending on where the page currently is. offsetTop
       * ignores transforms, so it gives the settled position. */
      const onFocusIn = (e) => {
        const card = e.target.closest?.('.m-track-row > *');
        const i = card ? cards.indexOf(card) : -1;
        if (i < 0 || !distance) return;
        let top = progressFor(i) * distance;
        for (let n = section; n; n = n.offsetParent) top += n.offsetTop;
        if (eng.lenis) eng.lenis.scrollTo(top, { immediate: true });
        else window.scrollTo({ top, behavior: 'auto' });
      };

      section.classList.add('m-track--h');
      row.addEventListener('focusin', onFocusIn);
      measure();
      paint(0);

      /* Start and end as numbers from layout offsets, not 'top top' and
       * 'bottom bottom': ScrollTrigger measures those from the rect, and
       * inside a Curtain the rect sits a sixth of a viewport low while
       * the page is at the top (the curtain's own transform), so the
       * scrub started late and the row was still moving after the panel
       * had let go. The height is measured in onRefreshInit, before
       * ScrollTrigger reads positions; clearing it there instead (the
       * old code) left a one-viewport section to measure, so the end
       * equalled the start and the row jumped straight to its last card. */
      const absTop = () => { let top = 0; for (let n = section; n; n = n.offsetParent) top += n.offsetTop; return top; };
      const trigger = eng.ScrollTrigger.create({
        trigger: section,
        start: () => absTop(),
        end: () => absTop() + distance,
        scrub: scrubValue(),
        onRefreshInit: measure,
        onRefresh: (self) => paint(self.progress),
        onUpdate: (self) => {
          section.style.setProperty('--track-p', self.progress.toFixed(4));
          paint(self.progress);
        },
      });

      return () => {
        trigger.kill();
        goToRef.current = null;
        row.removeEventListener('focusin', onFocusIn);
        section.classList.remove('m-track--h');
        section.style.height = '';
        section.style.removeProperty('--track-d');
        section.style.removeProperty('--track-p');
        cards.forEach((card, i) => {
          card.style.removeProperty('--card-c');
          card.removeAttribute('data-center'); card.removeAttribute('data-landed');
          segs[i]?.style.removeProperty('--seg-p');
        });
      };
    });

    return () => mm.revert();
  }, [state]);

  return (
    <Tag ref={ref} className={cx('m-track', className)} {...rest}>
      <div ref={innerRef} className="m-track-inner">
        {/* The heading lives INSIDE the sticky panel (the gap fix): a
            heading placed before the track scrolls away the moment the
            panel sticks, leaving the cards alone in the middle of an
            otherwise empty viewport for the whole hold. */}
        {head && <div className="m-track-head">{head}</div>}
        <div className="m-track-viewport">
          <div ref={rowRef} className={cx('m-track-row', rowClassName)}>
            {children}
          </div>
        </div>
        {segments && segments.length > 1 && (
          <div ref={progressRef} className="m-track-progress" role="tablist" aria-label={progressLabel}>
            {segments.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                className={cx('m-track-seg', i === active && 'is-active')}
                aria-selected={i === active}
                aria-label={`${label}, ${i + 1} of ${segments.length}`}
                onClick={() => goToRef.current?.(i)}
              >
                <span className="m-track-seg-fill" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Tag>
  );
}
