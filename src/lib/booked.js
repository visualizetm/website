import { MEETING_TYPES, PLANS, normalizeStage } from '../shared/semantics';
/* Booked pipeline helpers (trimmed in Prompt 13): stage derivation, the
 * legacy services catalog the command bar still labels, delete safety,
 * checklist progress, and the meeting date. Pure functions only.
 */

/**
 * A lead's pipeline stage. Older records have no `stage` field; a lead whose
 * callStatus is 'booked' is treated as booked so pre-existing bookings appear
 * in the workspace without any data migration.
 */
export const effectiveStage = normalizeStage;

/**
 * Delete safety rule: a lead is deletable only if it has never been worked,
 * empty call log AND still in the open-lead stage. Returns null when
 * deletable, otherwise a short human reason to show beside the disabled
 * control.
 */
export function deleteBlockReason(lead) {
  if ((lead?.callLog || []).length > 0) return "Has call history, cannot delete";
  const s = effectiveStage(lead);
  if (s === 'booked') return "Booked, cannot delete";
  if (s === 'won' || s === 'client') return "Won or client, cannot delete";
  return null;
}

/** Total / done across all of a lead's checklists, for n/m badges. */
export function checklistProgress(lead) {
  const lists = lead?.checklists || [];
  let total = 0; let done = 0;
  for (const l of lists) for (const i of (l.items || [])) { total++; if (i.done) done++; }
  return { total, done, lists: lists.length };
}

// Enums live in src/shared/semantics.js; re-exported so existing imports keep working.
export { MEETING_TYPES, PLANS };

/* The legacy services list: servicesPlanned[] on older leads still holds these ids
 * and the command bar labels them. New work uses pricing.js packages. */
export const SERVICES = [
  { id: 'logo', label: 'Logo design', group: 'Brand' },
  { id: 'brand-kit', label: 'Brand identity kit', group: 'Brand' },
  { id: 'social-kit', label: 'Social media kit', group: 'Brand' },
  { id: 'site-onepager', label: 'One-page website', group: 'Web' },
  { id: 'site-full', label: 'Full website', group: 'Web' },
  { id: 'site-shop', label: 'Online shop', group: 'Web' },
  { id: 'google-business', label: 'Google Business setup', group: 'Web' },
  { id: 'stickers', label: 'Stickers', group: 'Print' },
  { id: 'business-cards', label: 'Business cards', group: 'Print' },
  { id: 'nfc-cards', label: 'NFC cards', group: 'Print' },
  { id: 'vinyl', label: 'Vinyl decals', group: 'Print' },
  { id: 'bulk-custom', label: 'Bulk custom products', group: 'Print' },
];
export const serviceLabel = (id) => SERVICES.find(s => s.id === id)?.label || id;

/** Meeting Date object from the additive meeting {date,time} fields. */
export function meetingDate(lead) {
  const m = lead?.meeting;
  if (!m?.date) return null;
  const d = new Date(`${m.date}T${m.time || '09:00'}`);
  return Number.isNaN(d.getTime()) ? null : d;
}
