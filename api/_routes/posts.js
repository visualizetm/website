import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { safeUrl } from '../_lib/url.js';
import { PLATFORM_IDS, POST_STATUS_IDS, POST_FORMAT_IDS, POST_KIND_IDS, AD_GOAL_IDS, AD_PLACEMENT_IDS, AD_ONLY_STATUS_IDS } from '../_semantics.js';

/* Posts (Content Planner, prompt 1): one document per scheduled social post.
 * A post belongs to a client (call_leads _id) and to a month, and moves
 * making -> review -> approved -> posted. The client only ever sees it from
 * `review` onward, through api/planner.js.
 *
 *   GET    /api/admin/posts?leadId=<id>&month=YYYY-MM   { items } for one client
 *   GET    /api/admin/posts?leadId=<id>                 { items } every month
 *   GET    /api/admin/posts                             { items } this month and next
 *                                                       (what the Calendar screen reads)
 *   POST   { leadId, month, ... }                       { ok, item }
 *   POST   { action: 'send-review', leadId, ids }      { ok, ids } the batch send (Planner v2)
 *   PATCH  { id, set }                                  $set only the keys sent (sanitized)
 *   DELETE { id }                                       soft delete, the same tombstone
 *                                                       every other collection uses
 *
 * Every query filters deleted: { $ne: true }; nothing here ever hard deletes,
 * so a mistaken delete is recoverable exactly like a lead or a submission.
 */

const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const num = (v, max = 100000) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Number(v))) : 0);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };

/* Hashtags are normalised on the way in so the field is always the same
 * shape however it was typed: trimmed, one space between tokens, every token
 * carrying exactly one leading #, and no duplicates. */
