import { makeToken, sessionCookie, verifyAdminPassword, loginAttemptsLeft, recordLoginFailure, clearLoginFailures } from '../_lib/auth.js';
import { getDb } from '../_lib/mongo.js';
import { clientIp } from '../_lib/handler.js';

/* POST /api/admin/login { password }. Rate limited per IP (10 failures per 15
 * minutes, see auth.js); the compare is constant time on both the scrypt and
 * the env var path. Answers 429 with Retry-After once the limit is hit. */
export async function handler(req, res) {
  const db = await getDb();
  const ip = clientIp(req);
  if ((await loginAttemptsLeft(db, ip)) <= 0) { res.setHeader('Retry-After', '900'); return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' }); }
  const ok = await verifyAdminPassword(db, req.body?.password);
  if (!ok) { await recordLoginFailure(db, ip); return res.status(401).json({ error: 'wrong password' }); }
  await clearLoginFailures(db, ip);
  res.setHeader('Set-Cookie', sessionCookie(makeToken(30), 30));
  return res.status(200).json({ ok: true });
}