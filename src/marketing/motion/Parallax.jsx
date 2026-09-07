// Parallax: a subtle translateY drift as the user scrolls, for a single
// overlapping image or element. Capped at MAX_TRAVEL px either direction.
// Off entirely under prefers-reduced-motion or on a touch / no-hover /
// coarse-pointer device (see src/marketing/motion/shared.js) - on those
// devices this renders as a plain, static wrapper with no listeners at all.
import { useEffect, useRef, useState } from 'react';
import { cx, useCoarsePointer, useMotionPreference } from './shared';

const MAX_TRAVEL = 24;

export function Parallax({
  as: Tag = 'div',
  factor = 0.15,
  max = MAX_TRAVEL,
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useMotionPreference();
  const coarse = useCoarsePointer();
  const disabled = reduced || coarse;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (disabled) { setOffset(0); return undefined; }
    const el = ref.current;
    if (!el) return undefined;

    const cap = Math.min(Math.abs(max), MAX_TRAVEL);
    let raf = 0;
    const measure = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elCenter = rect.top + rect.height / 2;
      const delta = (viewportCenter - elCenter) * factor;
      setOffset(Math.max(-cap, Math.min(cap, delta)));
    };
    const onScrollOrResize = () => { if (!raf) raf = requestAnimationFrame(measure); };

    measure();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [disabled, factor, max]);

  const mergedStyle = { ...style };
  if (!disabled) {
    mergedStyle.transform = `translateY(${offset.toFixed(2)}px)`;
    mergedStyle.willChange = 'transform';
  }

  return (
    <Tag ref={ref} className={cx('m-parallax', className)} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  );
}
