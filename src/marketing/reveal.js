/* The reveal (the faster landing prompt): one IntersectionObserver for the
 * whole page, reveal once.
 *
 * A section (or a block inside a spotlight chapter) carries the class m-rv
 * and asks to be observed; when about a fifth of a screen of it has
 * entered from the bottom it gets data-in and the stylesheet fades it in and
 * rises it 20px over 500ms, its data-step children a short stagger behind
 * (the whole section is done inside 800ms). It is then unobserved: scrolling
 * back up never hides it and never replays it, which is what makes the page
 * scroll without jank. Reduced motion never observes anything: the element
 * is marked in at once and the stylesheet shows it with no movement.
 *
 * REVEAL_REPLAY is the old behaviour (hide on leaving, reveal again on the
 * next entry), kept behind this one flag, off. It is not read from anywhere
 * but here. Opacity and transform only; will-change is on while the
 * transition runs and taken off after it. */
import { prefersReducedMotion } from './motion/shared';

export const REVEAL_REPLAY = false;
const DONE_MS = 900;
const MARGIN = '0px 0px -15% 0px';

let io = null;
const timers = new WeakMap();

const show = (el) => {
  el.setAttribute('data-in', '');
  clearTimeout(timers.get(el));
  timers.set(el, setTimeout(() => el.setAttribute('data-done', ''), DONE_MS));
};
const hide = (el) => {
  el.removeAttribute('data-in');
  el.removeAttribute('data-done');
  clearTimeout(timers.get(el));
};

function observer() {
  if (io) return io;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { show(e.target); if (!REVEAL_REPLAY) io.unobserve(e.target); } else if (REVEAL_REPLAY) hide(e.target);
    }
  }, { threshold: 0, rootMargin: MARGIN });
  return io;
}

/** Observes `el` for its one reveal. Returns the stop function for an unmount. */
export function observeReveal(el) {
  if (!el) return () => {};
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { el.setAttribute('data-in', ''); el.setAttribute('data-done', ''); return () => {}; }
  observer().observe(el);
  return () => { io?.unobserve(el); clearTimeout(timers.get(el)); };
}
