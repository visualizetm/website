import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';
import { CONCEPT_KIND_IDS } from '../_semantics.js';

/* Concept packs (Prompt 11): the library of prompts and images Rob copies into
 * ChatGPT before a meeting.
 *   GET   /api/admin/concept-packs?leadId&industryKey&kind     { items }
 *   POST  { ...pack }                                          { ok, item }
 *   PATCH { id, set }                                          $set only
 * The first GET on an empty collection seeds one pack so the screen is never
 * empty: "Universal logo directions" with three prompt stubs to edit. */

const str = (v, max = 400) => String(v ?? '').slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const uid = () => Math.random().toString(36).slice(2, 10);

function sanitize(b) {
  return {
    title: b.title !== undefined ? str(b.title, 160) : undefined,
    leadId: b.leadId !== undefined ? str(b.leadId, 64) : undefined,
    industryKey: b.industryKey !== undefined ? str(b.industryKey, 80).trim().toLowerCase().replace(/\s+/g, ' ') : undefined,
    kind: b.kind !== undefined ? (CONCEPT_KIND_IDS.includes(b.kind) ? b.kind : 'other') : undefined,
    prompts: Array.isArray(b.prompts) ? b.prompts.slice(0, 40).map(p => ({ id: str(p?.id, 40) || uid(), label: str(p?.label, 120), text: str(p?.text, 6000) })) : undefined,
    images: Array.isArray(b.images) ? b.images.slice(0, 60).map(i => ({ id: str(i?.id, 40) || uid(), label: str(i?.label, 120), link: str(i?.link, 600) })) : undefined,
    tags: Array.isArray(b.tags) ? [...new Set(b.tags.slice(0, 30).map(t => str(t, 40).trim().toLowerCase()).filter(Boolean))] : undefined,
    notes: b.notes !== undefined ? str(b.notes, 3000) : undefined,
    usedFor: Array.isArray(b.usedFor) ? [...new Set(b.usedFor.slice(-200).map(x => str(x, 64)))] : undefined,
    lastUsedAt: b.lastUsedAt !== undefined ? str(b.lastUsedAt, 40) : undefined,
    archived: b.archived !== undefined ? !!b.archived : undefined,
  };
}
const compact = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

const SEED = {
  title: 'Universal logo directions', leadId: '', industryKey: '', kind: 'logo', tags: ['seed', 'logo'],
  prompts: [
    { id: 'p1', label: 'Direction 1: wordmark', text: 'A clean, confident wordmark for [business], a [industry] in [city]. Bold condensed sans serif, tight letter spacing, one accent mark that hints at [what they do]. Flat vector, black on white, no gradients, no mockup, presented on a plain background.' },
    { id: 'p2', label: 'Direction 2: mark and lockup', text: 'A simple geometric brand mark for [business] built from [one shape that says what they do], paired with a lowercase wordmark. Two color system: [primary] and off white. Flat vector, centered, plenty of margin, no mockup.' },
    { id: 'p3', label: 'Direction 3: badge', text: 'A circular badge logo for [business], [industry], established [year]. Hand set condensed type around the ring, a single line icon in the center, one color on a dark background. Flat vector, print ready feel, no mockup.' },
  ],
  images: [], notes: 'Edit these three stubs. Swap the brackets for the lead, then copy the prompt.', usedFor: [], archived: false,
};

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('concept_packs');

  if (req.method === 'GET') {
    if ((await col.countDocuments({})) === 0) await col.insertOne({ ...SEED, createdAt: new Date(), updatedAt: new Date() });
    const q = { archived: { $ne: true } };
    if (req.query?.leadId) q.leadId = String(req.query.leadId);
    if (req.query?.industryKey) q.industryKey = String(req.query.industryKey).trim().toLowerCase();
    if (req.query?.kind && CONCEPT_KIND_IDS.includes(req.query.kind)) q.kind = req.query.kind;
    const items = await col.find(q).sort({ updatedAt: -1 }).limit(500).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const doc = compact(sanitize(req.body || {}));
    if (!doc.title) return res.status(400).json({ error: 'title required' });
    const now = new Date();
    const item = { leadId: '', industryKey: '', kind: 'other', prompts: [], images: [], tags: [], notes: '', usedFor: [], archived: false, ...doc, createdAt: now, updatedAt: now };
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
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    allowed.updatedAt = new Date();
    await col.updateOne({ _id }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
}
