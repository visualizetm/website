import crypto from 'crypto';
import { makeToken, sessionCookie } from '../_lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const expected = process.env.ADMIN_PASSWORD || '';
  const given = String(req.body?.password || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!expected || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'wrong password' });
  }
  res.setHeader('Set-Cookie', sessionCookie(makeToken(30), 30));
  return res.status(200).json({ ok: true });
}
