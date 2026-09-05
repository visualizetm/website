/* Client error log (Prompt 15). Render errors, unhandled rejections, refused
 * writes, and failed API calls post to /api/admin/log, which keeps the last
 * 500 on the settings collection; Settings, Automation shows the last 20.
 * No third party service. Never logs a failure of the log call itself, keeps
 * one entry per message per minute, and stops after 40 entries per page
 * load so a render loop cannot flood the collection.
 */
import { apiFetch } from './api';

const recent = new Map();
let sent = 0;
const MAX_PER_LOAD = 40;

export function logClient({ kind = 'error', message, stack = '', url } = {}) {
  const msg = String(message || '').slice(0, 500);
  if (!msg || sent >= MAX_PER_LOAD) return;
  const now = Date.now();
  if ((recent.get(msg) || 0) > now - 60e3) return;
  recent.set(msg, now);
  sent += 1;
  const body = { kind, message: msg, stack: String(stack || '').slice(0, 2000), url: String(url || (typeof location !== 'undefined' ? location.pathname + location.search : '')).slice(0, 300), at: new Date().toISOString() };
  apiFetch('/api/admin/log', { method: 'POST', body, silent: true }).catch(() => {});
}

/** Wire window.onerror, unhandledrejection, and the offline refusal event once. */
let wired = false;
export function wireClientLog() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('error', (e) => logClient({ kind: 'error', message: e.message || String(e.error || 'Script error'), stack: e.error?.stack || `${e.filename || ''}:${e.lineno || 0}` }));
  window.addEventListener('unhandledrejection', (e) => { const r = e.reason; logClient({ kind: 'rejection', message: r?.message || String(r || 'Unhandled rejection'), stack: r?.stack || '' }); });
  window.addEventListener('vz:offline-write', (e) => logClient({ kind: 'refused', message: `Offline write refused: ${e.detail?.method || ''} ${e.detail?.url || ''}` }));
  window.addEventListener('vz:api-failed', (e) => logClient({ kind: 'api', message: `${e.detail?.method || ''} ${e.detail?.url || ''} answered ${e.detail?.status ?? 'no response'}${e.detail?.error ? `: ${e.detail.error}` : ''}` }));
}
