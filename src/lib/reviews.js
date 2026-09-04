/* Reviews (Prompt 11). Pure helpers over lead.reviews and the projects list. */
import { normalizeStage } from '../shared/semantics';
import { projectsOf, DAY } from './projects';

export const ASK_AFTER_DAYS = 3;
export const emptyReviews = () => ({ nfcCard: false, nfcGivenAt: '', googleLink: '', baseline: null, latest: null, asks: [] });
export const reviewsOf = (lead) => ({ ...emptyReviews(), ...(lead?.reviews || {}) });
export const asksOf = (lead) => reviewsOf(lead).asks || [];
export const lastAsk = (lead) => { const a = asksOf(lead); return a.length ? a[a.length - 1] : null; };
export const leftCount = (lead) => asksOf(lead).filter(a => a.result === 'left').length;
export const askedThisMonth = (lead, now = Date.now()) => { const d = new Date(now); const k = `${d.getFullYear()}-${d.getMonth()}`; return asksOf(lead).some(a => { const x = new Date(a.at); return `${x.getFullYear()}-${x.getMonth()}` === k; }); };

/** Count and rating delta between baseline and latest. null when either is missing. */
export function reviewDelta(lead) {
  const r = reviewsOf(lead);
  if (!r.baseline || !r.latest) return null;
  return { count: (r.latest.count || 0) - (r.baseline.count || 0), rating: Math.round(((r.latest.rating || 0) - (r.baseline.rating || 0)) * 10) / 10 };
}

/** The most recent released project, or null. */
export const releasedProject = (lead, projects) => projectsOf(projects, lead._id).filter(p => p.releasedAt).sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))[0] || null;
/** Delivered and never asked: a client with a released project and zero asks. */
export const deliveredNotAsked = (lead, projects) => normalizeStage(lead) === 'client' && !!releasedProject(lead, projects) && asksOf(lead).length === 0;
/** The ask notification rule: 3 days after releasedAt with zero asks. */
export function reviewAskDue(lead, projects, now = Date.now()) {
  if (!deliveredNotAsked(lead, projects)) return null;
  const p = releasedProject(lead, projects);
  const at = new Date(p.releasedAt).getTime() + ASK_AFTER_DAYS * DAY;
  return at <= now ? { at, project: p } : null;
}
export const reviewAsksDue = (leads, projects, now = Date.now()) => (leads || []).filter(l => reviewAskDue(l, projects, now)).length;

export const REVIEW_FILTERS = [['all', 'All'], ['nfc', 'Has NFC card'], ['nolink', 'No Google link'], ['never', 'Never asked'], ['month', 'Asked this month'], ['delivered', 'Delivered not asked']];
export function reviewPasses(lead, projects, f, now = Date.now()) {
  const r = reviewsOf(lead);
  switch (f) {
    case 'nfc': return !!r.nfcCard;
    case 'nolink': return !r.googleLink;
    case 'never': return asksOf(lead).length === 0;
    case 'month': return askedThisMonth(lead, now);
    case 'delivered': return deliveredNotAsked(lead, projects);
    default: return true;
  }
}

/** Two short ask texts in Rob's voice, the link appended when present. */
export function askTexts(lead) {
  const link = reviewsOf(lead).googleLink;
  const tail = link ? ` ${link}` : '';
  return [
    { id: 'quick', label: 'Quick ask', text: `Hey! If you have a minute, a quick Google review would mean a lot. Here's the link:${tail}` },
    { id: 'thanks', label: 'After delivery', text: `Loved working on this with you. If you're happy with how it turned out, a Google review helps more than you know. Here's the link:${tail}` },
  ];
}
