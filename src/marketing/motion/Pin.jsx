// Pin: holds a section still for N extra viewport heights while its children
// animate against how far through that hold the page has scrolled.
//
// The hold is plain CSS position: sticky, not a JS-driven transform, so the
// section never jitters and never fights the browser's own scrolling. The
// wrapper is (height + 1) viewports tall; the inner panel sticks to the top
// for exactly the extra height, which is the window during which --pin-p
// runs 0 to 1 on that panel. Children read var(--pin-p) inside transform
// and opacity, so nothing re-renders while it scrubs.
//
// With no engine (reduced motion, admin host, failed import) the wrapper
// keeps its natural height, nothing sticks, and --pin-p is never written:
// children see its resting value and must be written so that resting value
// is the state a viewer should be left with.
import { useRef } from 'react';
import { cx } from './shared';
import { useScrollEngine, useScrollProgress } from './useScroll';

export function Pin({
  as: Tag = 'section',
  height = 1.5,
  className = '',
  innerClassName = '',
  style,
  onProgress,
  children,
  ...rest
}) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const state = useScrollEngine();
  const active = state !== 'off';

  useScrollProgress(wrapRef, {
    start: 'top top',
    end: 'bottom bottom',
    cssVar: '--pin-p',
    varTarget: innerRef,
    onUpdate: onProgress,
  });

  return (
    <Tag
      ref={wrapRef}
      className={cx('m-pin', active && 'm-pin--active', className)}
      style={{ ...style, '--pin-h': height }}
      {...rest}
    >
      <div ref={innerRef} className={cx('m-pin-inner', innerClassName)}>
        {children}
      </div>
    </Tag>
  );
}