export function normalizeHashtags(v) {
  const seen = new Set();
  const out = [];
  for (const raw of String(v ?? '').split(/\s+/)) {
    const word = raw.replace(/^#+/, '').trim();
    if (!word) continue;
    const tag = `#${word}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.join(' ').slice(0, 500);
}

/** "YYYY-MM", or '' when it is not one. */
const monthStr = (v) => (/^\d{4}-\d{2}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');
/** "YYYY-MM-DD", or '' when it is not one. */
const dateStr = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').trim()) ? String(v).trim() : '');
/** "HH:MM" on a 24 hour clock, or '' when it is not one. */
const timeStr = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v ?? '').trim()) ? String(v).trim() : '');

/** The month a Date falls in, and the one after it, as "YYYY-MM". */
export function monthsFrom(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const key = (yy, mm) => `${yy}-${String(mm + 1).padStart(2, '0')}`;
  return [key(y, m), m === 11 ? key(y + 1, 0) : key(y, m + 1)];
}

/** The ad fields (planner dashboard): what Rob runs on Meta. budget is shown to the client only when showBudget is on; results only once any value is set. */
export function sanitizeAd(a) {
  if (!a || typeof a !== 'object') return undefined;
  const r = a.results && typeof a.results === 'object' ? a.results : {};
  const n = (v) => (v === '' || v == null ? '' : num(v, 1e7));
  return {
    name: str(a.name, 120), goal: AD_GOAL_IDS.includes(a.goal) ? a.goal : 'awareness', audience: str(a.audience, 300),
    placements: Array.isArray(a.placements) ? [...new Set(a.placements.filter(x => AD_PLACEMENT_IDS.includes(x)))] : [],
    buttonText: str(a.buttonText, 40), link: safeUrl(a.link, 600), startDate: dateStr(a.startDate), endDate: dateStr(a.endDate),
    budget: n(a.budget), showBudget: !!a.showBudget,
    results: { reach: n(r.reach), clicks: n(r.clicks), messages: n(r.messages), spend: n(r.spend) },
  };
}
/** The video on a video post or ad: the file (optional until it exists), its length and a poster. */
export function sanitizeVideo(v) {
  if (!v || typeof v !== 'object') return undefined;
  return { url: safeUrl(v.url, 600), durationSec: Math.round(num(v.durationSec, 3600)), poster: safeUrl(v.poster, 600) };
}

/** One earlier version of a post (Planner v2): the picture and words the client asked to change, with their note. */
export function sanitizeVersion(v) {
  if (!v || typeof v !== 'object') return null;
  return { imageUrl: safeUrl(v.imageUrl, 600), caption: String(v.caption ?? '').slice(0, 2200), note: str(v.note, 300), at: str(v.at, 40) };
}
export const VERSIONS_MAX = 5;
const POSTED_BY = ['client', 'rob'];
const CHANGE_REASONS = ['photo', 'words', 'date', 'other'];

/* sanitize() IS the schema. A key the whitelist does not know is not
 * written, and a key the caller did not send stays undefined so PATCH can
 * tell "set this to empty" from "leave this alone". */
function sanitize(b) {
  const kind = b.kind !== undefined ? (POST_KIND_IDS.includes(b.kind) ? b.kind : 'post') : undefined;
  return {
    /* Planner dashboard: a post the client shares, or an ad Rob runs. Missing means post, which every row written before this was. */
    kind,
    ad: b.ad !== undefined ? (b.ad === null ? null : sanitizeAd(b.ad)) : undefined,
    video: b.video !== undefined ? (b.video === null ? null : sanitizeVideo(b.video)) : undefined,
    concept: b.concept !== undefined ? str(b.concept, 600) : undefined, // a planned video's idea, before the file exists
    allowDownload: b.allowDownload !== undefined ? !!b.allowDownload : undefined,
    leadId: b.leadId !== undefined ? str(b.leadId, 64) : undefined,
    month: b.month !== undefined ? monthStr(b.month) : undefined,
    date: b.date !== undefined ? dateStr(b.date) : undefined,
    time: b.time !== undefined ? timeStr(b.time) : undefined,
    /* One post can go to several places at once. `platforms` is the field
     * that matters; `platform` stays accepted (and written by the editor as
     * the first entry) for one release, so a record written today is still
     * readable by anything that has not been updated. */
    platforms: Array.isArray(b.platforms)
      ? (() => {
          const clean = [...new Set(b.platforms.filter(x => PLATFORM_IDS.includes(x)))].slice(0, 4);
          return clean.length ? clean : ['instagram'];
        })()
      : undefined,
    platform: b.platform !== undefined ? (PLATFORM_IDS.includes(b.platform) ? b.platform : 'instagram') : undefined,
    /* A portrait feed post or a story. Missing means portrait, which is what
     * every post written before this existed is. */
    format: b.format !== undefined ? (POST_FORMAT_IDS.includes(b.format) ? b.format : 'portrait') : undefined,
    /* Their own field rather than part of the caption, so a set can be
     * reused across posts and the client can copy the caption clean. */
    hashtags: b.hashtags !== undefined ? normalizeHashtags(b.hashtags) : undefined,
    imageUrl: b.imageUrl !== undefined ? safeUrl(b.imageUrl, 600) : undefined, // http, https or a root path, else ''
    caption: b.caption !== undefined ? String(b.caption ?? '').slice(0, 2200) : undefined, // Instagram's own cap
    /* live and finished belong to ads; a post sent one of them is left as it was (undefined), never moved. The route checks the kind on write. */
    status: b.status !== undefined ? (POST_STATUS_IDS.includes(b.status) ? b.status : 'making') : undefined,
    note: b.note !== undefined ? str(b.note, 500) : undefined,             // Rob writes this one
    clientNote: b.clientNote !== undefined ? str(b.clientNote, 500) : undefined, // the client writes this one
    clientNoteAt: b.clientNoteAt !== undefined ? str(b.clientNoteAt, 40) : undefined,
    approvedAt: b.approvedAt !== undefined ? str(b.approvedAt, 40) : undefined,
    postedAt: b.postedAt !== undefined ? str(b.postedAt, 40) : undefined,
    /* Planner v2: who marked it posted, why the client asked for a change, when they decided, when it went to them, and the earlier versions. */
    postedBy: b.postedBy !== undefined ? (POSTED_BY.includes(b.postedBy) ? b.postedBy : '') : undefined,
    changeReason: b.changeReason !== undefined ? (CHANGE_REASONS.includes(b.changeReason) ? b.changeReason : '') : undefined,
    decidedAt: b.decidedAt !== undefined ? str(b.decidedAt, 40) : undefined,
    reviewAt: b.reviewAt !== undefined ? str(b.reviewAt, 40) : undefined,
    versions: b.versions !== undefined ? (Array.isArray(b.versions) ? b.versions.map(sanitizeVersion).filter(Boolean).slice(-VERSIONS_MAX) : []) : undefined,
    order: b.order !== undefined ? Math.round(num(b.order, 1000)) : undefined,
    archived: b.archived !== undefined ? !!b.archived : undefined,
  };
}
const compact = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

export async function handler(req, res) {
  const db = await getDb();
  const col = db.collection('posts');

  if (req.method === 'GET') {
    const q = { deleted: { $ne: true } };
    if (req.query?.archived === '1') q.archived = true; else q.archived = { $ne: true };
    if (req.query?.leadId) q.leadId = String(req.query.leadId);
    const month = monthStr(req.query?.month);
    if (month) q.month = month;
    // No client and no month: the Calendar's window, this month and next.
    else if (!req.query?.leadId) q.month = { $in: monthsFrom() };
    const items = await col.find(q).sort({ date: 1, order: 1, time: 1 }).limit(1000).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    /* Batch send (Planner v2, part 2): { action: 'send-review', leadId, ids } moves every post of that lead among ids that is still
     * being made and has a picture or a video and a caption to review, in one write, so the client sees one change rather than n.
     * Ads, posts of another lead, a post with nothing to approve yet and anything not in making are left exactly as they are.
     * Answers the ids it moved. */
    if (req.body?.action === 'send-review') {
      const leadId = str(req.body.leadId, 64);
      const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).slice(0, 200).map(oid).filter(Boolean);
      if (!leadId || !ids.length) return res.status(400).json({ error: 'leadId and ids required' });
      const found = await col.find({ _id: { $in: ids }, leadId, status: 'making', deleted: { $ne: true }, archived: { $ne: true } }).limit(200).toArray();
      const ready = found.filter(p => (p.kind || 'post') === 'post' && (String(p.imageUrl || '').trim() || String(p.video?.url || '').trim()) && String(p.caption || '').trim());
      const moved = ready.map(p => p._id);
      if (moved.length) {
        const at = new Date();
        await col.updateMany({ _id: { $in: moved }, leadId, status: 'making' }, { $set: { status: 'review', reviewAt: at.toISOString(), updatedAt: at } });
      }
      return res.status(200).json({ ok: true, ids: moved.map(String) });
    }
    const doc = compact(sanitize(req.body || {}));
    if (!doc.leadId || !doc.month) return res.status(400).json({ error: 'leadId and month required' });
    if (AD_ONLY_STATUS_IDS.includes(doc.status) && (doc.kind || 'post') !== 'ad') return res.status(400).json({ error: 'live and finished are ad statuses' });
    const now = new Date();
    const item = {
      kind: 'post', allowDownload: true,
      date: '', time: '', platform: 'instagram', platforms: ['instagram'], format: 'portrait',
      imageUrl: '', caption: '', hashtags: '', status: 'making',
      note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0,
      archived: false, ...doc, createdAt: now, updatedAt: now,
    };
    if (item.status === 'review' && !item.reviewAt) item.reviewAt = now.toISOString();
    const r = await col.insertOne(item);
    return res.status(200).json({ ok: true, item: { ...item, _id: r.insertedId } });
  }

  if (req.method === 'PATCH') {
    const { id, set } = req.body || {};
    const _id = oid(id);
    if (!_id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const clean = sanitize(set);
    const allowed = {};
    for (const key of Object.keys(clean)) if (key in set && clean[key] !== undefined) allowed[key] = clean[key];
    delete allowed.leadId; // a post never moves between clients
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    const needsCur = AD_ONLY_STATUS_IDS.includes(allowed.status) || allowed.status === 'review' || 'imageUrl' in allowed || 'caption' in allowed;
    const cur = needsCur ? await col.findOne({ _id, deleted: { $ne: true } }, { projection: { kind: 1, status: 1, imageUrl: 1, caption: 1, clientNote: 1, clientNoteAt: 1, versions: 1 } }) : null;
    if (AD_ONLY_STATUS_IDS.includes(allowed.status)) {
      if ((allowed.kind || cur?.kind || 'post') !== 'ad') return res.status(400).json({ error: 'live and finished are ad statuses' });
    }
    /* Planner v2: the moment it went to the client, stamped when it moves into review (not on every save of a post already there). */
    if (allowed.status === 'review' && cur && cur.status !== 'review' && !('reviewAt' in allowed)) allowed.reviewAt = new Date().toISOString();
    /* The first draft, kept: a new picture or new words on a post the client asked to change pushes the old pair, with their note, onto
     * versions in the same write. Once per change request: when the newest version is already newer than the request, the autosave's
     * later keystrokes do not stack up more copies of the same answer. */
    const update = { $set: allowed };
    if (cur && cur.clientNote && !('versions' in allowed)) {
      const changed = ('imageUrl' in allowed && allowed.imageUrl !== (cur.imageUrl || '')) || ('caption' in allowed && allowed.caption !== (cur.caption || ''));
      const last = Array.isArray(cur.versions) && cur.versions.length ? cur.versions[cur.versions.length - 1] : null;
      const answered = last && String(last.at || '') >= String(cur.clientNoteAt || '');
      if (changed && !answered) {
        const old = sanitizeVersion({ imageUrl: cur.imageUrl || '', caption: cur.caption || '', note: cur.clientNote, at: new Date().toISOString() });
        update.$push = { versions: { $each: [old], $slice: -VERSIONS_MAX } };
      }
    }
    allowed.updatedAt = new Date();
    await col.updateOne({ _id, deleted: { $ne: true } }, update);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const _id = oid(req.body?.id ?? req.query?.id);
    if (!_id) return res.status(400).json({ error: 'id required' });
    await col.updateOne({ _id }, { $set: { deleted: true, deletedAt: new Date() } });
    return res.status(200).json({ ok: true, deleted: 1 });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
