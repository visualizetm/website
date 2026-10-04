import { ObjectId } from 'mongodb';
import { getDb } from './_lib/mongo.js';
import { route } from './_lib/handler.js';
import { rateKey, rateState, rateHit } from './_lib/limit.js';
import { safeUrl } from './_lib/url.js';
import { sendPush } from './_lib/notify.js';
import { SUGGESTION_KIND_IDS, SUGGESTION_GOAL_IDS } from './_semantics.js';
import { addTask } from './_lib/taskRules.js';

/* The Content Planner's public endpoint (planner prompt 1, part 3). The one
 * new function this feature adds, taking the count from 9 to 10.
 *
 *   GET  /api/planner?token=xxx&month=YYYY-MM
 *        The client's own month: who they are, and every live post in it.
 *        Month defaults to the current one. A month with nothing in it is an
 *        empty posts array, not a 404.
 *
 *   POST /api/planner?token=xxx   { postId, action, note }
 *        action 'approve'        review -> approved (a post or an ad)
 *        action 'request-change' review -> making, with their note
 *        action 'suggest'        { kind, subject, goal, details, preferredDate, link, photos }
 *                                writes a suggestion (the Ideas tab), one every 20 seconds and
 *                                15 a day per token, every field capped, photos only on our own
 *                                Cloudinary cloud, the link through safeUrl; pushes Rob a
 *                                notification when the Client ideas toggle is on and adds a
 *                                "New idea" task to the client's Ideas checklist
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
const DAY = 24 * HOUR;
const ACTIONS_PER_HOUR = 30;
const SUGGEST_GAP_MS = 20 * 1000;
const SUGGESTS_PER_DAY = 15;
/* Photos on a suggestion must be https on our own Cloudinary cloud. The cloud name is the same variable the browser
 * build uses (Vercel exposes it at runtime too); with it unset, the host alone is required. */
