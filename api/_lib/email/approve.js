/* The Drafts rule (email safety, prompt 1 of 3): no email leaves the CRM
 * unless Rob tapped Send on a screen that showed him the recipient, the
 * subject and the body of that exact email. This file is the one place that
 * writes approvedAt and approvedBy on a log entry; send.js refuses a real
 * send that does not carry the stamp, the queue (sendLogged) refuses a queued
 * entry that lacks it, and the rules (rules.js) only ever draft. The approve
 * action on the email route (api/_routes/email.js) is the only caller.
 *
 *   approvalStamp(now)                 -> { approvedAt, approvedBy }
 *   isApproved(row)                    -> the entry carries Rob's stamp
 *   approveAndSend(db, row, opts, now) -> { status, body }: the draft or queued
 *      entry sent now (sendDraft with the stamp), queued for opts.sendAt (the
 *      stamp written, the cron sends it), or, for a text, marked sent by hand.
 *
 * A text (channel 'text') never goes through a transport: Rob sends it from
 * Messages, and Text it on the Drafts screen marks it sent here. */
import { updateLog } from './log.js';
import { sendDraft } from './drafts.js';
import { QUEUE_MAX_DAYS, APPROVED_BY, isApproved } from './send.js';
import { mirrorToGmail } from './gmail.js';

export { APPROVED_BY, isApproved };
/** The stamp itself: made here and nowhere else. */
export const approvalStamp = (now = Date.now()) => ({ approvedAt: new Date(now).toISOString(), approvedBy: APPROVED_BY });

export async function approveAndSend(db, row, opts = {}, now = Date.now()) {
  if (!row || !['draft', 'queued'].includes(row.status)) return { status: 409, body: { error: 'Only a draft or a queued email can be sent.' } };
  const stamp = approvalStamp(now);
  if (row.channel === 'text') {
    const sentAt = new Date(now).toISOString();
    await updateLog(db, row._id, { ...stamp, status: 'sent', sentAt, sendAt: '' });
    return { status: 200, body: { ok: true, text: true, sentAt, logId: String(row._id) } };
  }
  if (opts.sendAt) {
    const at = new Date(opts.sendAt).getTime();
    if (!Number.isFinite(at) || at < now - 60e3 || at > now + QUEUE_MAX_DAYS * 864e5) return { status: 400, body: { error: 'Pick a time in the next thirty days.' } };
    const sendAt = new Date(at).toISOString();
    await updateLog(db, row._id, { ...stamp, status: 'queued', sendAt });
    const gmail = await mirrorToGmail(db, { ...row, ...stamp, status: 'queued', sendAt });
    return { status: 200, body: { ok: true, queued: true, sendAt, logId: String(row._id), ...(gmail ? { gmail } : {}) } };
  }
  return sendDraft(db, row, { confirmDuplicate: opts.confirmDuplicate === true, driveShared: opts.driveShared === true, approval: stamp }, now);
}
