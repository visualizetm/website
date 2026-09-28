/* Server mirror of src/lib/score.js (CRM revamp, step 4), the same rules
 * byte for byte; the daily cron and the shared patch helper both use
 * the same rules, so the number never depends on who computed it.
 *
 *   has a phone                                   25
 *   has an instagram                              15
 *   no website, or a website flagged dead         25   (intel.gaps names the site as dead, down, broken, expired or 404)
 *   intel.gaps has anything in it                 15
 *   industry among the top five client industries 10
 *   a start or contact submission linked          10 */
export const SCORE_RULES = [
  { id: 'phone', label: 'Has a phone', points: 25 },
  { id: 'instagram', label: 'Has an Instagram', points: 15 },
  { id: 'no-site', label: 'No website, or a dead one', points: 25 },
  { id: 'gaps', label: 'The scan found gaps', points: 15 },
  { id: 'industry', label: 'An industry that converts', points: 10 },
  { id: 'brief', label: 'Came in through the site', points: 10 },
];
const DEAD = /\b(dead|down|broken|expired|404|not loading|does not load|doesn't load|offline)\b/i;
const SITE = /\b(site|website|domain|url|page)\b/i;
const key = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const gapsOf = (lead) => (Array.isArray(lead?.intel?.gaps) ? lead.intel.gaps : []).map(g => (typeof g === 'string' ? g : g?.text || g?.note || '')).filter(Boolean);
export const websiteDead = (lead) => gapsOf(lead).some(g => DEAD.test(g) && SITE.test(g));

/** The five industries that made the most clients (stage client or won), as lowercase keys. */
export function topClientIndustries(leads, n = 5) {
  const c = new Map();
  for (const l of leads || []) { if (l.deleted) continue; if (l.stage !== 'client' && l.stage !== 'won') continue; const k = key(l.industry); if (!k) continue; c.set(k, (c.get(k) || 0) + 1); }
  return new Set([...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k));
}
/** The lead ids with a start or contact submission linked. */
export function briefedLeadIds(submissions) {
  return new Set((submissions || []).filter(s => !s.deleted && (s.type === 'start' || s.type === 'contact') && s.linkedLeadId).map(s => String(s.linkedLeadId)));
}
/** Which rules a lead meets, in rule order. ctx: { topIndustries: Set, briefed: Set }. */
export function scoreRulesMet(lead, ctx = {}) {
  if (!lead || typeof lead !== 'object') return [];
  const met = [];
  if (String(lead.phone || '').replace(/\D/g, '').length >= 7) met.push('phone');
  if (lead.socials?.instagram) met.push('instagram');
  if (!lead.socials?.website || websiteDead(lead)) met.push('no-site');
  if (gapsOf(lead).length) met.push('gaps');
  if (ctx.topIndustries && ctx.topIndustries.has(key(lead.industry))) met.push('industry');
  if (ctx.briefed && ctx.briefed.has(String(lead._id))) met.push('brief');
  return met;
}
/** The score, 0 to 100. */
export function scoreFor(lead, ctx = {}) {
  const met = new Set(scoreRulesMet(lead, ctx));
  return Math.min(100, SCORE_RULES.filter(r => met.has(r.id)).reduce((n, r) => n + r.points, 0));
}
export const SCORE_KEYS = ['phone', 'socials', 'intel', 'industry'];
/** The set a write should carry: the caller's set plus the recomputed score when a scored field changed. */
export function withScore(record, set, ctx = {}) {
  if (!record || !set || 'score' in set) return set;
  if (!Object.keys(set).some(k => SCORE_KEYS.includes(k))) return set;
  const next = scoreFor({ ...record, ...set }, ctx);
  return next === Number(record.score) ? set : { ...set, score: next };
}
export const scoreTone = (n) => (n >= 70 ? 'booked' : n >= 40 ? 'new' : 'neutral');
