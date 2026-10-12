#!/usr/bin/env node
/* The CRM side of the client portal (src/lib/portal.js): the link, the patches, the message, the rows and the status.   node scripts/portal-crm-test.mjs */
import * as P from '../src/lib/portal.js';
import { PORTAL_MODULES } from '../src/shared/portalModules.js';
import { buildIcs, icsDataUrl } from '../src/lib/portalIcs.js';
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) bad++; };
const lead = { _id: 'x', business: 'Sharpless Detailing', askFor: 'Dan the owner', portal: { token: 'abcdefghijklmnopqrstuvwx', views: 3, lastViewedAt: '2026-10-01T00:00:00.000Z', pin: 'hash', template: 'brand', modules: { contact: 'off' }, documents: [{ id: 'd1', label: 'A', url: 'https://a.example', kind: 'pdf' }] } };
ok(P.portalUrl(lead) === 'https://visualizestudio.org/c/abcdefghijklmnopqrstuvwx' && P.portalUrl({}) === '', 'the link is the base plus the token, empty without one');
ok(JSON.stringify(P.generatePortalPatch(lead)) === '{"portal":{"regenerate":false}}' && JSON.stringify(P.generatePortalPatch(lead, true)) === '{"portal":{"regenerate":true}}', 'generate and regenerate send only the flag');
ok(P.portalSentPatch(lead, 0).portal.sentAt === '1970-01-01T00:00:00.000Z', 'mark sent stamps sentAt');
ok(JSON.stringify(P.modulePatch('contact', 'on')) === '{"portal":{"modules":{"contact":"on"}}}' && JSON.stringify(P.templatePatch('website')) === '{"portal":{"template":"website"}}', 'a module and a template patch carry one key');
ok(P.pinPatch('1234').portal.pin === '1234' && P.pinPatch('12').portal.pin === '' && P.pinPatch('').portal.pin === '', 'the PIN patch sends four digits or clears');
ok(P.portalMessage(lead).startsWith('Hey Dan!') && P.portalMessage(lead).endsWith(P.portalUrl(lead)) && !/\bwe\b/i.test(P.portalMessage(lead)), 'the message greets by first name, ends with the link, says I never we');
const rows = P.moduleRows(lead);
ok(rows.length === PORTAL_MODULES.length - 1 && !rows.some(r => r.id === 'home') && rows.find(r => r.id === 'contact').state === 'off' && rows.find(r => r.id === 'book').state === 'auto', 'the rows are every module but home, with the stored or the default state');
const st = P.portalStatus(lead);
ok(st.on && st.views === 3 && st.pinned && st.template === 'brand' && st.documents === 1 && st.off === 1 && st.modules === rows.length, `the status line reads the link, views, PIN, template, documents and the cards off (${JSON.stringify(st)})`);
ok(!P.portalStatus({}).on && P.portalStatus({}).off === 0, 'no portal: off, nothing off');
const d = P.newDocument(' Brand guide ', 'https://x.example/g', 'weird', 0);
ok(d.label === 'Brand guide' && d.kind === 'link' && d.addedAt === '1970-01-01T00:00:00.000Z' && d.id.startsWith('d'), 'a new document trims the label, defaults an unknown kind to link and stamps addedAt');
/* the send message from the cards that render now (prompt 3) */
const cards = [{ id: 'home' }, { id: 'files' }, { id: 'planner' }, { id: 'book' }];
ok(P.portalSummary(cards) === 'Your portal has your files, the content planner and a quick way to book a call.', `the summary names the cards in one sentence (${P.portalSummary(cards)})`);
ok(P.portalSummary([{ id: 'home' }, { id: 'pay' }]) === 'Your portal has your invoice.' && P.portalSummary([]) === '' && /and 2 more\.$/.test(P.portalSummary(['needs_you', 'pay', 'approvals', 'concepts', 'planner', 'progress', 'revisions'].map(id => ({ id })))), 'one card, no cards, and more than five');
ok(P.portalMessage(lead, cards).startsWith("Hey Dan! Here's your page with me. Your portal has your files, the content planner and a quick way to book a call. Save it") && P.portalMessage(lead, cards).endsWith(P.portalUrl(lead)), 'the message carries the summary and the link');
ok(P.portalMessage(lead).includes('everything about your work in one place') && !/\bwe\b/i.test(P.portalMessage(lead, cards)), 'without the cards the message keeps its plain line; never we');
const nowCards = P.portalCardsNow({ ...lead, planner: { enabled: true, token: 'plnTOKEN0123456789abcdefghijkl' } }, { projects: [], posts: [], sets: [], profile: { phone: '555 0100' }, meetingLink: 'https://calendly.com/x' });
ok(nowCards.map(c => c.id).join(',') === 'home,planner,documents,book', `the CRM side renders the cards from what it holds, in the home order; contact is off on this record (${nowCards.map(c => c.id).join(',')})`);
/* the .ics builder (prompt 3) */
const ics = buildIcs({ title: 'Studio meeting; with Rob', start: '2026-10-20T14:00:00.000Z', end: '2026-10-20T14:30:00.000Z', url: 'https://zoom.us/j/123', description: 'Line one\nline two, with a comma' }, Date.UTC(2026, 9, 12));
ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0') && ics.endsWith('END:VCALENDAR\r\n'), 'the file opens and closes as a calendar, CRLF lines');
ok(/DTSTART:20261020T140000Z\r\n/.test(ics) && /DTEND:20261020T143000Z\r\n/.test(ics) && /DTSTAMP:20261012T000000Z/.test(ics), 'start, end and stamp in UTC');
ok(/SUMMARY:Studio meeting\\; with Rob/.test(ics) && /DESCRIPTION:Line one\\nline two\\, with a comma/.test(ics) && /URL:https:\/\/zoom.us\/j\/123/.test(ics), 'semicolons, commas and newlines are escaped');
ok(/DTEND:20261020T153000Z/.test(buildIcs({ start: '2026-10-20T15:00:00.000Z' })) && buildIcs({ start: 'nope' }) === '' && buildIcs({}) === '', 'no end: thirty minutes; no start: nothing');
const long = buildIcs({ title: 'x'.repeat(120), start: '2026-10-20T15:00:00.000Z' });
ok(long.split('\r\n').every(l => l.length <= 75), 'every line folds at 75');
ok(icsDataUrl('BEGIN:VCALENDAR').startsWith('data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR'), 'the data url the Add to calendar link carries');
console.log(bad ? `\n${bad} failed.` : '\nAll checks pass.'); process.exit(bad ? 1 : 0);
