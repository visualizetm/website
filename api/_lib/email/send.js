/* The email system's send pipeline (milestone 2), shared by the preview and
 * send actions and, later, the cron: load the records, resolve the
 * variables, render the effective template, judge availability, then send
 * through the transport, log, stamp. Nothing here trusts HTML from a
 * request: the server renders every email it sends. */
import { ObjectId } from 'mongodb';
import { randomBytes } from 'node:crypto';
import { dealOf } from '../deal.js';
import { invoicesOf } from '../invoices.js';
import { attachPaymentLink } from '../stripe.js';
import { readEmailSettings } from './settings.js';
import { effectiveTemplate, templateOf, serviceOf } from './templates.js';
import { resolveVars, SITE } from './vars.js';
import { renderEmail, sanitizeBlocks, varsUsed } from './render.js';
import { sendEmail, senderOf, isEmail, TEST_MESSAGE } from './transport.js';
import { writeLog, updateLog, sentWithin, DUPLICATE_WINDOW_MS } from './log.js';
import { applySendStamps } from './stamps.js';

export const TOKEN_BYTES = 18; // 24 base64url characters, the planner's and the portal's rule
export const QUEUE_MAX_DAYS = 30;
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const str = (v, max) => String(v ?? '').slice(0, max);
export const isMarketing = (tpl) => tpl?.class === 'marketing';
export const optOutUrlFor = (token) => (token ? `${SITE}/u/${token}` : '');
export const unsubscribeApiFor = (token) => (token ? `${SITE}/api/unsubscribe?token=${token}` : '');

/** The record, its project and invoice, and everything the variables read. { error, status } when something is off. */
export async function loadContext(db, { recordId, projectId = '', invoiceId = '' } = {}) {
  const _id = oid(recordId);
  if (!_id) return { error: 'recordId required', status: 400 };
  const lead = await db.collection('call_leads').findOne({ _id, deleted: { $ne: true } });
  if (!lead) return { error: 'not found', status: 404 };
  let project = null;
  if (projectId) {
    const pid = oid(projectId);
    project = pid ? await db.collection('projects').findOne({ _id: pid, leadId: String(lead._id) }) : null;
    if (!project) return { error: 'project not found', status: 404 };
  }
  let invoice = null;
  if (invoiceId) {
    const list = project ? invoicesOf(project) : invoicesOf(dealOf(lead));
    invoice = list.find(i => i.id === String(invoiceId)) || null;
    if (!invoice) return { error: 'invoice not found', status: 404 };
  }
  const [projects, sets, settings, profileDoc] = await Promise.all([
    db.collection('projects').find({ leadId: String(lead._id), archived: { $ne: true } }).toArray(),
    db.collection('concept_sets').find({ leadId: String(lead._id), deleted: { $ne: true } }).toArray(),
    readEmailSettings(db),
    db.collection('settings').findOne({ _id: 'profile' }),
  ]);
  return { lead, project, invoice, projects, sets, settings, profile: profileDoc || {} };
}

/** A request's edits to this one email: subject, preheader and blocks, capped and sanitized; nothing else. */
export function sanitizeOverride(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  if (typeof o.subject === 'string') out.subject = str(o.subject, 200);
  if (typeof o.preheader === 'string') out.preheader = str(o.preheader, 200);
  if (Array.isArray(o.blocks)) out.blocks = sanitizeBlocks(o.blocks);
  return Object.keys(out).length ? out : null;
}

