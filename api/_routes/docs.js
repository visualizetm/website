import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { DOC_TYPE_IDS, LIMITS, sanitizeBlocks, sanitizeTitle, searchTextOf, refsOf } from '../_lib/docBlocks.js';

/* Client docs (docs job): briefs, call notes, contracts, delivery notes and
 * brand notes kept per client. Admin only (route() guards it): there is no
 * public link and no public endpoint reads this collection.
 *
 *   GET    ?id=<id>            { item } one doc with its blocks (a deleted one too, for Restore)
 *   GET    ?leadId=<id>        { items } one client's docs, without blocks
 *   GET    ?deleted=1          { items } Recently Deleted
 *   GET    ?templates=1        { items, prefs } saved templates and { hidden, order } for the built in ones
 *   GET                        { items } every client's docs, without blocks, newest edit first
 *   POST   { leadId, type, title, blocks, projectId }   or { template: true, title, blocks }
 *   PATCH  { id, set }         $set only title, type, projectId, pinned, blocks
 *          { id, restore }     bring a deleted doc back
 *          { prefs }           the built in templates' hidden and order
 *   DELETE { id }              Recently Deleted; { id, purge } removes one that is already deleted
 *
 * sanitize() is the schema (src/shared/docBlocks.js, mirrored in
 * api/_lib/docBlocks.js): a block type it does not know is not written. A
 * reference block may only point at a record of the same client: a new one
 * is checked against the database and the whole write is refused when it
 * is not (one already stored stays, so a task deleted later never blocks
 * the autosave). The list answers `text`, the block text for search, and
 * never the blocks. A created or deleted doc is also logged on the client
 * (docLog, capped) so History can say so. */
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const str = (v, max = 64) => String(v ?? '').slice(0, max);
const MAX_PER_CLIENT = 300;
const MAX_TEMPLATES = 40;
const META = { blocks: 0 };

const withText = (blocks) => ({ blocks, text: searchTextOf(blocks), blockCount: blocks.length });

function sanitize(b) {
  const blocks = b.blocks !== undefined ? sanitizeBlocks(b.blocks) : undefined;
  return {
    title: b.title !== undefined ? sanitizeTitle(b.title) : undefined,
    type: b.type !== undefined ? (DOC_TYPE_IDS.includes(b.type) ? b.type : 'general') : undefined,
    projectId: b.projectId !== undefined ? str(b.projectId) : undefined,
    pinned: b.pinned !== undefined ? !!b.pinned : undefined,
    ...(blocks ? withText(blocks) : {}),
  };
}

/** The ids of a client's records a reference may name, by kind. */
async function ownRefs(db, leadId, refs) {
  const own = new Set();
  const kinds = new Set(refs.map(r => r.kind));
  const lead = await db.collection('call_leads').findOne({ _id: oid(leadId) });
  const projects = kinds.has('project') || kinds.has('task') || kinds.has('invoice') || kinds.has('file') ? await db.collection('projects').find({ leadId: String(leadId) }).toArray() : [];
  if (kinds.has('concept')) for (const s of await db.collection('concept_sets').find({ leadId: String(leadId) }).toArray()) own.add(`concept:${s._id}`);
  for (const p of projects) {
    own.add(`project:${p._id}`);
    for (const l of p.checklists || []) for (const t of l?.items || []) own.add(`task:${t?.id}`);
    for (const v of [...(p.invoices || []), ...(p.schedule || [])]) own.add(`invoice:${v?.id}`);
    for (const d of p.deliverables || []) own.add(`file:${d?.id}`);
  }
  for (const l of lead?.checklists || []) for (const t of l?.items || []) own.add(`task:${t?.id}`);
  for (const v of lead?.deal?.invoices || []) own.add(`invoice:${v?.id}`);
  for (const k of ['drive', 'website', 'instagram']) own.add(`file:${k}`);
  return own;
}

/** null when every new reference is the client's own, else the reason. */
async function checkRefs(db, leadId, blocks, stored) {
  const had = new Set(refsOf(stored).map(r => `${r.kind}:${r.id}`));
  const fresh = refsOf(blocks).filter(r => !had.has(`${r.kind}:${r.id}`));
  if (!fresh.length) return null;
  if (!leadId) return 'a template cannot hold a reference';
  const own = await ownRefs(db, leadId, fresh);
  return fresh.every(r => own.has(`${r.kind}:${r.id}`)) ? null : 'a reference must point at this client\'s own record';
}

async function logOn(db, leadId, entry) {
  const _id = oid(leadId);
  if (!_id) return;
  await db.collection('call_leads').updateOne({ _id }, { $push: { docLog: { $each: [{ at: new Date().toISOString(), ...entry }], $slice: -100 } } });
}

