/* Site Prompt 6, Part 1: the scroll engine, marketing host only.
 *
 * gsap + ScrollTrigger and lenis are loaded through dynamic import() from
 * this one module, so they land in their own chunks and the admin bundle
 * never references them (verified in the build output, see
 * reports/SITE-06-REPORT.md). Three gates decide what loads:
 *
 *   admin host        -> nothing loads at all
 *   reduced motion    -> nothing loads at all; every helper renders its
 *                        final state with a plain Reveal fade instead
 *   touch / coarse    -> ScrollTrigger still loads (scroll-driven
 *                        animation is fine on a phone), Lenis does not
 *                        (never hijack native mobile scrolling)
 *
 * Nothing here runs during render. A helper asks for the engine in an
 * effect; until it resolves the helper shows its "engine is coming" state,
 * and if the import fails the helpers fall back to visible-and-static
 * rather than leaving content hidden behind a script that never arrived.
 */
import { IS_ADMIN_HOST } from '../lib/adminPaths';
import { prefersReducedMotion, isCoarsePointer } from './motion/shared';

let enginePromise = null;
let engine = null;

/** Whether the heavy scroll engine is allowed to load at all. Synchronous,
 * so a helper can decide its very first frame (hidden and waiting for the
 * engine, or visible and static) without a flash either way. */
export function scrollEngineAllowed() {
  if (typeof window === 'undefined') return false;
  if (IS_ADMIN_HOST) return false;
  return !prefersReducedMotion();
}

/** Resolves to { gsap, ScrollTrigger, lenis } or null when not allowed or
 * the import failed. Loads once per session; every caller shares it. */
export function loadScrollEngine() {
  if (!scrollEngineAllowed()) return Promise.resolve(null);
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    try {
      const [gsapMod, stMod] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      const gsap = gsapMod.gsap || gsapMod.default;
      const ScrollTrigger = stMod.ScrollTrigger || stMod.default;
      gsap.registerPlugin(ScrollTrigger);

      /* iOS Safari resizes the viewport as its address bar hides and shows.
       * Without this, every one of those counts as a resize, ScrollTrigger
       * refreshes mid-scroll, and a pinned section re-measures under the
       * reader's finger. The heights themselves are in svh (see --svh in
       * src/index.css), which does not move with the bar either. */
      ScrollTrigger.config({ ignoreMobileResize: true });

      let lenis = null;
      if (!isCoarsePointer()) {
        const { default: Lenis } = await import('lenis');
        lenis = new Lenis({ autoRaf: false, duration: 1.05, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      }

      engine = { gsap, ScrollTrigger, lenis };
      return engine;
    } catch {
      engine = null;
      return null;
    }
  })();

  return enginePromise;
}

/* Scrub smoothing (Site Prompt 8, check 2). `true` ties the animation to
 * the scroll position exactly, which on a phone means every frame of the
 * animation waits on the compositor's scroll and reads as lag under the
 * finger. A small number gives ScrollTrigger half a second of catch-up
 * instead, which is smoother on touch and imperceptible with a wheel. */
export function scrubValue() {
  return isCoarsePointer() ? 0.5 : true;
}

/** The engine if it has already loaded, else null. Never triggers a load. */
export function getScrollEngine() {
  return engine;
}

/** Re-measures every pinned and scrubbed trigger. Call after a route change
 * and after data that changes a pinned section's height arrives (Home's
 * showcase fetch), otherwise pins measure against the pre-data layout. */
export function refreshScrollTriggers() {
  if (!engine) return;
  engine.ScrollTrigger.refresh();
}

/** Stops Lenis smoothing and kills every trigger. Only used if the app ever
 * tears the marketing tree down inside one session. */
export function destroyScrollEngine() {
  if (!engine) return;
  engine.ScrollTrigger.getAll().forEach(t => t.kill());
  engine.lenis?.destroy();
  engine = null;
  enginePromise = null;
}
