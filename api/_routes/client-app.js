import { getDb } from '../_lib/mongo.js';
import { leadKey, codeStatus } from '../_lib/clientSession.js';

/* The CRM's side of the client app (client app job), behind route() and the admin cookie.
 *
 *   POST /api/admin/client-app { action: 'reset-code', id }
 *        Clears the client's code and unlocks it, and bumps portal.code.version, so every device signed in with the old code
 *        is signed out on its next request. The client sets a new code from the link Rob sends. Answers the code's status
 *        (codeStatus: set, setAt, locked, lockedUntil, fails), never the hash, the salt or the version. Nothing sends. */
const idStr = (v) => (/^[A-Za-z0-9_-]{1,64}$/.test(String(v ?? '')) ? String(v) : '');

export async function handler(req, res) {
  const db = await getDb();
  const col = db.collection('call_leads');
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (req.method === 'POST' && b.action === 'reset-code') {
    const id = idStr(b.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const lead = await col.findOne({ _id: leadKey(id), deleted: { $ne: true } }, { projection: { 'portal.code': 1 } });
    if (!lead) return res.status(404).json({ error: 'not found' });
    const version = (Math.round(Number(lead.portal?.code?.version)) || 0) + 1;
    const code = { hash: '', salt: '', setAt: '', version, fails: 0, lockedUntil: '', locked: false, resetAt: new Date().toISOString() };
    await col.updateOne({ _id: lead._id }, { $set: { 'portal.code': code, updatedAt: new Date() } });
    return res.status(200).json({ ok: true, code: codeStatus(code) });
  }
  return res.status(400).json({ error: 'unknown action' });
}
