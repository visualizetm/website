import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { route } from '../_lib/handler.js';
import { rateKey, rateState, rateHit } from '../_lib/limit.js';
import { sendPush } from '../_lib/notify.js';
import { addTask, allTasks } from '../_lib/taskRules.js';

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
 *   The two above are the Pick one flow. A set whose approvalMode is review
 *   (Review each, docs/CONCEPTS-AUDIT.md) answers every direction on its own:
 *        decide    { directionId, status: approved | changes | pass, note }
 *                  saves that direction's draft answer (overwrites the last
 *                  one); changes needs a note, pass needs allowPass on the
 *                  set, a For reference direction takes no answer at all
 *        submit    every direction that needs a decision has one -> the
 *                  answers are copied into submissions[], the set is locked
 *                  (submittedAt), status becomes approved or changes, one
 *                  feedback entry, one task and one push for Rob
 *   Pick one actions on a review set, and review actions on a pick set, are
 *   409. Notes are cut at 1,000 characters and stripped of HTML tags.
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
/* Free text from the client: tags are removed (a note is plain words), then the length is cut. */
const plain = (v, max) => String(v ?? '').replace(/<\/?[a-z!][^>]*>/gi, '').trim().slice(0, max);
const DECISIONS = ['approved', 'changes', 'pass'];
const modeOf = (s) => (s?.approvalMode === 'review' ? 'review' : 'pick');
const needsDecision = (d) => d?.needsDecision !== false;
const answered = (d) => !!d?.decision && DECISIONS.includes(d.decision.status);
/* A set is unlocked until the client has sent their answers; an old document has no submittedAt at all. */
const UNLOCKED = { $or: [{ submittedAt: '' }, { submittedAt: { $exists: false } }] };

/* Live means: sent to the client and not taken back. A draft has not been
 * sent, an archived set has been taken back, a deleted one is gone. */