const cloudName = () => String(process.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
const ownPhoto = (u) => { const v = safeUrl(u, 600); const cloud = cloudName(); if (!/^https:\/\/res\.cloudinary\.com\//i.test(v)) return ''; if (cloud && !v.startsWith(`https://res.cloudinary.com/${cloud}/`)) return ''; return v; };
const dateStr = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');
const VIEW_STAMP_EVERY = HOUR; // lastViewedAt is a "they looked today" signal, not an access log

const notFound = (res) => res.status(404).json({ error: 'not found' });
const monthStr = (v) => (/^\d{4}-\d{2}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');
const tokenStr = (v) => {
  const t = String(v ?? '').trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : '';
};
const thisMonth = (now = new Date()) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

/* Per token, through the shared limiter (api/_lib/limit.js): a rolling
 * hour of stamps in the settings collection under rate:planner:<sha256 of
 * the token>, so the token itself is written nowhere but the lead. */

/* The lead behind a token, or null. The projection is the second half of the
 * whitelist: the fields this file is allowed to see are the only ones it
 * ever loads, so a future edit cannot leak something by accident. */
async function clientFor(db, token) {
  if (!token) return null;
  const lead = await db.collection('call_leads').findOne(
    { 'planner.token': token, deleted: { $ne: true } },
    { projection: { business: 1, 'showcase.displayName': 1, 'planner.enabled': 1, 'planner.welcome': 1, 'planner.postsPerMonth': 1, 'planner.lastViewedAt': 1, checklists: 1 } },
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

/** The ad fields a client may see: budget only when Rob chose to show it, results only once any is entered. */
const publicAd = (a) => {
  if (!a || typeof a !== 'object') return null;
  const r = a.results && typeof a.results === 'object' ? a.results : {};
  const hasResults = ['reach', 'clicks', 'messages', 'spend'].some(k => r[k] !== '' && r[k] != null && Number(r[k]) > 0);
  return {
    name: a.name || '', goal: a.goal || 'awareness', audience: a.audience || '', placements: Array.isArray(a.placements) ? a.placements : [],
    buttonText: a.buttonText || '', link: a.link || '', startDate: a.startDate || '', endDate: a.endDate || '',
    ...(a.showBudget && a.budget !== '' && a.budget != null ? { budget: Number(a.budget) || 0 } : {}),
    ...(hasResults ? { results: { reach: Number(r.reach) || 0, clicks: Number(r.clicks) || 0, messages: Number(r.messages) || 0, spend: Number(r.spend) || 0 } } : {}),
  };
};
/** Exactly the fields a client may see about one post (or ad). */
const publicPost = (p) => ({
  id: String(p._id),
  kind: p.kind === 'ad' ? 'ad' : 'post',
  date: p.date || '',
  time: p.time || '',
  /* An array, always: a post written before this existed carries a single
   * `platform` string and comes back as a one item list. */
  platforms: (Array.isArray(p.platforms) && p.platforms.length) ? p.platforms : [p.platform || 'instagram'],
  format: p.format === 'story' ? 'story' : p.format === 'video' ? 'video' : 'portrait',
  hashtags: p.hashtags || '',
  imageUrl: p.imageUrl || '',
  caption: p.caption || '',
  status: p.status || 'making',
  note: p.note || '',
  clientNote: p.clientNote || '',
  allowDownload: p.allowDownload !== false,
  video: p.format === 'video' ? { url: p.video?.url || '', durationSec: Number(p.video?.durationSec) || 0, poster: p.video?.poster || '', concept: p.concept || '' } : null,
  ad: p.kind === 'ad' ? publicAd(p.ad) : null,
});
/** Exactly the fields a client may see about one of their own ideas. */
const publicSuggestion = (s) => ({ id: String(s._id), kind: s.kind || 'post', subject: s.subject || '', goal: s.goal || 'other', status: s.status || 'new', note: s.status === 'declined' ? (s.note || '') : '', createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : '' });

/** When the New idea task is due: the day before the preferred date when there is one, else two working days from now (New York day keys are not needed here: the admin's own zone reads it back). */
function suggestionDue(preferredDate, nowMs) {
  const key = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  if (preferredDate) { const [y, m, d] = preferredDate.split('-').map(Number); const before = new Date(Date.UTC(y, m - 1, d - 1)); if (before.getTime() > nowMs) return `${key(before)}T13:00:00.000Z`; }
  const d = new Date(nowMs); let left = 2;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--; }
  return `${key(d)}T13:00:00.000Z`;
}

async function handler(req, res) {
  // A client's month is theirs: never a shared cache, never the back-forward cache with the token in the URL.
  res.setHeader('Cache-Control', 'no-store');
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

    const suggestions = await db.collection('suggestions').find({ leadId: String(lead._id), deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(50).toArray();
    return res.status(200).json({ client: publicClient(lead), month, posts: posts.map(publicPost), suggestions: suggestions.map(publicSuggestion) });
  }

  if (req.method === 'POST') {
    const key = rateKey('planner', token);
    const limit = await rateState(db, key, { max: ACTIONS_PER_HOUR, windowMs: HOUR });
    if (limit.exceeded) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'That is a lot of changes in one hour. Give it a little while and try again.' });
    }
    await rateHit(db, key, limit.hits);

    const { postId, action } = req.body || {};

    /* An idea (the Ideas tab). Its own two limiters: one every 20 seconds, 15 a day. Plain text in, plain text out. */
    if (action === 'suggest') {
      const b = req.body || {};
      const gap = await rateState(db, rateKey('suggest-gap', token), { max: 1, windowMs: SUGGEST_GAP_MS });
      const day = await rateState(db, rateKey('suggest-day', token), { max: SUGGESTS_PER_DAY, windowMs: DAY });
      if (gap.exceeded || day.exceeded) {
        res.setHeader('Retry-After', String(Math.max(gap.retryAfter, day.retryAfter)));
        return res.status(429).json({ error: gap.exceeded ? 'Give it a moment, then send the next one.' : 'That is a lot of ideas for one day. Send the rest tomorrow.' });
      }
      const subject = String(b.subject ?? '').trim().slice(0, 120);
      if (!subject) return res.status(400).json({ error: 'Say what it is about and I can make it.' });
      const doc = {
        leadId: String(lead._id),
        kind: SUGGESTION_KIND_IDS.includes(b.kind) ? b.kind : 'post',
        subject,
        goal: SUGGESTION_GOAL_IDS.includes(b.goal) ? b.goal : 'other',
        details: String(b.details ?? '').trim().slice(0, 1000),
        preferredDate: dateStr(b.preferredDate),
        link: safeUrl(b.link, 600),
        photos: (Array.isArray(b.photos) ? b.photos : []).map(ownPhoto).filter(Boolean).slice(0, 3),
        status: 'new', postId: '', note: '', seenAt: '',
        createdAt: new Date(), updatedAt: new Date(),
      };
      const r = await db.collection('suggestions').insertOne(doc);
      await rateHit(db, rateKey('suggest-gap', token), gap.hits);
      await rateHit(db, rateKey('suggest-day', token), day.hits);
      /* Rob's side of it, best effort: the "New idea" task (due in two working days, or the day before the preferred date) and the push. */
      try {
        const due = suggestionDue(doc.preferredDate, Date.now());
        const lists = addTask(lead.checklists || [], (lead.checklists || []).find(l => l.name === 'Ideas')?.id || '', { text: `New idea: ${subject}`, due, source: 'suggestion', suggestionId: String(r.insertedId), listName: 'Ideas' });
        await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { checklists: lists, updatedAt: new Date() } });
      } catch { /* the idea is saved; the task is a convenience */ }
      try {
        const notif = await db.collection('settings').findOne({ _id: 'notifications' });
        if (notif?.reminders?.ideas !== false) {
          const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
          await sendPush(db, { title: `New idea from ${lead.showcase?.displayName || lead.business}`, body: `${doc.kind === 'ad' ? 'An ad' : doc.kind === 'video' ? 'A video' : 'A post'}: ${subject}`, url: `${base}/clients/${lead._id}/planner?ideas=1` });
        }
      } catch { /* a push that fails never fails their idea */ }
      return res.status(200).json({ ok: true, suggestion: publicSuggestion({ ...doc, _id: r.insertedId }) });
    }

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
