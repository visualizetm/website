import { ObjectId } from 'mongodb';
import { getDb } from './_lib/mongo.js';
import { route } from './_lib/handler.js';

/* The Content Planner's public endpoint (planner prompt 1, part 3). The one
 * new function this feature adds, taking the count from 9 to 10.
 *
 *   GET  /api/planner?token=xxx&month=YYYY-MM
 *        The client's own month: who they are, and every live post in it.
 *        Month defaults to the current one. A month with nothing in it is an
 *        empty posts array, not a 404.
 *
 *   POST /api/planner?token=xxx   { postId, action, note }
 *        action 'approve'        review -> approved
 *        action 'request-change' review -> making, with their note
 *
 * The token is the whole credential, so the rules around it are the security
 * model:
 *
 *   - No token, an unknown token, and a client whose planner is switched off
 *     all answer the same 404 { error: 'not found' }. A wrong token must not
 *     be able to tell that a right one exists, and a client who was switched
 *     off must not be distinguishable from one who never existed.
 *   - A postId that belongs to somebody else is the same 404. That is the
 *     check that stops a client with a perfectly valid token from touching
 *     another client's posts.
 *   - Nothing else is writable. There is no path through this file that
 *     creates, deletes, reschedules, or rewrites a post, or that reads any
 *     lead field beyond the three in the response whitelist.
 */

const HOUR = 60 * 60 * 1000;
const ACTIONS_PER_HOUR = 30;
const VIEW_STAMP_EVERY = HOUR; // lastViewedAt is a "they looked today" signal, not an access log

const notFound = (res) => res.status(404).json({ error: 'not found' });
const monthStr = (v) => (/^\d{4}-\d{2}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');
const tokenStr = (v) => {
  const t = String(v ?? '').trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : '';
};
const thisMonth = (now = new Date()) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

/* Per token, in the settings collection, the same shape the review form's
 * limiter uses: a rolling hour of stamps, trimmed on every read so the
 * document never grows. The token is already opaque, so unlike the review
 * limiter's IP there is nothing here to hash. */
async function actionRateExceeded(db, token) {
  const _id = `rate:planner:${token}`;
  const now = Date.now();
  const settings = db.collection('settings');
  let doc = null;
  try { doc = await settings.findOne({ _id }); } catch { return false; } // a read failure never blocks a real client
  const hits = (Array.isArray(doc?.hits) ? doc.hits : []).filter(t => now - Number(t) < HOUR);
  if (hits.length >= ACTIONS_PER_HOUR) return true;
  try {
    await settings.updateOne({ _id }, { $set: { hits: [...hits, now], updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  } catch { /* counted best effort */ }
  return false;
}

/* The lead behind a token, or null. The projection is the second half of the
 * whitelist: the fields this file is allowed to see are the only ones it
 * ever loads, so a future edit cannot leak something by accident. */
async function clientFor(db, token) {
  if (!token) return null;
  const lead = await db.collection('call_leads').findOne(
    { 'planner.token': token, deleted: { $ne: true } },
    { projection: { business: 1, 'showcase.displayName': 1, 'planner.enabled': 1, 'planner.welcome': 1, 'planner.postsPerMonth': 1, 'planner.lastViewedAt': 1 } },
  );
  if (!lead || !lead.planner?.enabled) return null;
  return lead;
}

/** Exactly the fields a client may see about themselves. */
const publicClient = (lead) => ({
  displayName: lead.showcase?.displayName || lead.business || '',
  welcome: lead.planner?.welcome || '',
  postsPerMonth: Number(lead.planner?.postsPerMonth) || 8,
});

/** Exactly the fields a client may see about one post. */
const publicPost = (p) => ({
  id: String(p._id),
  date: p.date || '',
  time: p.time || '',
  platform: p.platform || 'instagram',
  imageUrl: p.imageUrl || '',
  caption: p.caption || '',
  status: p.status || 'making',
  note: p.note || '',
  clientNote: p.clientNote || '',
});

async function handler(req, res) {
  const token = tokenStr(req.query?.token);
  const db = await getDb();
  const lead = await clientFor(db, token);
  if (!lead) return notFound(res);

  if (req.method === 'GET') {
    const month = monthStr(req.query?.month) || thisMonth();
    const posts = await db.collection('posts').find({
      leadId: String(lead._id),
      month,
      deleted: { $ne: true },
      archived: { $ne: true },
      /* Every live post in the month, `making` included. Hiding those would
       * be tidier for a half-built month, but it would also make a post
       * vanish the moment a client asked for a change on it, which is the
       * one time they are most likely to look again. status is in the
       * response so the page can say what is happening instead. */
    }).sort({ date: 1, order: 1, time: 1 }).limit(200).toArray();

    /* Stamp that they looked, at most once an hour, so a refresh does not
     * write on every load and the value still answers "have they seen this
     * month yet". Best effort: a failed stamp never fails their read. */
    const last = Date.parse(lead.planner?.lastViewedAt || '') || 0;
    if (Date.now() - last > VIEW_STAMP_EVERY) {
      try {
        await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'planner.lastViewedAt': new Date().toISOString() } });
      } catch { /* their read matters more than the stamp */ }
    }

    return res.status(200).json({ client: publicClient(lead), month, posts: posts.map(publicPost) });
  }

  if (req.method === 'POST') {
    if (await actionRateExceeded(db, token)) {
      return res.status(429).json({ error: 'That is a lot of changes in one hour. Give it a little while and try again.' });
    }

    const { postId, action } = req.body || {};
    let _id = null;
    try { _id = new ObjectId(String(postId)); } catch { return notFound(res); }

    /* leadId is part of the query, not checked afterwards: a post that is
     * not theirs is simply not found, which is the same answer a made up id
     * gets. */
    const post = await db.collection('posts').findOne({ _id, leadId: String(lead._id), deleted: { $ne: true } });
    if (!post) return notFound(res);

    if (action === 'approve') {
      if (post.status !== 'review') return res.status(409).json({ error: 'That post is not waiting for approval any more.' });
      await db.collection('posts').updateOne({ _id }, { $set: { status: 'approved', approvedAt: new Date().toISOString(), updatedAt: new Date() } });
      return res.status(200).json({ ok: true, status: 'approved' });
    }

    if (action === 'request-change') {
      if (post.status !== 'review') return res.status(409).json({ error: 'That post is not waiting for approval any more.' });
      const note = String(req.body?.note ?? '').trim().slice(0, 500);
      if (!note) return res.status(400).json({ error: 'Tell me what to change and I will redo it.' });
      await db.collection('posts').updateOne({ _id }, { $set: { status: 'making', clientNote: note, clientNoteAt: new Date().toISOString(), updatedAt: new Date() } });
      return res.status(200).json({ ok: true, status: 'making' });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

export default route(handler, { methods: ['GET', 'POST'], admin: false, maxBody: 16 * 1024 });
