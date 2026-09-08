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
// Touch and reduced motion get a vertical stack instead: same cards, same
// order, no sideways motion and nothing held. On touch the page itself
// snaps gently (proximity, never mandatory) so a card tends to settle
// centred rather than half cut off; the class is added to <html> only while
// a track is mounted on a coarse pointer, and removed after.
import { useEffect, useRef } from 'react';
import { getScrollEngine, scrubValue } from '../scroll';
import { cx, useCoarsePointer } from './shared';
import { useScrollEngine } from './useScroll';

const DESKTOP_QUERY = '(min-width: 861px) and (pointer: fine)';
const SNAP_CLASS = 'm-snap-y';

export function TrackScroll({
  as: Tag = 'section',
  className = '',
  rowClassName = '',
  children,
  ...rest
}) {
  const ref = useRef(null);
  const innerRef = useRef(null);
  const rowRef = useRef(null);
  const state = useScrollEngine();
  const coarse = useCoarsePointer();

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
      const measure = () => {
        const distance = Math.max(0, row.scrollWidth - inner.clientWidth);
        section.style.setProperty('--track-d', `${distance}px`);
        section.style.height = `${window.innerHeight + distance}px`;
      };

      /* Tab moves focus through the cards in DOM order, but their position
       * on screen is a function of how far the page has scrolled, so the
       * browser's own "scroll the focused element into view" cannot reach a
       * card that is still off to the right. This puts the page exactly
       * where that card is visible. Without it the row is keyboard
       * reachable but not keyboard visible, which is worse than either. */
      const onFocusIn = (e) => {
        const card = e.target.closest?.('.m-track-row > *');
        if (!card) return;
        const distance = Math.max(0, row.scrollWidth - inner.clientWidth);
        if (!distance) return;
        const needed = Math.min(distance, Math.max(0, card.offsetLeft + card.offsetWidth - inner.clientWidth + 24));
        /* Layout offsets, not getBoundingClientRect: Home wraps this
         * section in a Curtain, whose transform moves the rect by up to a
         * sixth of a viewport depending on where the page currently is.
         * offsetTop ignores transforms, so it gives the settled position
         * the page will actually be in once it arrives. */
        let top = needed;
        for (let n = section; n; n = n.offsetParent) top += n.offsetTop;
        if (eng.lenis) eng.lenis.scrollTo(top, { immediate: true });
        else window.scrollTo({ top, behavior: 'auto' });
      };

      section.classList.add('m-track--h');
      row.addEventListener('focusin', onFocusIn);
      measure();

      const trigger = eng.ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: scrubValue(),
        onRefreshInit: () => { section.style.height = ''; },
        onRefresh: measure,
        onUpdate: (self) => { section.style.setProperty('--track-p', self.progress.toFixed(4)); },
      });

      return () => {
        trigger.kill();
        row.removeEventListener('focusin', onFocusIn);
        section.classList.remove('m-track--h');
        section.style.height = '';
        section.style.removeProperty('--track-d');
        section.style.removeProperty('--track-p');
      };
    });

    return () => mm.revert();
  }, [state]);

  useEffect(() => {
    if (!coarse || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    root.classList.add(SNAP_CLASS);
    return () => root.classList.remove(SNAP_CLASS);
  }, [coarse]);

  return (
    <Tag ref={ref} className={cx('m-track', className)} {...rest}>
      <div ref={innerRef} className="m-track-inner">
        <div className="m-track-viewport">
          <div ref={rowRef} className={cx('m-track-row', rowClassName)}>
            {children}
          </div>
        </div>
      </div>
    </Tag>
  );
}
