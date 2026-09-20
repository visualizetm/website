// ScaleIn: an image or card settles into place, once, as it enters the
// viewport. It starts oversized, transparent and soft, and settles back to
// its true size, opaque and sharp. The only one of the new helpers that is not
// scroll-scrubbed: it is a one-shot CSS transition on the same
// IntersectionObserver Reveal uses, which is why it is safe on every page,
// not just Home.
//
// `soft` is the card variant: from 0.97 and no blur (text must never blur).
//
// Under reduced motion useRevealOnce reports "already in view" on the first
// render, so the final state paints immediately with no transition.
import { cx, useMotionPreference, useRevealOnce } from './shared';

export function ScaleIn({
  as: Tag = 'div',
  delay = 0,
  soft = false,
  threshold = 0.15,
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
      className={cx('m-scalein', soft && 'm-scalein--soft', visible && 'm-scalein--in', className)}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
}
