#!/usr/bin/env node
/* The client planner's pure logic (src/lib/plannerView.js, Planner v2 part 1):
 * week dots, the review queue, the feed order, the idea tracker, the Post it
 * steps, the month progress, the ad sentence and the timeline.
 *   node scripts/planner-view-test.mjs
 */
import path from 'path';
import { pathToFileURL } from 'url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const V = await import(pathToFileURL(path.join(root, 'src', 'lib', 'plannerView.js')).href);

let fails = 0; let n = 0;
const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)})`);

const P = (id, date, status, extra = {}) => ({ id, kind: 'post', date, time: '', status, caption: `Post ${id}`, hashtags: '', imageUrl: 'https://img.example/x.jpg', allowDownload: true, clientNote: '', ...extra });
const A = (id, start, status, extra = {}) => ({ id, kind: 'ad', date: start, status, ad: { name: `Ad ${id}`, startDate: start }, ...extra });

/* Months, weeks, days */
eq(V.shiftMonth('2026-12', 1), '2027-01', 'December plus one is January');
eq(V.shiftMonth('2026-01', -1), '2025-12', 'January minus one is December');
eq(V.monthName('2026-12'), 'December', 'the month name');
eq(V.shortDate('2026-12-16'), 'Dec 16', 'a short date');
eq(V.shortDate('soon'), '', 'not a date is empty');
const weeks = V.weeksOf('2026-12');
eq(weeks[0], ['', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'], 'December 2026 starts on a Tuesday, Monday first');
ok(weeks.every(w => w.length === 7) && weeks.flat().filter(Boolean).length === 31, 'every week has seven cells and the month has 31 days');
eq(V.dowIndex('2026-12-21'), 0, 'a Monday is index 0');
eq(V.dowIndex('2026-12-27'), 6, 'a Sunday is index 6');
eq(V.addDays('2026-12-31', 1), '2027-01-01', 'adding a day crosses the year');
eq(V.addDays('2026-11-01', 1), '2026-11-02', 'adding a day across the November clock change is one calendar day');

/* Dots and the week */
const items = [
  P('a', '2026-12-16', 'review'),
  P('b', '2026-12-16', 'approved'),
  A('c', '2026-12-16', 'live'),
  P('d', '2026-12-17', 'posted'),
  P('e', '2026-12-14', 'making', { clientNote: 'Brighter please' }),
  A('f', '2026-12-20', 'review'),
  P('g', '', 'making'),
];
eq(V.dotsFor(items, '2026-12-16'), ['needs', 'post', 'ad'], 'a day carries red for needs you, white for a post, blue for an ad');
eq(V.dotsFor(items, '2026-12-17'), ['posted'], 'a posted post is green');
eq(V.dotsFor(items, '2026-12-20'), ['needs'], 'an ad that needs them is red, not blue');
const five = Array.from({ length: 6 }, (_, i) => P(`m${i}`, '2026-12-18', 'approved'));
eq(V.dotsFor(five, '2026-12-18').length, V.DOT_MAX, 'a day shows at most four dots');
const wk = V.weekDots(items, '2026-12-16');
eq(wk.map(d => d.key), ['2026-12-14', '2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18', '2026-12-19', '2026-12-20'], 'the week runs Monday to Sunday around today');
ok(wk[2].isToday && !wk[1].isToday && wk[2].dots.length === 3, 'today is marked and carries its dots');
eq(V.weekDots([], '2026-12-31').map(d => d.key)[6], '2027-01-03', 'a week can run into the next year');

/* Status keys */
eq(['review', 'approved', 'posted', 'live', 'finished'].map(s => V.statusKey({ status: s })), ['needs', 'approved', 'done', 'done', 'finished'], 'the status keys');
eq(V.statusKey({ status: 'making', clientNote: 'x' }), 'changes', 'making with their note is Changes sent');
eq(V.statusKey({ status: 'making' }), 'making', 'making without a note is making');
eq(V.STATUS_TONE.needs + V.STATUS_TONE.approved + V.STATUS_TONE.done + V.STATUS_TONE.changes, 'wonprogressbookednew', 'the tones: needs red, approved blue, done green, changes amber');

/* The review queue and Post today */
eq(V.reviewQueue(items).map(i => i.id), ['a', 'f'], 'the review queue is every item in review, in date order, ads included');
eq(V.reviewQueue([P('z', '', 'review'), P('y', '2026-12-02', 'review')]).map(i => i.id), ['y', 'z'], 'an undated item waits at the end of the queue');
eq(V.postToday(items, '2026-12-16').map(i => i.id), ['b'], 'Post today is an approved post dated today, never an ad or one in review');
eq(V.postToday(items, '2026-12-17').length, 0, 'a posted post is not Post today');

/* Month progress */
eq(V.monthProgress(items, 8), { ready: 2, posted: 1, of: 8, pct: 25 }, 'ready counts approved and posted posts, never ads');
eq(V.monthProgress(Array.from({ length: 12 }, (_, i) => P(`r${i}`, '2026-12-01', 'approved')), 8).pct, 100, 'the fill stops at 100');
eq(V.monthProgress([], 0).of, 8, 'a plan with no number reads as the default eight, as the server does, never a divide by zero');

/* Ads */
eq(V.liveAd(items)?.id, 'c', 'the live ad');
eq(V.adSentence({ results: { reach: 3280, clicks: 50, messages: 24 } }), '3,280 people saw it and 24 asked for a quote.', 'the plain sentence');
eq(V.adSentence({ results: { reach: 1240, clicks: 38, messages: 0 } }), '1,240 people saw it and 38 tapped it.', 'taps when nobody asked yet');
eq(V.adSentence({ results: { reach: 0, clicks: 0, messages: 0 } }), '', 'no results, no sentence');
eq(V.adSentence({}), '', 'an ad with no results at all has no sentence');
eq(V.adTiles({ results: { reach: 3280, clicks: 0, messages: 24 } }).map(t => t.id), ['reach', 'messages'], 'a tile with no number does not render');
eq(V.adSpend({ results: { spend: 120 } }), null, 'no budget in the read, no spend bar');
eq(V.adSpend({ budget: 300, results: { spend: 120 } }), { budget: 300, spent: 120, pct: 40 }, 'the spend bar when the budget is shown');
const g = V.adGroups([A('l', '2026-12-01', 'live'), A('p', '2026-12-09', 'making'), A('r', '2026-12-05', 'review'), A('f', '2026-11-01', 'finished'), P('x', '2026-12-01', 'review')]);
ok(g.live.length === 1 && g.coming.map(a => a.id).join() === 'r,p' && g.finished.length === 1, 'ads group into live, coming up in date order, and finished; posts never');

/* Feed */
const feed = V.feedOrder([...items, ...Array.from({ length: 8 }, (_, i) => P(`p${i}`, `2026-12-0${i + 1}`, 'posted'))]);
ok(!feed.some(i => i.kind === 'ad'), 'ads never show in the feed');
const firstPosted = feed.findIndex(i => i.status === 'posted');
ok(feed.slice(0, firstPosted).every(i => i.status !== 'posted') && feed.slice(firstPosted).every(i => i.status === 'posted'), 'the posts still to go up come first, then the posted ones');
eq(feed.slice(0, firstPosted).map(i => i.id), ['a', 'b', 'e', 'g'], 'the upcoming posts are newest first, undated last');
eq(feed.slice(firstPosted).length, V.FEED_POSTED_MAX, 'at most six posted ones');
eq(feed.slice(firstPosted).map(i => i.id).slice(0, 2), ['d', 'p7'], 'the posted ones are newest first');

/* List by week */
const byWeek = V.groupByWeek(items, '2026-12');
eq(byWeek.map(w => w.label), ['Week of Dec 14', 'No date yet'], 'the list groups by week, Monday first, with the undated last');
eq(byWeek[0].items.map(i => i.id), ['e', 'a', 'b', 'c', 'd', 'f'], 'a week keeps date order');
eq(V.groupByWeek([P('one', '2026-12-01', 'review')], '2026-12')[0].label, 'Week of Nov 30', 'the first week is named by its Monday, even in the month before');

/* Ideas */
eq(V.ideaProgress({ status: 'new', seen: false }).reached, 1, 'a new idea has reached Sent');
eq(V.ideaProgress({ status: 'new', seen: true }).state, 'seen', 'Rob opened it: Seen');
eq(V.ideaProgress({ status: 'planned', seen: false }).reached, 3, 'planned counts as seen and in the plan');
eq(V.ideaProgress({ status: 'planned', made: true }).steps.map(s => s.done), [true, true, true, true], 'made: all four steps');
eq(V.ideaProgress({ status: 'new', made: true }).reached, 1, 'made does not count until it is planned');
eq(V.ideaProgress({ status: 'declined', made: true }).steps.map(s => s.done), [true, true, false, false], 'declined stops after Seen');
eq(V.ideaProgress({ status: 'declined' }).state, 'declined', 'declined has its own state');

/* Post it */
ok(V.canPostIt(P('q', '2026-12-16', 'approved'), '2026-12-16'), 'an approved post dated today can be posted');
ok(V.canPostIt(P('q', '2026-12-10', 'approved'), '2026-12-16'), 'and one dated earlier');
ok(!V.canPostIt(P('q', '2026-12-17', 'approved'), '2026-12-16'), 'not one dated tomorrow');
ok(!V.canPostIt(P('q', '', 'approved'), '2026-12-16'), 'not one with no date');
ok(!V.canPostIt(P('q', '2026-12-16', 'review'), '2026-12-16'), 'not one still in review');
ok(!V.canPostIt(A('q', '2026-12-16', 'approved'), '2026-12-16'), 'never an ad');
eq(V.postItSteps(P('s', '2026-12-16', 'approved')).map(s => s.id), ['save', 'copy', 'open', 'posted'], 'the four steps in order');
ok(!V.postItSteps(P('s', '2026-12-16', 'approved', { allowDownload: false }))[0].available, 'Save the picture honours allowDownload');
ok(!V.postItSteps(P('s', '2026-12-16', 'approved', { imageUrl: '' }))[0].available, 'nothing to save without a picture');
ok(!V.postItSteps(P('s', '2026-12-16', 'approved', { caption: '', hashtags: '' }))[1].available, 'nothing to copy without words');
eq(V.captionText({ caption: ' Peach dumplings ', hashtags: '#peach #friday' }), 'Peach dumplings\n\n#peach #friday', 'the copied text is the caption then the hashtags');
eq(V.captionText({ caption: '', hashtags: '#peach' }), '#peach', 'hashtags alone');

/* Timeline */
eq(V.timelineOf(P('t', '2026-12-16', 'review')).map(s => `${s.id}:${s.done}`), ['made:true', 'waiting:false', 'goesUp:false'], 'in review: made, waiting for your yes, goes up');
eq(V.timelineOf(P('t', '2026-12-16', 'approved')).map(s => `${s.id}:${s.done}`), ['made:true', 'approved:true', 'goesUp:false'], 'approved: you approved it, goes up on its date');
eq(V.timelineOf(P('t', '2026-12-16', 'posted', { postedAt: '2026-12-16T15:00:00.000Z' }))[2], { id: 'posted', done: true, at: '2026-12-16' }, 'posted carries the day it went up');
ok(!V.hasPrevious(P('t', '', 'review')) && V.hasPrevious(P('t', '', 'review', { previous: { imageUrl: 'x', caption: '', note: '' } })), 'a previous draft shows only when the read carries one');

console.log(fails ? `\n${fails} of ${n} failing.` : `\nAll ${n} planner view checks pass.`);
process.exit(fails ? 1 : 0);
