// WordReveal: a headline whose words rise into place one after another as
// the heading crosses the viewport, scrubbed, so scrolling back up puts them
// away again.
//
// The text is split into one span per word, each wrapped in a clipping span
// so a word rises out from behind its own line rather than sliding over the
// line above. The spaces between words stay real text nodes, so the heading
// still reads, copies, and is announced as one sentence.
//
// Three states, and the heading is legible in all of them: 'off' (reduced
// motion, admin host, failed import) paints every word at rest, 'loading'
// holds them just below the line for the few frames before gsap arrives, and
// 'on' hands them to a scrubbed timeline.
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { getScrollEngine, scrubValue } from '../scroll';
import { cx } from './shared';
import { useScrollEngine } from './useScroll';

export function WordReveal({
  as: Tag = 'h2',
  className = '',
  start = 'top 85%',
  end = 'top 45%',
  children,
  ...rest
}) {
  const ref = useRef(null);
  const state = useScrollEngine();
  const text = String(children ?? '');
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    if (state !== 'on' || !ref.current) return undefined;
    const eng = getScrollEngine();
    if (!eng) return undefined;

    const targets = ref.current.querySelectorAll('.m-word-i');
    if (!targets.length) return undefined;

    /* A heading that is already on screen when the page loads has no
     * scroll left between its start and end positions, so a scrubbed
     * reveal would sit at progress 0 forever and the heading would never
     * appear. Those play once on their own clock instead; only headings
     * still below the fold are handed to the scroll. */
    const aboveFold = ref.current.getBoundingClientRect().top < window.innerHeight * 0.6;
    const from = { yPercent: 110, opacity: 0 };
    const to = aboveFold
      ? { yPercent: 0, opacity: 1, ease: 'power3.out', duration: 0.7, stagger: 0.06 }
      : { yPercent: 0, opacity: 1, ease: 'none', stagger: 0.25, scrollTrigger: { trigger: ref.current, start, end, scrub: scrubValue() } };

    const tween = eng.gsap.fromTo(targets, from, to);

    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [state, start, end, words.length]);

  return (
    <Tag
      ref={ref}
      className={cx('m-words', state === 'off' && 'm-words--static', className)}
      {...rest}
    >
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="m-word"><span className="m-word-i">{word}</span></span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </Tag>
  );
}
