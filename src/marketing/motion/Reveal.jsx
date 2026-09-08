// Reveal: fades a section in and rises it --m-rise as it enters the
// viewport, once. Stagger: the same behavior applied to a list of children,
// each delayed a step further than the last (capped, see STAGGER_MAX_STEP).
// The .m-reveal / .m-reveal--visible rules live once in src/index.css
// (a marketing utility class, same convention as .wordmark),
// not duplicated into a <style> tag per instance.
import { Children, useMemo } from 'react';
import { cssMs, cx, useMotionPreference, useRevealOnce } from './shared';

// A 7th+ item in a Stagger keeps the delay of the 6th (index 5) rather than
// growing without bound, so a long list never makes the last on-screen item
// wait an ever-longer beat to appear.
const STAGGER_MAX_STEP = 5;

export function Reveal({
  as: Tag = 'div',
  delay = 0,
  threshold = 0.2,
  rootMargin = '0px',
  className = '',
  style,
  children,
  ...rest
}) {
  const reduced = useMotionPreference();
  const [ref, inView] = useRevealOnce({ threshold, rootMargin, disabled: reduced });
  const visible = reduced || inView;

  const mergedStyle = { ...style };
  if (!reduced && delay) mergedStyle.transitionDelay = `${delay}ms`;

  return (
    <Tag
      ref={ref}
      className={cx('m-reveal', visible && 'm-reveal--visible', className)}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Stagger({
  as: Tag = 'div',
  itemAs = 'div',
  threshold = 0.2,
  rootMargin = '0px',
  className = '',
  itemClassName = '',
  style,
  children,
  ...rest
}) {
  const items = Children.toArray(children);
  const stepMs = useMemo(() => cssMs('--m-stagger'), []);

  return (
    <Tag className={cx('m-stagger', className)} style={style} {...rest}>
      {items.map((child, i) => (
        <Reveal
          key={child.key ?? i}
          as={itemAs}
          threshold={threshold}
          rootMargin={rootMargin}
          delay={Math.min(i, STAGGER_MAX_STEP) * stepMs}
          className={itemClassName}
        >
          {child}
        </Reveal>
      ))}
    </Tag>
  );
}
