/* Appearance (Prompt 14): the theme and the reduce motion switch.
 *
 * One store, three readers: the pre-paint script in index.html (reads the same
 * localStorage keys before the bundle runs), the shell (data-v-theme and
 * data-v-motion on .lay-root and on <html>), and Settings Profile (the picker
 * and the toggle, which also persist to the settings profile document).
 *
 * Keys, shared with the marketing site's pre-paint script and ThemeToggle:
 *   vz_theme   'dark' | 'light' | 'system'   (admin default: dark; marketing: OS)
 *   vz_motion  'reduce' when the in-app toggle is on
 *   vz_boot    '1' once a session check has answered signed in (the boot frame hint)
 */
import { useEffect, useState } from 'react';

export const THEME_KEY = 'vz_theme';
export const MOTION_KEY = 'vz_motion';
export const BOOT_KEY = 'vz_boot';
export const THEME_MODES = [{ id: 'system', label: 'System' }, { id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }];

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };
const osLight = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;
const osReduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The saved theme mode: 'system', 'dark', or 'light' (an unset key means dark in the admin). */
export function getThemeMode() { const v = read(THEME_KEY); return v === 'light' || v === 'system' ? v : 'dark'; }
/** The theme that actually renders: 'dark' or 'light'. */
export function resolveTheme(mode = getThemeMode()) { return mode === 'light' ? 'light' : mode === 'system' ? (osLight() ? 'light' : 'dark') : 'dark'; }
export function getReduceMotion() { return read(MOTION_KEY) === 'reduce'; }

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

/** Stamp the current appearance on <html> so the boot frame, portals, and standalone roots agree. */
export function applyAppearance() {
  if (typeof document === 'undefined') return;
  const de = document.documentElement;
  const theme = resolveTheme();
  de.dataset.vTheme = theme;
  // The marketing site reads data-theme from the same key; keep the two in step on the admin host.
  de.dataset.theme = theme;
  if (getReduceMotion()) de.dataset.vMotion = 'reduce'; else delete de.dataset.vMotion;
}
export function setThemeMode(mode) { write(THEME_KEY, mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : 'system'); applyAppearance(); notify(); }
export function setReduceMotion(on) { write(MOTION_KEY, on ? 'reduce' : null); applyAppearance(); notify(); }
export function setBootHint(on) { write(BOOT_KEY, on ? '1' : null); }
export function hasBootHint() { return read(BOOT_KEY) === '1'; }

/** Live appearance for the shell: { mode, theme, reduce, reduceOS }. */
export function useAppearance() {
  const snap = () => ({ mode: getThemeMode(), theme: resolveTheme(), reduce: getReduceMotion(), reduceOS: osReduce() });
  const [state, setState] = useState(snap);
  useEffect(() => {
    const fn = () => setState(snap());
    listeners.add(fn);
    const mqs = [window.matchMedia?.('(prefers-color-scheme: light)'), window.matchMedia?.('(prefers-reduced-motion: reduce)')].filter(Boolean);
    const onMq = () => { applyAppearance(); fn(); };
    mqs.forEach(m => m.addEventListener('change', onMq));
    applyAppearance();
    return () => { listeners.delete(fn); mqs.forEach(m => m.removeEventListener('change', onMq)); };
  }, []);
  return state;
}
