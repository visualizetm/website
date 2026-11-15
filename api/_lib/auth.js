/* Admin sessions (auth rebuild): a signed cookie and nothing else.
 *
 * signSession()      -> `${expiresAt}.${hmac}`; the hmac is SHA-256 over the
 *                       expiry with SESSION_SECRET (required on Vercel; a
 *                       local dev fallback lives in config.js).
 * verifySession(req) -> true when the vz_admin cookie carries a valid hmac and
 *                       an expiry in the future. No database, no renewal.
 * requireAdmin(req, res) -> verifySession, else 401 { error: 'unauthorized' }
 *                       and false.
 *
 * The caller's session (Billy's Call Room) is a second cookie, vz_caller,
 * signed with the same secret over a different payload:
 *   `${version}.${expiresAt}.${hmac(`caller:${version}:${expiresAt}`)}`
 * so neither cookie verifies as the other. requireCaller(req, res) checks
 * the signature and the expiry, then reads the one team document: the
 * cookie's version must be the stored version and Can sign in must be on.
 * Pause, Reset passcode and Can sign in off all bump the version, so an old
 * cookie dies on its next request. The cookie is scoped to /api/caller, so
 * the browser never sends it to an admin route at all.
 */
import crypto from 'crypto';
import { SESSION_DAYS, sessionSecret } from './config.js';
import { getDb } from './mongo.js';

export const COOKIE = 'vz_admin';
export const CALLER_COOKIE = 'vz_caller';
export const CALLER_DAYS = 14;
export const CALLER_ID = 'billy';

const hmac = (value) => crypto.createHmac('sha256', sessionSecret()).update(String(value)).digest('base64url');

export function signSession(days = SESSION_DAYS) {
  const expiresAt = String(Date.now() + days * 86400000);
  return `${expiresAt}.${hmac(expiresAt)}`;
}

export function sessionCookie(value, days = SESSION_DAYS) {
  const maxAge = days > 0 ? days * 86400 : 0;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(req, name = COOKIE) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) { try { return decodeURIComponent(v.join('=')); } catch { return null; } }
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

/* ── The caller (Billy's Call Room) ──────────────────────────────────── */
const callerPayload = (version, expiresAt) => `caller:${version}:${expiresAt}`;
const versionOf = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? n : 0; };

export function signCaller(version, days = CALLER_DAYS) {
  const v = String(versionOf(version) || 1);
  const expiresAt = String(Date.now() + days * 86400000);
  return `${v}.${expiresAt}.${hmac(callerPayload(v, expiresAt))}`;
}

export function callerCookie(value, days = CALLER_DAYS) {
  const maxAge = days > 0 ? days * 86400 : 0;
  return `${CALLER_COOKIE}=${value}; Path=/api/caller; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/** The version a valid, unexpired vz_caller cookie was signed for, else 0. No database. */
export function verifyCaller(req) {
  const token = readCookie(req, CALLER_COOKIE);
  if (!token) return 0;
  const [version, expiresAt, sig, ...rest] = token.split('.');
  if (!version || !expiresAt || !sig || rest.length) return 0;
  if (!versionOf(version) || !(Number(expiresAt) > Date.now())) return 0;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(callerPayload(version, expiresAt)));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? versionOf(version) : 0;
}

/** The caller guard: a valid cookie whose version is the stored one, on an account that may sign in. Sets req.caller. */
export async function requireCaller(req, res) {
  const version = verifyCaller(req);
  if (version) {
    const db = await getDb();
    const doc = await db.collection('team').findOne({ _id: CALLER_ID });
    if (doc && doc.canSignIn !== false && versionOf(doc.version) === version) {
      req.caller = { id: CALLER_ID, name: String(doc.name || 'Billy').slice(0, 40), moveOffRobLists: doc.moveOffRobLists !== false };
      return true;
    }
  }
  res.status(401).json({ error: 'unauthorized' });
  return false;
}
