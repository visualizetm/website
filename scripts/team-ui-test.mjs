#!/usr/bin/env node
/* Billy on Rob's side, in a browser at 390 and 1280 (Billy's Call Room, part 1), against the mocked admin (audit-fixtures.mjs):
 * the home's Billy today card (Calls, Talked, Callbacks, the "N booked" pill, Open Billy's day, one height in every state),
 * the Booked by Billy tag on the home's rows, the Booked by Billy card on the record (inside a section, no new header pill
 * or control), Billy's day (Today, Yesterday, Week; All, Calls, Booked, Sorting; a row opens its lead; a batch with Undo per
 * lead), Settings > Team > Billy (the switches, Reset passcode shown once, the open times source, Tell me when Billy, Pause
 * now) and Who calls it on a list.
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/team-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, TEAM_BILLY, TEAM_DAY, leads, daysFrom } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const ADMIN = `${BASE}/admin`;
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const rel = (page) => { const u = new URL(page.url()); return (u.pathname.replace(/^\/admin/, '') || '/') + u.search; };

async function session(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* none */ } });
  const team = { billy: TEAM_BILLY(), day: TEAM_DAY(), posts: [], ...(opts.team || {}) };
  await mockRoutes(page, { team, ...(opts.routes || {}) });
  /* A booking Billy made an hour ago, with the meeting three days out: what the home looks like right after he books (the fixture's own
     booked leads meet today, and a booking becomes a deal an hour past its meeting, so they cannot stand in for one still ahead). */
  const fresh = { ...leads[8], _id: 'LB1', business: 'Billy Booked Bakery', listId: '', deal: undefined, nextAction: undefined, meeting: { date: daysFrom(3), time: '10:00', type: 'call', location: '' }, bookedBy: { who: 'billy', at: new Date(Date.now() - 3600e3).toISOString() } };
  /* Two callbacks due later today on plain leads: one Billy set (his call, by: 'billy') and one Rob set. Only Rob's is Rob's to see (1b). */
  const soon = (id, business, mins, by) => ({ ...leads[3], _id: id, business, stage: 'lead', listId: '', nextAction: undefined, callStatus: 'callback', callbackAt: new Date(Date.now() + mins * 60e3).toISOString(), callLog: [{ at: new Date(Date.now() - 864e5).toISOString(), outcome: 'callback', note: 'Call after lunch', meeting: '', email: '', ...(by ? { by } : {}) }] });
  const extra = [fresh, soon('LB2', 'Billy Callback Bakery', 5, 'billy'), soon('LB3', 'Rob Callback Bakery', 6, '')];
  if (opts.leads !== false) await page.route('**/api/admin/call-leads**', (r) => (r.request().method() === 'GET' && !/deleted=1/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [...leads, ...extra] }) }) : r.fallback()));
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, team, errors };
}

