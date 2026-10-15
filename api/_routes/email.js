import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { emailConnected, fromLine, senderOf, isEmail, SENDS_PER_HOUR, sendsThisHour } from '../_lib/email/transport.js';
import { readEmailSettings, emailSettingsOf, EMAIL_SETTINGS_ID, AUTOMATION_IDS } from '../_lib/email/settings.js';
import { EMAIL_TEMPLATES, TEMPLATE_IDS, SERVICE_IDS } from '../_lib/email/templates.js';
import { sanitizeBlocks } from '../_lib/email/render.js';
import { varRows } from '../_lib/email/vars.js';
import { loadContext, composeEmail, sendComposed } from '../_lib/email/send.js';
import { logFor, logById, recentLog, updateLog } from '../_lib/email/log.js';
import { safeUrl } from '../_lib/url.js';

/* The email system's admin endpoints, one dispatched route: vercel.json
 * rewrites /api/admin/email/<action> to /api/admin/index?r=email&a=<action>,
 * so every action rides on the one admin function and keeps the admin
 * guard, the body cap and the try/catch of route().
 *
 *   GET  email/status      { connected, sender, from, sentLastHour, limit }
 *   POST email/preview     { templateId, recordId, projectId?, invoiceId?, override? }
 *                          -> { subject, preheader, html, text, missing, warnings, to, vars, available, lacking, class, service }
 *   POST email/send        the same plus { to[], cc[], testToSelf, confirmDuplicate, sendAt? }: the server renders again
 *                          (never a request's HTML), refuses on a missing field, a bad address, an opt out (marketing)
 *                          or a duplicate inside ten minutes, logs, ticks the template's checkpoint and writes the next
 *                          action on the same request; testToSelf goes to the sender with "[Test]" and ticks nothing
 *   GET  email/log         ?recordId= or ?projectId= (the entries, newest first, no html), ?id= (one entry with its
 *                          html), ?recent=1 (the last fifty across every record, failures first)
 *   POST email/log         { id, cancel: true } cancels a queued send (it becomes a draft)
 *   GET  email/settings    { settings, templates (the defaults), connected }
 *   PUT  email/settings    { sender?, signatureName?, calendlyLink?, invoiceTerms?, automation?, templates? } merged;
 *                          templates[id] of null deletes the override (Reset to default)
 * An action with the wrong method answers 405 with Allow; an unknown action 404. */
const METHODS = { status: ['GET'], preview: ['POST'], send: ['POST'], log: ['GET', 'POST'], settings: ['GET', 'PUT'] };
const actionOf = (req) => {
  const a = req.query?.a;
  if (typeof a === 'string' && a) return a;
  try { return new URL(req.url, 'http://localhost').searchParams.get('a') || ''; } catch { return ''; }
};
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const INVOICE_KINDS = ['deposit', 'final', 'plan', 'retainer', 'custom'];

/** Rob's override of one template: subject, preheader, blocks (or a variant's), auto. */
function sanitizeTemplateOverride(o, had = null) {
  if (o === null) return null;
  if (!o || typeof o !== 'object') return undefined;
  const base = had && typeof had === 'object' ? had : {};
  const out = { ...base };
  if (typeof o.subject === 'string') out.subject = str(o.subject, 200);
  if (typeof o.preheader === 'string') out.preheader = str(o.preheader, 200);
  if (Array.isArray(o.blocks)) out.blocks = sanitizeBlocks(o.blocks);
  if (o.variants && typeof o.variants === 'object') out.variants = { ...(base.variants || {}), ...Object.fromEntries(Object.entries(o.variants).filter(([k, v]) => SERVICE_IDS.includes(k) && Array.isArray(v)).map(([k, v]) => [k, sanitizeBlocks(v)])) };
  if (typeof o.auto === 'boolean') out.auto = o.auto;
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
      return res.status(200).json({ subject: rendered.subject, preheader: rendered.preheader, html: rendered.html, text: rendered.text, missing: rendered.missing, warnings: rendered.warnings, bytes: rendered.bytes, to: composed.to, vars: varRows(composed.vars), available: composed.available, lacking: composed.lacking, class: composed.base.class, service: composed.tpl.service, edited: composed.tpl.edited, optedOut: composed.marketing && !!ctx.lead.emailOptOut, connected: emailConnected() });
    }
    const r = await sendComposed(db, ctx, args, { to: b.to, cc: b.cc, testToSelf: b.testToSelf === true, confirmDuplicate: b.confirmDuplicate === true, sendAt: typeof b.sendAt === 'string' ? b.sendAt : '' });
    if (r.status === 429 && r.body.retryAfter) res.setHeader('Retry-After', String(r.body.retryAfter));
    return res.status(r.status).json(r.body);
  }

  if (a === 'log') {
    if (req.method === 'POST') {
      const _id = oid(b.id);
      if (!_id) return res.status(400).json({ error: 'id required' });
      const row = await logById(db, _id);
      if (!row) return res.status(404).json({ error: 'not found' });
      if (b.cancel !== true) return res.status(400).json({ error: 'nothing to do' });
      if (row.status !== 'queued') return res.status(409).json({ error: 'Only a queued email can be cancelled.' });
      await updateLog(db, _id, { status: 'draft', sendAt: '' });
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
    if (b.invoiceTerms && typeof b.invoiceTerms === 'object') next.invoiceTerms = { ...(cur.invoiceTerms || {}), ...Object.fromEntries(Object.entries(b.invoiceTerms).filter(([k, v]) => INVOICE_KINDS.includes(k) && Array.isArray(v)).map(([k, v]) => [k, v.map(x => str(x, 300)).filter(Boolean).slice(0, 8)])) };
    if (b.automation && typeof b.automation === 'object') next.automation = { ...(cur.automation || {}), ...Object.fromEntries(Object.entries(b.automation).filter(([k, v]) => TEMPLATE_IDS.includes(k) && AUTOMATION_IDS.includes(v))) };
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
