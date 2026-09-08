// Curtain: the next section arrives over the one before it, rounded at the
// top, while the section it covers scales back a little and dims.
//
// Two halves. The curtain itself is pulled up by a negative margin and
// pushed back down by translateY(var(--curtain-p)), so at progress 0 it sits
// exactly where normal flow put it and at progress 1 it has slid a sixth of
// a viewport over its predecessor. The predecessor is found at runtime
// (previousElementSibling) and written to directly from the scroll frame:
// transform and opacity only, both composited, no layout property touched.
//
// With no engine the negative margin is not applied, the shadow and radius
// still read as an edge, and the previous section is never written to.
import { useRef } from 'react';
import { cx } from './shared';
import { useScrollEngine, useScrollProgress } from './useScroll';

const PREV_SCALE = 0.04;   // the covered section settles at 0.96
const PREV_FADE = 0.4;     // how far it dims

export function Curtain({
  as: Tag = 'section',
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const prev = useRef(null);
  const hinted = useRef(false);
  const state = useScrollEngine();
  const active = state !== 'off';

  useScrollProgress(ref, {
    start: 'top bottom',
    end: 'top center',
    cssVar: '--curtain-p',
    onUpdate: (p, el) => {
      if (!prev.current) {
        const sibling = el.previousElementSibling;
        if (!sibling) return;
        prev.current = sibling;
        sibling.style.transformOrigin = 'center top';
      }
      /* will-change only while this curtain is actually moving (Site
       * Prompt 8, check 7): left on permanently it holds a layer for
       * every curtained section for the life of the page, which on a
       * phone is exactly the memory that makes the rest of the scroll
       * stutter. Two writes per frame, both composited, no layout read. */
      const active = p > 0.001 && p < 0.999;
      if (active !== hinted.current) {
        hinted.current = active;
        prev.current.style.willChange = active ? 'transform, opacity' : '';
        el.style.willChange = active ? 'transform' : '';
      }
      prev.current.style.transform = `scale(${(1 - PREV_SCALE * p).toFixed(4)})`;
      prev.current.style.opacity = `${(1 - PREV_FADE * p).toFixed(3)}`;
    },
  });

  return (
    <Tag
      ref={ref}
      className={cx('m-curtain', active && 'm-curtain--active', className)}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
