/* Server mirror of src/lib/reviewPublic.js (review links): the same rules byte
 * for byte below REVIEW_PULL_MAX; scripts/review-link-test.mjs asserts it. */
export const REVIEW_PULL_MAX = 140;
export const MIN_RATINGS_FOR_AVERAGE = 3;
export const TESTIMONIAL_STATUS_IDS = ['pending', 'approved', 'hidden'];

const hasStatus = (t) => typeof t?.status === 'string' && t.status !== '';
export const isSubmission = (t) => hasStatus(t) || typeof t?.text === 'string';
/** Public: a consented, approved submission, or a typed testimonial marked published. */
export const isPublicTestimonial = (t) => !!t && (hasStatus(t) ? (t.status === 'approved' && t.consent === true) : t.published === true);
export const isFeaturedTestimonial = (t) => isPublicTestimonial(t) && t.featured === true;
/** A submission may be approved only with consent. */
export const canApprove = (t) => !!t && t.consent === true;

/** The first `max` characters cut at a word (never mid word unless the first word is longer than half the room), trailing punctuation dropped. */
export function cleanCut(text, max = REVIEW_PULL_MAX) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const i = cut.lastIndexOf(' ');
  return `${(i > max / 2 ? cut.slice(0, i) : cut).replace(/[\s,;:.!?]+$/, '')}...`;
}
export const quoteOf = (t) => (String(t?.pullQuote || '').trim() ? String(t.pullQuote).trim().slice(0, REVIEW_PULL_MAX) : typeof t?.text === 'string' && t.text ? cleanCut(t.text) : String(t?.quote || ''));
export const authorOf = (t) => String(t?.name || t?.author || '');
export const roleOf = (t) => String(t?.role || '');
export const ratingOf = (t) => { const n = Number(t?.rating); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
/** When it happened: approval first, then the submission, then the typed date; 0 when none. */
export const testimonialTime = (t) => { for (const v of [t?.approvedAt, t?.createdAt, t?.at]) { const ms = Date.parse(v || ''); if (!Number.isNaN(ms)) return ms; } return 0; };
export const newestFirst = (a, b) => testimonialTime(b) - testimonialTime(a) || (Number(a?.order) || 0) - (Number(b?.order) || 0);

/** The public card: nothing from the record but these. */
export const publicCard = (t) => ({ id: String(t?.id || ''), quote: quoteOf(t), author: authorOf(t), role: roleOf(t), rating: ratingOf(t), source: t?.source || 'website', featured: t?.featured === true, at: testimonialTime(t) ? new Date(testimonialTime(t)).toISOString() : '' });

/** The real average across public ratings, to one decimal, once there are MIN_RATINGS_FOR_AVERAGE of them; null before that. */
export function averageRating(testimonials) {
  const r = (Array.isArray(testimonials) ? testimonials : []).filter(isPublicTestimonial).map(ratingOf).filter(n => n !== null);
  if (r.length < MIN_RATINGS_FOR_AVERAGE) return { value: null, count: r.length };
  return { value: Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10, count: r.length };
}
/** The stat the landing shows: the real average once it exists, else the typed override, else null. */
export function averageRatingStat(testimonials, override) {
  const live = averageRating(testimonials);
  if (live.value !== null) return { value: live.value, source: 'reviews', count: live.count };
  const o = Number(override);
  return { value: Number.isFinite(o) && override !== null && override !== '' ? o : null, source: 'override', count: live.count };
}
