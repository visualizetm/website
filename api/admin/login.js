import { makeToken, sessionCookie, verifyAdminPassword } from '../_lib/auth.js';
import { getDb } from '../_lib/mongo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const db = await getDb();
  const ok = await verifyAdminPassword(db, req.body?.password);
  if (!ok) return res.status(401).json({ error: 'wrong password' });
  res.setHeader('Set-Cookie', sessionCookie(makeToken(30), 30));
  return res.status(200).json({ ok: true });
}
