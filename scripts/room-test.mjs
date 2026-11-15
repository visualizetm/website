#!/usr/bin/env node
/* Billy's Call Room, the pure half (part 1 of 2): src/room/roomLib.js and the script lines as a caller who is not the owner
 * reads them (src/shared/callScript.js). The greeting by the hour, the Callbacks tab's sections (only what Billy set, only
 * leads he called), Start calling's order (the callbacks due now first, then the list), the triage pile (highest score
 * first, Not now to the back), the Leads search and chips, the filter fill counted before it is written, "N left of M",
 * the session's numbers and what is still to do, the open times by day, and that no line a lead reads says "we".
 *   node scripts/room-test.mjs */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const L = await import(pathToFileURL(path.join(root, 'src/room/roomLib.js')).href);
const cs = await import(pathToFileURL(path.join(root, 'src/shared/callScript.js')).href);

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);
const ny = (y, m, d, h, min = 0) => cs.nyMs(y, m, d, h, min);
const NOW = ny(2026, 11, 16, 14, 30); // a Monday, 2:30 PM New York
const iso = (t) => new Date(t).toISOString();
const lead = (id, over = {}) => ({ id, business: `Shop ${id}`, type: 'Barber', city: 'Dover', owner: '', phone: '3025550100', score: 50, stage: 'lead', listId: '', callStatus: 'not-called', callbackAt: '', callLog: [], found: { at: iso(NOW - 864e5), where: 'scraper' }, intel: { gaps: [], accomplishments: [], dropLines: [] }, script: {}, ...over });
const mine = (outcome, at) => ({ who: 'billy', at: iso(at), outcome, note: '' });
const robs = (outcome, at) => ({ who: 'rob', at: iso(at), outcome });

section('1. Today');
ok(L.greeting('Billy', ny(2026, 11, 16, 8)) === 'Morning, Billy.' && L.greeting('Billy', ny(2026, 11, 16, 12)) === 'Afternoon, Billy.' && L.greeting('Billy', ny(2026, 11, 16, 16, 59)) === 'Afternoon, Billy.' && L.greeting('Billy', ny(2026, 11, 16, 17)) === 'Evening, Billy.', 'Morning before noon, Afternoon until five, Evening after, by the New York clock');
ok(L.dateLine(NOW) === 'Monday, November 16', `the date line (${L.dateLine(NOW)})`);
ok(L.tomorrowNine(NOW) === iso(ny(2026, 11, 17, 9)), 'the default callback is tomorrow at 9:00 AM New York');
ok(L.tomorrowNine(ny(2026, 10, 31, 23, 30)) === iso(ny(2026, 11, 1, 9)) && L.tomorrowNine(ny(2026, 3, 7, 12)) === iso(ny(2026, 3, 8, 9)), 'and it holds across the November and March clock changes');
ok(L.whenLine(iso(ny(2026, 11, 16, 15, 30)), NOW) === 'Today 3:30 PM' && L.whenLine(iso(ny(2026, 11, 17, 9)), NOW) === 'Tomorrow 9:00 AM' && /^Thu, Nov 19 at 10:00 AM$/.test(L.whenLine(iso(ny(2026, 11, 19, 10)), NOW)), 'a time reads Today, Tomorrow, or its day');

