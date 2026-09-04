/* Lookups over src/shared/semantics.js so kit components can be driven by an
 * id alone: <Pill id="booked" /> resolves label, tone, and icon itself. */
import {
  CALL_STATUSES, PRIORITIES, STAGES, LEAD_STATUSES, ORDER_STATUSES, PREP_STATUSES, CONTACT_TYPES,
} from '../shared/semantics';

export const TONES = ['new', 'progress', 'callback', 'booked', 'won', 'danger', 'neutral'];

/** Tone name ('booked') from a semantics entry's var() strings. */
export function toneOf(entry) {
  const m = /--v-status-([a-z]+)-/.exec(entry?.solid || '');
  return m ? m[1] : 'neutral';
}

const LISTS = [CALL_STATUSES, PRIORITIES, STAGES, PREP_STATUSES, LEAD_STATUSES, ORDER_STATUSES, CONTACT_TYPES];

/** First semantics entry with this id, searched in pipeline order. Pass a
 *  list to disambiguate ids shared across sets ('new' is a submission AND an
 *  order status; 'booked' is a call status AND a stage). */
export function entryOf(id, list) {
  if (!id) return null;
  if (list) return list.find(e => e.id === id) || null;
  for (const l of LISTS) { const e = l.find(x => x.id === id); if (e) return e; }
  return null;
}

/** Resolve {label, tone, icon} for a Pill/Badge/IconTile from an id, with
 *  explicit props winning over the lookup. */
export function resolveSemantic({ id, list, label, tone, icon }) {
  const e = TONES.includes(id) && !list ? null : entryOf(id, list);
  return {
    label: label ?? e?.label ?? (id ? String(id) : ''),
    tone: tone ?? (e ? toneOf(e) : TONES.includes(id) ? id : 'neutral'),
    icon: icon ?? e?.icon ?? null,
  };
}
