/* The pipeline's one set of facts about what makes a record a client, shared
 * by the daily cron's heal (api/_routes/cron-daily.js), the clientSince
 * backfill (scripts/backfill-client-since.mjs), and the repair script
 * (scripts/repair-leads.mjs). Stage itself is decided by normalizeStage on
 * the stage field (src/shared/semantics.js); this module only answers "did
 * this record ever reach client", for the case where a background job has
 * wiped the stage and the field can no longer say so.
 *
 * Each rule names something that only exists on a record that reached
 * client: the moment it was won, a won outcome, a published showcase, a
 * project, a payment, a planner switched on, a testimonial. A lead with none
 * of these is a lead, whatever else is on it. */
export const STAGE_IDS = ['lead', 'booked', 'won', 'client', 'lost'];

const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
const list = (v) => (Array.isArray(v) ? v : []);

/** The client evidence rules, in the order they are reported. `test` reads the lead and its project count. */
export const CLIENT_EVIDENCE = [
  { id: 'clientSince', label: 'clientSince is set', test: (l) => nonEmpty(l.clientSince) },
  { id: 'won', label: 'a won outcome', test: (l) => l.bookedOutcome?.result === 'won' },
  { id: 'showcase', label: 'a published showcase', test: (l) => l.showcase?.published === true },
  { id: 'project', label: 'a project', test: (l, projectCount) => projectCount > 0 },
  { id: 'purchase', label: 'a purchase', test: (l) => list(l.purchases).length > 0 },
  { id: 'planner', label: 'the planner switched on', test: (l) => l.planner?.enabled === true },
  { id: 'testimonial', label: 'a testimonial', test: (l) => list(l.reviews?.testimonials).length > 0 },
];

/** The ids of every rule this record satisfies; an empty list means it never reached client. */
export function clientEvidence(lead, projectCount = 0) {
  if (!lead || typeof lead !== 'object') return [];
  return CLIENT_EVIDENCE.filter(r => { try { return !!r.test(lead, projectCount); } catch { return false; } }).map(r => r.id);
}

/** True when the stored stage is not one of the five stages (the enricher leaves ''). */
export const stageWiped = (lead) => !STAGE_IDS.includes(lead?.stage);

const ms = (v) => { const t = new Date(v || '').getTime(); return Number.isFinite(t) && t > 0 ? t : null; };

/** The earliest of the record's first purchase, first project, or updatedAt, as ISO, for a client with no clientSince. */
export function earliestClientSince(lead, projects = []) {
  const times = [
    ...list(lead?.purchases).map(p => ms(p?.at)),
    ...list(projects).map(p => ms(p?.createdAt)),
    ms(lead?.updatedAt),
  ].filter(Boolean);
  if (!times.length) return '';
  return new Date(Math.min(...times)).toISOString();
}