const LIVE = { deleted: { $ne: true }, archived: { $ne: true }, status: { $in: ['sent', 'viewed', 'approved', 'changes'] } };
const PROJECTION = { leadId: 1, title: 1, round: 1, intro: 1, status: 1, approvedDirectionId: 1, directions: 1, feedback: 1, lastViewedAt: 1, approvalMode: 1, allowPass: 1, submittedAt: 1 };

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
const publicDecision = (x) => (x && DECISIONS.includes(x.status) ? { status: x.status, note: String(x.note || ''), decidedAt: String(x.decidedAt || '') } : null);
/* A review set hands back each direction's own saved answer, to the one who holds the link, so they can leave and come back to it. */
const publicDirection = (d, review = false) => ({ id: String(d?.id || ''), name: String(d?.name || ''), rationale: String(d?.rationale || ''), needsDecision: !review || needsDecision(d), decision: review && needsDecision(d) ? publicDecision(d?.decision) : null, items: (Array.isArray(d?.items) ? [...d.items] : []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(publicItem) });
const publicFeedback = (f) => ({ at: String(f?.at || ''), directionId: String(f?.directionId || ''), action: String(f?.action || ''), name: String(f?.name || '') });
const publicSet = (s) => ({ title: String(s.title || ''), round: Number(s.round) || 1, intro: String(s.intro || ''), status: String(s.status || ''), approvedDirectionId: String(s.approvedDirectionId || ''), approvalMode: modeOf(s), allowPass: modeOf(s) === 'review' && s.allowPass === true, submittedAt: modeOf(s) === 'review' ? String(s.submittedAt || '') : '' });

/* Rob's side of a submission, best effort and once per submission: a task "Review concept answers" on the client (unless an open one is already
 * there) and one push for the whole set. Their answers are saved before this runs, so neither failing ever fails the submit. */
const TASK_TEXT = 'Review concept answers';
export function summaryLine(answers) {
  const n = (k) => answers.filter(a => a.status === k).length;
  return [[n('approved'), 'approved'], [n('changes'), n('changes') === 1 ? 'needs changes' : 'need changes'], [n('pass'), 'passed']].filter(([c]) => c).map(([c, l]) => `${c} ${l}`).join(', ');
}
async function tellRob(db, set, answers, name) {
  let lead = null;
  try {
    lead = await db.collection('call_leads').findOne({ _id: toId(set.leadId), deleted: { $ne: true } }, { projection: { business: 1, 'showcase.displayName': 1, checklists: 1 } });
    if (lead && !allTasks(lead).some(t => !t.done && String(t.text || '').toLowerCase().startsWith(TASK_TEXT.toLowerCase()))) {
      const existing = lead.checklists || [];
      const due = new Date(Date.now() + 24 * HOUR).toISOString();
      const lists = addTask(existing, existing.find(l => l.name === 'Concepts')?.id || '', { text: TASK_TEXT, due, source: 'manual', listName: 'Concepts' });
      await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { checklists: lists, updatedAt: new Date() } });
    }
  } catch { /* the task is a convenience */ }
  try {
    const notif = await db.collection('settings').findOne({ _id: 'notifications' });
    if (notif?.reminders?.concepts !== false) {
      const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
      const who = lead?.showcase?.displayName || lead?.business || name || 'A client';
      await sendPush(db, { title: `${who} sent their answers`, body: summaryLine(answers), url: `${base}/leads/${String(set.leadId)}/concepts?set=${String(set._id)}` });
    }
  } catch { /* a push that fails never fails their answers */ }
}

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
      directions: (Array.isArray(set.directions) ? [...set.directions] : []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(d => publicDirection(d, modeOf(set) === 'review')),
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
    const note = plain(req.body?.note, 1000);
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
      if (modeOf(set) === 'review') return res.status(409).json({ error: 'This set is answered one by one.' });
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
        { _id: set._id, ...LIVE, status: { $in: OPEN }, approvalMode: { $ne: 'review' }, 'directions.id': directionId },
        { $set, $push: { feedback: { $each: [entry(action)], $slice: -200 } } },
      );
      if (!r.matchedCount) {
        const again = await col.findOne({ _id: set._id, ...LIVE }, { projection: { status: 1 } });
        return again && !OPEN.includes(again.status) ? res.status(409).json({ error: 'This set is already decided.' }) : notFound(res);
      }
      return res.status(200).json({ ok: true, status: $set.status });
    }

    /* ── Review each: one saved answer per direction, then one submit ── */
    if (action === 'decide') {
      if (modeOf(set) !== 'review') return res.status(409).json({ error: 'This set is a pick one.' });
      if (set.submittedAt) return res.status(409).json({ error: 'Your answers are already sent.' });
      const status = String(req.body?.status ?? '');
      if (!DECISIONS.includes(status)) return res.status(400).json({ error: 'unknown answer' });
      if (status === 'pass' && set.allowPass !== true) return res.status(400).json({ error: 'That one is not on for this set.' });
      if (status === 'changes' && !note) return res.status(400).json({ error: 'Say what should change first.' });
      const dirs = Array.isArray(set.directions) ? set.directions : [];
      const at = dirs.findIndex(d => d?.id === directionId);
      if (!directionId || at < 0) return notFound(res);
      if (!needsDecision(dirs[at])) return res.status(400).json({ error: 'That one is for reference, nothing to decide.' });
      /* The position, the id, the mode, the lock and the open status are all one filter: a direction that moved, a lock that landed a
       * moment ago or a pass the set does not allow matches nothing. */
      const filter = { _id: set._id, ...LIVE, status: { $in: OPEN }, approvalMode: 'review', ...UNLOCKED, [`directions.${at}.id`]: directionId, [`directions.${at}.needsDecision`]: { $ne: false } };
      if (status === 'pass') filter.allowPass = true;
      const r = await col.updateOne(filter, { $set: { [`directions.${at}.decision`]: { status, note, decidedAt: new Date().toISOString() }, updatedAt: new Date() } });
      if (!r.matchedCount) {
        const again = await col.findOne({ _id: set._id, ...LIVE }, { projection: { submittedAt: 1 } });
        return again?.submittedAt ? res.status(409).json({ error: 'Your answers are already sent.' }) : notFound(res);
      }
      return res.status(200).json({ ok: true, decision: { status, note } });
    }

    if (action === 'submit') {
      if (modeOf(set) !== 'review') return res.status(409).json({ error: 'This set is a pick one.' });
      if (set.submittedAt) return res.status(409).json({ error: 'Your answers are already sent.' });
      if (!OPEN.includes(set.status)) return res.status(409).json({ error: 'This set is already decided.' });
      const need = (Array.isArray(set.directions) ? [...set.directions] : []).sort((a, b) => (a.order || 0) - (b.order || 0)).filter(needsDecision);
      if (!need.length) return res.status(400).json({ error: 'Nothing here needs an answer.' });
      const open = need.filter(d => !answered(d));
      if (open.length) return res.status(400).json({ error: 'Answer every one first.', remaining: open.map(d => String(d.id)) });
      const at = new Date().toISOString();
      const answers = need.map(d => ({ directionId: String(d.id), name: String(d.name || ''), status: d.decision.status, note: String(d.decision.note || ''), decidedAt: String(d.decision.decidedAt || '') }));
      const result = answers.some(a => a.status === 'changes') || answers.every(a => a.status === 'pass') ? 'changes' : 'approved';
      const r = await col.updateOne(
        { _id: set._id, ...LIVE, status: { $in: OPEN }, approvalMode: 'review', ...UNLOCKED },
        { $set: { submittedAt: at, status: result, updatedAt: new Date() }, $push: { submissions: { $each: [{ id: Math.random().toString(36).slice(2, 10), at, name, status: result, answers }], $slice: -20 }, feedback: { $each: [entry('submit')], $slice: -200 } } },
      );
      if (!r.matchedCount) return res.status(409).json({ error: 'Your answers are already sent.' });
      await tellRob(db, set, answers, name);
      return res.status(200).json({ ok: true, status: result });
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

export default route(handler, { methods: ['GET', 'POST'], admin: false, maxBody: 16 * 1024 });
