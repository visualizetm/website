/* What the client app needs to know about the device it runs on (client app job). Pure reads, no storage writes.
 *   isIOS()          an iPhone or iPad (an iPad reports itself as a Mac with touch)
 *   standalone()     opened from the Home Screen icon, not a browser tab
 *   pushSupported()  web push works here (on an iPhone only once it is on the Home Screen)
 *   installPrompt    Android's install prompt, kept when the browser offers it (beforeinstallprompt) */
export const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const standalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** The one line an iPhone in Safari gets instead of the switch: pings need the Home Screen app there. */
export const needsHomeScreenForPush = () => !pushSupported() && isIOS() && !standalone();

let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; listeners.forEach(f => f(true)); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f(false)); });
}
export const installPrompt = {
  available: () => !!deferred,
  subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  async show() { if (!deferred) return false; const e = deferred; deferred = null; listeners.forEach(f => f(false)); try { await e.prompt(); const c = await e.userChoice; return c?.outcome === 'accepted'; } catch { return false; } },
};
