// Tone: a section changes ground colour as it comes up the page, so the page
// does not read as one flat surface end to end.
//
// The change is the opacity of one absolutely positioned layer painted in
// the destination colour over the section's own background. Crossfading two
// filled layers is compositor work; animating background-color is not, and
// the standing rule is transforms and opacity only.
//
// With no engine the layer sits at full opacity, so the section still shows
// its settled tone rather than reverting to the page ground.
import { useRef } from 'react';
import { cx } from './shared';
import { useScrollEngine, useScrollProgress } from './useScroll';

export function Tone({
  as: Tag = 'section',
  from = 'var(--bg)',
  to = 'var(--bg-elevated)',
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const state = useScrollEngine();

  useScrollProgress(ref, {
    start: 'top bottom',
    end: 'top 40%',
    cssVar: '--tone-p',
  });

  return (
    <Tag
      ref={ref}
      className={cx('m-tone', state === 'off' && 'm-tone--static', className)}
      style={{ ...style, '--tone-from': from, '--tone-to': to }}
      {...rest}
    >
      <span className="m-tone-layer" aria-hidden="true" />
      {children}
    </Tag>
  );
}
