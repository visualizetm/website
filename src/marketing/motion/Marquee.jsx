// Marquee: a slow, seamless, horizontal infinite-loop scroller (for a
// future logo strip). Pauses on hover by default (CSS animation-play-state,
// no JS timers to fight). Under prefers-reduced-motion it is static: the
// content renders once, in a manually-scrollable row, no animation.
import { Children } from 'react';
import { cx, useMotionPreference } from './shared';

export function Marquee({
  children,
  duration = 30,
  gap = 48,
  pauseOnHover = true,
  className = '',
  trackClassName = '',
  ...rest
}) {
  const reduced = useMotionPreference();
  const items = Children.toArray(children);

  if (reduced) {
    return (
      <div className={cx('m-marquee', 'm-marquee--static', className)} {...rest}>
        <div className={cx('m-marquee-track', 'm-marquee-track--static', trackClassName)} style={{ gap: `${gap}px` }}>
          {items}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx('m-marquee', !pauseOnHover && 'm-marquee--no-hover-pause', className)}
      {...rest}
    >
      <div
        className={cx('m-marquee-track', trackClassName)}
        style={{ '--m-marquee-duration': `${duration}s` }}
      >
        {/* Two identical groups, each carrying its own trailing gap (not a
            gap on the track) so the two groups are exactly the same width -
            translateX(-50%) then lands precisely one group-width over, the
            seam invisible. A track-level gap would break that symmetry. */}
        <div className="m-marquee-group" style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}>{items}</div>
        <div className="m-marquee-group" style={{ gap: `${gap}px`, paddingRight: `${gap}px` }} aria-hidden="true">{items}</div>
      </div>
    </div>
  );
}