section('2. Callbacks: only what Billy set, only leads he called');
{
  const leads = [
    lead('due', { callStatus: 'callback', callbackAt: iso(NOW - 600e3), callLog: [mine('callback', NOW - 864e5)] }),
    lead('later', { callStatus: 'callback', callbackAt: iso(ny(2026, 11, 16, 17)), callLog: [mine('callback', NOW - 864e5)] }),
    lead('tom', { callStatus: 'callback', callbackAt: iso(ny(2026, 11, 17, 9)), callLog: [robs('no-answer', NOW - 2 * 864e5), mine('callback', NOW - 864e5)] }),
    lead('far', { callStatus: 'callback', callbackAt: iso(ny(2026, 11, 20, 9)), callLog: [mine('callback', NOW - 864e5)] }),
    lead('robs', { callStatus: 'callback', callbackAt: iso(NOW - 600e3), callLog: [robs('callback', NOW - 864e5)] }),
    lead('retry', { callStatus: 'no-answer', callLog: [mine('no-answer', NOW - 3600e3)] }),
    lead('robretry', { callStatus: 'no-answer', callLog: [mine('no-answer', NOW - 864e5), robs('no-answer', NOW - 3600e3)] }),
    lead('none'),
  ];
  const s = L.callbackSections(leads, NOW);
  const ids = (a) => a.map(l => l.id).join();
  ok(ids(s.dueNow) === 'due' && ids(s.laterToday) === 'later' && ids(s.tomorrow) === 'tom' && ids(s.later) === 'far', `Due now, Later today, Tomorrow and further out (${ids(s.dueNow)} | ${ids(s.laterToday)} | ${ids(s.tomorrow)} | ${ids(s.later)})`);
  ok(ids(s.retry) === 'retry', 'No answer, try again is the leads whose last call was his and rang out');
  ok(![...s.dueNow, ...s.laterToday, ...s.tomorrow, ...s.later, ...s.retry].some(l => l.id === 'robs' || l.id === 'robretry'), 'a callback Rob set and a retry on Rob\'s call are not Billy\'s');
  ok(L.callbacksCount(leads, NOW) === 1, 'the Callbacks tab badge counts what is due now');
  const list = { id: 'A', leadIds: ['none', 'due', 'gone', 'retry'], callerId: 'billy' };
  ok(L.startQueue(list, leads, NOW).join() === 'due,none,retry', `Start calling: the callbacks due now first, then the list, each lead once (${L.startQueue(list, leads, NOW).join()})`);
  ok(L.startQueue(null, leads, NOW).join() === 'due', 'with no list it is the callbacks alone');
}

section('3. Lists');
{
  const lists = [
    { id: 'old', name: 'Old', callerId: 'billy', leadIds: ['a'], target: 4, createdAt: iso(NOW - 5 * 864e5) },
    { id: 'new', name: 'New', callerId: 'billy', leadIds: ['b', 'c'], target: 2, createdAt: iso(NOW - 864e5) },
    { id: 'empty', name: 'Empty', callerId: 'billy', leadIds: [], target: 25, createdAt: iso(NOW) },
    { id: 'rob', name: 'Robs', callerId: 'rob', leadIds: ['d'], target: 25, createdAt: iso(NOW - 2 * 864e5) },
    { id: 'sys', name: 'Callbacks due', system: true, callerId: '', leadIds: ['e'], target: 500, createdAt: iso(NOW - 30 * 864e5) },
  ];
  ok(L.yourList(lists).id === 'new', 'Your list is the newest list Billy calls that has someone on it');
  ok(L.leftLine(lists[0]) === '1 left of 4' && L.listProgress(lists[0]) === 75 && L.leftLine(lists[1]) === '2 left of 2' && L.listProgress(lists[1]) === 0, '"N left of M" and its progress');
  ok(L.callerPill(lists[0]) === 'Billy calls it' && L.callerPill(lists[3]) === 'Rob calls it' && L.callerPill(lists[4]) === 'Fills itself', 'the caller pill, and Callbacks due says Fills itself');
  ok(L.listsInOrder(lists).map(l => l.id).join() === 'empty,new,old,rob,sys' && L.targetLists(lists).map(l => l.id).join() === 'empty,new,rob,old', 'lists newest first: his, then Rob\'s, then Callbacks due; targets never include the system list');
  ok(L.onRobList(lead('x', { listId: 'rob' }), lists)?.id === 'rob' && L.onRobList(lead('y', { listId: 'new' }), lists) === null && L.onRobList(lead('z'), lists) === null, 'a lead on a list Rob calls is known');
}

