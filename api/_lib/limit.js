/* One rolling window rate limiter for the three doors the public can knock
 * on (security audit): the admin login, /api/submissions, and the planner's
 * actions. One settings document per key holds the timestamps inside the
 * window; every read drops the stamps that have aged out, so a document
 * never grows past `max` entries.
 *
 *   const key = rateKey('login', ip);            settings _id, the IP hashed
 *   const st = await rateState(db, key, { max: 10, windowMs: 15 * 60e3 });
 *   if (st.exceeded) -> 429, Retry-After st.retryAfter (seconds)
 *   await rateHit(db, key, st.hits);              count this one
 *   await rateClear(db, key);                     a success wipes the count
 *
 * A read failure never blocks: an outage at the database should not also
 * lock the door, which is the same choice every limiter here made before
 * they were one. Keys carry a sha256 of the IP or token, never the value,
 * so the settings collection (and the backup) hold no address and no
 * credential.
 */
import { createHash } from 'node:crypto';

export const rateKey = (scope, value) => `rate:${scope}:${createHash('sha256').update(String(value)).digest('hex').slice(0, 32)}`;

export async function rateState(db, key, { max, windowMs }) {
  const now = Date.now();
  let doc = null;
  try { doc = await db.collection('settings').findOne({ _id: key }); } catch { return { hits: [], exceeded: false, retryAfter: 0 }; }
  const hits = (Array.isArray(doc?.hits) ? doc.hits : []).map(Number).filter(t => now - t < windowMs).sort((a, b) => a - b);
  const exceeded = hits.length >= max;
  const retryAfter = exceeded ? Math.max(1, Math.ceil((hits[hits.length - max] + windowMs - now) / 1000)) : 0;
  return { hits, exceeded, retryAfter };
}

export async function rateHit(db, key, hits = []) {
  try {
    await db.collection('settings').updateOne(
      { _id: key },
      { $set: { hits: [...hits, Date.now()], updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  } catch { /* counted best effort */ }
}

export async function rateClear(db, key) {
  try { await db.collection('settings').deleteOne({ _id: key }); } catch { /* best effort */ }
}
