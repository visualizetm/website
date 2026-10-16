import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { clientIp } from '../_lib/handler.js';
import { rateKey, rateState, rateHit } from '../_lib/limit.js';
import { EMAIL_KIND_IDS } from '../_semantics.js';
import { hookFor, buildEmailPayload, samplePayload } from '../_lib/email.js';
import { dealOf } from '../_lib/deal.js';
import { invoicesOf } from '../_lib/invoices.js';
import { attachPaymentLink } from '../_lib/stripe.js';
import { applySendStamps } from '../_lib/email/stamps.js';
import { emailConnected } from '../_lib/email/transport.js';

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
 * appears in a response or a log.
 * Retired (the email system, milestone 8): with RESEND_API_KEY set, Compose
 * sends every email and this door answers 410 without posting anything; the
 * hooks only matter until then (docs/RUNBOOK.md, Emails). */
const NOT_CONNECTED = 'That email is not connected yet.';
const RETIRED = 'The Zapier emails are retired. Compose sends this one now.';
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
  if (emailConnected()) return res.status(410).json({ error: RETIRED, retired: true });
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
      /* Client portal (prompt 2 fix): the invoice's own Stripe link, made now so the email and the Pay card carry it. */
      invoice = await attachPaymentLink(invoice, { leadId: String(lead._id), projectId: project ? String(project._id) : '' });
    }
    payload = buildEmailPayload(kind, { lead, project, invoice });
  }

  const ok = await postHook(hook, payload);
  await rateHit(db, key, limit.hits);
  if (!ok) return res.status(502).json({ error: DID_NOT_SEND });
  const sentAt = payload.sentAt;
  if (b.test === true) return res.status(200).json({ ok: true, sentAt, test: true });

  /* The stamps, all on this request: the checkpoint, the invoice, the project's delivery flag, the contact log, the next action (api/_lib/email/stamps.js, shared with the email system's send route). */
  await applySendStamps(db, { lead, project, invoice, kind, sentAt });
  return res.status(200).json({ ok: true, sentAt });
}
