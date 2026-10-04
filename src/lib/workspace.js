import { postsOf, kindOf } from './posts';
import { setsOf, newestSet, statusOf as conceptStatusOf, itemCount } from './concepts';
import { conceptSetStatusOf } from '../shared/semantics';
import { taskCounts, taskNextUp, openTasks } from '../shared/taskRules';
import { completeness } from './showcaseMeter';

/* The client workspace's status lines (client page workspace redesign): one
 * selector per card, read by the Workspace cards, by the record's overflow
 * menu lines on a lead or a deal, and by nothing else, so the four numbers
 * can never disagree with each other. Nothing here fetches: every input is
 * what the shell already holds (the lead, its posts, its concept sets). */

/** Showcase: none, draft, ready (every block the page shows is filled), published. The wording the menu used. */
export function showcaseStatus(lead) {
  const sh = lead?.showcase && typeof lead.showcase === 'object' && Object.keys(lead.showcase).length > 0 ? lead.showcase : null;
  if (!sh) return { state: 'none', label: 'none yet', images: 0, cover: '', ready: false, published: false };
  const b = sh.brand || {}; const w = sh.website || {};
  const images = (Array.isArray(b.images) ? b.images.length : 0) + (Array.isArray(w.screenshots) ? w.screenshots.length : 0);
  const c = completeness(sh, lead);
  const ready = c.total > 0 && c.done === c.total;
  const state = sh.published ? 'published' : ready ? 'ready' : 'draft';
  return { state, label: state, images, cover: sh.cover || sh.logoUrl || '', ready, published: !!sh.published, done: c.done, total: c.total, slug: sh.slug || '' };
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

/** Concepts: how many sets, the newest live one and its state, when the client last looked. */
export function conceptsStatus(sets, leadId) {
  const all = setsOf(sets, leadId);
  const set = newestSet(sets, leadId);
  const st = set ? conceptSetStatusOf(conceptStatusOf(set)) : null;
  return {
    count: all.length, set, status: st, label: st ? st.label.toLowerCase() : 'none',
    items: set ? itemCount(set) : 0, lastViewedAt: set?.lastViewedAt || '', approved: !!set?.approvedDirectionId,
  };
}
