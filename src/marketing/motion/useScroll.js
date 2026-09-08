/* Site Prompt 6, Part 1: the two hooks every scroll-driven helper is built
 * on. Both degrade to "no engine, render the resting state" on the admin
 * host, under reduced motion, and if the dynamic import ever fails.
 */
import { useEffect, useRef, useState } from 'react';
import { loadScrollEngine, refreshScrollTriggers, scrollEngineAllowed, scrubValue } from '../scroll';

/** 'off' | 'loading' | 'on'. 'off' is decided synchronously on the first
 * render (reduced motion, admin host) so a helper never paints a hidden
 * first frame it will not animate out of. */
export function useScrollEngine() {
  const [state, setState] = useState(() => (scrollEngineAllowed() ? 'loading' : 'off'));

  useEffect(() => {
    if (!scrollEngineAllowed()) { setState('off'); return undefined; }
    let alive = true;
    loadScrollEngine().then((eng) => { if (alive) setState(eng ? 'on' : 'off'); });
    return () => { alive = false; };
  }, []);

  return state;
}

/**
 * Scrubs 0 to 1 while `ref`'s element crosses the viewport, writing the
 * value to a CSS custom property (default `--sp`) on the element (or on
 * `varTarget` when given) every scroll frame. That property is the intended
 * way to consume it: CSS reads it inside transform/opacity, so the value
 * changing does not re-render React at all. `onUpdate` is called with the
 * same number for the rare case JS has to react (Curtain animating its
 * previous sibling).
 *
 * Returns a ref whose `.current` is the latest progress, for reads outside
 * render. With no engine the property is never written, so the resting
 * value (whatever the stylesheet's own fallback says) stands.
 */
export function useScrollProgress(ref, {
  start = 'top bottom',
  end = 'bottom top',
  cssVar = '--sp',
  varTarget = null,
  onUpdate = null,
} = {}) {
  const progress = useRef(0);
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    const el = ref.current;
    if (!el || !scrollEngineAllowed()) return undefined;

    let trigger = null;
    let alive = true;

    loadScrollEngine().then((eng) => {
      if (!alive || !eng || !ref.current) return;
      const target = varTarget?.current || ref.current;
      /* onUpdate runs inside ScrollTrigger's own tick, which is gsap's
       * requestAnimationFrame, so this is already once per frame and never
       * inside a scroll event. It reads no layout, and it skips the write
       * entirely when the rounded value has not moved, so a frame where
       * nothing changed does not invalidate style (Site Prompt 8, check 6).
       * Three decimals is finer than a pixel on any of these. */
      let last = '';
      trigger = eng.ScrollTrigger.create({
        trigger: ref.current,
        start,
        end,
        scrub: scrubValue(),
        onUpdate: (self) => {
          progress.current = self.progress;
          const next = self.progress.toFixed(3);
          if (next === last) return;
          last = next;
          if (cssVar) target.style.setProperty(cssVar, next);
          cb.current?.(self.progress, target);
        },
      });
    });

    return () => { alive = false; trigger?.kill(); };
  }, [ref, start, end, cssVar, varTarget]);

  return progress;
}

/** Re-measures every pinned and scrubbed trigger one frame after `dep`
 * changes. Home passes its showcase payload: a pin that measured the
 * page before the CRM's sections had any content in them would hold for
 * the wrong distance once they did. A no-op when no engine is running. */
export function useScrollRefresh(dep) {
  useEffect(() => {
    if (!scrollEngineAllowed()) return undefined;
    let alive = true;
    const raf = requestAnimationFrame(() => { if (alive) refreshScrollTriggers(); });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [dep]);
}
