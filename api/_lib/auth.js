/* Admin sessions (auth rebuild): a signed cookie and nothing else.
 *
 * signSession()      -> `${expiresAt}.${hmac}`; the hmac is SHA-256 over the
 *                       expiry with SESSION_SECRET (required on Vercel; a
 *                       local dev fallback lives in config.js).
 * verifySession(req) -> true when the vz_admin cookie carries a valid hmac and
 *                       an expiry in the future. No database, no renewal.
 * requireAdmin(req, res) -> verifySession, else 401 { error: 'unauthorized' }
 *                       and false.
 */
import crypto from 'crypto';
import { SESSION_DAYS, sessionSecret } from './config.js';

export const COOKIE = 'vz_admin';

const hmac = (value) => crypto.createHmac('sha256', sessionSecret()).update(String(value)).digest('base64url');

export function signSession(days = SESSION_DAYS) {
  const expiresAt = String(Date.now() + days * 86400000);
  return `${expiresAt}.${hmac(expiresAt)}`;
}

export function sessionCookie(value, days = SESSION_DAYS) {
  const maxAge = days > 0 ? days * 86400 : 0;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(req) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function verifySession(req) {
  const token = readCookie(req);
  if (!token) return false;
  const [expiresAt, sig] = token.split('.');
  if (!expiresAt || !sig) return false;
  if (!(Number(expiresAt) > Date.now())) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(expiresAt));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAdmin(req, res) {
  if (verifySession(req)) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}
