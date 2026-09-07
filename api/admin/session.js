/* GET /api/admin/session (auth rebuild): 200 { ok: true, authed: true } when
 * the vz_admin cookie verifies, else 401. `authed` is kept alongside `ok`
 * because the shell (AdminApp, the Call Console) reads r.ok && r.data.authed. */
import { verifySession } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (verifySession(req)) return res.status(200).json({ ok: true, authed: true });
  return res.status(401).json({ ok: false, authed: false, error: 'unauthorized' });
}
