/* The client app's code door (api/_routes/app-public.js through the /api/app/:action rewrite). Every call answers
 * { ok, status, data }: status 0 is no connection. The code goes in a POST body, never a URL. */
const go = async (url, init) => {
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init });
    let data = {}; try { data = await r.json(); } catch { data = {}; }
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0, data: {} }; }
};
const post = (a, body) => go(`/api/app/${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
export const appApi = {
  me: () => go('/api/app/me'),
  token: (token) => go(`/api/app/token?token=${encodeURIComponent(token)}`),
  set: (token, code, again) => post('set', { token, code, again }),
  signIn: (body) => post('signin', body),
  signOut: () => post('signout'),
};

/* The phone or email a client signed in with is kept on this device so the next sign in asks only for the four digits.
 * The identifier only, never the code. */
const ID_KEY = 'vz_app_id';
const HOME_KEY = 'vz_app_a2hs';
const read = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* private mode */ } };
export const rememberedId = () => read(ID_KEY).slice(0, 200);
export const rememberId = (v) => write(ID_KEY, String(v || '').trim().slice(0, 200));
export const homeCardSeen = () => read(HOME_KEY) === 'seen';
export const markHomeCardSeen = () => write(HOME_KEY, 'seen');
