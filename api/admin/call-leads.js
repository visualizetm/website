import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';

const CALL_STATUSES = ['not-called', 'callback', 'booked', 'no', 'no-answer'];
const PRIORITIES = ['hot', 'warm', 'cold'];
const SOCIAL_KEYS = ['website', 'instagram', 'facebook', 'tiktok', 'google', 'yelp', 'linkedin', 'x', 'youtube'];
const TLDS = ['com','net','org','co','io','us','de','biz','app','shop','site','store','me','tv','xyz','info'];

// Server-side copy of the client normalizer (serverless can't import from src/).
function normalizeSocial(key, raw) {
  let v = String(raw ?? '').trim().replace(/^[<"'\s]+|[>"'\s]+$/g, '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return 'https://' + v;
  const firstSeg = v.split('/')[0];
  const dot = firstSeg.lastIndexOf('.');
  const isDomain = dot >= 0 && TLDS.includes(firstSeg.slice(dot + 1).toLowerCase());
  if (v.includes('/') || isDomain) return 'https://' + v.replace(/^\/+/, '');
  const h = v.replace(/^@+/, '').replace(/^\/+/, '');
  switch (key) {
    case 'website':   return 'https://' + h;
    case 'instagram': return `https://instagram.com/${h}`;
    case 'facebook':  return `https://facebook.com/${h}`;
    case 'tiktok':    return `https://tiktok.com/@${h}`;
    case 'yelp':      return `https://yelp.com/biz/${h}`;
    case 'linkedin':  return `https://linkedin.com/company/${h}`;
    case 'x':         return `https://x.com/${h}`;
    case 'youtube':   return /^uc[\w-]{20,}$/i.test(h) ? `https://youtube.com/channel/${h}` : `https://youtube.com/@${h}`;
    case 'google':    return `https://www.google.com/maps/search/${encodeURIComponent(h)}`;
    default:          return 'https://' + h;
  }
}
function normalizeSocials(obj) {
  const out = {};
  if (obj && typeof obj === 'object') {
    for (const k of SOCIAL_KEYS) { const u = normalizeSocial(k, obj[k]); if (u) out[k] = u; }
  }
  return out;
}
export { normalizeSocials };

const str = (v, max = 400) => String(v ?? '').slice(0, max);
const strArr = (v, max = 30) => Array.isArray(v) ? v.slice(0, max).map(x => str(x, 600)) : [];
const qaArr = (v, max = 12) => Array.isArray(v)
  ? v.slice(0, max).map(x => ({ say: str(x?.say, 300), respond: str(x?.respond, 800) }))
  : [];

// Normalize an incoming lead object to the stored shape (defense in depth —
// the endpoint is admin-only, but bad shapes would break the notepad render).
function sanitize(b) {
  const s = b.script || {};
  const c = b.close || {};
  const a = b.afterCall || {};
  const i = b.intel || {};
  return {
    business: str(b.business, 200),
    industry: str(b.industry, 80),
    descriptor: str(b.descriptor, 400),
    phone: str(b.phone, 40),
    phoneNote: str(b.phoneNote, 200),
    email: str(b.email, 200),
    area: str(b.area, 160),
    serviceInterest: str(b.serviceInterest, 200),
    sourceId: b.sourceId ? str(b.sourceId, 120) : undefined,
    notes: str(b.notes, 3000),
    askFor: str(b.askFor, 200),
    bestWindow: str(b.bestWindow, 300),
    priority: PRIORITIES.includes(b.priority) ? b.priority : 'warm',
    callStatus: CALL_STATUSES.includes(b.callStatus) ? b.callStatus : 'not-called',
    angle: str(b.angle, 1200),
    beforeYouDial: strArr(b.beforeYouDial),
    script: {
      confirm: str(s.confirm, 400),
      intro: str(s.intro, 600),
      homework: str(s.homework, 600),
      question: str(s.question, 400),
      likelyAnswers: qaArr(s.likelyAnswers),
      hook: str(s.hook, 800),
      ask: str(s.ask, 400),
    },
    objections: qaArr(b.objections),
    close: {
      lockIt: str(c.lockIt, 600),
      ifNo: str(c.ifNo, 600),
      noAnswer: str(c.noAnswer, 400),
    },
    afterCall: {
      meeting: str(a.meeting, 300),
      email: str(a.email, 200),
      whatTheySaid: str(a.whatTheySaid, 3000),
      nextAction: str(a.nextAction, 600),
    },
    intel: {
      accomplishments: strArr(i.accomplishments),
      gaps: strArr(i.gaps),
      dropLines: strArr(i.dropLines),
    },
    socials: normalizeSocials(b.socials),
  };
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('call_leads');

  if (req.method === 'GET') {
    const items = await col.find({ deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(500).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const raw = Array.isArray(body.leads) ? body.leads : [body];
    const docs = raw
      .map(sanitize)
      .filter(d => d.business)
      .map(d => ({ ...d, createdAt: new Date(), updatedAt: new Date() }));
    if (!docs.length) return res.status(400).json({ error: 'business name required' });

    // Idempotent import: skip leads whose business name already exists.
    const existing = new Set(
      (await col.find({}, { projection: { business: 1 } }).toArray()).map(d => d.business)
    );
    const fresh = docs.filter(d => !existing.has(d.business));
    if (fresh.length) await col.insertMany(fresh);

    // Backfill: an existing lead with no socials yet gets them from a re-import.
    let backfilled = 0;
    for (const d of docs) {
      if (!existing.has(d.business) || !Object.keys(d.socials || {}).length) continue;
      const r = await col.updateOne(
        { business: d.business, $or: [{ socials: { $exists: false } }, { socials: {} }] },
        { $set: { socials: d.socials, updatedAt: new Date() } },
      );
      backfilled += r.modifiedCount;
    }
    return res.status(200).json({ ok: true, inserted: fresh.length, backfilled, skipped: docs.length - fresh.length - backfilled });
  }

  if (req.method === 'PATCH') {
    const { id, set } = req.body || {};
    if (!id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const clean = sanitize(set);
    const allowed = {};
    for (const key of Object.keys(clean)) {
      if (key in set) allowed[key] = clean[key]; // only fields the caller actually sent
    }
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    allowed.updatedAt = new Date();
    await col.updateOne({ _id: new ObjectId(String(id)) }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    // Soft delete: keeps a tombstone so a spreadsheet re-upload won't recreate it.
    await col.updateOne({ _id: new ObjectId(String(id)) }, { $set: { deleted: true, deletedAt: new Date() } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
