import crypto from 'crypto';

const COOKIE = 'vz_admin';

function hmac(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(value).digest('base64url');
}

export function makeToken(days = 30) {
  const exp = String(Date.now() + days * 86400000);
  return `${exp}.${hmac(exp)}`;
}

export function checkToken(token) {
  if (!token || !process.env.SESSION_SECRET) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expect = hmac(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(token, maxAgeDays = 30) {
  const maxAge = maxAgeDays > 0 ? maxAgeDays * 86400 : 0;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function isAuthed(req) {
  return checkToken(getCookie(req, COOKIE));
}

// Returns true when authorized; otherwise responds 401 and returns false.
export function requireAdmin(req, res) {
  if (isAuthed(req)) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}

/* Sliding renewal (Prompt 15): a valid cookie older than RENEW_AFTER_DAYS is
 * reissued for a fresh 30 days on any authed request, so a device in daily
 * use never gets signed out; one left alone expires 30 days after its last visit. */
const SESSION_DAYS = 30;
const RENEW_AFTER_DAYS = 1;
export function renewSession(req, res) {
  const token = getCookie(req, COOKIE);
  if (!checkToken(token)) return false;
  const exp = Number(token.split('.')[0]);
  const ageDays = SESSION_DAYS - (exp - Date.now()) / 86400000;
  if (ageDays < RENEW_AFTER_DAYS) return false;
  res.setHeader('Set-Cookie', sessionCookie(makeToken(SESSION_DAYS), SESSION_DAYS));
  return true;
}

/* Login rate limit (Prompt 15): 10 failed attempts per IP per 15 minutes,
 * kept on the settings 'login-limit' document so every serverless instance
 * shares one count (an in memory map would reset on each cold start and
 * differ per instance, so it is only the fallback when the database is
 * unreachable). Successful sign in clears the IP's count. */
const LIMIT = 10;
const WINDOW_MS = 15 * 60e3;
const memory = globalThis._vzLoginLimit || (globalThis._vzLoginLimit = new Map());
const ipKey = (ip) => String(ip || 'unknown').replace(/[.$]/g, '_').slice(0, 64);
export async function loginAttemptsLeft(db, ip) {
  const key = ipKey(ip); const since = Date.now() - WINDOW_MS;
  let hits = memory.get(key) || [];
  try { const doc = await db.collection('settings').findOne({ _id: 'login-limit' }, { projection: { [`hits.${key}`]: 1 } }); hits = doc?.hits?.[key] || hits; } catch { /* memory fallback */ }
  return Math.max(0, LIMIT - hits.filter(t => t > since).length);
}
export async function recordLoginFailure(db, ip) {
  const key = ipKey(ip); const now = Date.now(); const since = now - WINDOW_MS;
  const hits = [...(memory.get(key) || []).filter(t => t > since), now].slice(-LIMIT);
  memory.set(key, hits);
  try { await db.collection('settings').updateOne({ _id: 'login-limit' }, { $set: { [`hits.${key}`]: hits, updatedAt: new Date() } }, { upsert: true }); } catch { /* memory only */ }
}
export async function clearLoginFailures(db, ip) {
  const key = ipKey(ip);
  memory.delete(key);
  try { await db.collection('settings').updateOne({ _id: 'login-limit' }, { $unset: { [`hits.${key}`]: '' } }); } catch { /* fine */ }
}

/* ── Password verification ─────────────────────────────────────────
   A password changed from the admin Settings screen is stored as a salted
   scrypt hash in Mongo and takes precedence over the ADMIN_PASSWORD env var.
   Until one is set, the env var remains the password. */

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}

function timingSafeEq(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function verifyAdminPassword(db, given) {
  const pw = String(given || '');
  const doc = await db.collection('settings').findOne({ _id: 'auth' });
  if (doc?.hash && doc?.salt) {
    const test = crypto.scryptSync(pw, doc.salt, 64).toString('hex');
    return timingSafeEq(test, doc.hash);
  }
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  return timingSafeEq(
    crypto.createHash('sha256').update(pw).digest('hex'),
    crypto.createHash('sha256').update(expected).digest('hex'),
  );
}
