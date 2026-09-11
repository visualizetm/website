/* POST /api/admin/login (auth rebuild, rate limited in the security audit):
 * its own Vercel function, no shared wrapper, no dynamic segment. Body
 * { password }; the password comes from api/_lib/config.js (or the
 * ADMIN_PASSWORD env var when set). A match sets the signed vz_admin cookie
 * for 30 days and answers 200 { ok: true }; a mismatch answers 401
 * { error: 'wrong password' }.
 *
 * Ten wrong passwords from one IP inside fifteen minutes lock that IP out
 * with 429 (Retry-After in seconds) until the oldest of them ages out; the
 * count lives in the settings collection under rate:login:<sha256(ip)>,
 * and a correct password clears it. The body is capped at 4KB: a password
 * is not a file. */
import crypto from 'crypto';
import { adminPassword, SESSION_DAYS } from '../_lib/config.js';
import { signSession, sessionCookie } from '../_lib/auth.js';
import { getDb } from '../_lib/mongo.js';
import { clientIp } from '../_lib/handler.js';
import { rateKey, rateState, rateHit, rateClear } from '../_lib/limit.js';

const MAX_BODY = 4 * 1024;
const FAILS_MAX = 10;
const FAILS_WINDOW_MS = 15 * 60e3;

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(String(req.body)); } catch { return {}; }
  }
  const chunks = []; let size = 0;
  try { for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return {}; chunks.push(chunk); } } catch { return {}; }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    if (Number(req.headers['content-length'] || 0) > MAX_BODY) return res.status(413).json({ error: 'request too large' });
    const db = await getDb();
    const key = rateKey('login', clientIp(req));
    const limit = await rateState(db, key, { max: FAILS_MAX, windowMs: FAILS_WINDOW_MS });
    if (limit.exceeded) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'Too many wrong passwords. Try again in a few minutes.' });
    }
    const body = await readBody(req);
    const given = typeof body?.password === 'string' ? body.password : '';
    const ok = crypto.timingSafeEqual(sha(given), sha(adminPassword()));
    if (!ok) { await rateHit(db, key, limit.hits); return res.status(401).json({ error: 'wrong password' }); }
    await rateClear(db, key);
    res.setHeader('Set-Cookie', sessionCookie(signSession(SESSION_DAYS), SESSION_DAYS));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api] POST /api/admin/login', err?.stack || err);
    if (res.headersSent) return undefined;
    // A deployment without SESSION_SECRET must say so, not sign in with a constant.
    if (/SESSION_SECRET/.test(String(err?.message))) return res.status(500).json({ error: 'SESSION_SECRET is not set' });
    return res.status(500).json({ error: 'server error' });
  }
}
