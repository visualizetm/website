import { EMAIL_NOTE, EMAIL_CHECKPOINT } from '../email.js';
import { dealOf, isTicked } from '../deal.js';
import { invoicesOf, markSent, replaceInvoice } from '../invoices.js';
import { nextActionFor, resolveNextAction } from '../nextAction.js';
import { clientPushTick } from '../clientPush.js';

/* What a successful send stamps (CRM revamp, step 6, moved here whole by the
 * email system so the old Zapier route and the new send route run the one
 * piece of code, never a fork): the deal checkpoint (introSent,
 * onboardingSent, invoiceSent) by auto, the invoice marked sent with sentAt
 * on the project or the deal, delivery.emailSent on the project, a
 * contactLog entry, and the next action recomputed, all on this request.
 * `kind` is the old send kind: intro, onboarding, invoice or delivery; any
 * other kind stamps only the contact log entry and the next action. */
export async function applySendStamps(db, { lead, project = null, invoice = null, kind, sentAt, note = '' }) {
  const leads = db.collection('call_leads');
  const projects = db.collection('projects');
  const set = { updatedAt: new Date() };
  const cp = EMAIL_CHECKPOINT[kind];
  let deal = dealOf(lead);
  if (cp && (lead.deal || lead.stage === 'booked' || lead.stage === 'deal') && !isTicked(deal, cp)) { deal = { ...deal, checkpoints: { ...deal.checkpoints, [cp]: { at: sentAt, by: 'auto' } }, stalledSince: '' }; set.deal = deal; }
  if (kind === 'invoice' && invoice) {
    if (project) await projects.updateOne({ _id: project._id }, { $set: { invoices: replaceInvoice(invoicesOf(project), markSent(invoice, Date.parse(sentAt))), updatedAt: new Date() } });
    else { deal = { ...(set.deal || deal), invoices: replaceInvoice(invoicesOf(deal), markSent(invoice, Date.parse(sentAt))) }; set.deal = deal; }
  }
  if (kind === 'delivery' && project) await projects.updateOne({ _id: project._id }, { $set: { delivery: { driveShared: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', ...(project.delivery || {}), emailSent: true }, updatedAt: new Date() } });
  set.contactLog = [...(Array.isArray(lead.contactLog) ? lead.contactLog : []), { type: 'email', at: sentAt, note: note || EMAIL_NOTE[kind] || 'Sent an email' }].slice(-200);
  const after = { ...lead, ...set };
  const [mine, sets] = await Promise.all([
    projects.find({ leadId: String(lead._id), archived: { $ne: true } }).toArray(),
    db.collection('concept_sets').find({ leadId: String(lead._id), deleted: { $ne: true }, archived: { $ne: true } }).project({ leadId: 1 }).toArray(),
  ]);
  set.nextAction = resolveNextAction(after, nextActionFor(after, { projects: mine, sets }, Date.now()));
  await leads.updateOne({ _id: lead._id }, { $set: set });
  if (kind === 'invoice') { try { await clientPushTick(db, lead._id); } catch { /* the email went; the sweep tries again */ } }
  return set;
}
