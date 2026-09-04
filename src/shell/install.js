/* PWA install prompt capture (Prompt 12). Chrome fires beforeinstallprompt
 * once, early; we keep the event so Settings can show the real prompt later. */
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; listeners.forEach(fn => fn()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(fn => fn()); });
}
export const canPrompt = () => !!deferred;
export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred; deferred = null;
  e.prompt();
  const r = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  listeners.forEach(fn => fn());
  return r?.outcome || 'dismissed';
}
export const onInstallChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
