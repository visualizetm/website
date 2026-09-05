import { sessionCookie } from '../_lib/auth.js';

export function handler(req, res) {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.status(200).json({ ok: true });
}