section('4. Triage');
{
  const pile = L.triagePile([lead('low', { stage: 'triage', score: 30 }), lead('top', { stage: 'triage', score: 90 }), lead('snz', { stage: 'triage', score: 99, triageSnoozedAt: iso(NOW - 60e3) }), lead('snz0', { stage: 'triage', score: 10, triageSnoozedAt: iso(NOW - 3600e3) }), lead('lead'), lead('mid', { stage: 'triage', score: 60 })]);
  ok(pile.map(l => l.id).join() === 'top,mid,low,snz0,snz', `highest score first; Not now goes to the back of the pile, oldest snooze first (${pile.map(l => l.id).join()})`);
  ok(L.foundLine(lead('a', { found: { at: iso(ny(2026, 11, 12, 10)), where: 'scraper' } })) === 'Found Nov 12 by the nightly scraper' && /^Added by hand/.test(L.foundLine(lead('b', { found: { at: '', where: 'hand' } }))), 'when and where it was found');
  ok(L.ratingLine({ rating: 4.8, reviews: 212 }) === '4.8 on 212 reviews' && L.ratingLine({ rating: null, reviews: 0 }) === '', 'the Google rating and review count, or nothing');
  ok(L.websiteLine({ website: 'none', intel: {} }) === 'No website' && /^Website is down/.test(L.websiteLine({ website: 'dead', intel: { gaps: ['The site is dead (404)'] } })) && L.websiteLine({ website: 'up', intel: { gaps: [] } }) === 'Has a website', 'the website status in words');
}

section('5. Leads: search, chips, the filter fill');
{
  const lists = [{ id: 'rob', callerId: 'rob', leadIds: ['r'] }, { id: 'me', callerId: 'billy', leadIds: ['m'] }];
  const leads = [lead('r', { listId: 'rob', business: 'Kims Cafe', city: 'Dover', owner: 'Kim', type: 'Cafe' }), lead('m', { listId: 'me', city: 'Smyrna' }), lead('f', { owner: 'Dana' }), lead('t', { stage: 'triage' }), lead('n', { stage: 'nurture', type: 'Cafe' })];
  ok(L.filterLeads(leads, lists, { q: 'kim' }).map(l => l.id).join() === 'r' && L.filterLeads(leads, lists, { q: 'smyrna' }).map(l => l.id).join() === 'm' && L.filterLeads(leads, lists, { q: 'dana' }).map(l => l.id).join() === 'f', 'the search reads the name, the city and the owner');
  const c = L.chipCounts(leads, lists);
  ok(c.all === 5 && c.nolist === 3 && c.rob === 1, `the chips count All, No list and Rob's list (${JSON.stringify(c)})`);
  const p = L.fillPreview(leads, lists, { types: ['barber'] });
  ok(p.match === 2 && p.onList === 1 && p.add === 1, `a filter fill counts leads only: who matches, who is on a list already, who will be added (${JSON.stringify(p)})`);
  ok(L.fillLine({ match: 34, onList: 6, add: 28 }) === '34 leads match. 6 are on a list already and stay where they are. 28 will be added.', 'and says it the way the sheet does');
  ok(L.fillLine({ match: 1, onList: 1, add: 0 }) === '1 lead matches. 1 is on a list already and stays where it is. 0 will be added.' && L.fillLine({ match: 0, onList: 0, add: 0 }) === 'No leads match yet.', 'in the singular too, and when nothing matches');
  ok(L.fillPreview(leads, lists, { noList: true }).match === 1, 'No list yet narrows the match to leads on no list');
  ok(L.facet(leads, 'type')[0].value === 'Barber' && L.facet(leads, 'city').map(x => x.value).includes('Smyrna'), 'the filter chips come from the leads themselves');
}

section('6. The session');
{
  let s = L.newSession({ list: { id: 'A', name: 'Dover shops' }, ids: ['a', 'b', 'c', 'd'], now: NOW });
  ok(L.sessionNext(s) === 'a' && s.list === 'Dover shops', 'the session starts on the first lead');
  s = L.sessionSkipped(s, 'a');
  ok(s.ids.join() === 'b,c,d,a' && L.sessionNext(s) === 'b', 'Skip for now sends the lead to the end of today\'s queue');
  s = L.sessionLogged(s, 'b', 'no-answer', { voicemail: true });
  s = L.sessionLogged(s, 'c', 'callback');
  s = L.sessionLogged(s, 'd', 'no');
  s = L.sessionLogged(s, 'z', 'booked');
  ok(L.sessionNext(s, 'd') === 'a', 'the skipped lead comes up last');
  s = L.sessionLogged(s, 'a', 'wrong-number');
  const st = L.sessionStats(s);
  ok(st.calls === 5 && st.talked === 3 && st.booked === 1 && st.callbacks === 1 && st.noAnswer === 1 && st.notInterested === 1, `the six numbers (${JSON.stringify(st)})`);
  ok(L.sessionNext(s) === '' && L.sessionLine(s, NOW + 65 * 60e3) === '5 calls in 1h 05m', 'done when everyone has an outcome; "5 calls in 1h 05m"');
  ok(L.stillToDo(s).texts.join() === 'b' && L.stillToDo(s).callbacks === 1 && L.stillToDo(L.sessionTexted(s, 'b')).texts.length === 0, 'Still to do: the voicemail text until it is sent, and the callbacks scheduled');
}

