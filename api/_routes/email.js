import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { emailConnected, fromLine, senderOf, isEmail, SENDS_PER_HOUR, sendsThisHour } from '../_lib/email/transport.js';
import { readEmailSettings, emailSettingsOf, EMAIL_SETTINGS_ID, AUTOMATION_IDS, INVOICE_KIND_IDS, automationModeOf } from '../_lib/email/settings.js';
import { EMAIL_TEMPLATES, TEMPLATE_IDS, SERVICE_IDS } from '../_lib/email/templates.js';
import { sanitizeBlocks } from '../_lib/email/render.js';
import { varRows } from '../_lib/email/vars.js';
import { loadContext, composeEmail, sendComposed, availabilityFor } from '../_lib/email/send.js';
import { logFor, logById, recentLog, updateLog, draftsList } from '../_lib/email/log.js';
import { approveAndSend } from '../_lib/email/approve.js';
import { gmailConnected, gmailEnabled, GMAIL_ENV } from '../_lib/email/gmail.js';
import { safeUrl } from '../_lib/url.js';

/* The email system's admin endpoints, one dispatched route: vercel.json
 * rewrites /api/admin/email/<action> to /api/admin/index?r=email&a=<action>,
 * so every action rides on the one admin function and keeps the admin
 * guard, the body cap and the try/catch of route().
 *
 *   GET  email/status      { connected, sender, from, sentLastHour, limit }
 *   POST email/preview     { templateId, recordId, projectId?, invoiceId?, override? }
 *                          -> { subject, preheader, html, text, missing, warnings, to, vars, available, lacking, class, service,
 *                             template (the effective source Compose edits), availability (every template on this record) }
 *   POST email/send        the same plus { to[], cc[], testToSelf }: the server renders again (never a request's HTML),
 *                          refuses on a missing field, a bad address or an opt out (marketing), and writes the email as a
 *                          DRAFT with the edits kept ({ ok, draft: true, logId }): the Drafts rule, nothing leaves until
 *                          Rob approves it; testToSelf goes to the sender with "[Test]" at once and ticks nothing
 *   POST email/approve     { id, sendAt?, confirmDuplicate?, driveShared? }: the one door out. Stamps approvedAt and
 *                          approvedBy on the entry (api/_lib/email/approve.js), then sends it now (rendered again from the
 *                          record and the draft's edits, the duplicate guard, the stamps, the task ticked) or queues it for
 *                          sendAt; a text is marked sent by hand
 *   GET  email/drafts      { items }: every draft and queued email, newest due first, then what went in the last thirty days
 *   POST email/drafts      { recordId, channel: 'text', body, reason? } writes a text draft (Rob sends it from Messages)
 *   GET  email/log         ?recordId= or ?projectId= (the entries, newest first, no html), ?id= (one entry with its
 *                          html), ?recent=1 (the last fifty across every record, failures first)
 *   POST email/log         { id, cancel: true } cancels a queued send (back to a draft, the stamp cleared); { id, edit: { subject,
 *                          preheader, blocks } } saves edits to a draft and renders it again; { id, send: true } is refused (403):
 *                          sends go through approve
 *   GET  email/gmail       { connected (the three variables exist, names only), enabled }
 *   POST email/gmail       { enabled } turns Draft into Gmail on or off
 *   GET  email/settings    { settings, templates (the defaults), connected }
 *   PUT  email/settings    { sender?, signatureName?, calendlyLink?, invoiceTerms?, automation?, templates?, gmailDrafts? } merged;
 *                          templates[id] of null deletes the override (Reset to default)
 * An action with the wrong method answers 405 with Allow; an unknown action 404. */
const METHODS = { status: ['GET'], preview: ['POST'], send: ['POST'], approve: ['POST'], drafts: ['GET', 'POST'], gmail: ['GET', 'POST'], log: ['GET', 'POST'], settings: ['GET', 'PUT'] };
const NEEDS_TAP = 'Nothing sends without your tap: open it in Drafts and send it from there.';
const actionOf = (req) => {
  const a = req.query?.a;
  if (typeof a === 'string' && a) return a;
  try { return new URL(req.url, 'http://localhost').searchParams.get('a') || ''; } catch { return ''; }
};
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };

