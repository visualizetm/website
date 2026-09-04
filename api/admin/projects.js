import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { requireAdmin } from '../_lib/auth.js';
import { PROJECT_KIND_IDS, PROJECT_STAGE_IDS, SCHEDULE_STATUS_IDS } from '../_semantics.js';

/* Projects (Prompt 10): one client (a call_leads doc with stage 'client') has
 * many projects over time. Money lives on the lead's purchases[] ledger; a
 * schedule item points at its ledger entry through ledgerId.
 *
 *   GET   /api/admin/projects?leadId=<id>      { items } for one client
 *   GET   /api/admin/projects                  { items } every live project (limit 1000)
 *   GET   /api/admin/projects?archived=1       archived ones
 *   POST  { leadId, name, kind, ... }          { ok, item }
 *   PATCH { id, set }                          $set only the keys sent (sanitized)
 *
 * Every write goes through sanitize(); nothing is ever renamed or dropped. */

const str = (v, max = 400) => String(v ?? '').slice(0, max);
const num = (v, max = 1000000) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Number(v))) : 0);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };

function sanitize(b) {
  return {
    leadId: b.leadId !== undefined ? str(b.leadId, 64) : undefined,
    name: b.name !== undefined ? str(b.name, 160) : undefined,
    kind: b.kind !== undefined ? (PROJECT_KIND_IDS.includes(b.kind) ? b.kind : 'brand') : undefined,
    packageId: b.packageId !== undefined ? str(b.packageId, 40) : undefined,
    custom: b.custom && typeof b.custom === 'object' ? { name: str(b.custom.name, 160), total: num(b.custom.total) } : b.custom === null ? null : undefined,
    stage: b.stage !== undefined ? (PROJECT_STAGE_IDS.includes(b.stage) ? b.stage : 'kickoff') : undefined,
    stages: Array.isArray(b.stages) ? b.stages.filter(s => PROJECT_STAGE_IDS.includes(s)).slice(0, 8) : undefined,
    total: b.total !== undefined ? num(b.total) : undefined,
    schedule: Array.isArray(b.schedule)
      ? b.schedule.slice(0, 120).map(s => ({
          id: str(s?.id, 40), amount: num(s?.amount), dueAt: str(s?.dueAt, 10),
          status: SCHEDULE_STATUS_IDS.includes(s?.status) ? s.status : 'upcoming',
          ledgerId: str(s?.ledgerId, 40), label: str(s?.label, 120), paidAt: str(s?.paidAt, 40), extra: !!s?.extra,
        })) : undefined,
    revisions: b.revisions && typeof b.revisions === 'object' ? {
      max: Math.max(0, Math.min(20, Math.round(num(b.revisions.max, 20)))),
      used: Math.max(0, Math.min(50, Math.round(num(b.revisions.used, 50)))),
      log: Array.isArray(b.revisions.log) ? b.revisions.log.slice(-50).map(r => ({ at: str(r?.at, 40), note: str(r?.note, 600), extra: !!r?.extra })) : [],
    } : undefined,
    plan: b.plan && typeof b.plan === 'object' ? { months: Math.round(num(b.plan.months, 60)), monthly: num(b.plan.monthly), stripeCancelled: !!b.plan.stripeCancelled, stripeSubscriptionId: str(b.plan.stripeSubscriptionId, 80), stripeCancelledAt: str(b.plan.stripeCancelledAt, 40) } : b.plan === null ? null : undefined,
    links: b.links && typeof b.links === 'object' ? { drive: str(b.links.drive, 400), clickup: str(b.links.clickup, 400) } : undefined,
    deliverables: Array.isArray(b.deliverables)
      ? b.deliverables.slice(0, 60).map(d => ({ id: str(d?.id, 40), group: str(d?.group, 8), label: str(d?.label, 120), done: !!d?.done, link: str(d?.link, 400) })) : undefined,
    delivery: b.delivery && typeof b.delivery === 'object' ? { driveShared: !!b.delivery.driveShared, emailSent: !!b.delivery.emailSent, pitchSent: !!b.delivery.pitchSent, followUpLeadCallbackAt: str(b.delivery.followUpLeadCallbackAt, 40) } : undefined,
    releasedAt: b.releasedAt !== undefined ? str(b.releasedAt, 40) : undefined,
    monthly: Array.isArray(b.monthly)
      ? b.monthly.slice(-60).map(m => ({
          month: str(m?.month, 7), included: Math.round(num(m?.included, 1000)), delivered: Math.round(num(m?.delivered, 10000)),
          log: Array.isArray(m?.log) ? m.log.slice(-100).map(l => ({ at: str(l?.at, 40), count: Math.round(num(l?.count, 1000)), note: str(l?.note, 400) })) : [],
        })) : undefined,
    // Retainer projects: which plan and when it bills.
    retainer: b.retainer && typeof b.retainer === 'object' ? { planId: str(b.retainer.planId, 40), billDay: Math.max(1, Math.min(28, Math.round(num(b.retainer.billDay, 28)) || 1)), startedAt: str(b.retainer.startedAt, 40) } : undefined,
    archived: b.archived !== undefined ? !!b.archived : undefined,
  };
}
const compact = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const db = await getDb();
  const col = db.collection('projects');

  if (req.method === 'GET') {
    const q = { archived: req.query?.archived === '1' ? true : { $ne: true } };
    if (req.query?.leadId) q.leadId = String(req.query.leadId);
    const items = await col.find(q).sort({ createdAt: -1 }).limit(1000).toArray();
    return res.status(200).json({ items });
  }

  if (req.method === 'POST') {
    const doc = compact(sanitize(req.body || {}));
    if (!doc.leadId || !doc.name) return res.status(400).json({ error: 'leadId and name required' });
    const now = new Date();
    const item = { stage: 'kickoff', schedule: [], deliverables: [], monthly: [], archived: false, ...doc, createdAt: now, updatedAt: now };
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
    delete allowed.leadId; // a project never moves between clients
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    allowed.updatedAt = new Date();
    await col.updateOne({ _id }, { $set: allowed });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
}
