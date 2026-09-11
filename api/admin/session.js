/* GET /api/admin/session (auth rebuild): 200 { ok: true, authed: true } when
 * the vz_admin cookie verifies, else 401. `authed` is kept alongside `ok`
 * because the shell (AdminApp, the Call Console) reads r.ok && r.data.authed. */
import { verifySession } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    if (verifySession(req)) return res.status(200).json({ ok: true, authed: true });
  } catch (err) {
    console.error('[api] GET /api/admin/session', err?.stack || err);
    if (/SESSION_SECRET/.test(String(err?.message))) return res.status(500).json({ ok: false, authed: false, error: 'SESSION_SECRET is not set' });
    return res.status(500).json({ ok: false, authed: false, error: 'server error' });
  }
  return res.status(401).json({ ok: false, authed: false, error: 'unauthorized' });
}