section('7. The script names the caller');
{
  const billy = { name: 'Billy', owner: false };
  ok(/^I'm Rob, I run Visualize/.test(cs.scriptLine({}, 'intro')) && cs.scriptLine({}, 'intro') === cs.V2.intro, 'the console, passing nothing, still reads the owner\'s line');
  ok(/^I'm Billy with Visualize/.test(cs.scriptLine({}, 'intro', billy)) && /it's Billy from Visualize/.test(cs.scriptLine({}, 'noAnswer', billy)) && /it's Billy from Visualize/.test(cs.voicemailText({}, billy)), 'Billy\'s lines say Billy');
  const spoken = ['confirm', 'intro', 'homework', 'question', 'hook', 'ask', 'lockIt', 'ifNo', 'noAnswer', 'voicemail'].map(k => cs.scriptLine({}, k, billy));
  ok(spoken.every(l => l.length > 10 && !/\{\{/.test(l)), 'every step has a line and no token is left unfilled');
  ok(spoken.every(l => !/\b(I'm|it's|this is) Rob\b/i.test(l)), 'none of them has Billy saying he is Rob');
  ok(cs.scriptLine({ script: { intro: "Hey, it's Rob from Visualize." } }, 'intro', billy) === "Hey, it's Billy from Visualize." && cs.scriptLine({ script: { intro: "Hey, it's Rob from Visualize." } }, 'intro') === "Hey, it's Rob from Visualize.", 'a lead\'s own line written for the owner is said in the caller\'s name; the owner reads it as written');
  ok(cs.ROOM_STEPS.length === 8 && cs.ROOM_STEPS.map(s => s.id).join() === 'answer,owner,open,homework,question,hook,ask,close', 'the room\'s eight steps: answer, owner\'s name, open, homework, question, hook, ask, close');
  const src = (await import('node:fs')).readFileSync(path.join(root, 'src/shared/callScript.js'), 'utf8');
  const lines = src.slice(src.indexOf('const LINES = {'), src.indexOf('const callerOf'));
  ok(!/\bRob\b|\bBilly\b/.test(lines), 'no line in the script module is written with either name');
  const read = [cs.voicemailText({}, billy), L.bookedText({ owner: 'Kim Park' }, iso(ny(2026, 11, 19, 10)), 'Billy', 'Rob')];
  ok(read.every(t => !/\bwe\b|\bwe'|\bour\b/i.test(t)) && /it's Billy from Visualize/.test(read[1]) && /Thursday, November 19 at 10:00 AM/.test(read[1]) && /^Hey Kim,/.test(read[1]), `what a lead reads says I, never we ("${read[1].slice(0, 60)}...")`);
}

section('8. Open times');
{
  const slots = [iso(ny(2026, 11, 17, 10)), iso(ny(2026, 11, 17, 10, 30)), iso(ny(2026, 11, 19, 14)), iso(NOW - 3600e3), iso(ny(2026, 11, 16, 16))];
  const days = L.slotDays(slots, NOW);
  ok(days.map(d => d.label).join('|') === 'Today|Tomorrow|Thu, Nov 19' && days[1].slots.map(s => s.label).join() === '10:00 AM,10:30 AM' && days[0].slots.length === 1, `slots group by their New York day, past ones dropped (${days.map(d => d.label).join('|')})`);
  ok(L.slotLine(iso(ny(2026, 11, 19, 14)), NOW) === 'Thu, Nov 19 2:00 PM' && L.slotLine(iso(ny(2026, 11, 17, 10)), NOW) === 'Tomorrow 10:00 AM', 'the Book button names the day and the time');
}

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
