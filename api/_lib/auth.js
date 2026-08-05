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
