import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../shared/api';

/* Billy on Rob's side: the two reads (his access page, his day) and the writes Settings > Team > Billy makes.
 * Everything goes to /api/admin/team behind Rob's cookie; the passcode comes back once from reset and is never kept. */
const URL = '/api/admin/team';
export const teamApi = {
  get: () => apiFetch(URL, { silent: true, fresh: true }),
  day: (range = 'today') => apiFetch(`${URL}?view=day&range=${encodeURIComponent(range)}`, { silent: true, fresh: true }),
  set: (set) => apiFetch(URL, { method: 'PATCH', body: { set }, silent: true }),
  resetPasscode: () => apiFetch(URL, { method: 'POST', body: { action: 'reset-passcode' }, silent: true }),
  pause: () => apiFetch(URL, { method: 'POST', body: { action: 'pause' }, silent: true }),
  undoDecline: (rowId, leadId) => apiFetch(URL, { method: 'POST', body: { action: 'undo-decline', rowId, leadId }, silent: true }),
  eventTypes: () => apiFetch(`${URL}?view=event-types`, { silent: true, fresh: true }),
};

/* Whether Billy is set up is remembered on the device, so the home can hold his card's place while his day loads
 * (and draw nothing at all for a studio known to have no caller). */
const KEY = 'vz_billy';
/** true (he is set up), false (this studio has no caller), or null (not known yet on this device). */
export const knowsBilly = () => { try { const v = window.localStorage.getItem(KEY); return v === '1' ? true : v === '0' ? false : null; } catch { return null; } };
const remember = (on) => { try { window.localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } };

/** Billy's day for a range: { data, loading, error, reload }. */
export function useBillyDay(range = 'today') {
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: false }));
    const r = await teamApi.day(range);
    if (!r.ok) { setState(s => ({ ...s, loading: false, error: true })); return false; }
    remember(!!r.data?.billy?.exists);
    setState({ data: r.data, loading: false, error: false });
    return true;
  }, [range]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
