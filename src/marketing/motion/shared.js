// Shared helpers for src/marketing/motion. Every primitive in this folder
// reads reduced-motion and touch/coarse-pointer state through the two hooks
// below, so the detection mechanism (and the "answer immediately, do not
// wait for an effect to run" guarantee) lives in exactly one place.
//
// Detection mechanisms (name these if asked, they are not UA sniffing):
//   reduced motion -> matchMedia('(prefers-reduced-motion: reduce)')
//   touch / coarse pointer -> matchMedia('(hover: none), (pointer: coarse)')
//     (a media query LIST: the comma is OR, so either condition disables motion)
import { useEffect, useRef, useState } from 'react';

export const TOUCH_QUERY = '(hover: none), (pointer: coarse)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Marketing's own duration tokens live on :root in src/index.css (not the
// admin's --v-dur-* on .lay-root), so JS that needs a token's value in
// milliseconds reads :root directly. Mirrors src/ui/motion.js's durationMs().
const FALLBACK_MS = { '--m-dur': 600, '--m-stagger': 60 };

export function cssMs(name, fallback = FALLBACK_MS[name] ?? 0) {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return /ms$/.test(raw) ? n : n * 1000;
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function isCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(TOUCH_QUERY).matches;
}

// Subscribes to a media query's changes, tolerating the older addListener
// API some engines still expose. Returns an unsubscribe function.
function subscribeMediaQuery(query, onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(query);
  const handler = () => onChange(mql.matches);
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
  else if (typeof mql.addListener === 'function') mql.addListener(handler);
  return () => {
    if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', handler);
    else if (typeof mql.removeListener === 'function') mql.removeListener(handler);
  };
}

/** True when the OS/browser asks for reduced motion, live-updated. The
 * initial value is computed synchronously (no effect delay), so a
 * reduced-motion viewer never sees a first frame that assumes motion. */
export function useMotionPreference() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => subscribeMediaQuery(REDUCED_MOTION_QUERY, setReduced), []);
  return reduced;
}

/** True on touch / no-hover / coarse-pointer devices, live-updated (a
 * hybrid laptop's mode can change without a reload). */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(isCoarsePointer);
  useEffect(() => subscribeMediaQuery(TOUCH_QUERY, setCoarse), []);
  return coarse;
}

/** The IntersectionObserver-once pattern shared by Reveal and Counter: a
 * ref to attach, and whether the element has crossed `threshold` at least
 * once. Once true it never goes back to false (observation stops), and it
 * never re-fires on scrolling away. Pass `disabled: true` (reduced motion)
 * to skip the observer entirely and report "already in view" from the very
 * first render, so nothing is ever hidden waiting on a scroll a
 * reduced-motion viewer may not perform the way a sighted-scroll user would. */
export function useRevealOnce({ threshold = 0.2, rootMargin = '0px', disabled = false } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(disabled);

  useEffect(() => {
    if (disabled) { setInView(true); return undefined; }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { setInView(true); obs.unobserve(entry.target); }
      });
    }, { threshold, rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin, disabled]);

  return [ref, inView];
}

/** Joins class names, dropping falsy values. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
