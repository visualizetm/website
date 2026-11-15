#!/usr/bin/env node
/* Billy on Rob's side, the pure half (src/lib/team.js): the Booked by Billy card's facts, the tag on the home's rows,
 * Billy's day (the chips, a row's words, a batch and its Undo, the one lead a row opens), the times and the last seen line.
 *   node scripts/team-test.mjs */
import * as T from '../src/lib/team.js';

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const NOW = Date.parse('2026-11-16T19:30:00Z'); // Monday 2:30 PM in New York
const iso = (t) => new Date(t).toISOString();

console.log('\n1. The record: Booked by Billy');
{
  const log = [
    { at: iso(NOW - 5 * 864e5), outcome: 'no-answer', note: "Rob's own call note" },
    { at: iso(NOW - 3 * 864e5), outcome: 'no-answer', note: 'Left a voicemail.', by: 'billy' },
    { at: iso(NOW - 864e5), outcome: 'booked', note: 'Wants a new sign before spring.', by: 'billy' },
  ];
  const lead = { _id: 'L1', business: 'Kims Cafe', stage: 'booked', bookedBy: { who: 'billy', at: iso(NOW - 864e5) }, callLog: log };
  const b = T.bookedByBilly(lead);
  ok(!!b && b.name === 'Billy' && b.at === lead.bookedBy.at && b.notes === 'Wants a new sign before spring.', 'the card carries when he booked it and the notes from that call');
  ok(b.calls.length === 2 && b.calls.every(c => !/Rob's own/.test(c.note)) && b.calls[0].label === 'No answer' && b.calls[1].label === 'Booked', 'and his calls on the lead only, never one of Rob\'s');
  ok(T.bookedByBilly({ ...lead, bookedBy: null }) === null && T.bookedByBilly({ ...lead, bookedBy: { who: 'rob', at: 'x' } }) === null && T.bookedByBilly(null) === null, 'a lead he did not book has no card');
  ok(T.bookedByBilly({ bookedBy: { who: 'billy', at: '' } }).notes === '' && T.bookedByBilly({ bookedBy: { who: 'billy' }, callLog: 'junk' }).calls.length === 0, 'an older or odd record still reads: no notes, no calls, no throw');
  ok(T.bookedTag(lead) === 'Booked by Billy' && T.bookedTag({ ...lead, stage: 'deal' }) === '' && T.bookedTag({ ...lead, stage: 'client' }) === '' && T.bookedTag({ ...lead, bookedBy: null }) === '', 'the home tag shows while the booking is still ahead, and only on his');
}

console.log("\n2. Billy's day: chips and rows");
{
  const row = (i, minsAgo, kind, business, detail = {}, leadIds = ['L1']) => ({ id: `r${i}`, at: iso(NOW - minsAgo * 60e3), who: 'billy', kind, leadIds, business, detail, undone: [] });
  const rows = [
    row(1, 90, 'sort', 'Kims Cafe', { op: 'accept', list: 'Dover shops' }),
    row(2, 10, 'booked', 'Kims Cafe', { outcome: 'booked', note: 'Wants a sign' }),
    row(3, 30, 'call', 'Sharp Line', { outcome: 'callback', note: 'After lunch' }),
    row(4, 50, 'sort', '2 leads', { op: 'decline', reason: 'has-site', note: 'New sites', before: [{ id: 'L7', business: 'Seven', stage: 'lead' }, { id: 'L8', business: 'Eight', stage: 'triage' }] }, ['L7', 'L8']),
    row(5, 70, 'contact', 'Nine Co', { fields: ['phone', 'owner'] }),
    row(6, 120, 'session', 'Dover shops', { list: 'Dover shops', calls: 12, talked: 5, booked: 1 }, []),
    row(7, 40, 'call', 'Ten Co', { outcome: 'no', reason: 'budget', note: 'Too pricey', before: [{ id: 'L10', business: 'Ten Co', stage: 'lead' }] }, ['L10']),
    row(8, 100, 'sort', 'Dover shops', { op: 'new-list', list: 'Dover shops', added: 12, calls: 'rob' }, []),
  ];
  const all = T.dayRows(rows);
  ok(all.length === 8 && all[0].id === 'r2' && all[all.length - 1].id === 'r6', 'rows read newest first');
  const c = T.chipCounts(rows);
  ok(T.DAY_CHIPS.map(x => x.label).join() === 'All,Calls,Booked,Sorting' && c.all === 8 && c.calls === 2 && c.booked === 1 && c.sorting === 4, `the chips: All, Calls, Booked, Sorting (${JSON.stringify(c)})`);
  ok(T.dayRows(rows, 'calls').map(r => r.id).join() === 'r3,r7' && T.dayRows(rows, 'booked').map(r => r.id).join() === 'r2' && T.dayRows(rows, 'sorting').map(r => r.id).join() === 'r4,r5,r1,r8', 'each chip keeps its own rows');
  ok(T.DAY_RANGES.map(x => x.label).join() === 'Today,Yesterday,Week', 'the ranges: Today, Yesterday, Week');
  const w = (i) => T.rowWords(rows[i - 1]);
  ok(w(2).title === 'Booked Kims Cafe' && w(2).detail === 'Wants a sign', 'a booking: who, and his note');
  ok(w(3).title === 'Call back set: Sharp Line' && w(3).detail === 'After lunch' && /^Not interested: Ten Co$/.test(w(7).title) && /Too pricey/.test(w(7).detail), 'a call names its outcome and the business');
  ok(w(1).title === 'Accepted Kims Cafe' && w(1).detail === 'Onto Dover shops' && w(4).title === 'Declined 2 leads' && /New sites/.test(w(4).detail), 'sorting: an accept names the list, a batch decline counts its leads');
  ok(w(5).title === 'Fixed the phone and owner: Nine Co' && /12 calls, 5 talked, 1 booked/.test(w(6).detail) && w(8).title === 'New list: Dover shops' && /12 leads, Rob calls it/.test(w(8).detail), 'the contact fix, a session and a new list read plainly');
  ok(rows.every(r => { const x = T.rowWords(r); return x.title && !/undefined|null/.test(x.title + x.detail) && !/\u2014/.test(x.title + x.detail); }) && T.rowWords({}).title === 'A lead', 'no row ever reads undefined, and an empty one still has words');
  ok(T.isBatch(rows[3]) && T.isBatch(rows[6]) && !T.isBatch(rows[0]) && !T.isBatch(rows[1]), 'a decline (sorted or said on a call) is a batch; nothing else is');
  const bl = T.batchLeads({ ...rows[3], undone: ['L8'] });
  ok(bl.length === 2 && bl[0].id === 'L7' && bl[0].undone === false && bl[1].undone === true && bl[1].stage === 'triage', 'a batch lists its leads with where each stood, and marks the ones already put back');
  ok(T.rowLeadId(rows[1]) === 'L1' && T.rowLeadId(rows[2]) === 'L1' && T.rowLeadId(rows[3]) === '' && T.rowLeadId(rows[5]) === '' && T.rowLeadId(rows[7]) === '' && T.rowLeadId(rows[6]) === '', 'a row opens its one lead; a batch, a session and a list row open none');
}

console.log('\n3. Times, in New York');
{
  ok(T.rowTime(iso(NOW)) === '2:30 PM' && T.rowTime(iso(NOW), 'week') === 'Mon 2:30 PM' && T.rowTime('') === '' && T.rowTime('junk') === '', 'a row\'s time is the New York clock, with the day in the week view');
  ok(T.lastSeenLine('', NOW) === 'Has not signed in yet' && T.lastSeenLine(iso(NOW - 30e3), NOW) === 'Seen just now' && T.lastSeenLine(iso(NOW - 12 * 60e3), NOW) === 'Seen 12 minutes ago', 'last seen: never, just now, minutes ago');
  ok(T.lastSeenLine(iso(NOW - 3 * 3600e3), NOW) === 'Seen today at 11:30 AM' && T.lastSeenLine(iso(NOW - 4 * 864e5), NOW) === 'Seen Nov 12', 'last seen: earlier today, or the day');
}

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
