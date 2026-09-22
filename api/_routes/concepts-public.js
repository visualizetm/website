import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { route } from '../_lib/handler.js';
import { rateKey, rateState, rateHit } from '../_lib/limit.js';

/* The concepts presentation's public endpoint (Concepts rebuild, Part 5),
 * served by route from the existing public function: vercel.json rewrites
 * /api/concepts to /api/showcase?r=concepts and api/showcase.js hands the
 * request here, so the function count stays where it was.
 *
 *   GET  /api/concepts?token=xxx
 *        Exactly { client: { displayName }, set: { title, round, intro,
 *        status, approvedDirectionId }, directions: [{ id, name, rationale,
 *        items: [{ id, kind, image, caption }] }], feedback: [{ at,
 *        directionId, action, name }] }. Feedback notes never come back:
 *        a note is the client's own words to Rob, not a public record.
 *        The first view moves sent to viewed; lastViewedAt is stamped at
 *        most once an hour.
 *
 *   POST /api/concepts?token=xxx   { action, directionId, note, name }
 *        approve   sent, viewed or changes -> approved, approvedDirectionId
 *                  and approvedAt set, one feedback entry appended
 *        change    sent, viewed or changes -> changes, a note required,
 *                  one feedback entry appended (several before approval)
 *        note      appends only, in any live status
 *
 * The token is the whole credential and the rules around it are the
 * security model, the same as the planner's: no token, a malformed one, an
 * unknown one, a draft, an archived set and a deleted one are all the same
 * 404 body; a directionId that is not in the set is found inside the query
 * (it is part of the filter, never checked afterwards) and is the same 404;
 * the three actions are the only writes and nothing else in the request is
 * ever written. Actions are limited per token, thirty an hour, through the
 * shared limiter; reads are never limited. */

const HOUR = 60 * 60 * 1000;
const ACTIONS_PER_HOUR = 30;
const VIEW_STAMP_EVERY = HOUR;
const OPEN = ['sent', 'viewed', 'changes']; // a decision is still possible

const notFound = (res) => res.status(404).json({ error: 'not found' });
const tokenStr = (v) => { const t = String(v ?? '').trim(); return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : ''; };
const idStr = (v) => { const t = String(v ?? '').trim(); return /^[A-Za-z0-9_-]{1,64}$/.test(t) ? t : ''; };
const str = (v, max) => String(v ?? '').trim().slice(0, max);

/* Live means: sent to the client and not taken back. A draft has not been
 * sent, an archived set has been taken back, a deleted one is gone. */
const LIVE = { deleted: { $ne: true }, archived: { $ne: true }, status: { $in: ['sent', 'viewed', 'approved', 'changes'] } };
const PROJECTION = { leadId: 1, title: 1, round: 1, intro: 1, status: 1, approvedDirectionId: 1, directions: 1, feedback: 1, lastViewedAt: 1 };

async function setFor(db, token) {
  if (!token) return null;
  return db.collection('concept_sets').findOne({ token, ...LIVE }, { projection: PROJECTION });
}
async function clientFor(db, set) {
  const lead = await db.collection('call_leads').findOne({ _id: toId(set.leadId), deleted: { $ne: true } }, { projection: { business: 1, 'showcase.displayName': 1 } });
  return { displayName: lead?.showcase?.displayName || lead?.business || '' };
}
/* The lead id as the set stores it (a string): an ObjectId when it parses,
 * so a lead keyed either way is found; never the raw request value. */
function toId(v) {
  const s = String(v ?? '');
  try { return ObjectId.isValid(s) && s.length === 24 ? new ObjectId(s) : s; } catch { return s; }
}

