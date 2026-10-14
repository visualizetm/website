// Section: a landing or Projects page section that reveals once as one
// piece (src/marketing/reveal.js). Native scroll, nothing pinned, no engine.
//
//   <Section tone="b" label="How it works">
//     <h2 data-step="0">...</h2>
//     <p data-step="1">...</p>
//   </Section>
//
// tone a is the page ground, b the elevated surface; consecutive sections
// alternate so the boundary reads as a shift. data-step children stagger a
// beat each behind the section's own fade. `reveal={false}` renders the
// section shown from the first frame (the hero: text first, then motion).
// Block is the same reveal on any element inside a section (a spotlight
// chapter's panel, colours and applications, each arriving on its own).
import { useEffect, useRef } from 'react';
import { observeReveal } from '../reveal';
import { cx } from './shared';

export function Section({ as: Tag = 'section', tone = 'a', label, reveal = true, className = '', children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => (reveal ? observeReveal(ref.current) : undefined), [reveal]);
  return (
    <Tag ref={ref} className={cx('m-sec', `m-sec--${tone === 'b' ? 'b' : 'a'}`, reveal && 'm-rv', className)} aria-label={label} {...rest}>
      {children}
    </Tag>
  );
}

export function Block({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => observeReveal(ref.current), []);
  return <Tag ref={ref} className={cx('m-rv', className)} {...rest}>{children}</Tag>;
}
