import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { safeUrl } from '../_lib/url.js';
import { PLATFORM_IDS, POST_STATUS_IDS, POST_FORMAT_IDS } from '../_semantics.js';

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

/* sanitize() IS the schema. A key the whitelist does not know is not
 * written, and a key the caller did not send stays undefined so PATCH can
 * tell "set this to empty" from "leave this alone". */
function sanitize(b) {
  return {
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
    status: b.status !== undefined ? (POST_STATUS_IDS.includes(b.status) ? b.status : 'making') : undefined,
    note: b.note !== undefined ? str(b.note, 500) : undefined,             // Rob writes this one
    clientNote: b.clientNote !== undefined ? str(b.clientNote, 500) : undefined, // the client writes this one
    clientNoteAt: b.clientNoteAt !== undefined ? str(b.clientNoteAt, 40) : undefined,
    approvedAt: b.approvedAt !== undefined ? str(b.approvedAt, 40) : undefined,
    postedAt: b.postedAt !== undefined ? str(b.postedAt, 40) : undefined,
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
    const doc = compact(sanitize(req.body || {}));
    if (!doc.leadId || !doc.month) return res.status(400).json({ error: 'leadId and month required' });
    const now = new Date();
    const item = {
      date: '', time: '', platform: 'instagram', platforms: ['instagram'], format: 'portrait',
      imageUrl: '', caption: '', hashtags: '', status: 'making',
      note: '', clientNote: '', clientNoteAt: '', approvedAt: '', postedAt: '', order: 0,
      archived: false, ...doc, createdAt: now, updatedAt: now,
    };
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
    allowed.updatedAt = new Date();
    await col.updateOne({ _id, deleted: { $ne: true } }, { $set: allowed });
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
