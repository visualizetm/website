// TrackScroll: a row of cards that moves sideways while the page scrolls
// down, the section held still until the row has run out.
//
// Desktop with a fine pointer only. ScrollTrigger pins the section and
// translates the row by exactly the distance it overflows its viewport,
// recomputed on every refresh (invalidateOnRefresh) so a resize, a font
// swap, or the showcase fetch landing does not leave the last card
// unreachable. gsap.matchMedia owns the setup, so leaving the breakpoint
// tears the whole thing down and restores normal flow.
//
// Touch and reduced motion get a vertical stack instead: same cards, same
// order, no sideways motion and nothing pinned. On touch the page itself
// snaps gently (proximity, never mandatory) so a card tends to settle
// centred rather than half cut off; the class is added to <html> only while
// a track is mounted on a coarse pointer, and removed after.
import { useEffect, useRef } from 'react';
import { getScrollEngine } from '../scroll';
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
  const rowRef = useRef(null);
  const state = useScrollEngine();
  const coarse = useCoarsePointer();

  useEffect(() => {
    if (state !== 'on' || !ref.current || !rowRef.current) return undefined;
    const eng = getScrollEngine();
    if (!eng) return undefined;

    const section = ref.current;
    const row = rowRef.current;
    const mm = eng.gsap.matchMedia();

    mm.add(DESKTOP_QUERY, () => {
      const distance = () => Math.max(0, row.scrollWidth - section.clientWidth);
      const tween = eng.gsap.to(row, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
      return () => { tween.scrollTrigger?.kill(); tween.kill(); };
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
    <Tag ref={ref} className={cx('m-track', state === 'on' && 'm-track--h', className)} {...rest}>
      <div className="m-track-viewport">
        <div ref={rowRef} className={cx('m-track-row', rowClassName)}>
          {children}
        </div>
      </div>
    </Tag>
  );
}
