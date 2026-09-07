/* POST /api/admin/logout (auth rebuild): clears the vz_admin cookie. */
import { sessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return res.status(200).json({ ok: true });
}