export async function handler(req, res) {
  const db = await getDb();
  const col = db.collection('docs');

  if (req.method === 'GET') {
    const q = req.query || {};
    if (q.id) {
      const _id = oid(q.id);
      const item = _id ? await col.findOne({ _id }) : null;
      return item ? res.status(200).json({ item }) : res.status(404).json({ error: 'not found' });
    }
    if (q.templates) {
      const items = await col.find({ template: true, deleted: { $ne: true } }).sort({ order: 1, createdAt: 1 }).limit(MAX_TEMPLATES).toArray();
      const prefs = await db.collection('settings').findOne({ _id: 'doc-templates' });
      return res.status(200).json({ items, prefs: { hidden: prefs?.hidden || [], order: prefs?.order || [] } });
    }
    if (q.deleted) {
      const items = await col.find({ deleted: true, template: { $ne: true } }, { projection: META }).sort({ deletedAt: -1 }).limit(500).toArray();
      return res.status(200).json({ items });
    }
    const filter = { deleted: { $ne: true }, template: { $ne: true } };
    if (q.leadId) filter.leadId = String(q.leadId);
    const items = await col.find(filter, { projection: META }).sort({ updatedAt: -1 }).limit(q.leadId ? 300 : 2000).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const clean = sanitize(b);
    const template = b.template === true;
    const now = new Date();
    const blocks = clean.blocks || [];
    let leadId = '';
    if (!template) {
      const lead = oid(b.leadId) ? await db.collection('call_leads').findOne({ _id: oid(b.leadId) }) : null;
      if (!lead) return res.status(400).json({ error: 'client not found' });
      leadId = String(lead._id);
      if (await col.countDocuments({ leadId, deleted: { $ne: true } }) >= MAX_PER_CLIENT) return res.status(400).json({ error: 'too many docs for this client' });
      if (clean.projectId) {
        const p = oid(clean.projectId) ? await db.collection('projects').findOne({ _id: oid(clean.projectId), leadId }) : null;
        if (!p) return res.status(400).json({ error: 'project is not this client\'s' });
      }
    } else if (await col.countDocuments({ template: true, deleted: { $ne: true } }) >= MAX_TEMPLATES) return res.status(400).json({ error: 'too many templates' });
    const bad = await checkRefs(db, leadId, blocks, []);
    if (bad) return res.status(400).json({ error: bad });
    const item = {
      leadId, template, projectId: template ? '' : clean.projectId || '', type: clean.type || 'general', title: clean.title || (template ? 'Untitled template' : 'Untitled'),
      pinned: template ? false : !!clean.pinned, ...withText(blocks), ...(template ? { order: Date.now() } : {}), deleted: false, createdAt: now, updatedAt: now,
    };
    const r = await col.insertOne(item);
    if (!template) await logOn(db, leadId, { action: 'created', docId: String(r.insertedId), title: item.title });
    return res.status(200).json({ ok: true, item: { ...item, _id: r.insertedId } });
  }

  if (req.method === 'PATCH') {
    const b = req.body || {};
    if (b.prefs && typeof b.prefs === 'object') {
      const ids = (v) => (Array.isArray(v) ? v.slice(0, 80).map(x => str(x)).filter(Boolean) : []);
      await db.collection('settings').updateOne({ _id: 'doc-templates' }, { $set: { hidden: ids(b.prefs.hidden), order: ids(b.prefs.order), updatedAt: new Date() } }, { upsert: true });
      return res.status(200).json({ ok: true });
    }
    const _id = oid(b.id);
    if (!_id) return res.status(400).json({ error: 'id required' });
    if (b.restore) {
      const cur = await col.findOne({ _id });
      if (!cur) return res.status(404).json({ error: 'not found' });
      await col.updateOne({ _id }, { $set: { deleted: false, updatedAt: new Date() }, $unset: { deletedAt: '' } });
      return res.status(200).json({ ok: true });
    }
    if (!b.set || typeof b.set !== 'object') return res.status(400).json({ error: 'set required' });
    const cur = await col.findOne({ _id, deleted: { $ne: true } });
    if (!cur) return res.status(404).json({ error: 'not found' });
    const clean = sanitize(b.set);
    const allowed = {};
    for (const key of Object.keys(clean)) if (clean[key] !== undefined) allowed[key] = clean[key];
    if (cur.template) { delete allowed.pinned; delete allowed.projectId; }
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    if (allowed.blocks) {
      const bad = await checkRefs(db, cur.leadId, allowed.blocks, cur.blocks);
      if (bad) return res.status(400).json({ error: bad });
    }
    if (allowed.projectId) {
      const p = oid(allowed.projectId) ? await db.collection('projects').findOne({ _id: oid(allowed.projectId), leadId: cur.leadId }) : null;
      if (!p) return res.status(400).json({ error: 'project is not this client\'s' });
    }
    if ('title' in allowed && !allowed.title) allowed.title = cur.template ? 'Untitled template' : 'Untitled';
    /* Pinning pins to the card; pinned and the other edits that are not content leave the edit time alone. */
    allowed.updatedAt = 'blocks' in allowed || 'title' in allowed || 'type' in allowed ? new Date() : cur.updatedAt || new Date();
    await col.updateOne({ _id, deleted: { $ne: true } }, { $set: allowed });
    return res.status(200).json({ ok: true, updatedAt: allowed.updatedAt });
  }

  if (req.method === 'DELETE') {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const _id = oid(b.id || req.query?.id);
    if (!_id) return res.status(400).json({ error: 'id required' });
    const cur = await col.findOne({ _id });
    if (!cur) return res.status(404).json({ error: 'not found' });
    if (b.purge) {
      if (!cur.deleted) return res.status(400).json({ error: 'move it to Recently Deleted first' });
      await col.deleteOne({ _id, deleted: true });
      return res.status(200).json({ ok: true });
    }
    if (cur.template) await col.deleteOne({ _id });
    else {
      await col.updateOne({ _id }, { $set: { deleted: true, deletedAt: new Date() } });
      await logOn(db, cur.leadId, { action: 'deleted', docId: String(_id), title: cur.title });
    }
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
