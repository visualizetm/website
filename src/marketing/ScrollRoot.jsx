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

export default function ScrollRoot() {
  const { pathname } = useLocation();

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
