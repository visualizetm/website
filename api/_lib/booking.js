/* The booking Billy makes (Billy's Call Room, part 1): the pure pieces of the write. The console's booked outcome
 * (src/lib/callOutcome.js, callOutcomeSet) is the model: stage booked, the meeting, the deal started from the recommended
 * pricing option; caller-test holds the two together. The confirmation is an override on the custom template, drafted
 * for Rob through the drafts path (api/_lib/email/drafts.js). Nothing here writes and nothing here can send. */
import { emptyDeal } from './deal.js';
import { packageOf, addonOf, planFor } from './pricing.js';
import { zoneParts, ZONE } from './zone.js';

const pad = (n) => String(n).padStart(2, '0');
/** The meeting a slot is: its day and HH:MM in New York, a call. */
export function meetingOf(atMs) {
  const p = zoneParts(atMs);
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}`, type: 'call', location: '' };
}
/** The package, add-ons and plan a booking carries, from the recommended (else first) pricing option (src/lib/dealConvert.js). */
export function dealFromOptions(options = []) {
  const o = (options || []).find(x => x?.recommended) || (options || [])[0];
  if (!o?.packageId && !(o?.addonIds || []).length) return { packageId: '', addonIds: [], plan: null };
  const pkg = packageOf(o.packageId);
  const total = (pkg?.price || 0) + (o.addonIds || []).map(id => addonOf(id)?.price || 0).reduce((n, v) => n + v, 0);
  const wants = o.plan === '6mo' || o.plan === '12mo';
  const p = wants ? planFor(total, o.packageId) : null;
  const plan = p ? (o.plan === '12mo' && p.alt ? { months: p.alt.months, monthly: p.alt.monthly } : { months: p.months, monthly: p.monthly }) : null;
  return { packageId: pkg?.id || '', addonIds: (o.addonIds || []).filter(id => addonOf(id)), plan };
}
export const bookingDeal = (lead) => ({ ...emptyDeal(), ...dealFromOptions(lead?.pricingOptions) });
/** "Thursday, November 19 at 10:00 AM" in New York. */
export function whenLine(atMs) {
  const p = zoneParts(atMs);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(atMs));
  return `${day} at ${((p.h + 11) % 12) + 1}:${pad(p.min)} ${p.h >= 12 ? 'PM' : 'AM'}`;
}
/** The confirmation Rob sends once he has looked at it: his words, "I" and never "we", the caller named. */
export function confirmationOverride(lead, atMs, callerName = 'Billy') {
  const first = String(lead?.askFor || '').trim().split(/[\s,]+/)[0] || 'there';
  const when = whenLine(atMs);
  const who = String(callerName || 'Billy').trim() || 'Billy';
  return {
    subject: `You're set for ${when}`,
    preheader: "I'll have your concepts ready.",
    blocks: [
      { type: 'eyebrow', text: 'Next step' },
      { type: 'heading', text: `You're set, ${first}` },
      { type: 'text', text: `${who} told me you two talked. You're on my calendar for ${when} Eastern. I'll call you then and walk you through a couple of concepts I made for ${String(lead?.business || 'the shop').slice(0, 120)}, no charge.` },
      { type: 'text', text: 'If anyone else is part of the decision, bring them along. Any questions before then, just reply here.' },
    ],
  };
}
