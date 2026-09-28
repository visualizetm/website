import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { clientIp } from '../_lib/handler.js';
import { rateKey, rateState, rateHit } from '../_lib/limit.js';
import { EMAIL_KIND_IDS } from '../_semantics.js';
import { hookFor, buildEmailPayload, samplePayload, EMAIL_NOTE, EMAIL_CHECKPOINT } from '../_lib/email.js';
import { dealOf, isTicked } from '../_lib/deal.js';
import { invoicesOf, markSent, replaceInvoice } from '../_lib/invoices.js';
import { nextActionFor, resolveNextAction } from '../_lib/nextAction.js';

/* Send one of the four branded emails (CRM revamp, step 6).
 *   POST /api/admin/send-email { leadId, kind intro | onboarding | invoice | delivery, invoiceId?, projectId? }
 *   POST /api/admin/send-email { kind, test: true }   the Settings Send test: a fixed sample, nothing stamped
 * The payload is built from the record (api/_lib/email.js) and posted as
 * JSON to the Zapier catch hook for that kind, read from the environment.
 * No hook: 503. Zapier not 2xx: 502, nothing stamped. Success stamps the
 * deal checkpoint (introSent, onboardingSent, invoiceSent) by auto, or
 * delivery.emailSent on the project, marks the invoice sent, appends a
 * contactLog entry, recomputes the next action, and answers { ok, sentAt }.
 * Sixty sends an hour through the shared limiter. The hook URL never
 * appears in a response or a log. */
const NOT_CONNECTED = 'That email is not connected yet.';
const DID_NOT_SEND = 'That email did not go out. Zapier did not accept it; nothing was stamped.';
const SENDS_PER_HOUR = 60;
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));

async function postHook(url, payload) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
    return r.ok;
  } catch { return false; }
}

export async function handler(req, res) {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const kind = EMAIL_KIND_IDS.includes(b.kind) ? b.kind : '';
  if (!kind) return res.status(400).json({ error: 'kind must be intro, onboarding, invoice or delivery' });
  const hook = hookFor(kind);
  if (!hook) return res.status(503).json({ error: NOT_CONNECTED });
  const db = await getDb();
  const key = rateKey('email', clientIp(req));
  const limit = await rateState(db, key, { max: SENDS_PER_HOUR, windowMs: 3600e3 });
  if (limit.exceeded) { res.setHeader('Retry-After', String(limit.retryAfter)); return res.status(429).json({ error: 'That is a lot of emails in one hour. Give it a little while and try again.' }); }

  const leads = db.collection('call_leads');
  const projects = db.collection('projects');
  let lead = null; let project = null; let invoice = null; let payload;
  if (b.test === true) {
    payload = samplePayload(kind);
  } else {
    const _id = oid(b.leadId);
    if (!_id) return res.status(400).json({ error: 'leadId required' });
    lead = await leads.findOne({ _id, deleted: { $ne: true } });
    if (!lead) return res.status(404).json({ error: 'not found' });
    if (!isEmail(lead.email)) return res.status(400).json({ error: 'Add an email first.' });
    if (b.projectId) {
      const pid = oid(b.projectId);
      project = pid ? await projects.findOne({ _id: pid, leadId: String(lead._id) }) : null;
      if (!project) return res.status(404).json({ error: 'project not found' });
    }
    if (kind === 'delivery' && !project) return res.status(400).json({ error: 'projectId required' });
    if (kind === 'invoice') {
      const list = project ? invoicesOf(project) : invoicesOf(dealOf(lead));
      invoice = list.find(i => i.id === String(b.invoiceId || '')) || null;
      if (!invoice) return res.status(400).json({ error: 'invoiceId required' });
    }
    payload = buildEmailPayload(kind, { lead, project, invoice });
  }

  const ok = await postHook(hook, payload);
  await rateHit(db, key, limit.hits);
  if (!ok) return res.status(502).json({ error: DID_NOT_SEND });
  const sentAt = payload.sentAt;
  if (b.test === true) return res.status(200).json({ ok: true, sentAt, test: true });

  /* The stamps, all on this request: the checkpoint, the invoice, the project's delivery flag, the contact log, the next action. */
  const set = { updatedAt: new Date() };
  const cp = EMAIL_CHECKPOINT[kind];
  let deal = dealOf(lead);
  if (cp && (lead.deal || lead.stage === 'booked' || lead.stage === 'deal') && !isTicked(deal, cp)) { deal = { ...deal, checkpoints: { ...deal.checkpoints, [cp]: { at: sentAt, by: 'auto' } }, stalledSince: '' }; set.deal = deal; }
  if (kind === 'invoice') {
    if (project) await projects.updateOne({ _id: project._id }, { $set: { invoices: replaceInvoice(invoicesOf(project), markSent(invoice, Date.parse(sentAt))), updatedAt: new Date() } });
    else { deal = { ...(set.deal || deal), invoices: replaceInvoice(invoicesOf(deal), markSent(invoice, Date.parse(sentAt))) }; set.deal = deal; }
  }
  if (kind === 'delivery') await projects.updateOne({ _id: project._id }, { $set: { delivery: { driveShared: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', ...(project.delivery || {}), emailSent: true }, updatedAt: new Date() } });
  set.contactLog = [...(Array.isArray(lead.contactLog) ? lead.contactLog : []), { type: 'email', at: sentAt, note: EMAIL_NOTE[kind] }].slice(-200);
  const after = { ...lead, ...set };
  const [mine, sets] = await Promise.all([
    projects.find({ leadId: String(lead._id), archived: { $ne: true } }).toArray(),
    db.collection('concept_sets').find({ leadId: String(lead._id), deleted: { $ne: true }, archived: { $ne: true } }).project({ leadId: 1 }).toArray(),
  ]);
  set.nextAction = resolveNextAction(after, nextActionFor(after, { projects: mine, sets }, Date.now()));
  await leads.updateOne({ _id: lead._id }, { $set: set });
  return res.status(200).json({ ok: true, sentAt });
}
