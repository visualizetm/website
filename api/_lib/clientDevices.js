import { rateKey, rateState, rateHit } from './limit.js';

/* A client's devices for web push (client portal prompt 4, shared by the planner in Planner v2). One door for both public pages:
 * { action: 'push_on', subscription } saves this device for this client (role client, the client's id, one row per endpoint);
 * { action: 'push_off', endpoint } removes it, and only this client's own row. Ten a day per token, through the shared limiter,
 * under the caller's own key (the portal's ppsh, the planner's plpsh). The count of the client's devices is written to the
 * record under the caller's object (portal.pushDevices, planner.pushDevices) with the moment it was turned on. */

const DAY_MS = 24 * 60 * 60 * 1000;
export const PUSH_MAX = 10;
const endpointOf = (v) => { const e = String(v || '').trim(); return /^https:\/\/[^\s]{10,1000}$/.test(e) ? e : ''; };

export async function toggleClientPush(db, lead, token, b, res, { limiter = 'ppsh', field = 'portal' } = {}) {
  const key = rateKey(limiter, token);
  const st = await rateState(db, key, { max: PUSH_MAX, windowMs: DAY_MS });
  if (st.exceeded) { res.setHeader('Retry-After', String(st.retryAfter)); return res.status(429).json({ error: 'That is a lot of changes for one day.' }); }
  const subs = db.collection('push_subscriptions');
  const leadId = String(lead._id);
  if (b.action === 'push_on') {
    const sub = b.subscription && typeof b.subscription === 'object' ? b.subscription : null;
    const endpoint = endpointOf(sub?.endpoint);
    const keys = sub?.keys && typeof sub.keys === 'object' ? { p256dh: String(sub.keys.p256dh || '').slice(0, 200), auth: String(sub.keys.auth || '').slice(0, 100) } : null;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'subscription required' });
    await rateHit(db, key, st.hits);
    await subs.updateOne({ 'subscription.endpoint': endpoint }, { $set: { role: 'client', leadId, subscription: { endpoint, expirationTime: sub.expirationTime ?? null, keys }, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  } else {
    const endpoint = endpointOf(b.endpoint);
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await rateHit(db, key, st.hits);
    await subs.deleteOne({ 'subscription.endpoint': endpoint, role: 'client', leadId });
  }
  const devices = (await subs.find({ role: 'client', leadId }).project({ _id: 1 }).limit(50).toArray()).length;
  await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { [`${field}.pushDevices`]: devices, ...(b.action === 'push_on' ? { [`${field}.pushAt`]: new Date().toISOString() } : {}), updatedAt: new Date() } });
  return res.status(200).json({ ok: true, on: b.action === 'push_on', devices });
}
