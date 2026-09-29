/* After a send (CRM revamp, step 7): the same stamps the server wrote,
 * applied to the local record so the screen does not wait for a refetch
 * that a service worker could answer from cache. Mirrors what
 * api/_routes/send-email.js stores: the deal checkpoint by auto, the
 * invoice sent with sentAt, the contact log entry, the next action. */
import { dealOf, isTicked } from './deal.js';
import { invoicesOf, markSent, replaceInvoice } from './invoices.js';
import { nextActionFor, resolveNextAction } from './nextAction.js';

export const EMAIL_CHECKPOINT = { intro: 'introSent', onboarding: 'onboardingSent', invoice: 'invoiceSent' };
export const EMAIL_NOTE = { intro: 'Sent the intro email', onboarding: 'Sent the onboarding email', invoice: 'Sent the invoice email', delivery: 'Sent the delivery email' };

/** The lead's local set and the project's local set for a successful send. ctx: { projects, sets }. */
export function applySendResult(lead, kind, { sentAt, invoice = null, project = null }, ctx = {}) {
  const leadSet = {};
  const cp = EMAIL_CHECKPOINT[kind];
  let deal = dealOf(lead);
  if (cp && (lead.deal || lead.stage === 'booked' || lead.stage === 'deal') && !isTicked(deal, cp)) { deal = { ...deal, checkpoints: { ...deal.checkpoints, [cp]: { at: sentAt, by: 'auto' } }, stalledSince: '' }; leadSet.deal = deal; }
  let projectSet = null;
  if (kind === 'invoice' && invoice) {
    if (project) projectSet = { invoices: replaceInvoice(invoicesOf(project), markSent(invoice, Date.parse(sentAt))) };
    else { deal = { ...(leadSet.deal || deal), invoices: replaceInvoice(invoicesOf(deal), markSent(invoice, Date.parse(sentAt))) }; leadSet.deal = deal; }
  }
  if (kind === 'delivery' && project) projectSet = { delivery: { driveShared: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', ...(project.delivery || {}), emailSent: true } };
  leadSet.contactLog = [...(Array.isArray(lead.contactLog) ? lead.contactLog : []), { type: 'email', at: sentAt, note: EMAIL_NOTE[kind] }].slice(-200);
  const after = { ...lead, ...leadSet };
  const projects = (ctx.projects || []).map(p => (projectSet && project && String(p._id) === String(project._id) ? { ...p, ...projectSet } : p));
  leadSet.nextAction = resolveNextAction(after, nextActionFor(after, { projects, sets: ctx.sets || [] }, Date.parse(sentAt) || Date.now()));
  return { leadSet, projectSet };
}
