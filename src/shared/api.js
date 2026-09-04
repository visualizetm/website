/* Same-origin admin API helpers.
 *
 * apiFetch: fetch + JSON with a uniform { ok, status, data } result so call
 * sites never repeat the headers/JSON/ok dance.
 *
 * patchWithRollback: the optimistic PATCH pattern every admin screen uses:
 * apply locally first, send, and undo on failure. `apply` returns the undo
 * function (or nothing); `onError` gets the failure so the screen can show
 * its own loud toast. Returns true on success.
 */
export async function apiFetch(url, { method = 'GET', body, headers } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json', ...(headers || {}) } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty or non-JSON body */ }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
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
