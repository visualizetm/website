import { postsOf, kindOf } from './posts';
import { setsOf, newestSet, statusOf as conceptStatusOf, itemCount, reviewLine, approvalModeOf, needsDecision } from './concepts';
import { conceptSetStatusOf } from '../shared/semantics';
import { taskCounts, taskNextUp, openTasks } from '../shared/taskRules';
import { completeness, imageCount } from './showcaseMeter';
import { docsOf, sortDocs } from './docs';

/* The client workspace's status lines (client page workspace redesign): one
 * selector per card, read by the Workspace cards, by the record's overflow
 * menu lines on a lead or a deal, and by nothing else, so the four numbers
 * can never disagree with each other. Nothing here fetches: every input is
 * what the shell already holds (the lead, its posts, its concept sets). */

/** Showcase: none, draft, ready (every block the page shows is filled), published. The wording the menu used. */
export function showcaseStatus(lead) {
  const sh = lead?.showcase && typeof lead.showcase === 'object' && Object.keys(lead.showcase).length > 0 ? lead.showcase : null;
  if (!sh) return { state: 'none', empty: false, label: 'none yet', images: 0, cover: '', ready: false, published: false };
  /* The count was the two galleries only, so a published page with a cover and a logo read "0 images on the page" (client docs job, part 5). */
  const images = imageCount(sh);
  const c = completeness(sh, lead);
  const ready = c.total > 0 && c.done === c.total;
  const state = sh.published ? 'published' : ready ? 'ready' : 'draft';
  /* Published with nothing to look at is the one state worth a nudge; it never reads as a plain Published. */
  const empty = !!sh.published && images === 0;
  return { state, empty, label: empty ? 'published, no images yet' : state, images, cover: sh.cover || sh.logoUrl || '', ready, published: !!sh.published, done: c.done, total: c.total, slug: sh.slug || '' };
}

/** Planner: the private link's state and the month's items by state, with the posts and ads split (both already loaded at the shell). */
export function plannerStatus(posts, lead) {
  const mine = postsOf(posts || [], lead?._id);
  const count = (s) => mine.filter(p => p.status === s).length;
  const ads = mine.filter(p => kindOf(p) === 'ad').length;
  const enabled = !!lead?.planner?.enabled;
  const inReview = count('review');
  return {
    enabled, inReview, approved: count('approved'), live: count('live'), posted: count('posted'), making: count('making'), finished: count('finished'),
    total: mine.length, posts: mine.length - ads, ads,
    /* The one line the menu used: off, N in review, on. */
    label: !enabled ? 'off' : inReview ? `${inReview} in review` : 'on',
  };
}

/** Tasks: the counts, and the next tasks in the order Next up reads them: the pinned one or the earliest due open task first, then by due date, undated last. */
export function tasksStatus(record, n = 2, now = Date.now()) {
  const counts = taskCounts(record);
  const first = taskNextUp(record, now);
  const ms = (t) => { const v = Date.parse(t?.due || ''); return Number.isNaN(v) ? Infinity : v; };
  const rest = openTasks(record).filter(t => !first || t.id !== first.id).sort((a, b) => ms(a) - ms(b) || a.listIndex - b.listIndex || a.index - b.index);
  const next = [...(first ? [first] : []), ...rest].slice(0, n);
  return { ...counts, next, label: counts.total ? `${counts.done} of ${counts.total} done` : 'none yet' };
}

/** Concepts: how many sets, the newest live one and its state, when the client last looked. A Review each set also carries `review`, the one
 * line the card and the menu say about it: "Waiting on client, 2 of 4" before they send, "3 approved, 1 needs changes" after. A Pick one set
 * (and every older one) has none and keeps today's wording. */
export function conceptsStatus(sets, leadId) {
  const all = setsOf(sets, leadId);
  const set = newestSet(sets, leadId);
  const st = set ? conceptSetStatusOf(conceptStatusOf(set)) : null;
  const review = set ? reviewLine(set) : undefined;
  return {
    rows: set ? directionRows(set) : [], answeredAt: set?.submittedAt || '',
    count: all.length, set, status: st, label: review ? review[0].toLowerCase() + review.slice(1) : st ? st.label.toLowerCase() : 'none', review,
    items: set ? itemCount(set) : 0, lastViewedAt: set?.lastViewedAt || '', approved: !!set?.approvedDirectionId,
  };
}

/** The Concepts card's middle: up to three directions with where each stands. A Review each set shows the client's answer on each; a Pick one
 * set shows the one they picked. state is approved, changes, pass, picked or waiting (nothing from them yet). */
export function directionRows(set, n = 3) {
  const dirs = [...(set?.directions || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const review = approvalModeOf(set) === 'review';
  return dirs.slice(0, n).map((d, i) => {
    const letter = String.fromCharCode(65 + i);
    const dec = d.decision?.status;
    const state = review ? (!needsDecision(d) ? 'reference' : dec === 'approved' ? 'approved' : dec === 'changes' ? 'changes' : dec === 'pass' ? 'pass' : 'waiting')
      : (set?.approvedDirectionId === d.id ? 'picked' : 'waiting');
    return { id: d.id, name: d.name || `Direction ${letter}`, state };
  });
}

/** Docs: the count and the three the card shows, pinned first then the latest edit. Nothing fetches: the list is what the shell holds. */
export function docsStatus(docs, leadId, n = 3) {
  const mine = docsOf(docs, leadId);
  const sorted = sortDocs(mine, 'edited');
  return { count: mine.length, pinned: mine.filter(d => d.pinned).length, rows: sorted.slice(0, n), more: Math.max(0, mine.length - n), label: mine.length ? `${mine.length} doc${mine.length === 1 ? '' : 's'}` : 'none yet' };
}
