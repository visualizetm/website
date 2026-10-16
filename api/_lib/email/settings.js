/* The emails settings document (the email system, milestone 1): settings
 * _id 'emails', the one place Rob's edits to the email system live.
 *
 *   { sender { name, address, replyTo }, signatureName, calendlyLink, invoiceTerms, invoiceCounter,
 *     automation { [templateId]: 'off' | 'draft' | 'send' }, templates { [templateId]: { subject, preheader, blocks, auto, updatedAt } } }
 *
 * Milestone 1 shapes the sender and the counter; milestone 2 adds the
 * template overrides, milestone 6 the invoice terms. Every reader goes
 * through emailSettingsOf() so a missing document reads as the defaults. */
import { EXTRA_ROUND, REVISION_ROUNDS, money } from '../pricing.js';
import { senderOf } from './transport.js';
import { safeUrl } from '../url.js';

export const EMAIL_SETTINGS_ID = 'emails';
export const AUTOMATION_IDS = ['off', 'draft', 'send'];
const str = (v, max) => String(v ?? '').trim().slice(0, max);

export const INVOICE_KIND_IDS = ['deposit', 'final', 'plan', 'retainer', 'custom'];
/** The default terms by kind, editable in Settings. Only what the house rules say (src/shared/pricing.js): the repo holds no refund, late fee
 * or ownership terms, so none are invented here. {{plan.next}} and {{plan.count}} fill at render time. */
export const DEFAULT_INVOICE_TERMS = {
  deposit: ['The deposit starts the project. The balance is due before delivery.', 'Your final files release once everything is paid.', `${REVISION_ROUNDS} revision rounds are included. Extra rounds are ${money(EXTRA_ROUND.design)} for design or ${money(EXTRA_ROUND.web)} for web.`, 'Questions about this invoice? Just reply.'],
  final: ['This is the last payment for your project.', 'Your files release as soon as it lands.'],
  plan: ['Payment {{plan.next}} of {{plan.count}}. Payments come out monthly.', 'Your files unlock after the last payment.'],
  retainer: ['Month to month. Cancel anytime with 30 days notice.'],
  custom: ['Questions about this invoice? Just reply.'],
};
const termsOf = (saved) => { const out = { ...DEFAULT_INVOICE_TERMS }; for (const k of INVOICE_KIND_IDS) { const v = saved && Array.isArray(saved[k]) ? saved[k].map(x => str(x, 300)).filter(Boolean) : null; if (v && v.length) out[k] = v; } return out; };
export function emailSettingsOf(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  return {
    sender: senderOf(d.sender),
    signatureName: str(d.signatureName, 80) || 'Rob',
    calendlyLink: safeUrl(d.calendlyLink, 400),
    invoiceTerms: termsOf(d.invoiceTerms && typeof d.invoiceTerms === 'object' ? d.invoiceTerms : {}),
    invoiceCounter: Math.max(0, Math.round(Number(d.invoiceCounter) || 0)),
    automation: d.automation && typeof d.automation === 'object' ? Object.fromEntries(Object.entries(d.automation).filter(([, v]) => AUTOMATION_IDS.includes(v))) : {},
    templates: d.templates && typeof d.templates === 'object' ? d.templates : {},
  };
}
export async function readEmailSettings(db) {
  let doc = null;
  try { doc = await db.collection('settings').findOne({ _id: EMAIL_SETTINGS_ID }); } catch { doc = null; }
  return emailSettingsOf(doc);
}
