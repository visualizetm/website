import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';

const CALL_STATUSES = ['not-called', 'callback', 'booked', 'no', 'no-answer'];
const PRIORITIES = ['hot', 'warm'];

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
  };
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('call_leads');

  if (req.method === 'GET') {
    const items = await col.find({}).sort({ createdAt: -1 }).limit(500).toArray();
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
    return res.status(200).json({ ok: true, inserted: fresh.length, skipped: docs.length - fresh.length });
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
    await col.deleteOne({ _id: new ObjectId(String(id)) });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