/** Exactly what a client may see. */
const publicItem = (it) => ({ id: String(it?.id || ''), kind: String(it?.kind || 'other'), image: String(it?.image || ''), caption: String(it?.caption || '') });
const publicDirection = (d) => ({ id: String(d?.id || ''), name: String(d?.name || ''), rationale: String(d?.rationale || ''), items: (Array.isArray(d?.items) ? [...d.items] : []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(publicItem) });
const publicFeedback = (f) => ({ at: String(f?.at || ''), directionId: String(f?.directionId || ''), action: String(f?.action || ''), name: String(f?.name || '') });
const publicSet = (s) => ({ title: String(s.title || ''), round: Number(s.round) || 1, intro: String(s.intro || ''), status: String(s.status || ''), approvedDirectionId: String(s.approvedDirectionId || '') });

export async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = tokenStr(req.query?.token);
  const db = await getDb();
  const set = await setFor(db, token);
  if (!set) return notFound(res);
  const col = db.collection('concept_sets');

  if (req.method === 'GET') {
    const now = new Date().toISOString();
    const last = Date.parse(set.lastViewedAt || '') || 0;
    const stamp = {};
    if (Date.now() - last > VIEW_STAMP_EVERY) stamp.lastViewedAt = now;
    if (set.status === 'sent') stamp.status = 'viewed';
    if (Object.keys(stamp).length) {
      try { await col.updateOne({ _id: set._id }, { $set: { ...stamp, updatedAt: new Date() } }); } catch { /* their read matters more than the stamp */ }
      Object.assign(set, stamp);
    }
    const client = await clientFor(db, set);
    return res.status(200).json({
      client,
      set: publicSet(set),
      directions: (Array.isArray(set.directions) ? [...set.directions] : []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(publicDirection),
      feedback: (Array.isArray(set.feedback) ? set.feedback : []).map(publicFeedback),
    });
  }

  if (req.method === 'POST') {
    const key = rateKey('concepts', token);
    const limit = await rateState(db, key, { max: ACTIONS_PER_HOUR, windowMs: HOUR });
    if (limit.exceeded) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'That is a lot at once. Give it a few minutes.' });
    }
    await rateHit(db, key, limit.hits);

    const action = String(req.body?.action ?? '');
    const directionId = idStr(req.body?.directionId);
    const note = str(req.body?.note, 1000);
    const name = str(req.body?.name, 80);
    const entry = (a) => ({ at: new Date().toISOString(), directionId, action: a, name, note });

    if (action === 'note') {
      /* A general note names no direction; one that does must name one of this set's. */
      if (directionId) {
        const r = await col.updateOne({ _id: set._id, ...LIVE, 'directions.id': directionId }, { $push: { feedback: { $each: [entry('note')], $slice: -200 } }, $set: { updatedAt: new Date() } });
        if (!r.matchedCount) return notFound(res);
      } else {
        if (!note) return res.status(400).json({ error: 'Write the note first.' });
        await col.updateOne({ _id: set._id, ...LIVE }, { $push: { feedback: { $each: [entry('note')], $slice: -200 } }, $set: { updatedAt: new Date() } });
      }
      return res.status(200).json({ ok: true, status: set.status });
    }

    if (action === 'approve' || action === 'change') {
      if (!directionId) return notFound(res);
      if (action === 'change' && !note) return res.status(400).json({ error: 'Say what should change first.' });
      if (!OPEN.includes(set.status)) return res.status(409).json({ error: 'This set is already decided.' });
      const at = new Date().toISOString();
      const $set = action === 'approve'
        ? { status: 'approved', approvedDirectionId: directionId, approvedAt: at, updatedAt: new Date() }
        : { status: 'changes', updatedAt: new Date() };
      /* The direction must belong to this set and the set must still be
       * open, both inside the one filter: a direction from another set, or
       * a race with an approval that landed a moment ago, matches nothing. */
      const r = await col.updateOne(
        { _id: set._id, ...LIVE, status: { $in: OPEN }, 'directions.id': directionId },
        { $set, $push: { feedback: { $each: [entry(action)], $slice: -200 } } },
      );
      if (!r.matchedCount) {
        const again = await col.findOne({ _id: set._id, ...LIVE }, { projection: { status: 1 } });
        return again && !OPEN.includes(again.status) ? res.status(409).json({ error: 'This set is already decided.' }) : notFound(res);
      }
      return res.status(200).json({ ok: true, status: $set.status });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

export default route(handler, { methods: ['GET', 'POST'], admin: false, maxBody: 16 * 1024 });
