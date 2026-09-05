/* Motion helpers (Prompt 14). Every JS timer that has to outlast a CSS
 * transition reads the duration from the tokens on .lay-root, so the in-app
 * Reduce motion switch and prefers-reduced-motion (both zero the tokens)
 * shorten the timers with the animation. Nothing hardcodes a duration.
 *
 *   durationMs('--v-dur-base')          200 by default, 0 under reduced motion
 *   durationMs('--v-dur-slow', 320)     with a fallback used before the tokens mount
 */
const FALLBACK = { '--v-dur-fast': 120, '--v-dur-base': 200, '--v-dur-slow': 320, '--v-dur-enter': 400, '--v-stagger': 40 };

export function durationMs(name, fallback = FALLBACK[name] ?? 0) {
  if (typeof document === 'undefined') return fallback;
  const root = document.querySelector('.lay-root') || document.documentElement;
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return /ms$/.test(raw) ? n : n * 1000;
}

/** True when motion is reduced by the OS or by the in-app switch. */
export function motionReduced() {
  if (typeof document === 'undefined') return false;
  return durationMs('--v-dur-base', 200) === 0;
}
