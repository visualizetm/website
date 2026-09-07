/* POST /api/admin/login (auth rebuild): its own Vercel function, no shared
 * wrapper, no dynamic segment. Body { password }; the password comes from
 * api/_lib/config.js (or the ADMIN_PASSWORD env var when set). A match sets
 * the signed vz_admin cookie for 30 days and answers 200 { ok: true }; a
 * mismatch answers 401 { error: 'wrong password' }. */
import crypto from 'crypto';
import { adminPassword, SESSION_DAYS } from '../_lib/config.js';
import { signSession, sessionCookie } from '../_lib/auth.js';

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(String(req.body)); } catch { return {}; }
  }
  const chunks = [];
  try { for await (const chunk of req) chunks.push(chunk); } catch { return {}; }
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
    const body = await readBody(req);
    const given = typeof body?.password === 'string' ? body.password : '';
    const ok = crypto.timingSafeEqual(sha(given), sha(adminPassword()));
    if (!ok) return res.status(401).json({ error: 'wrong password' });
    res.setHeader('Set-Cookie', sessionCookie(signSession(SESSION_DAYS), SESSION_DAYS));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api] POST /api/admin/login', err?.stack || err);
    if (!res.headersSent) return res.status(500).json({ error: 'server error' });
    return undefined;
  }
}