/** Rob's override of one template: subject, preheader, blocks (or a variant's), auto. */
function sanitizeTemplateOverride(o, had = null) {
  if (o === null) return null;
  if (!o || typeof o !== 'object') return undefined;
  const base = had && typeof had === 'object' ? had : {};
  const out = { ...base };
  if (typeof o.subject === 'string') out.subject = str(o.subject, 200);
  if (typeof o.preheader === 'string') out.preheader = str(o.preheader, 200);
  if (Array.isArray(o.blocks)) out.blocks = sanitizeBlocks(o.blocks);
  if (o.variants && typeof o.variants === 'object') out.variants = { ...(base.variants || {}), ...Object.fromEntries(Object.entries(o.variants).filter(([k, v]) => (SERVICE_IDS.includes(k) || INVOICE_KIND_IDS.includes(k) || k === 'general') && Array.isArray(v)).map(([k, v]) => [k, sanitizeBlocks(v)])) };
  if (typeof o.auto === 'boolean') out.auto = o.auto;
  if (o.options && typeof o.options === 'object') out.options = { ...(base.options || {}), ...Object.fromEntries(Object.entries(o.options).filter(([k, v]) => /^[a-z_]{1,24}$/.test(k) && typeof v === 'boolean')) };
  out.updatedAt = new Date().toISOString();
  return out;
}

