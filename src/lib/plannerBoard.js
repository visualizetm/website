/* Rob's month board for a client's planner (Planner v2, part 2): the pure
 * logic the board, the activity strip and the batch send share, so
 * scripts/planner-board-test.mjs can check it without a browser.
 *
 * A post's column is its status: Making, Waiting on the client (review),
 * Approved, and Posted or live (posted, live, finished). A drag only ever
 * moves a post between Making and Waiting, which is sending it for approval
 * or taking it back; every other move is an explicit menu choice, so a drag
 * never posts or approves anything for the client. */

const HOUR = 3600e3;
const DAY = 24 * HOUR;
export const SEEN_UNANSWERED_H = 48;

export const BOARD_COLUMNS = [
  { id: 'making', label: 'Making' },
  { id: 'review', label: 'Waiting on' }, // the board names the client after it
  { id: 'approved', label: 'Approved' },
  { id: 'done', label: 'Posted or live' },
];
const kindOf = (p) => (p?.kind === 'ad' ? 'ad' : 'post');
const ms = (v) => { const t = v instanceof Date ? v.getTime() : Date.parse(v || ''); return Number.isFinite(t) ? t : 0; };

/** The column a post sits in. */
export function columnOf(p) {
  const s = p?.status || 'making';
  if (s === 'review') return 'review';
  if (s === 'approved') return 'approved';
  if (s === 'posted' || s === 'live' || s === 'finished') return 'done';
  return 'making';
}

/** A drag is a send or a take back: Making to Waiting, or Waiting to Making. Nothing else is draggable. */
export const dragAllowed = (from, to) => (from === 'making' && to === 'review') || (from === 'review' && to === 'making');

/** The status a menu move writes, by kind: a post's last column is Posted, an ad's is Live. */
export function statusFor(column, post) {
  if (column === 'done') return kindOf(post) === 'ad' ? 'live' : 'posted';
  return column;
}
/** The menu's moves for a card: every column but its own (an ad also gets Finished once it is live). */
export function menuMoves(p, clientName = 'the client') {
  const here = columnOf(p);
  const label = { making: 'Back to Making', review: `Send to ${clientName} for approval`, approved: 'Mark approved', done: kindOf(p) === 'ad' ? 'Mark live' : 'Mark posted' };
  const out = BOARD_COLUMNS.filter(c => c.id !== here).map(c => ({ column: c.id, status: statusFor(c.id, p), label: label[c.id] }));
  if (kindOf(p) === 'ad' && p.status === 'live') out.push({ column: 'done', status: 'finished', label: 'Mark finished' });
  return out;
}

/** Has Rob answered the client's change request? A version kept after it (the route's own rule), or an edit well after it. */
export function changeAnswered(p) {
  const asked = ms(p?.clientNoteAt);
  if (!asked) return true;
  const v = Array.isArray(p?.versions) && p.versions.length ? p.versions[p.versions.length - 1] : null;
  if (v && ms(v.at) >= asked) return true;
  return ms(p?.updatedAt) - asked > 5000;
}
/** A change the client asked for that Rob has not answered: back in Making with their note, nothing done since. */
export const changeAsked = (p) => (p?.status || 'making') === 'making' && !!p?.clientNote && !changeAnswered(p);

/** Seen, not answered: in review for more than two days since it was sent, and the client opened the planner after it was sent. */
export function seenUnanswered(p, lastViewedAt, now = Date.now()) {
  if (p?.status !== 'review') return false;
  const sent = ms(p.reviewAt);
  if (!sent) return false;
  return now - sent > SEEN_UNANSWERED_H * HOUR && ms(lastViewedAt) > sent;
}
/** The one red line a card carries, or ''. */
export function flagOf(p, { lastViewedAt = '', now = Date.now(), today = '' } = {}) {
  if (changeAsked(p)) return 'Change asked';
  if (seenUnanswered(p, lastViewedAt, now)) return 'Seen, not answered';
  if (p?.status === 'approved' && kindOf(p) === 'post' && today && p.date === today) return 'Goes up today';
  return '';
}

/** Ready for the batch send: a post (not an ad) being made, with a picture or a video file and a caption. The route asks the same. */
export const sendable = (p) => (p?.status || 'making') === 'making' && kindOf(p) === 'post' && !!(String(p?.imageUrl || '').trim() || String(p?.video?.url || '').trim()) && !!String(p?.caption || '').trim();

/** The activity strip for one month. */
export function activityOf(monthPosts, { postsPerMonth = 8, ideas = [] } = {}) {
  const posts = monthPosts.filter(p => kindOf(p) === 'post');
  const ready = posts.filter(p => p.status === 'approved' || p.status === 'posted').length;
  const live = monthPosts.filter(p => kindOf(p) === 'ad' && p.status === 'live');
  const best = live.reduce((m, a) => Math.max(m, Number(a.ad?.results?.messages) || 0), 0);
  return {
    ready, of: Math.max(1, Number(postsPerMonth) || 8),
    waiting: monthPosts.filter(p => p.status === 'review').length,
    changes: monthPosts.filter(changeAsked).length,
    ideas: ideas.filter(s => (s.status || 'new') === 'new').length,
    adBest: best > 0 ? best : 0,
  };
}

/** How fast they usually say yes: the median of (approved, else decided) minus sent, over the last 20 decided posts; null under 3,
 *  because a median of one or two is not honest. Answers whole days, at least one. */
export const APPROVE_SAMPLE = 20;
export const APPROVE_MIN = 3;
export function approvalDays(allPosts) {
  const spans = allPosts
    .map(p => ({ sent: ms(p.reviewAt), said: ms(p.approvedAt) || ms(p.decidedAt) }))
    .filter(x => x.sent && x.said && x.said >= x.sent)
    .sort((a, b) => b.said - a.said)
    .slice(0, APPROVE_SAMPLE)
    .map(x => x.said - x.sent)
    .sort((a, b) => a - b);
  if (spans.length < APPROVE_MIN) return null;
  const mid = spans.length % 2 ? spans[(spans.length - 1) / 2] : (spans[spans.length / 2 - 1] + spans[spans.length / 2]) / 2;
  return Math.max(1, Math.ceil(mid / DAY));
}
export const approvalLine = (days) => (days == null ? '' : `usually approves within ${days === 1 ? 'a day' : `${days} days`}`);

/** The calendar chip's tone: waiting red, an ad blue, everything else neutral. */
export const chipTone = (p) => (p?.status === 'review' ? 'won' : kindOf(p) === 'ad' ? 'progress' : 'neutral');
