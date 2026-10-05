import { useEffect } from 'react';

/* A sideways row that reads as scrollable (client docs job, part 5): the row says which edge has more through data-fade (none, start,
 * end, both) and the CSS fades that edge, so a chip is never cut off with no sign that the row moves. Nothing here scrolls anything;
 * the row's own overflow does. */
export default function useScrollFade(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth; const x = el.scrollLeft;
      el.dataset.fade = max <= 2 ? 'none' : x <= 2 ? 'end' : x >= max - 2 ? 'start' : 'both';
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); window.removeEventListener('resize', update); };
  }, [ref]);
}