for (const width of [390, 1280]) {
  console.log(`\n── ${width}px ──`);
  const S = await session(width); const p = S.page;

  /* 1. The home's card */
  await p.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-card="billy"] .bt-in', { timeout: 8000 });
  const card = p.locator('[data-card="billy"]');
  const text = (await card.innerText()).replace(/\n+/g, ' | ');
  ok(/Billy today/.test(text) && /14 \| Calls/.test(text) && /6 \| Talked/.test(text) && /2 \| Callbacks/.test(text), `Billy today: Calls, Talked, Callbacks (${text.slice(0, 80)})`);
  ok(/1 booked/.test(await card.locator('.bt-booked').innerText()) && await card.getByRole('button', { name: "Open Billy's day" }).count() === 1, 'an "N booked" pill and Open Billy\'s day');
  const order = await p.evaluate(() => { const a = document.querySelector('.nh-wrap, [data-card="today"], .nh-card'); const b = document.querySelector('[data-card="billy"]'); return a && b ? (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 'after' : 'before') : 'missing'; });
  ok(order !== 'before', `the card sits under Next up, never above it (${order})`);
  const box = await card.boundingBox();
  ok(box.width <= width && await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'it fits the width with no sideways scroll');

  /* 2. The tag on the home's rows */
  if (await p.locator('.nh-coming-head').getAttribute('aria-expanded') === 'false') await p.locator('.nh-coming-head').click();
  await p.waitForSelector('[data-booked-by="billy"]', { timeout: 5000 }).catch(() => {});
  const tagged = await p.locator('[data-booked-by="billy"]').evaluateAll(els => els.map(e => `${e.closest('[data-card]')?.getAttribute('data-card')}: ${e.innerText.replace(/\n+/g, ' | ')}`));
  ok(tagged.length >= 1 && tagged.every(t => /Billy Booked Bakery · Booked by Billy/.test(t)) && tagged.some(t => t.startsWith('next-coming')), `his booking shows under Coming up with "Booked by Billy" (${tagged.map(t => t.slice(0, 60)).join(' / ')})`);
  ok(await p.locator('[data-row-id="L9"][data-booked-by]').count() === 0 && await p.locator('[data-row-id="L10"][data-booked-by]').count() === 0, 'a lead that is a deal by now, and one he never booked, do not');

  /* 2b. A callback Billy set is Billy's: none of Rob's Next up lists, the Tasks page or the drawer shows it (1b) */
  const homeRows = await p.locator('[data-card="next-today"] .nh-row, [data-card="next-coming"] .nh-row, [data-card="next-overdue"] .nh-row').evaluateAll(els => els.map(e => e.innerText.replace(/\n+/g, ' | ')));
  ok(homeRows.some(t => /Rob Callback Bakery/.test(t)) && !homeRows.some(t => /Billy Callback Bakery/.test(t)), `the home lists the callback Rob set and not the one Billy set (${homeRows.filter(t => /Callback Bakery/.test(t)).map(t => t.slice(0, 40)).join(' / ')})`);
  await p.locator('.sh-bell').click();
  await p.waitForSelector('.v-sheet', { timeout: 5000 });
  const drawer = await p.locator('.v-sheet').innerText();
  ok(/Rob Callback Bakery/.test(drawer) && !/Billy Callback Bakery/.test(drawer), 'the notifications drawer has Rob\'s callback and not Billy\'s');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.v-sheet', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.goto(`${ADMIN}/tasks`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.tr-row, .v-empty', { timeout: 8000 }).catch(() => {});
  const tasksText = await p.locator('.sh-content').innerText();
  ok(/Rob Callback Bakery/.test(tasksText) && !/Billy Callback Bakery/.test(tasksText), 'the Tasks page (the Next up queue) has Rob\'s callback and not Billy\'s');
  await p.goto(`${ADMIN}/calls?section=leads`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  ok(/Billy Callback Bakery/.test(await p.locator('.sh-content').innerText()), 'the lead itself is still in Rob\'s Leads: only the callback is Billy\'s');
  await p.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-card="billy"] .bt-in', { timeout: 8000 });

  /* 3. One height in every state: loading, failed, loaded */
  const F = await session(width, { routes: { fail: ['team'] } });
  await F.page.addInitScript(() => { try { localStorage.setItem('vz_billy', '1'); } catch { /* none */ } });
  await F.page.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await F.page.waitForSelector('[data-card="billy"] .bt-retry', { timeout: 8000 }).catch(() => {});
  const fbox = await F.page.locator('[data-card="billy"]').boundingBox().catch(() => null);
  ok(!!fbox && /did not load/.test(await F.page.locator('[data-card="billy"]').innerText()) && await F.page.locator('[data-card="billy"] .bt-retry').count() === 1, 'when his day does not load the card says so with Try again');
  ok(!!fbox && Math.abs(fbox.height - box.height) <= 1, `and it keeps the same height (${fbox ? Math.round(fbox.height) : 0} and ${Math.round(box.height)})`);
  await F.ctx.close();
  const N = await session(width, { leads: false, team: { billy: { ...TEAM_BILLY(), exists: false } } });
  /* The same leads with nobody's bookedBy: what the app looked like before Billy. */
  await N.page.route('**/api/admin/call-leads**', (r) => (r.request().method() === 'GET' && !/deleted=1/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: leads.map(({ bookedBy, ...l }) => { void bookedBy; return l; }) }) }) : r.fallback()));
  await N.page.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await N.page.waitForTimeout(400);
  ok(await N.page.locator('[data-card="billy"]').count() === 0 && await N.page.evaluate(() => localStorage.getItem('vz_billy')) === '0', 'a studio with no caller has no card, and the device remembers that');
  ok(await N.page.locator('.nh-row').count() > 0 && await N.page.locator('[data-booked-by]').count() === 0, 'and a booking Rob made himself wears no tag');
  await N.page.goto(`${ADMIN}/deals/L9`, { waitUntil: 'networkidle' });
  await N.page.getByRole(width < 768 ? 'button' : 'tab', { name: /Meeting/ }).first().click().catch(() => {});
  await N.page.waitForTimeout(300);
  ok(await N.page.locator('.rc-meeting').count() === 1 && await N.page.locator('[data-card="booked-by"]').count() === 0, 'nor does its record carry the card');
  await N.ctx.close();

  /* 4. The record: Booked by Billy, inside Meeting, no new header pill or control */
  await p.goto(`${ADMIN}/deals/L9`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.rc-root, .rc-header, [data-record]', { timeout: 8000 }).catch(() => {});
  const head = async (page) => ({ pills: await page.locator('.rc-header .v-pill, .rc-head .v-pill').count(), controls: await page.locator('.rc-header-actions button, .rc-head-actions button').count() });
  const h9 = await head(p);
  const meeting = p.getByRole(width < 768 ? 'button' : 'tab', { name: /Meeting/ }).first();
  await meeting.click();
  await p.waitForSelector('[data-card="booked-by"]', { timeout: 5000 }).catch(() => {});
  const bb = p.locator('[data-card="booked-by"]');
  const bt = (await bb.innerText().catch(() => '')).replace(/\n+/g, ' | ');
  ok(/Booked by Billy/i.test(bt) && /\d{1,2}:\d{2}/.test(bt) && /Wants a new sign before spring/.test(bt), `the record's Booked by Billy card: the time and his notes (${bt.slice(0, 70)})`);
  ok(/No answer: Left a voicemail\./.test(bt) && !/Rang out/.test(bt), 'and his calls on that lead, not Rob\'s');
  ok(await bb.locator('button, a, input').count() === 0 && await bb.locator('.v-pill').count() === 0, 'the card is text only: no control and no pill');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'a long note wraps: no sideways scroll');
  ok(h9.pills <= 2 && h9.controls <= 3, `the header keeps its laws: at most two pills and three controls (${h9.pills} pills, ${h9.controls} controls)`);

  /* 5. Open Billy's day from the home */
  await p.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-card="billy"] .bt-open', { timeout: 8000 });
  await p.locator('[data-card="billy"] .bt-open').click();
  await p.waitForSelector('.td-list', { timeout: 8000 });
  ok(rel(p) === '/settings/team/day', `Open Billy's day goes to his day (${rel(p)})`);

  /* 6. Billy's day: ranges, chips, rows */
  const ranges = await p.locator('.td-range [role="radio"]').allInnerTexts();
  const chips = await p.locator('.td-chips .v-chip').evaluateAll(els => els.map(e => e.innerText.replace(/\n+/g, ' ').trim()));
  ok(ranges.map(x => x.trim()).join(' | ') === 'Today | Yesterday | Week' && chips.join(' | ') === 'All 8 | Calls 2 | Booked 1 | Sorting 4', `segments ${ranges.map(x => x.trim()).join(', ')} and chips ${chips.join(', ')}`);
  ok(/14 calls, 6 talked, 1 booked, 2 callbacks/.test(await p.locator('.td-page').innerText()), 'the count line: the day\'s numbers');
  const rows = await p.locator('.td-row').evaluateAll(els => els.map(e => ({ id: e.getAttribute('data-row-id'), meta: e.querySelector('.td-meta')?.innerText || '', opens: !!e.querySelector('.v-stretch') })));
  ok(rows.length === 8 && rows.map(r => r.id).join() === 'TA1,TA2,TA3,TA4,TA5,TA6,TA7,TA8' && rows.every(r => /^\d{1,2}:\d{2} (AM|PM) · by Billy$/.test(r.meta)), 'rows newest first, each with the time and "by Billy"');
  ok(rows.find(r => r.id === 'TA6').opens === false && rows.find(r => r.id === 'TA8').opens === false && rows.find(r => r.id === 'TA1').opens && rows.find(r => r.id === 'TA4').opens, 'a new list and a finished session are not controls; a call, a booking and a batch are');
  const small = await p.evaluate(() => [...document.querySelectorAll('.td-row .v-stretch, .td-chips .v-chip, .td-range [role="radio"]')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length);
  ok(small === 0, 'every control on the page is 44px or more');
  await p.locator('[data-chip="calls"]').click();
  ok(await p.locator('.td-row').count() === 2 && (await p.locator('.td-row').evaluateAll(els => els.every(e => e.getAttribute('data-kind') === 'call'))), 'Calls shows the calls only');
  await p.locator('[data-chip="booked"]').click();
  ok(await p.locator('.td-row').count() === 1 && /Booked Lead Business 9/.test(await p.locator('.td-row').innerText()), 'Booked shows the booking');
  await p.locator('.td-range').getByRole('radio', { name: 'Yesterday' }).click();
  await p.waitForSelector('.td-page .v-empty', { timeout: 5000 }).catch(() => {});
  ok(/Nothing from Billy yesterday/i.test(await p.locator('.td-page .v-empty').innerText()) && await p.locator('[data-state="no-results"]').count() === 0, 'a day with nothing says so (the first time state, not No results)');
  await p.locator('.td-range').getByRole('radio', { name: 'Week' }).click();
  await p.waitForSelector('.td-row', { timeout: 5000 });
  ok(/^[A-Z][a-z]{2} \d{1,2}:\d{2} (AM|PM) · by Billy$/.test(await p.locator('.td-row .td-meta').first().innerText()), 'the week view puts the day in front of the time');
  await p.locator('.td-range').getByRole('radio', { name: 'Today' }).click();
  await p.waitForSelector('.td-row', { timeout: 5000 });

  /* 7. A row opens its lead; Back returns to his day */
  await p.locator('[data-row-id="TA2"] .v-stretch').click();
  await p.waitForFunction(() => /\/(leads|deals|clients)\/L4/.test(location.pathname) || /open=L4/.test(location.search), null, { timeout: 5000 }).catch(() => {});
  ok(/L4/.test(rel(p)), `tapping a row opens the lead (${rel(p)})`);
  await p.goBack();
  await p.waitForSelector('.td-list', { timeout: 8000 });

  /* 8. A batch opens with Undo per lead */
  const before = S.team.posts.length;
  await p.locator('[data-row-id="TA4"] .v-stretch').click();
  await p.waitForSelector('.td-batch', { timeout: 5000 });
  const batch = await p.locator('.td-batch-row').evaluateAll(els => els.map(e => ({ id: e.getAttribute('data-lead-id'), text: e.innerText.replace(/\n+/g, ' | '), undo: !!e.querySelector('.td-undo') })));
  ok(batch.length === 3 && batch.every(b => b.undo) && /It was in Triage/.test(batch[1].text) && /It was in Leads/.test(batch[0].text), 'a batch row opens the batch: each lead, where it stood, and Undo');
  await p.locator('.td-batch-row[data-lead-id="L11"] .td-undo').click();
  await p.waitForFunction(() => !document.querySelector('.td-batch-row[data-lead-id="L11"] .td-undo'), null, { timeout: 5000 }).catch(() => {});
  const undo = S.team.posts.slice(before).map(x => x.body);
  ok(undo.length === 1 && undo[0].action === 'undo-decline' && undo[0].rowId === 'TA4' && undo[0].leadId === 'L11' && /Back in Leads/.test(await p.locator('.td-batch-row[data-lead-id="L11"]').innerText()) && await p.locator('.td-batch-row .td-undo').count() === 2, 'Undo reverses that one decline (one write) and the row says where the lead is now');
  await p.locator('.td-batch').getByRole('button', { name: 'Close' }).first().click();
  await p.waitForSelector('.td-batch', { state: 'detached', timeout: 5000 }).catch(() => {});
  ok(S.team.posts.slice(before).length === 1 && S.team.posts.every(x => x.body.action === 'undo-decline' || x.method === 'PATCH' || x.body.action), 'the page is read only: the one write it made is the Undo');

  /* 9. Back from his day goes to Team, then to Settings */
  await p.goto(`${ADMIN}/settings/team/day`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.td-list', { timeout: 8000 });
  await p.locator('.sh-top .sh-top-back, .lay-back, [aria-label="Back"]').first().click();
  await p.waitForSelector('[data-card="team-billy"]', { timeout: 8000 });
  ok(rel(p) === '/settings/team', `Back from a cold open of his day lands on Team (${rel(p)})`);

  /* 10. Settings > Team > Billy */
  const tb = (await p.locator('[data-card="team-billy"]').innerText()).replace(/\n+/g, ' | ');
  ok(/Billy/.test(tb) && /Seen 7 minutes ago/.test(tb) && (await p.locator('.tm-status').innerText()).trim() === 'Active', `his name, last seen and the Active pill (${tb.slice(0, 60)})`);
  ok(await p.getByRole('switch', { name: /Can sign in/ }).count() === 1 && await p.getByRole('switch', { name: /Move leads off your lists/ }).isChecked(), 'the switches: Can sign in, and Move leads off your lists (on)');
  ok(/billy@example\.com/.test(await p.locator('[data-card="team-signin"]').innerText()) && await p.locator('.tm-reset').count() === 1 && await p.locator('.tm-pause').count() === 1, 'his email, Reset passcode and Pause now');
  ok(/\/room$/.test((await p.locator('.tm-url').innerText()).trim()), 'and where he signs in');
  const n0 = S.team.posts.length;
  await p.getByRole('switch', { name: /Move leads off your lists/ }).click();
  await p.waitForTimeout(250);
  ok(JSON.stringify(S.team.posts[n0]?.body) === JSON.stringify({ set: { moveOffRobLists: false } }) && !(await p.getByRole('switch', { name: /Move leads off your lists/ }).isChecked()), 'a switch is one PATCH of that one field');

  /* Reset passcode: shown once */
  await p.locator('.tm-reset').click();
  await p.locator('.v-modal').getByRole('button', { name: 'Reset passcode' }).click();
  await p.waitForSelector('.tm-pass-sheet', { timeout: 5000 });
  const code = (await p.locator('[data-passcode]').innerText()).trim();
  ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code) && /Shown once/i.test(await p.locator('.tm-pass-sheet').innerText()), `Reset passcode shows the new passcode once (${code.replace(/[A-Z0-9]/g, 'X')})`);
  await p.locator('.tm-pass-done').click();
  await p.waitForSelector('.tm-pass-sheet', { state: 'detached', timeout: 5000 }).catch(() => {});
  const leaked = await p.evaluate((c) => document.body.innerText.includes(c) || Object.keys(localStorage).some(k => String(localStorage.getItem(k)).includes(c)) || Object.keys(sessionStorage).some(k => String(sessionStorage.getItem(k)).includes(c)), code);
  ok(!leaked, 'once the sheet closes the passcode is nowhere on the page or on the device');

  /* Open times */
  const srcs = await p.locator('.tm-source [role="radio"]').allInnerTexts();
  ok(srcs.map(x => x.trim()).join(' | ') === 'Calendly | Weekly hours' && await p.locator('.tm-days .v-chip').count() === 7 && await p.getByLabel('Start').count() === 1 && await p.getByLabel('End').count() === 1 && /30 minute slots/.test(await p.locator('[data-card="team-open"]').innerText()), 'the open times source: Calendly or weekly hours (days, start, end, 30 minute slots)');
  const n1 = S.team.posts.length;
  await p.locator('.tm-days [data-day="6"]').click();
  await p.waitForTimeout(250);
  ok(S.team.posts[n1]?.body?.set?.openTimes?.hours?.days?.join() === '1,2,3,4,5,6', 'a day chip saves the weekly hours');
  await p.locator('.tm-source').getByRole('radio', { name: 'Calendly' }).click();
  await p.waitForSelector('.tm-event select, .tm-event .v-field-control', { timeout: 5000 });
  const opts = await p.locator('.tm-event option').allInnerTexts();
  ok(opts.some(o => /Intro call \(30 min\)/.test(o)) && opts.length >= 3, `Calendly offers the event type picker (${opts.slice(1, 3).map(o => o.slice(0, 24)).join(', ')})`);
  const n2 = S.team.posts.length;
  await p.locator('.tm-event select').selectOption('https://api.calendly.com/event_types/INTRO30');
  await p.waitForTimeout(250);
  const picked = S.team.posts[n2]?.body?.set?.openTimes || {};
  ok(picked.source === 'calendly' && picked.eventType === 'https://api.calendly.com/event_types/INTRO30' && picked.eventTypeName === 'Intro call', 'picking one saves its address and its name');

  /* Tell me when Billy */
  const tell = p.locator('[data-card="team-tell"]');
  ok(/Tell me when Billy/i.test(await tell.innerText()) && await tell.getByRole('switch', { name: /Books a lead/ }).isChecked() && !(await tell.getByRole('switch', { name: /Finishes a session/ }).isChecked()), '"Tell me when Billy": Books a lead (on), Finishes a session (off)');
  const n3 = S.team.posts.length;
  await tell.getByRole('switch', { name: /Finishes a session/ }).click();
  await p.waitForTimeout(250);
  ok(JSON.stringify(S.team.posts[n3]?.body?.set?.prefs) === JSON.stringify({ booked: true, session: true }), 'the toggle saves on his prefs');

  /* Pause now */
  await p.locator('.tm-pause').click();
  await p.locator('.v-modal').getByRole('button', { name: 'Pause now' }).click();
  await p.waitForFunction(() => document.querySelector('.tm-status')?.innerText.trim() === 'Paused', null, { timeout: 5000 }).catch(() => {});
  ok(S.team.posts.slice(-1)[0]?.body?.action === 'pause' && (await p.locator('.tm-status').innerText()).trim() === 'Paused' && !(await p.getByRole('switch', { name: /Can sign in/ }).isChecked()) && await p.locator('.tm-pause').count() === 0, 'Pause now signs him out: Paused, Can sign in off');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the page fits the width');

  /* 11. Who calls it, on a list */
  await p.goto(`${ADMIN}/calls?section=lists`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ls-card', { timeout: 8000 });
  const listCard = p.locator('.ls-card[data-row-id="LS2"]').first();
  await listCard.getByRole('button', { name: /actions/ }).click();
  await p.getByRole('menuitem', { name: 'Who calls it' }).click();
  await p.waitForSelector('.ls-who', { timeout: 5000 });
  const who = await p.locator('.ls-who [role="radio"]').allInnerTexts();
  ok(who.map(x => x.trim()).join(' | ') === 'Rob | Billy' && await p.locator('.ls-who').getByRole('radio', { name: 'Rob' }).getAttribute('aria-checked') === 'true', 'a list has Who calls it (Rob | Billy), defaulting to who made it');
  const listReq = p.waitForRequest(r => /\/api\/admin\/lists/.test(r.url()) && r.method() === 'PATCH');
  await p.locator('.ls-who').getByRole('radio', { name: 'Billy' }).click();
  await p.locator('.v-modal').getByRole('button', { name: 'Save' }).click();
  const lr = JSON.parse((await listReq).postData() || '{}');
  ok(lr.id === 'LS2' && JSON.stringify(lr.set) === JSON.stringify({ callerId: 'billy' }), 'saving it is one PATCH of callerId');
  await p.waitForSelector('.ls-card[data-row-id="LS2"] .ls-caller', { timeout: 5000 }).catch(() => {});
  ok(/Billy calls it/.test(await listCard.innerText()), 'and the card says Billy calls it');
  await p.locator('.ls-card[data-row-id="LS0"]').first().getByRole('button', { name: /actions/ }).click();
  ok(await p.getByRole('menuitem', { name: 'Who calls it' }).count() === 0, 'Callbacks due cannot be assigned: its menu has no such item');
  await p.keyboard.press('Escape');

  ok(S.errors.length === 0, `no page errors (${S.errors.slice(0, 2).join(' | ') || 'none'})`);
  await S.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} failed.` : '\nAll team browser checks pass.');
process.exit(fails ? 1 : 0);
