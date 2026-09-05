import { getDb } from '../_lib/mongo.js';
import { route } from '../_lib/handler.js';

/* Client error log (Prompt 15). No third party service: the admin posts
 * render errors and refused writes here, the settings 'client-log' document
 * keeps the last 500 (oldest dropped), and Settings, Automation shows the
 * last 20 with a Clear button.
 *   GET    ?limit=20        { items }  newest first
 *   POST   { kind, message, stack, url, at }
 *   DELETE                  clears the list
 */
const str = (v, max) => String(v ?? '').slice(0, max);
const KINDS = new Set(['error', 'boundary', 'rejection', 'refused', 'api']);
const MAX = 500;

async function handler(req, res) {
  const db = await getDb();
  const settings = db.collection('settings');
  if (req.method === 'GET') {
    const limit = Math.max(1, Math.min(MAX, Number(req.query?.limit) || 20));
    const doc = await settings.findOne({ _id: 'client-log' }, { projection: { items: { $slice: -limit } } });
    return res.status(200).json({ items: (doc?.items || []).slice().reverse() });
  }
  if (req.method === 'POST') {
    const b = req.body || {};
    const item = { kind: KINDS.has(b.kind) ? b.kind : 'error', message: str(b.message, 500), stack: str(b.stack, 2000), url: str(b.url, 300), at: /^\d{4}-\d{2}-\d{2}T/.test(String(b.at || '')) ? str(b.at, 40) : new Date().toISOString(), ua: str(req.headers['user-agent'], 200), receivedAt: new Date() };
    if (!item.message) return res.status(400).json({ error: 'message required' });
    await settings.updateOne({ _id: 'client-log' }, { $push: { items: { $each: [item], $slice: -MAX } }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return res.status(200).json({ ok: true });
  }
  await settings.updateOne({ _id: 'client-log' }, { $set: { items: [], updatedAt: new Date() } }, { upsert: true });
  return res.status(200).json({ ok: true });
}
export default route(handler, { methods: ['GET', 'POST', 'DELETE'], maxBody: 16 * 1024 });