/** The template, the variables and the rendered email for one record. */
export function composeEmail(ctx, { templateId, override = null, optOutToken = '' } = {}) {
  const base = templateOf(templateId);
  if (!base) return { error: 'unknown template', status: 400 };
  const vars = resolveVars({ lead: ctx.lead, project: ctx.project, invoice: ctx.invoice, projects: ctx.projects, sets: ctx.sets, settings: ctx.settings, profile: ctx.profile });
  const tpl = effectiveTemplate(templateId, ctx.settings.templates, { service: vars.service || serviceOf('') });
  const o = sanitizeOverride(override);
  const draft = { ...tpl, ...(o?.subject !== undefined ? { subject: o.subject } : {}), ...(o?.preheader !== undefined ? { preheader: o.preheader } : {}), ...(o?.blocks ? { blocks: o.blocks } : {}) };
  const marketing = isMarketing(base);
  /* A preview of a marketing email on a record with no token yet shows a stand in link; the send mints the token first and renders again. */
  const rendered = renderEmail({ subject: draft.subject, preheader: draft.preheader, blocks: draft.blocks, vars, marketing, optOutUrl: marketing ? optOutUrlFor(optOutToken || ctx.lead.emailToken || 'preview') : '' });
  /* Available: every variable the template needs is on the record (the default's needs plus what the draft actually reads). */
  const needs = [...new Set([...(base.needs || []), ...varsUsed(draft)])].filter(k => k !== 'optOutUrl');
  const lacking = needs.filter(k => { const v = vars[k]; return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length); });
  return { tpl: draft, base, vars, rendered, marketing, available: lacking.length === 0, lacking, to: isEmail(ctx.lead.email) ? [String(ctx.lead.email).trim().toLowerCase()] : [] };
}

/** The record's opt out token, minted on the first marketing send and kept for good. */
export async function ensureEmailToken(db, lead) {
  if (/^[A-Za-z0-9_-]{16,64}$/.test(String(lead.emailToken || ''))) return lead.emailToken;
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { emailToken: token, updatedAt: new Date() } });
  lead.emailToken = token;
  return token;
}

const addresses = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x || '').trim().toLowerCase()).filter(Boolean);

/**
 * sendComposed(db, ctx, { templateId, override }, { to, cc, testToSelf, confirmDuplicate, sendAt, auto })
 *   -> { status: 200 | 4xx | 5xx, body }
 * Renders on the server (never a request's HTML), refuses on a missing field, a bad address, an opt out (marketing
 * only) or a duplicate inside ten minutes; a sendAt queues; testToSelf goes to the sender with "[Test]" and stamps
 * nothing; a real send logs, stamps the template's checkpoint through the one stamps function and recomputes the next
 * action, all on this request.
 */
