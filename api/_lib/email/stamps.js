import { EMAIL_NOTE, EMAIL_CHECKPOINT } from '../email.js';
import { dealOf, isTicked } from '../deal.js';
import { invoicesOf, markSent, replaceInvoice } from '../invoices.js';
import { nextActionFor, resolveNextAction } from '../nextAction.js';
import { clientPushTick } from '../clientPush.js';
import { addTask } from '../taskRules.js';
import { zoneDayKey, zoneDateAt, keyAddDays } from '../zone.js';

/* What a successful send stamps (CRM revamp, step 6, moved here whole by the
 * email system so the old Zapier route and the new send route run the one
 * piece of code, never a fork): the deal checkpoint (introSent,
 * onboardingSent, invoiceSent) by auto, the invoice marked sent with sentAt
 * on the project or the deal, delivery.emailSent on the project, a
 * contactLog entry, and the next action recomputed, all on this request.
 * `kind` is the old send kind: intro, onboarding, invoice or delivery; any
 * other kind stamps only the contact log entry and the next action. */
export async function applySendStamps(db, { lead, project = null, invoice = null, kind, sentAt, note = '', deliveryFull = false }) {
  const leads = db.collection('call_leads');
  const projects = db.collection('projects');
  const set = { updatedAt: new Date() };
  const cp = EMAIL_CHECKPOINT[kind];
  /* The deal is read again right before it is written, so a sibling send's number on another line is not undone by this one's snapshot. */
  const fresh = await leads.findOne({ _id: lead._id }, { projection: { deal: 1, contactLog: 1 } });
  if (fresh) { lead = { ...lead, deal: fresh.deal, contactLog: fresh.contactLog }; }
  let deal = dealOf(lead);
  if (cp && (lead.deal || lead.stage === 'booked' || lead.stage === 'deal') && !isTicked(deal, cp)) { deal = { ...deal, checkpoints: { ...deal.checkpoints, [cp]: { at: sentAt, by: 'auto' } }, stalledSince: '' }; set.deal = deal; }
  if (kind === 'invoice' && invoice) {
    if (project && Array.isArray(project.invoices)) { const sent = markSent(invoice, Date.parse(sentAt)); await projects.updateOne({ _id: project._id, 'invoices.id': invoice.id }, { $set: { 'invoices.$.status': sent.status, 'invoices.$.sentAt': sent.sentAt, ...(invoice.payUrl ? { 'invoices.$.payUrl': invoice.payUrl, 'invoices.$.paymentLinkId': invoice.paymentLinkId || '' } : {}), updatedAt: new Date() } }); }
    else if (project) await projects.updateOne({ _id: project._id }, { $set: { invoices: replaceInvoice(invoicesOf(project), markSent(invoice, Date.parse(sentAt))), updatedAt: new Date() } });
    else { deal = { ...(set.deal || deal), invoices: replaceInvoice(invoicesOf(deal), markSent(invoice, Date.parse(sentAt))) }; set.deal = deal; }
  }
  /* The old Zapier route keeps today's one flag (deliveryFull false); the email system's delivery send stamps the whole step. */
  if (kind === 'delivery' && project && !deliveryFull) await projects.updateOne({ _id: project._id }, { $set: { delivery: { driveShared: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', ...(project.delivery || {}), emailSent: true }, updatedAt: new Date() } });
  if (kind === 'delivery' && project && deliveryFull) {
    /* The delivery email (milestone 7): the steps it covers (the email, the pitch in its red box, the folder shared), deliveredAt when
     * empty, and the two follow ups as tasks on the project (the one task system): the retainer follow up three days on, the review
     * request three days after the release (or the delivery when nothing is released yet). */
    const deliveredAt = project.deliveredAt || sentAt;
    const dayAfter = (iso, n, h) => new Date(zoneDateAt(keyAddDays(zoneDayKey(Date.parse(iso)), n), h, 0)).toISOString();
    const pid = String(project._id).slice(-16);
    let lists = Array.isArray(project.checklists) ? project.checklists : [];
    const has = (id) => lists.some(l => (l?.items || []).some(it => it?.id === id));
    const listId = () => lists.find(l => l?.name === 'Delivery')?.id || '';
    if (!has(`dlret${pid}`)) lists = addTask(lists, listId(), { id: `dlret${pid}`, text: 'Send the retainer follow up', due: dayAfter(deliveredAt, 3, 10), source: 'manual', listName: 'Delivery' });
    if (!has(`dlrev${pid}`)) lists = addTask(lists, listId(), { id: `dlrev${pid}`, text: 'Ask for a review', due: dayAfter(project.releasedAt || deliveredAt, 3, 10), source: 'manual', listName: 'Delivery' });
    await projects.updateOne({ _id: project._id }, { $set: { delivery: { reviewLinkSent: false, followUpLeadCallbackAt: '', ...(project.delivery || {}), emailSent: true, pitchSent: true, driveShared: true }, deliveredAt, checklists: lists, updatedAt: new Date() } });
  }
  /* The concepts in progress email is the offer itself when Rob did not stamp one first (the email system, milestone 5). */
  if (kind === 'concepts_in_progress' && !lead.conceptsOffered) set.conceptsOffered = sentAt;
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
