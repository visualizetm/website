/* Same-origin admin API helpers.
 *
 * apiFetch: fetch + JSON with a uniform { ok, status, data } result so call
 * sites never repeat the headers/JSON/ok dance. Every request carries
 * X-Requested-With: visualize (Prompt 15): the admin routes refuse any
 * non GET request without it, which is the CSRF guard (a cross site form or
 * script cannot set that header without a CORS preflight the API rejects).
 *
 * patchWithRollback: the optimistic PATCH pattern every admin screen uses:
 * apply locally first, send, and undo on failure. `apply` returns the undo
 * function (or nothing); `onError` gets the failure so the screen can show
 * its own loud toast. Returns true on success.
 */
export const CSRF_HEADER = { 'X-Requested-With': 'visualize' };

/** True when the browser says there is no network. Writes are refused up front so nothing half applies. */
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* no window */ } };

const warmStore = new Map();
/** Start a GET now and hand it to the first apiFetch for the same URL (see src/shared/warm.js). */
export function warm(urls) { for (const url of urls) if (!warmStore.has(url)) warmStore.set(url, apiFetch(url, { silent: true })); }

export async function apiFetch(url, { method = 'GET', body, headers, silent = false } = {}) {
  if (method === 'GET' && warmStore.has(url)) { const p = warmStore.get(url); warmStore.delete(url); return p; }
  if (method !== 'GET' && isOffline()) {
    // Prompt 14: offline writes are blocked, not queued (see reports/PROMPT-14-REPORT.md section 10).
    emit('vz:offline-write', { url, method });
    return { ok: false, status: 0, data: null, offline: true };
  }
  try {
    const res = await fetch(url, {
      method,
      headers: { ...CSRF_HEADER, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty or non-JSON body */ }
    // A server error (not a 4xx the screen expects, like 401 or 404) is worth a log entry.
    if (!silent && res.status >= 500) emit('vz:api-failed', { url, method, status: res.status, error: data?.error });
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    if (!silent) emit('vz:api-failed', { url, method, status: 0, error: err?.message });
    return { ok: false, status: 0, data: null, error: err };
  }
}

export async function patchWithRollback({ url, id, set, apply, onError }) {
  const undo = apply?.();
  const r = await apiFetch(url, { method: 'PATCH', body: { id, set } });
  if (!r.ok) {
    if (typeof undo === 'function') undo();
    onError?.(r);
    return false;
  }
  return true;
}
