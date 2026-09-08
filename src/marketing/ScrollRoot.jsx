// ScrollRoot: the one place the scroll engine is started and re-measured.
// Renders nothing.
//
// It lives here, in a marketing-only lazy chunk, rather than in App.jsx,
// because App.jsx is the shared entry both hosts download: importing
// src/marketing/scroll.js from there put the loader (and the URLs of the
// gsap and lenis chunks) into the admin's entry too. Mounted only in the
// public site's own branch of App.jsx, so the admin never parses it.
//
// On every route change: the page goes back to the top (Lenis owns the
// scroll position once it is running, so asking the window alone is not
// enough), then every pinned and scrubbed trigger re-measures against the
// page that just mounted. Sections whose height depends on CRM data ask
// for a second refresh themselves once their fetch resolves, through
// useScrollRefresh (src/marketing/motion/useScroll.js).
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getScrollEngine, loadScrollEngine, refreshScrollTriggers } from './scroll';

/* --svh fallback (Site Prompt 8, check 1). Browsers that know svh get it
 * from the stylesheet and this never runs; older ones get a pixel value
 * measured from innerHeight, re-measured only on a real resize (an
 * orientation change), never on the address bar's own scroll-driven
 * resize, which is what the ignoreMobileResize config is for. */
function useSmallViewportFallback() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.CSS?.supports?.('height', '1svh')) return undefined;
    let last = 0;
    const set = () => {
      const h = window.innerHeight;
      // Only a real resize: ignore the address bar's few-hundred-pixel nudge.
      if (Math.abs(h - last) < 120) return;
      last = h;
      document.documentElement.style.setProperty('--svh', `${h / 100}px`);
    };
    set();
    window.addEventListener('resize', set, { passive: true });
    window.addEventListener('orientationchange', set, { passive: true });
    return () => {
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);
}

export default function ScrollRoot() {
  const { pathname } = useLocation();
  useSmallViewportFallback();

  useEffect(() => {
    let alive = true;
    let raf = 0;
    loadScrollEngine().then(() => {
      if (!alive) return;
      getScrollEngine()?.lenis?.scrollTo(0, { immediate: true });
      raf = requestAnimationFrame(() => { if (alive) refreshScrollTriggers(); });
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [pathname]);

  return null;
}
