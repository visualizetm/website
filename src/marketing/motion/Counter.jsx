// Counter: counts up from 0 to `value` once the element is revealed in the
// viewport, reusing Reveal's IntersectionObserver-once pattern. Under
// prefers-reduced-motion it renders the target value immediately - it never
// counts, not even quickly (a reduced-motion viewer sees the final number
// on the first frame, same as everyone else sees it on the last).
import { useEffect, useRef, useState } from 'react';
import { cx, useMotionPreference, useRevealOnce } from './shared';

const DEFAULT_DURATION = 1200;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function formatValue(n, decimals, prefix, suffix, format) {
  if (format) return format(n);
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

export function Counter({
  as: Tag = 'span',
  value,
  duration = DEFAULT_DURATION,
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
  threshold = 0.2,
  rootMargin = '0px',
  className = '',
  ...rest
}) {
  const reduced = useMotionPreference();
  const [ref, inView] = useRevealOnce({ threshold, rootMargin, disabled: reduced });
  const [display, setDisplay] = useState(() => (reduced || inView ? value : 0));
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced) { setDisplay(value); return undefined; }
    if (!inView) return undefined;

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      setDisplay(value * easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, reduced, value, duration]);

  const rounded = Math.round(display * 10 ** decimals) / 10 ** decimals;

  return (
    <Tag ref={ref} className={cx('m-counter', className)} {...rest}>
      {formatValue(rounded, decimals, prefix, suffix, format)}
    </Tag>
  );
}
