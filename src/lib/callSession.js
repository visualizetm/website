import { objectionCard, followUpText, FOLLOW_UP_DAYS } from '../shared/callScript.js';

/* The call session's pure logic (prompt 2 of 3, milestone 5): what the Queue's prep card, the Summary and the record's cards say.
 * A session is { ids, idx, stats, logged: { [id]: outcome }, startedAt } (AdminCalls keeps it in localStorage). */

/** The prep card's facts: the Google rating and count, Instagram, the website's state, the best window, one drop line. */
export function prepFacts(lead) {
  const r = lead?.reviews?.latest?.count ? lead.reviews.latest : lead?.reviews?.baseline?.count ? lead.reviews.baseline : null;
  const fromIntel = (lead?.intel?.accomplishments || []).find(a => /star|review/i.test(String(a)));
  const site = lead?.socials?.website || '';
  const gaps = (lead?.intel?.gaps || []).map(String);
  const siteGap = gaps.find(g => /site|website|load|phone|dead|expired/i.test(g));
  return {
    rating: r ? `${Number(r.rating).toFixed(1)} on ${r.count} review${r.count === 1 ? '' : 's'}` : fromIntel ? String(fromIntel) : '',
    instagram: lead?.socials?.instagram || '',
    website: site ? (siteGap ? `Site: ${siteGap}` : 'Site: up') : 'No site',
    window: lead?.bestWindow || '',
    drop: (lead?.intel?.dropLines || []).map(String).find(Boolean) || '',
  };
}

/** The Summary's numbers: dialed, answered (connects), asked, booked, the ask rate (booked of asked). */
export function sessionSummary(session, leadsById) {
  const s = session?.stats || {};
  const dialed = Number(s.calls) || 0;
  const answered = Math.max(0, dialed - (Number(s.noAnswer) || 0) - (Number(s.wrongNumber) || 0));
  const ids = session?.ids || [];
  const leads = ids.map(id => leadsById?.get?.(id) || leadsById?.[id]).filter(Boolean);
  const booked = ids.filter(id => session?.logged?.[id] === 'booked');
  const asked = leads.filter(l => (Number(l.afterCall?.asks) || 0) > 0 || session?.logged?.[l._id] === 'booked').length;
  const askRate = asked ? Math.round((booked.length / asked) * 100) : 0;
  return { dialed, answered, asked, booked: booked.length, askRate, bookedRows: booked.map(id => leadsById?.get?.(id) || leadsById?.[id]).filter(Boolean) };
}
/** "Ask rate 50%, up from 33% last session" or the first session's line. */
export function askRateLine(cur, last) {
  if (!cur.asked) return 'No asks yet. Every connect is a chance to ask.';
  if (!last || typeof last.askRate !== 'number') return `Ask rate ${cur.askRate}% (${cur.booked} of ${cur.asked} asked). First session on record.`;
  const d = cur.askRate - last.askRate;
  return `Ask rate ${cur.askRate}% (${cur.booked} of ${cur.asked} asked), ${d > 0 ? `up ${d} points from` : d < 0 ? `down ${-d} points from` : 'the same as'} last session${d === 0 ? ` (${last.askRate}%)` : ''}.`;
}
/** No decision: they talked (a callback logged) and nothing was decided; those get the day 1, 3 and 7 follow ups. */
export const noDecisionIds = (session) => (session?.ids || []).filter(id => session?.logged?.[id] === 'callback');
/** The saved concern for the follow ups: the objection they raised, else their own words. */
export function concernOf(lead) {
  const id = lead?.afterCall?.objection;
  if (id) { const c = objectionCard(lead, id); if (c) return c.said.replace(/\.$/, ''); }
  return String(lead?.afterCall?.whatTheySaid || '').trim();
}
/** The three text drafts for one lead: { day, subject, body }. */
export const followUpDrafts = (lead) => FOLLOW_UP_DAYS.map(day => ({ day, subject: `Follow up, day ${day}`, body: followUpText(lead, day, concernOf(lead)) }));
export const LAST_SESSION_KEY = 'vz_call_last_session';
