/* The client planner's pure logic (Planner v2, part 1). Everything a screen
 * decides about the month lives here, so scripts/planner-view-test.mjs can
 * check it without a browser: the month and week helpers, the dot a day
 * carries, the review queue, the feed order, the idea tracker, the Post it
 * steps and the timeline. No React, no fetch, no clock: the caller passes
 * today as a "YYYY-MM-DD" key in the browser's own zone. */

import { slidesOf } from '../shared/slides.js';

const pad = (n) => String(n).padStart(2, '0');

/* ── Month and day keys (the browser's zone: this is what the client sees on their own calendar) ── */
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const thisMonth = (now = new Date()) => monthKey(now);
export const todayKey = (now = new Date()) => dayKey(now);
export function shiftMonth(m, by) {
  const [y, mo] = String(m).split('-').map(Number);
  return monthKey(new Date(y, mo - 1 + by, 1));
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map(m => m.slice(0, 3));
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** "December" for "2026-12". */
export function monthName(m) {
  const mo = Number(String(m).split('-')[1]);
  return MONTHS[mo - 1] || '';
}
/** "Dec 16" for "2026-12-16", or '' when it is not a date. */
export function shortDate(key) {
  const [y, mo, d] = String(key || '').split('-').map(Number);
  if (!y || !mo || !d) return '';
  return `${SHORT[mo - 1]} ${d}`;
}
const fromKey = (key) => { const [y, m, d] = String(key).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return dayKey(d); };
/** Monday first: 0 for a Monday, 6 for a Sunday. */
export const dowIndex = (key) => (fromKey(key).getDay() + 6) % 7;

/** The month as weeks of day keys, Monday first; a cell outside the month is ''. */
export function weeksOf(month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return [];
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(''), ...Array.from({ length: days }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push('');
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/* ── What an item is ── */
export const kindOf = (item) => (item?.kind === 'ad' ? 'ad' : 'post');
/** The day an item lands on: an ad's start, else its date. */
export const whenOf = (item) => (kindOf(item) === 'ad' ? (item?.ad?.startDate || item?.date || '') : (item?.date || ''));
export const byWhen = (a, b) => (whenOf(a) || '9999').localeCompare(whenOf(b) || '9999') || String(a.time || '').localeCompare(String(b.time || ''));

/** The status in the planner's own terms (Planner v2 design rules): needs (review, red), approved (blue), done (posted or live, green),
 *  changes (making with their change request, amber), making (neutral; a planned ad is making too), finished (neutral). */
export function statusKey(item) {
  const s = item?.status || 'making';
  if (s === 'review') return 'needs';
  if (s === 'approved') return 'approved';
  if (s === 'posted' || s === 'live') return 'done';
  if (s === 'finished') return 'finished';
  return item?.clientNote ? 'changes' : 'making';
}
/** The --v-status-* tone each status key reads. */
export const STATUS_TONE = { needs: 'won', approved: 'progress', done: 'booked', changes: 'new', making: 'neutral', finished: 'neutral' };

/** The dot a day carries for one item (Home's week and the Plan calendar): red needs you, blue an ad, green posted, white a post. */
export function dotOf(item) {
  if (item?.status === 'review') return 'needs';
  if (kindOf(item) === 'ad') return 'ad';
  if (item?.status === 'posted') return 'posted';
  return 'post';
}
export const DOT_MAX = 4;
/** The dots on one day, in the order the items fall, at most four. */
export const dotsFor = (items, key) => items.filter(i => whenOf(i) === key).sort(byWhen).map(dotOf).slice(0, DOT_MAX);

/** The week that holds today, Monday to Sunday, each day with its dots. */
export function weekDots(items, today) {
  const monday = addDays(today, -dowIndex(today));
  return DOW.map((dow, i) => {
    const key = addDays(monday, i);
    return { key, dow, day: Number(key.slice(-2)), dots: dotsFor(items, key), isToday: key === today };
  });
}

/** What needs them: every item in review, in the order of its date. */
export const reviewQueue = (items) => items.filter(i => i.status === 'review').sort(byWhen);

/** Post today: approved posts (kind post) dated today, in time order. */
export const postToday = (items, today) => items.filter(i => kindOf(i) === 'post' && i.status === 'approved' && i.date === today).sort(byWhen);

/** The month so far: posts ready (approved or posted) out of the plan, and how many are up. Ads are Rob's to run and do not count. */
export function monthProgress(items, postsPerMonth = 8) {
  const posts = items.filter(i => kindOf(i) === 'post');
  const ready = posts.filter(i => i.status === 'approved' || i.status === 'posted').length;
  const posted = posts.filter(i => i.status === 'posted').length;
  const of = Math.max(1, Number(postsPerMonth) || 8);
  return { ready, posted, of, pct: Math.min(100, Math.round((ready / of) * 100)) };
}

/** The live ad, the first one running. */
export const liveAd = (items) => items.filter(i => kindOf(i) === 'ad' && i.status === 'live').sort(byWhen)[0] || null;

const num = (n) => Number(n || 0).toLocaleString('en-US');
/** One plain sentence from an ad's results: "3,280 people saw it and 24 asked for a quote." '' when nothing is in yet. */
export function adSentence(ad) {
  const r = ad?.results;
  if (!r) return '';
  const reach = Number(r.reach) || 0; const clicks = Number(r.clicks) || 0; const msgs = Number(r.messages) || 0;
  const second = msgs ? `${num(msgs)} asked for a quote` : clicks ? `${num(clicks)} tapped it` : '';
  if (reach && second) return `${num(reach)} people saw it and ${second}.`;
  if (reach) return `${num(reach)} people saw it.`;
  if (msgs) return `${num(msgs)} people asked for a quote.`;
  if (clicks) return `${num(clicks)} people tapped it.`;
  return '';
}
/** The stat tiles (Ads): people saw it, tapped, messaged or asked for a quote; a tile with no number does not render. */
export function adTiles(ad) {
  const r = ad?.results || {};
  return [
    { id: 'reach', label: 'People saw it', value: Number(r.reach) || 0 },
    { id: 'clicks', label: 'Tapped', value: Number(r.clicks) || 0 },
    { id: 'messages', label: 'Messaged or asked for a quote', value: Number(r.messages) || 0 },
  ].filter(t => t.value > 0).map(t => ({ ...t, text: num(t.value) }));
}
/** The spend bar: spent out of the budget, only when Rob shows the budget (the read carries budget only then). */
export function adSpend(ad) {
  if (ad?.budget == null || !(Number(ad.budget) > 0)) return null;
  const spent = Number(ad.results?.spend) || 0;
  return { budget: Number(ad.budget), spent, pct: Math.min(100, Math.round((spent / Number(ad.budget)) * 100)) };
}
/** Ads in three groups: the live ones, coming up (planned, in review, approved) and finished. */
export function adGroups(items) {
  const ads = items.filter(i => kindOf(i) === 'ad').sort(byWhen);
  return { live: ads.filter(a => a.status === 'live'), coming: ads.filter(a => ['making', 'review', 'approved'].includes(a.status || 'making')), finished: ads.filter(a => a.status === 'finished') };
}

/** The Feed (Plan): how their profile will look. Posts only, never ads; the month's posts still to go up, newest first, then up to six
 *  already posted ones, newest first. Only the loaded month is known, so the posted ones are this month's. */
export const FEED_POSTED_MAX = 6;
export function feedOrder(items) {
  const posts = items.filter(i => kindOf(i) === 'post');
  const desc = (a, b) => (!whenOf(a) - !whenOf(b)) || byWhen(b, a); // newest first, an undated post last
  const upcoming = posts.filter(p => p.status !== 'posted').sort(desc);
  const posted = posts.filter(p => p.status === 'posted').sort(desc).slice(0, FEED_POSTED_MAX);
  return [...upcoming, ...posted];
}

/** List (Plan): the month grouped by week, Monday first; anything without a date last. */
export function groupByWeek(items, month) {
  const weeks = weeksOf(month);
  const groups = weeks.map((w) => ({ key: w.find(Boolean), items: [] }));
  const undated = [];
  for (const it of [...items].sort(byWhen)) {
    const k = whenOf(it);
    const i = k ? weeks.findIndex(w => w.includes(k)) : -1;
    if (i < 0) undated.push(it); else groups[i].items.push(it);
  }
  const out = groups.filter(g => g.items.length).map(g => ({ key: g.key, label: `Week of ${shortDate(addDays(g.key, -dowIndex(g.key)))}`, items: g.items }));
  if (undated.length) out.push({ key: 'undated', label: 'No date yet', items: undated });
  return out;
}

/** The idea tracker (Ideas): Sent, Seen, In the plan, Made, and how far along it is. A declined idea stops after Seen. */
export const IDEA_STEPS = ['sent', 'seen', 'plan', 'made'];
export function ideaProgress(s) {
  const status = s?.status || 'new';
  const seen = !!s?.seen || status !== 'new';
  const plan = status === 'planned';
  const made = plan && !!s?.made;
  const reached = made ? 4 : plan ? 3 : seen ? 2 : 1;
  const state = status === 'declined' ? 'declined' : made ? 'made' : plan ? 'plan' : seen ? 'seen' : 'sent';
  return { reached, state, steps: IDEA_STEPS.map((id, i) => ({ id, done: i < reached && !(status === 'declined' && i > 1) })) };
}

/** Can they post it now: an approved post of kind post, dated today or earlier. */
export const canPostIt = (item, today) => kindOf(item) === 'post' && item?.status === 'approved' && !!item?.date && item.date <= today;
/** The four Post it steps, each with whether it can be done here: Save the picture (a picture or video they may download), Copy the
 *  caption (words to copy), Open Instagram, I posted it. */
export function postItSteps(item) {
  const media = !!(item?.video?.url || slidesOf(item).length || item?.video?.poster);
  return [
    { id: 'save', available: media && item?.allowDownload !== false },
    { id: 'copy', available: !!captionText(item) },
    { id: 'open', available: true },
    { id: 'posted', available: true },
  ];
}
/** The words they paste: the caption, then the hashtags. */
export function captionText(item) {
  return [String(item?.caption || '').trim(), String(item?.hashtags || '').trim()].filter(Boolean).join('\n\n');
}

/** The timeline on a post page: Rob made it; waiting for their yes or they approved it; posted or goes up on its date. */
export function timelineOf(item) {
  const s = item?.status || 'making';
  const asked = s === 'making' && !!item?.clientNote;
  return [
    { id: 'made', done: s !== 'making' || asked },
    { id: s === 'review' || s === 'making' ? 'waiting' : 'approved', done: ['approved', 'posted', 'live', 'finished'].includes(s) },
    { id: s === 'posted' ? 'posted' : 'goesUp', done: s === 'posted', at: s === 'posted' ? String(item?.postedAt || '').slice(0, 10) : (item?.date || '') },
  ];
}

/** Which earlier draft to show (the post page's First draft / New version): the newest version only, as the read carries it. */
export const hasPrevious = (item) => !!(item?.previous && (slidesOf(item.previous).length || item.previous.caption));
