/* The emails settings document (the email system, milestone 1): settings
 * _id 'emails', the one place Rob's edits to the email system live.
 *
 *   { sender { name, address, replyTo }, signatureName, calendlyLink, invoiceTerms, invoiceCounter,
 *     automation { [templateId]: 'off' | 'draft' | 'send' }, templates { [templateId]: { subject, preheader, blocks, auto, updatedAt } } }
 *
 * Milestone 1 shapes the sender and the counter; milestone 2 adds the
 * template overrides, milestone 6 the invoice terms. Every reader goes
 * through emailSettingsOf() so a missing document reads as the defaults. */
import { senderOf } from './transport.js';
import { safeUrl } from '../url.js';

export const EMAIL_SETTINGS_ID = 'emails';
export const AUTOMATION_IDS = ['off', 'draft', 'send'];
const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function emailSettingsOf(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  return {
    sender: senderOf(d.sender),
    signatureName: str(d.signatureName, 80) || 'Rob',
    calendlyLink: safeUrl(d.calendlyLink, 400),
    invoiceTerms: d.invoiceTerms && typeof d.invoiceTerms === 'object' ? d.invoiceTerms : {},
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
