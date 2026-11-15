/* Billy's Call Room: the only place the room talks to the server. Every URL is under /api/caller/ (one route behind the
 * caller cookie, api/_routes/caller.js); nothing under src/room calls an admin endpoint (email-safety-test scans for it).
 * The service worker never caches these (public/sw.js). */
import { apiFetch } from '../shared/api';

const call = (action, method = 'GET', body) => apiFetch(`/api/caller/${action}`, { method, body, silent: true, fresh: method === 'GET' });

export const roomApi = {
  session: () => call('session'),
  home: () => call('home'),
  login: (email, passcode) => call('login', 'POST', { email, passcode }),
  logout: () => call('logout', 'POST', {}),
  triage: (body) => call('triage', 'POST', body),
  batch: (body) => call('batch', 'POST', body),
  list: (body) => call('list', 'POST', body),
  contact: (body) => call('contact', 'POST', body),
  outcome: (body) => call('outcome', 'POST', body),
  sessionEnd: (body) => call('session', 'POST', body),
  openTimes: () => call('open-times'),
  book: (body) => call('book', 'POST', body),
};

/* What the room keeps on the device (sessionStorage, cleared at sign out): the running session and what Billy is typing. */
const KEY = 'rm_';
const store = () => { try { return window.sessionStorage; } catch { return null; } };
export const roomStore = {
  get(k, fallback = null) { try { const v = store()?.getItem(KEY + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { if (v == null) store()?.removeItem(KEY + k); else store()?.setItem(KEY + k, JSON.stringify(v)); } catch { /* private mode: memory only */ } },
  clear() { try { const s = store(); if (!s) return; for (let i = s.length - 1; i >= 0; i--) { const k = s.key(i); if (k && k.startsWith(KEY)) s.removeItem(k); } } catch { /* nothing to clear */ } },
};
