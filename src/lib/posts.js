/* Content Planner posts: the pure logic the shell and the screens read.
 * The documents come from /api/admin/posts (api/_routes/posts.js); nothing
 * here fetches, exactly like lib/projects.js and lib/reviews.js.
 */
import { POST_STATUS_IDS } from '../shared/semantics';

const H = 3600e3;
/** Words that read as dangling when a caption is cut short. */
const FILLER = new Set(['a', 'an', 'the', 'on', 'of', 'in', 'and', 'for', 'with', 'at', 'to', 'from', 'is', 'are', 'this', 'that', 'our', 'your', 'my', 'we', 'it']);
/** How far back a client action still counts as news worth a notification. */
export const RECENT_ACTION_H = 48;

/* Every read path goes through this: a post written today carries a
 * `platforms` array, one written before carries a single `platform` string,
 * and one written by something older still carries neither. Nothing reads
 * post.platform directly any more. */
export function platformsOf(post) {
  const many = post?.platforms;
  if (Array.isArray(many) && many.length) return many;
  return post?.platform ? [post.platform] : ['instagram'];
}

/** The post's format, with the pre-format default every old post reads as. */
export const formatOf = (post) => (post?.format === 'story' ? 'story' : 'portrait');

/** The hashtags on a post as tokens, for counting and for display. */
export const hashtagsOf = (post) => String(post?.hashtags || '').split(/\s+/).filter(t => t.startsWith('#') && t.length > 1);

/* What a post still needs before it can go out for approval. A portrait post
 * is a feed post: it needs something to look at, words, and tags. A story is
 * a picture that vanishes in a day, so the picture is the whole requirement
 * and a caption on one is optional. Returns the missing pieces in the order
 * a sentence would name them. */
export function missingForReview(post) {
  const missing = [];
  if (!post?.imageUrl) missing.push('an image');
  if (formatOf(post) === 'portrait') {
    if (!String(post?.caption || '').trim()) missing.push('a caption');
    if (!hashtagsOf(post).length) missing.push('hashtags');
  }
  return missing;
}
export const readyForReview = (post) => missingForReview(post).length === 0;

/** "an image, a caption and hashtags", the way a person would say it. */
export function listPhrase(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Live posts only: not soft deleted, not archived. */
export const livePosts = (posts = []) => posts.filter(p => !p.deleted && !p.archived);

/** One client's live posts, newest month first is NOT applied: they arrive sorted by date. */
export const postsOf = (posts = [], leadId) => livePosts(posts).filter(p => String(p.leadId) === String(leadId));

/** The month a date string falls in, "YYYY-MM". */
export const monthOf = (date) => String(date || '').slice(0, 7);

/** Posts sitting with clients right now, across every client. The nav badge. */
export const postsInReview = (posts = []) => livePosts(posts).filter(p => p.status === 'review').length;

/** Is this a status the enums know? Guards a document written before an enum changed. */
export const knownStatus = (s) => POST_STATUS_IDS.includes(s);

/** A short, human date for a post: "Sep 24". */
export function postDateLabel(date) {
  const [y, m, d] = String(date || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** How to name one post inside a sentence: the first few words of its
 *  caption ("the peach dumpling post"), or its date when there is no
 *  caption yet ("the Sep 24 post"). */
export function postLabel(post) {
  const caption = String(post?.caption || '').trim().replace(/\s+/g, ' ');
  if (caption) {
    // The first clause reads like a name; the whole first line does not.
    // Trailing filler is trimmed too, so five words of "Behind the counter
    // on a Saturday" is "Behind the counter post", not "on a post".
    const clause = caption.split(/[,.!?;:]/)[0].trim() || caption;
    const words = clause.split(' ').slice(0, 5);
    while (words.length > 1 && FILLER.has(words[words.length - 1].toLowerCase())) words.pop();
    return `${words.join(' ')} post`;
  }
  const d = postDateLabel(post?.date);
  return d ? `${d} post` : 'post';
}

/**
 * Client actions from the last `hours`, newest first: an approval, or a
 * change request. Both are computed from the post's own stamps rather than a
 * separate log, so nothing has to be written twice.
 * @returns {Array<{ id, kind: 'approved'|'change', post, lead, at }>}
 */
export function recentClientActions(posts = [], leads = [], hours = RECENT_ACTION_H, now = Date.now()) {
  const byId = new Map(leads.map(l => [String(l._id), l]));
  const out = [];
  for (const p of livePosts(posts)) {
    const lead = byId.get(String(p.leadId));
    if (!lead) continue;
    const approvedAt = Date.parse(p.approvedAt || '') || 0;
    if (p.status === 'approved' && approvedAt && now - approvedAt < hours * H) {
      out.push({ id: `post-ok:${p._id}`, kind: 'approved', post: p, lead, at: approvedAt });
    }
    const noteAt = Date.parse(p.clientNoteAt || '') || 0;
    /* A change request leaves the post back in `making` with the note on it.
     * Once Rob has put it up for review again the note stays as history, so
     * the status check is what stops an old note reappearing as news. */
    if (p.status === 'making' && p.clientNote && noteAt && now - noteAt < hours * H) {
      out.push({ id: `post-change:${p._id}`, kind: 'change', post: p, lead, at: noteAt });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}
