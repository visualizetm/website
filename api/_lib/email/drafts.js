/* Drafts for Rob (the email system, milestones 6 and 8): an email written and
 * logged as a draft for him to send, with one task on the record's Emails
 * checklist ("Email ready: Payment received for Mike's Tacos") so Next up
 * says it. One draft per record, template and invoice while it stands; a
 * draft that lacks a value says what is missing in its task and its log
 * entry instead of going out blank. The paid event (Rob's tap or the Stripe
 * webhook), the plan's bill day and the cron's rules (rules.js) write these.
 * The task carries the entry (emailId), and sendDraft() is the one door that
 * sends a draft: the Next up row, the email sheet and a Send for me rule
 * all come through it. */
import { loadContext, composeEmail, sendComposed } from './send.js';
import { writeLog } from './log.js';
import { templateOf } from './templates.js';
import { addTask, setTaskDone } from '../taskRules.js';
import { zoneDayKey, zoneDateAt } from '../zone.js';

export const DRAFT_LIST = 'Emails';
export const draftTaskId = (logId) => `ed${String(logId).slice(-20)}`;

/** The standing draft for this record, template and invoice, or null. */
export async function existingDraft(db, { recordId, templateId, invoiceId = '' }) {
  return db.collection('email_log').findOne({ recordId: String(recordId), templateId: String(templateId), invoiceId: String(invoiceId || ''), status: 'draft' });
}

/**
 * draftEmail(db, { recordId, projectId, invoiceId, templateId, auto, reason }) -> { ok, log, already, missing }
 * Renders the template on the record as it stands, logs it as a draft and writes the task; answers the standing draft when one exists.
 */
export async function draftEmail(db, { recordId, projectId = '', invoiceId = '', templateId, auto = true, reason = '' }, now = Date.now()) {
  const base = templateOf(templateId);
  if (!base) return { ok: false, error: 'unknown template' };
  const had = await existingDraft(db, { recordId, templateId, invoiceId });
  if (had) return { ok: true, log: had, already: true, missing: [] };
  const ctx = await loadContext(db, { recordId, projectId, invoiceId });
  if (ctx.error) return { ok: false, error: ctx.error };
  const composed = composeEmail(ctx, { templateId });
  if (composed.error) return { ok: false, error: composed.error };
  const { rendered, lacking, to } = composed;
  const missing = [...new Set([...rendered.missing, ...lacking])];
  const log = await writeLog(db, {
    recordId: String(ctx.lead._id), projectId: ctx.project ? String(ctx.project._id) : '', invoiceId: ctx.invoice ? String(ctx.invoice.id) : '', templateId: base.id, class: base.class,
    to, cc: [], subject: rendered.subject, text: rendered.text, html: rendered.html, status: 'draft', auto: auto === true, error: missing.length ? `Missing: ${missing.join(', ')}` : '',
  });
  const business = String(ctx.lead.showcase?.displayName || ctx.lead.business || 'a lead').slice(0, 120);
  const id = draftTaskId(log._id);
  const lists = Array.isArray(ctx.lead.checklists) ? ctx.lead.checklists : [];
  if (!lists.some(l => (l?.items || []).some(it => it?.id === id))) {
    const text = `Email ready: ${base.name} for ${business}${missing.length ? ` (needs ${missing.join(', ')})` : ''}${reason ? `. ${reason}` : ''}`;
    const next = addTask(lists, lists.find(l => l?.name === DRAFT_LIST)?.id || '', { id, text, due: new Date(zoneDateAt(zoneDayKey(now), 17, 0)).toISOString(), source: 'manual', listName: DRAFT_LIST, emailId: String(log._id) });
    await db.collection('call_leads').updateOne({ _id: ctx.lead._id }, { $set: { checklists: next, updatedAt: new Date() } });
  }
  return { ok: true, log, missing };
}

/** The draft's task on the lead (by the entry it carries, or the id drafts gave it), ticked done. */
export async function finishDraftTask(db, leadId, logId, now = Date.now()) {
  const lead = await db.collection('call_leads').findOne({ _id: leadId }, { projection: { checklists: 1 } });
  const lists = Array.isArray(lead?.checklists) ? lead.checklists : [];
  const it = lists.flatMap(l => (l?.items || [])).find(x => x && (String(x.emailId || '') === String(logId) || x.id === draftTaskId(logId)));
  if (!it || it.done) return false;
  await db.collection('call_leads').updateOne({ _id: leadId }, { $set: { checklists: setTaskDone(lists, it.id, true, now), updatedAt: new Date() } });
  return true;
}

/**
 * sendDraft(db, row, { auto, confirmDuplicate, driveShared }) -> { status, body }: a draft (or a queued entry) sent now. The email renders
 * again from the record as it stands (the invoice number and the Stripe link come with the send, never with the draft), through the
 * one pipeline (sendComposed) and onto the same log entry, and the draft's task is ticked.
 */
export async function sendDraft(db, row, opts = {}, now = Date.now()) {
  if (!row || !['draft', 'queued'].includes(row.status)) return { status: 409, body: { error: 'Only a draft or a queued email can be sent now.' } };
  const ctx = await loadContext(db, { recordId: row.recordId, projectId: row.projectId, invoiceId: row.invoiceId });
  if (ctx.error) return { status: ctx.status, body: { error: ctx.error } };
  const r = await sendComposed(db, ctx, { templateId: row.templateId }, { auto: opts.auto === true, confirmDuplicate: opts.confirmDuplicate === true, driveShared: opts.driveShared === true, reuseLogId: row._id });
  if (r.status === 200 && !r.body.queued) r.body.taskDone = await finishDraftTask(db, ctx.lead._id, row._id, now);
  return r;
}