export async function sendComposed(db, ctx, args = {}, opts = {}) {
  const { lead, project, invoice } = ctx;
  const testToSelf = opts.testToSelf === true;
  let composed = composeEmail(ctx, args);
  if (composed.error) return { status: composed.status, body: { error: composed.error } };
  /* A marketing email carries its own opt out link, so the token is minted before the final render. */
  if (composed.marketing && !testToSelf) { const token = await ensureEmailToken(db, lead); composed = composeEmail(ctx, { ...args, optOutToken: token }); }
  const { base, rendered, marketing } = composed;
  if (rendered.missing.length) return { status: 400, body: { error: `Fill in ${rendered.missing.join(', ')} first.`, missing: rendered.missing } };
  if (rendered.tooBig) return { status: 400, body: { error: 'That email is over 90 KB. Take a block out.' } };
  const sender = senderOf(ctx.settings.sender);
  const to = testToSelf ? [sender.address] : (addresses(opts.to).length ? addresses(opts.to) : composed.to);
  const cc = testToSelf ? [] : addresses(opts.cc).filter(x => !to.includes(x));
  if (!to.length) return { status: 400, body: { error: 'Add their email first.' } };
  const bad = [...to, ...cc].find(x => !isEmail(x));
  if (bad) return { status: 400, body: { error: `${bad} is not an email address.` } };
  if (marketing && !testToSelf && lead.emailOptOut) return { status: 403, body: { error: `${lead.business || 'They'} opted out of these emails.`, optedOut: true } };
  if (!testToSelf && opts.confirmDuplicate !== true) {
    const dup = await sentWithin(db, { recordId: String(lead._id), templateId: base.id, ms: DUPLICATE_WINDOW_MS });
    if (dup) return { status: 409, body: { error: `${base.name} went to ${lead.business || 'them'} ${Math.max(1, Math.round((Date.now() - new Date(dup.createdAt).getTime()) / 60000))} minutes ago. Send it again?`, duplicate: { at: dup.createdAt, subject: dup.subject } } };
  }
  const headers = {};
  if (marketing && !testToSelf) {
    const token = lead.emailToken;
    headers['List-Unsubscribe'] = `<${unsubscribeApiFor(token)}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  const subject = testToSelf ? `[Test] ${rendered.subject}` : rendered.subject;
  const entry = { recordId: String(lead._id), projectId: project ? String(project._id) : '', invoiceId: invoice ? String(invoice.id) : '', templateId: base.id, class: base.class, to, cc, subject, text: rendered.text, html: rendered.html, auto: opts.auto === true };
  if (opts.sendAt && !testToSelf) {
    const at = new Date(opts.sendAt).getTime();
    if (!Number.isFinite(at) || at < Date.now() - 60e3 || at > Date.now() + QUEUE_MAX_DAYS * 864e5) return { status: 400, body: { error: 'Pick a time in the next thirty days.' } };
    const log = await writeLog(db, { ...entry, status: 'queued', sendAt: new Date(at).toISOString() });
    return { status: 200, body: { ok: true, queued: true, sendAt: log.sendAt, logId: String(log._id) } };
  }
  const r = await sendEmail(db, { to, cc, subject, html: rendered.html, text: rendered.text, headers, sender });
  if (r.limited) return { status: 429, body: { error: r.error, retryAfter: r.retryAfter } };
  const sentAt = new Date().toISOString();
  if (!r.ok) {
    const log = await writeLog(db, { ...entry, status: 'failed', error: r.error });
    return { status: 502, body: { error: `That email did not go out. ${r.error}`, logId: String(log._id) } };
  }
  const log = await writeLog(db, { ...entry, status: r.test ? 'test' : 'sent', providerId: r.providerId, sentAt });
  if (testToSelf) return { status: 200, body: { ok: true, test: r.test, sentAt, logId: String(log._id), toSelf: true, message: r.test ? TEST_MESSAGE : `Test sent to ${sender.address}.` } };
  /* The invoice's own Stripe link, made now so the email that just went and the Pay card carry it (the old route did the same). */
  let inv = invoice;
  if (base.stamp === 'invoice' && invoice) { try { inv = await attachPaymentLink(invoice, { leadId: String(lead._id), projectId: project ? String(project._id) : '' }); } catch { inv = invoice; } }
  const stamps = await applySendStamps(db, { lead, project, invoice: inv, kind: base.stamp || base.id, sentAt, note: `Sent ${base.name.toLowerCase()}` });
  return { status: 200, body: { ok: true, test: r.test, sentAt, logId: String(log._id), stamped: Object.keys(stamps).filter(k => k !== 'updatedAt'), message: r.test ? TEST_MESSAGE : `Sent to ${to.join(', ')}` } };
}

/** A queued or drafted log entry sent now, exactly as rendered then; the stamps follow a real send. */
export async function sendLogged(db, log) {
  const ctx = await loadContext(db, { recordId: log.recordId, projectId: log.projectId, invoiceId: log.invoiceId });
  if (ctx.error) { await updateLog(db, log._id, { status: 'failed', error: ctx.error }); return { ok: false, error: ctx.error }; }
  const base = templateOf(log.templateId);
  const marketing = isMarketing(base);
  if (marketing && ctx.lead.emailOptOut) { await updateLog(db, log._id, { status: 'failed', error: 'opted out' }); return { ok: false, error: 'opted out' }; }
  const headers = {};
  if (marketing) { const token = await ensureEmailToken(db, ctx.lead); headers['List-Unsubscribe'] = `<${unsubscribeApiFor(token)}>`; headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'; }
  const sender = senderOf(ctx.settings.sender);
  const r = await sendEmail(db, { to: log.to, cc: log.cc, subject: log.subject, html: log.html, text: log.text, headers, sender });
  if (r.limited) return { ok: false, limited: true, error: r.error };
  const sentAt = new Date().toISOString();
  if (!r.ok) { await updateLog(db, log._id, { status: 'failed', error: r.error }); return { ok: false, error: r.error }; }
  await updateLog(db, log._id, { status: r.test ? 'test' : 'sent', providerId: r.providerId, sentAt, sendAt: '' });
  if (base) await applySendStamps(db, { lead: ctx.lead, project: ctx.project, invoice: ctx.invoice, kind: base.stamp || base.id, sentAt, note: `Sent ${base.name.toLowerCase()}` });
  return { ok: true, test: r.test, sentAt };
}
