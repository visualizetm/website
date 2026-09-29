/* Triage (CRM revamp, step 4): the pure writes behind Keep, Later and
 * their undos, the source pill, and the intel lines a card shows. */
import { addDaysKey } from './nurture.js';
import { normalizeStage } from '../shared/semantics.js';

/** The pile waiting to be sorted, best first (score, then newest). */
export const triageLeads = (leads) => (leads || []).filter(l => normalizeStage(l) === 'triage').sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

/** Keep: stage lead with the priority and the window picked. The shared patch helper recomputes nextAction. */
export const keepPatch = (lead, picked = {}) => ({ stage: 'lead', priority: picked.priority || lead?.priority || 'warm', bestWindow: picked.bestWindow !== undefined ? picked.bestWindow : (lead?.bestWindow || ''), nurture: null });
export const undoKeepPatch = (lead) => ({ stage: 'triage', priority: lead?.priority || 'warm', bestWindow: lead?.bestWindow || '', nextAction: null, listId: '' });
/** Later: parked 30 days, back through triage when the day comes. */
export const laterPatch = (lead, now = Date.now()) => ({ stage: 'nurture', nurture: { until: addDaysKey(30, now), reason: 'Later' }, nextAction: null, listId: '' });
export const undoLaterPatch = (lead) => ({ stage: 'triage', nurture: lead?.nurture || null, nextAction: null });
/** Where the lead came from. briefed: the Set of lead ids with a start or contact submission linked. */
export const SOURCE_TONE = { scraper: 'progress', brief: 'booked', import: 'neutral', hand: 'new' };
export function sourceOf(lead, briefed) {
  if (lead?.sourceId) return { id: 'scraper', label: 'Nightly scraper' };
  if (briefed && briefed.has(String(lead?._id))) return { id: 'brief', label: 'Website brief' };
  if (lead?.source === 'import') return { id: 'import', label: 'Import' };
  return { id: 'hand', label: 'Added by hand' };
}
/** Up to three intel lines: gaps first (they are the pitch), then accomplishments. */
export function intelLines(lead, n = 3) {
  const s = (v) => (typeof v === 'string' ? v : v?.text || v?.note || '');
  const gaps = (Array.isArray(lead?.intel?.gaps) ? lead.intel.gaps : []).map(s).filter(Boolean);
  const wins = (Array.isArray(lead?.intel?.accomplishments) ? lead.intel.accomplishments : []).map(s).filter(Boolean);
  return [...gaps, ...wins].slice(0, n);
}
