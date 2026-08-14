import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';

const CALL_STATUSES = ['not-called', 'callback', 'booked', 'no', 'no-answer'];
const PRIORITIES = ['hot', 'warm', 'cold'];
const STAGES = ['lead', 'booked', 'won', 'lost', 'client'];
const MEETING_TYPES = ['call', 'video', 'in-person'];
const PLAN_IDS = ['full', '6mo', '12mo'];
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
// Call-session history — additive field. Each entry: when, what happened, and
// any note / booking details captured at log time.
const logArr = (v, max = 200) => Array.isArray(v)
  ? v.slice(-max).map(x => ({
      at: str(x?.at, 40),
      outcome: CALL_STATUSES.includes(x?.outcome) ? x.outcome : 'no-answer',
      note: str(x?.note, 1000),
      meeting: str(x?.meeting, 300),
      email: str(x?.email, 200),
    }))
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
    callLog: logArr(b.callLog),
    // ── Booked-pipeline fields (all additive — older leads simply lack them) ──
    stage: STAGES.includes(b.stage) ? b.stage : undefined,
    meeting: b.meeting && typeof b.meeting === 'object' ? {
      date: str(b.meeting.date, 10),
      time: str(b.meeting.time, 5),
      type: MEETING_TYPES.includes(b.meeting.type) ? b.meeting.type : 'call',
    } : undefined,
    servicesPlanned: Array.isArray(b.servicesPlanned)
      ? b.servicesPlanned.slice(0, 30).map(x => str(x, 60)) : undefined,
    pricingOptions: Array.isArray(b.pricingOptions)
      ? b.pricingOptions.slice(0, 3).map(o => ({
          label: str(o?.label, 80),
          price: Number.isFinite(Number(o?.price)) ? Math.max(0, Math.min(100000, Number(o.price))) : 0,
          plan: PLAN_IDS.includes(o?.plan) ? o.plan : 'full',
          retainer: str(o?.retainer, 200),
          notes: str(o?.notes, 600),
        })) : undefined,
    conceptsTracker: b.conceptsTracker && typeof b.conceptsTracker === 'object' ? {
      items: Array.isArray(b.conceptsTracker.items)
        ? b.conceptsTracker.items.slice(0, 20).map(i => ({ label: str(i?.label, 120), done: !!i?.done }))
        : [],
      demoUrl: str(b.conceptsTracker.demoUrl, 400),
      driveUrl: str(b.conceptsTracker.driveUrl, 400),
    } : undefined,
    prepNotes: b.prepNotes !== undefined ? str(b.prepNotes, 3000) : undefined,
    // Named task lists ("checklists") — additive. ≤10 lists × ≤50 items.
    checklists: Array.isArray(b.checklists)
      ? b.checklists.slice(0, 10).map(l => ({
          name: str(l?.name, 80),
          items: Array.isArray(l?.items)
            ? l.items.slice(0, 50).map(i => ({ text: str(i?.text, 300), done: !!i?.done }))
            : [],
        }))
      : undefined,
    // Set when the first invoice is paid and the lead becomes a client.
    clientSince: b.clientSince !== undefined ? str(b.clientSince, 40) : undefined,
    // What the client paid for — a purchases ledger. Additive.
    purchases: Array.isArray(b.purchases)
      ? b.purchases.slice(0, 50).map(p => ({
          label: str(p?.label, 160),
          amount: Number.isFinite(Number(p?.amount)) ? Math.max(0, Math.min(1000000, Number(p.amount))) : 0,
          at: str(p?.at, 40),
          notes: str(p?.notes, 400),
        }))
      : undefined,
    // Manual "I talked to them" log (calls/meetings outside the console).
    contactLog: Array.isArray(b.contactLog)
      ? b.contactLog.slice(-200).map(c => ({
          type: ['call', 'meeting', 'email', 'text', 'other'].includes(c?.type) ? c.type : 'other',
          at: str(c?.at, 40),
          note: str(c?.note, 600),
        }))
      : undefined,
    bookedOutcome: b.bookedOutcome && typeof b.bookedOutcome === 'object' ? {
      result: ['won', 'lost'].includes(b.bookedOutcome.result) ? b.bookedOutcome.result : 'lost',
      reason: str(b.bookedOutcome.reason, 600),
      at: str(b.bookedOutcome.at, 40),
    } : undefined,
  };
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('call_leads');

  if (req.method === 'GET') {
    // Recently deleted view (?deleted=1): lazily purge anything older than
    // 30 days, then return what's still restorable.
    if (req.query?.deleted === '1') {
      const cutoff = new Date(Date.now() - 30 * 864e5);
      await col.deleteMany({ deleted: true, deletedAt: { $lt: cutoff } });
      const items = await col.find({ deleted: true }).sort({ deletedAt: -1 }).limit(200).toArray();
      return res.status(200).json({ items });
    }
    const items = await col.find({ deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(500).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const raw = Array.isArray(body.leads) ? body.leads : [body];
    const docs = raw
      .map(sanitize)
      .filter(d => d.business)
      .map(d => {
        for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
        return { ...d, createdAt: new Date(), updatedAt: new Date() };
      });
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
    // Restore from Recently deleted — clears the tombstone so the lead is
    // visible everywhere again (and import matching treats it as live).
    if (req.body?.action === 'restore') {
      const ids = (Array.isArray(req.body.ids) ? req.body.ids : [])
        .map(x => { try { return new ObjectId(String(x)); } catch { return null; } })
        .filter(Boolean);
      if (!ids.length) return res.status(400).json({ error: 'ids required' });
      await col.updateMany({ _id: { $in: ids } }, { $set: { deleted: false }, $unset: { deletedAt: '' } });
      return res.status(200).json({ ok: true, restored: ids.length });
    }

    const { id, set } = req.body || {};
    if (!id || !set || typeof set !== 'object') return res.status(400).json({ error: 'id and set required' });
    const clean = sanitize(set);
    const allowed = {};
    for (const key of Object.keys(clean)) {
      // only fields the caller actually sent, and never write an undefined
      if (key in set && clean[key] !== undefined) allowed[key] = clean[key];
    }
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    allowed.updatedAt = new Date();
    await col.updateOne({ _id: new ObjectId(String(id)) }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    // Manual purge of everything in Recently deleted (Settings action).
    if (req.query?.purgeDeleted === '1') {
      const r = await col.deleteMany({ deleted: true });
      return res.status(200).json({ ok: true, purged: r.deletedCount });
    }
    // Soft delete (single ?id= or bulk ?ids=a,b,c): keeps a tombstone so a
    // spreadsheet re-upload won't recreate it; restorable for 30 days.
    const raw = req.query?.ids ? String(req.query.ids).split(',') : (req.query?.id ? [req.query.id] : []);
    const ids = raw.map(x => { try { return new ObjectId(String(x).trim()); } catch { return null; } }).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'id required' });
    await col.updateMany({ _id: { $in: ids } }, { $set: { deleted: true, deletedAt: new Date() } });
    return res.status(200).json({ ok: true, deleted: ids.length });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
