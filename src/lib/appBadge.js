/* The number on the Home Screen icon: what Next up holds that needs Rob today (overdue plus today, nextUpBadge in src/lib/nextAction.js,
 * the same count as the Tasks tab), cleared at zero. The Badging API is not everywhere (on iPhone it needs the installed app and
 * notification permission), and a browser may refuse it, so every call is guarded and none can throw or leave a rejected promise.
 *   setAppBadge(count, nav?)   -> 'set' | 'cleared' | 'unsupported'
 *   useAppBadge(count)         keeps the icon in step with count while the app is open */
import { useEffect } from 'react';

export function setAppBadge(count, nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return 'unsupported';
  const n = Math.max(0, Math.min(99999, Math.floor(Number(count) || 0)));
  const swallow = (p) => { try { Promise.resolve(p).catch(() => {}); } catch { /* not a promise */ } };
  try {
    if (n > 0 && typeof nav.setAppBadge === 'function') { swallow(nav.setAppBadge(n)); return 'set'; }
    if (n === 0 && typeof nav.clearAppBadge === 'function') { swallow(nav.clearAppBadge()); return 'cleared'; }
    if (n === 0 && typeof nav.setAppBadge === 'function') { swallow(nav.setAppBadge(0)); return 'cleared'; }
  } catch { /* a browser that throws on the badge has nothing to show */ }
  return 'unsupported';
}

export function useAppBadge(count) {
  useEffect(() => { setAppBadge(count); }, [count]);
}
