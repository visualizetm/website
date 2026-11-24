/* The client app's test helper (client app job, milestone 3): the planner's and the portal's doors read the client from the
 * vz_client cookie now, so a test that used to read with a bare token signs in first, here, and then runs every check it ran
 * before with the cookie.
 *
 *   const signIn = clientSignIn({ load, stores: _stores });
 *   const cookie = await signIn(token);   // 'vz_client=...', or '' when the token opens no client
 *
 * It goes through the real code door (api/_routes/app-public.js in the test's own copy of api/): it sets a code on a client
 * who has none, else signs in with the code it set, each time from a fresh address so the per IP limiter never bites. A token
 * the door does not open (a planner that is switched off) is signed in by writing a code the way the door does
 * (hashCode) and signing the cookie with the real signClient, so the doors' own 404 rules can still be checked. A token
 * that belongs to no client gets no cookie, and the door answers 401. A cookie is reused while the client's stored code is
 * the one it was made for, so a reseeded store signs in again. */
const TEST_CODE = '4831';

export function clientSignIn({ load, stores }) {
  let door = null; let session = null;
  const cache = new Map();
  let ip = 1;
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, send(b) { this._body = b; return this; }, setHeader(k, v) { this._headers[k] = v; }, end() { return this; } });
  const ask = async (a, method, body, query = {}) => {
    const res = fakeRes();
    await door({ method, query: { a, ...query }, body, headers: { 'x-forwarded-for': `192.0.2.${(ip++ % 250) + 1}` }, url: '/api/app', socket: {} }, res);
    return res;
  };
  const cookieOf = (res) => { const m = /^vz_client=([^;]+)/.exec(String(res._headers['Set-Cookie'] || '')); return m ? `vz_client=${m[1]}` : ''; };
  /* A deleted record is signed in too (the door then answers it the way it always has, the 404), so a test can still check that rule. */
  const leadOf = (token) => (stores.call_leads || []).find(l => l && (l.portal?.token === token || l.planner?.token === token)) || null;
  return async function signIn(token) {
    if (!door) { door = (await load('_routes/app-public.js')).handler; session = await load('_lib/clientSession.js'); }
    const lead = typeof token === 'string' ? leadOf(token) : null;
    if (!lead) return '';
    const key = String(lead._id);
    const hit = cache.get(key);
    if (hit && lead.portal?.code?.hash && hit.hash === lead.portal.code.hash && hit.version === lead.portal.code.version) return hit.cookie;
    let cookie = '';
    const step = await ask('token', 'GET', undefined, { token });
    if (step._status === 200 && step._json?.step === 'set') cookie = cookieOf(await ask('set', 'POST', { token, code: TEST_CODE, again: TEST_CODE }));
    else if (step._status === 200) cookie = cookieOf(await ask('signin', 'POST', { token, code: TEST_CODE }));
    if (!cookie) {
      /* The door does not open this link (a planner switched off), or the code is not the helper's: write one the door's way. */
      const version = (Math.round(Number(lead.portal?.code?.version)) || 0) + 1;
      lead.portal = { ...(lead.portal || {}), code: { ...session.hashCode(TEST_CODE), setAt: new Date().toISOString(), version, fails: 0, lockedUntil: '', locked: false } };
      cookie = `vz_client=${session.signClient(key, version)}`;
    }
    cache.set(key, { cookie, hash: lead.portal?.code?.hash, version: lead.portal?.code?.version });
    return cookie;
  };
}