export async function handler(req, res) {
  const a = actionOf(req);
  const allow = METHODS[a];
  if (!allow) return res.status(404).json({ error: 'not found' });
  if (!allow.includes(req.method)) { res.setHeader('Allow', allow.join(', ')); return res.status(405).json({ error: 'method not allowed' }); }
  const db = await getDb();
  const b = req.body && typeof req.body === 'object' ? req.body : {};

  if (a === 'status') {
    const settings = await readEmailSettings(db);
    const sentLastHour = await sendsThisHour(db);
    /* Connected is whether the key exists, never its value; the sender is what settings say, defaults included. */
    return res.status(200).json({ connected: emailConnected(), sender: settings.sender, from: fromLine(settings.sender), sentLastHour, limit: SENDS_PER_HOUR });
  }

  if (a === 'preview' || a === 'send') {
    if (!TEMPLATE_IDS.includes(b.templateId)) return res.status(400).json({ error: 'templateId must name a template' });
    const ctx = await loadContext(db, { recordId: b.recordId, projectId: b.projectId, invoiceId: b.invoiceId });
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    const args = { templateId: b.templateId, override: b.override };
    if (a === 'preview') {
      const composed = composeEmail(ctx, args);
      if (composed.error) return res.status(composed.status).json({ error: composed.error });
      const { rendered } = composed;
      const { base, source } = composed;
      const template = { id: base.id, name: base.name, group: base.group, class: base.class, when: base.when, service: source.service, edited: source.edited, subject: source.subject, preheader: source.preheader, blocks: source.blocks };
      return res.status(200).json({ subject: rendered.subject, preheader: rendered.preheader, html: rendered.html, text: rendered.text, missing: rendered.missing, warnings: rendered.warnings, bytes: rendered.bytes, to: composed.to, vars: varRows(composed.vars), available: composed.available, lacking: composed.lacking, class: base.class, service: composed.tpl.service, edited: composed.tpl.edited, optedOut: composed.marketing && !!ctx.lead.emailOptOut, connected: emailConnected(), template, availability: availabilityFor(ctx, composed.vars) });
    }
    /* No approval can ride on a request: sendComposed drafts. A test to Rob's own address goes at once. */
    const r = await sendComposed(db, ctx, args, { to: b.to, cc: b.cc, testToSelf: b.testToSelf === true, driveShared: b.driveShared === true, reason: typeof b.reason === 'string' ? b.reason : 'Written in Compose' });
    if (r.status === 429 && r.body.retryAfter) res.setHeader('Retry-After', String(r.body.retryAfter));
    return res.status(r.status).json(r.body);
  }

  if (a === 'approve') {
    const _id = oid(b.id);
    if (!_id) return res.status(400).json({ error: 'id required' });
    const row = await logById(db, _id);
    if (!row) return res.status(404).json({ error: 'not found' });
    const r = await approveAndSend(db, row, { sendAt: typeof b.sendAt === 'string' ? b.sendAt : '', confirmDuplicate: b.confirmDuplicate === true, driveShared: b.driveShared === true });
    if (r.status === 429 && r.body.retryAfter) res.setHeader('Retry-After', String(r.body.retryAfter));
    return res.status(r.status).json(r.body);
  }

  if (a === 'drafts') {
    if (req.method === 'GET') return res.status(200).json({ items: await draftsList(db) });
    if (b.channel !== 'text') return res.status(400).json({ error: 'channel must be text' });
    const ctx = await loadContext(db, { recordId: b.recordId });
    if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
    const body = str(b.body, 1000);
    if (!body) return res.status(400).json({ error: 'Write the text first.' });
    const { writeLog } = await import('../_lib/email/log.js');
    const log = await writeLog(db, { recordId: String(ctx.lead._id), templateId: 'custom', class: 'transactional', to: [], cc: [], subject: str(b.subject, 200) || `Text to ${ctx.lead.business || 'them'}`, text: body, html: '', status: 'draft', channel: 'text', phone: String(ctx.lead.phone || '').replace(/[^0-9+]/g, '').slice(0, 40), reason: str(b.reason, 200) || 'Written by hand' });
    return res.status(200).json({ ok: true, logId: String(log._id), item: { ...log, html: undefined } });
  }

  if (a === 'gmail') {
    const settings = await readEmailSettings(db);
    if (req.method === 'POST') {
      await db.collection('settings').updateOne({ _id: EMAIL_SETTINGS_ID }, { $set: { gmailDrafts: b.enabled === true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      return res.status(200).json({ ok: true, enabled: b.enabled === true, connected: gmailConnected() });
    }
    return res.status(200).json({ connected: gmailConnected(), enabled: gmailEnabled(settings), variables: GMAIL_ENV });
  }

  if (a === 'log') {
    if (req.method === 'POST') {
      const _id = oid(b.id);
      if (!_id) return res.status(400).json({ error: 'id required' });
      const row = await logById(db, _id);
      if (!row) return res.status(404).json({ error: 'not found' });
      /* The Drafts rule: this door never sends. The old { send: true } answers 403 and nothing moves. */
      if (b.send === true) return res.status(403).json({ error: NEEDS_TAP, needsApproval: true });
      if (b.edit && typeof b.edit === 'object') {
        if (row.status !== 'draft' && row.status !== 'queued') return res.status(409).json({ error: 'Only a draft can be edited.' });
        if (row.channel === 'text') { await updateLog(db, _id, { text: str(b.edit.text ?? b.edit.body, 1000) || row.text, subject: str(b.edit.subject, 200) || row.subject }); return res.status(200).json({ ok: true, item: await logById(db, _id) }); }
        const ctx = await loadContext(db, { recordId: row.recordId, projectId: row.projectId, invoiceId: row.invoiceId });
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });
        const composed = composeEmail(ctx, { templateId: row.templateId, override: b.edit });
        if (composed.error) return res.status(composed.status).json({ error: composed.error });
        const to = Array.isArray(b.to) ? b.to.map(x => str(x, 200).toLowerCase()).filter(isEmail).slice(0, 10) : null;
        /* An edited queued email waits for a fresh tap: the stamp clears and it is a draft again. */
        await updateLog(db, _id, { override: composed.tpl, subject: composed.rendered.subject, text: composed.rendered.text, html: composed.rendered.html, ...(to && to.length ? { to } : {}), status: 'draft', sendAt: '', approvedAt: '', approvedBy: '', error: composed.lacking.length ? `Missing: ${composed.lacking.join(', ')}` : '' });
        return res.status(200).json({ ok: true, item: await logById(db, _id) });
      }
      if (b.cancel !== true) return res.status(400).json({ error: 'nothing to do' });
      if (row.status !== 'queued') return res.status(409).json({ error: 'Only a queued email can be cancelled.' });
      await updateLog(db, _id, { status: 'draft', sendAt: '', approvedAt: '', approvedBy: '' });
      return res.status(200).json({ ok: true });
    }
    const q = req.query || {};
    if (q.id) { const _id = oid(q.id); const row = _id ? await logById(db, _id) : null; if (!row) return res.status(404).json({ error: 'not found' }); return res.status(200).json({ item: row }); }
    if (q.recent === '1') return res.status(200).json({ items: await recentLog(db, { limit: 50 }) });
    if (q.projectId) return res.status(200).json({ items: await logFor(db, { projectId: str(q.projectId, 64) }) });
    if (!q.recordId) return res.status(400).json({ error: 'recordId required' });
    return res.status(200).json({ items: await logFor(db, { recordId: str(q.recordId, 64) }) });
  }

  if (a === 'settings') {
    const settings = db.collection('settings');
    if (req.method === 'GET') {
      const doc = await settings.findOne({ _id: EMAIL_SETTINGS_ID });
      return res.status(200).json({ settings: emailSettingsOf(doc), templates: EMAIL_TEMPLATES, connected: emailConnected() });
    }
    const cur = (await settings.findOne({ _id: EMAIL_SETTINGS_ID })) || {};
    const next = { ...cur };
    if (b.sender && typeof b.sender === 'object') next.sender = senderOf({ ...(cur.sender || {}), ...b.sender });
    if (typeof b.signatureName === 'string') next.signatureName = str(b.signatureName, 80) || 'Rob';
    if (typeof b.calendlyLink === 'string') next.calendlyLink = safeUrl(b.calendlyLink, 400);
    if (b.invoiceTerms && typeof b.invoiceTerms === 'object') next.invoiceTerms = { ...(cur.invoiceTerms || {}), ...Object.fromEntries(Object.entries(b.invoiceTerms).filter(([k, v]) => INVOICE_KIND_IDS.includes(k) && Array.isArray(v)).map(([k, v]) => [k, v.map(x => str(x, 300)).filter(Boolean).slice(0, 8)])) };
    /* The Drafts rule: 'send' is not a mode any more; one sent anyway (an old screen) is saved as draft. */
    if (b.automation && typeof b.automation === 'object') next.automation = { ...(cur.automation || {}), ...Object.fromEntries(Object.entries(b.automation).filter(([k, v]) => TEMPLATE_IDS.includes(k) && (AUTOMATION_IDS.includes(v) || v === 'send')).map(([k, v]) => [k, automationModeOf(v)])) };
    if (typeof b.gmailDrafts === 'boolean') next.gmailDrafts = b.gmailDrafts;
    if (b.templates && typeof b.templates === 'object') {
      const t = { ...(cur.templates || {}) };
      for (const [id, o] of Object.entries(b.templates)) {
        if (!TEMPLATE_IDS.includes(id)) continue;
        const clean = sanitizeTemplateOverride(o, t[id]);
        if (clean === null) delete t[id]; else if (clean) t[id] = clean;
      }
      next.templates = t;
    }
    if (b.sender?.address !== undefined && !isEmail(b.sender.address)) return res.status(400).json({ error: 'The sender needs a real address.' });
    delete next._id;
    await settings.updateOne({ _id: EMAIL_SETTINGS_ID }, { $set: { ...next, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    const doc = await settings.findOne({ _id: EMAIL_SETTINGS_ID });
    return res.status(200).json({ ok: true, settings: emailSettingsOf(doc) });
  }
  return res.status(404).json({ error: 'not found' });
}
