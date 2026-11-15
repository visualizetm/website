#!/usr/bin/env node
/* Billy's Call Room in a browser (part 1 of 2), at 390 and 1280, against the mocked caller endpoints (audit-fixtures.mjs,
 * which answer through the server's own whitelist): the sign in page, the chrome modes (tabs on the three roots, focused on
 * the lead card and the summary, the tab bar hidden in the call room), Today, Start calling (the callbacks due now first),
 * the lead card, Skip for now, the call room (Step N of 8, lines that say Billy, If they say, What they said kept on the
 * device, Objections), every outcome (no answer with the voicemail text as an sms: link, a callback tomorrow at 9:00 AM New
 * York, not interested through the decline sheet, wrong number), the session summary and its record, the Callbacks tab,
 * Me > Booked, sign out. Then sorting: Triage (Not now, Accept through Put it on a list, Decline), Leads (search, chips, the
 * batch bar, locked rows, the confirm before a lead leaves a list Rob calls), Lists, the New list sheet (a filter counted first,
 * by hand, who calls it), rename, and the three first time states. Then booking: the open times, a slot taken since the
 * screen loaded, the one write, the Booked screen (the sms: link, Rob has it), the next lead, no open times, the load error.
 * Nothing in the walk may call an admin endpoint.
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/room-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, callerStore, CALLER_EMAIL, CALLER_PASSCODE } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const ROOM = `${BASE}/admin/room`;
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const rel = (page) => { const u = new URL(page.url()); return (u.pathname.replace(/^\/admin\/room/, '') || '/') + u.search; };

async function session(width, { signedOut = false, empty = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  /* A tel: or sms: link opens another app on a phone. Headless Chromium has none and swallows the next tap instead, so the test stops the
     navigation itself (the link's own click handler still runs) and reads the href. */
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); } catch { /* none */ } document.addEventListener('click', (e) => { const a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"], a[href^="sms:"]') : null; if (a) e.preventDefault(); }, true); });
  const store = callerStore();
  await mockRoutes(page, { caller: store, callerSignedOut: signedOut, ...(empty ? { empty: ['caller'] } : {}) });
  const adminCalls = []; const errors = [];
  page.on('request', (r) => { if (/\/api\/admin\//.test(r.url())) adminCalls.push(r.url()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, store, adminCalls, errors };
}
const posted = (store, action) => store.posts.filter(p => p.method === 'POST' && p.action === action).map(p => p.body);
const chrome = (page) => page.locator('.sh-root').getAttribute('data-chrome');
const tabsHidden = async (page) => (await page.locator('.sh-tabs').getAttribute('class')).includes('is-hidden');
const endCall = async (page) => { await page.locator('.rm-end').click(); await page.waitForSelector('.rm-outcome', { timeout: 5000 }); };
const dial = async (page) => { await page.locator('.rm-call').click(); await page.waitForSelector('.rm-call-body', { timeout: 5000 }); };

for (const width of [390, 1280]) {
  console.log(`\n── ${width}px ──`);
  const S = await session(width, { signedOut: true }); const p = S.page; const store = S.store;

  /* 1. Sign in */
  await p.goto(ROOM, { waitUntil: 'networkidle' });
  ok(await p.getByRole('heading', { name: 'Call Room.' }).count() === 1 && await p.getByLabel('Email').count() === 1 && await p.getByLabel('Passcode').count() === 1 && await p.getByRole('button', { name: 'Sign in' }).count() === 1, 'the sign in page: "Call Room.", Email, Passcode, Sign in');
  ok(await p.getByText('Trouble signing in? Text Rob.').count() === 1, 'and the line "Trouble signing in? Text Rob."');
  await p.getByLabel('Email').fill(CALLER_EMAIL); await p.getByLabel('Passcode').fill('WRONG-CODE'); await p.getByRole('button', { name: 'Sign in' }).click();
  await p.waitForSelector('text=That email or passcode is not right.', { timeout: 5000 }).catch(() => {});
  ok(await p.getByText('That email or passcode is not right.').count() >= 1 && await p.locator('.sh-root').count() === 0, 'a wrong passcode says so and stays on the page');
  const loginReq = p.waitForRequest(r => /\/api\/caller\/login$/.test(r.url()));
  await p.getByLabel('Passcode').fill(CALLER_PASSCODE); await p.getByRole('button', { name: 'Sign in' }).click();
  const lr = await loginReq;
  ok(lr.method() === 'POST' && !new URL(lr.url()).search && JSON.parse(lr.postData()).passcode === CALLER_PASSCODE, 'sign in is a POST with the passcode in the body, nothing in the URL');
  await p.waitForSelector('.rm-today', { timeout: 8000 });

  /* 2. Today and the chrome */
  ok(/^(Morning|Afternoon|Evening), Billy\.$/.test(await p.locator('.rm-hello-title').innerText()), `the greeting names Billy (${await p.locator('.rm-hello-title').innerText()})`);
  const statLabels = await p.locator('.rm-stats .v-stat-label').allInnerTexts();
  ok(statLabels.join() === 'Calls,Talked,Booked,Callbacks due', `the four numbers: ${statLabels.join(', ')}`);
  const listCard = p.locator('[data-card="your-list"]');
  ok(/Dover shops/.test(await listCard.innerText()) && /3 left of 5/.test(await listCard.innerText()) && await listCard.getByRole('button', { name: 'Start calling' }).count() === 1, 'Your list: the name, "3 left of 5", Start calling');
  ok(await p.getByRole('button', { name: 'Call back Callback Due Co' }).count() === 1, 'Callbacks due now lists the one that is due');
  ok(await chrome(p) === 'tabs' && !(await tabsHidden(p)), 'Calls is a section root: the tab bar shows');
  const tabs = p.locator('.sh-tabs .sh-tab');
  ok(await tabs.count() === 3 && (await tabs.evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).join() === 'Calls,Callbacks,Me' && (await tabs.evaluateAll(els => els.map(e => e.innerText.trim()).join(''))) === '', 'the tab bar is three icons with labels for a screen reader only: Calls, Callbacks, Me');
  ok(await p.locator('.sh-top .sh-top-back').count() === 0 && (await p.locator('.sh-top-title').innerText()).toLowerCase() === 'calls', 'the top bar on a root: the title, no Back');

  /* 3. Start calling: the callback due now first, then the list */
  await listCard.getByRole('button', { name: 'Start calling' }).click();
  await p.waitForSelector('.rm-lead', { timeout: 5000 });
  ok(rel(p) === '/lead/C6', `Start calling opens the callback due now first (${rel(p)})`);
  ok(await chrome(p) === 'focused' && await tabsHidden(p) && await p.locator('.sh-top .sh-top-back').count() === 1, 'the lead card is focused: tab bar hidden, Back in the top bar');
  ok(await p.locator('.sh-top-right .sh-top-action').count() === 1 && await p.getByRole('button', { name: 'Fix the number or the name' }).count() === 1, 'its top bar shows only the action it declares (the contact fix)');
  const card = await p.locator('.rm-lead').innerText();
  ok(/Owner:/.test(card) && /Score \d+/.test(card) && /Phone/.test(card) && /Website/.test(card) && /Before you dial/.test(card) && /Your opener/i.test(card), 'the lead card: chips, Owner, the phone, the website note, Before you dial, Your opener');
  ok(/^tel:\+?\d+/.test(await p.locator('a.rm-call').getAttribute('href')), 'Call is a tel: link');
  await p.locator('.rm-skip').click();
  await p.waitForFunction(() => /\/lead\/C1$/.test(location.pathname), null, { timeout: 5000 }).catch(() => {});
  ok(rel(p) === '/lead/C1' && posted(store, 'list').some(b => b.op === 'skip' && b.leadId === 'C6'), `Skip for now moves on to the list and sends the lead to the end (${rel(p)})`);

  /* 4. The contact fix: phone and owner only */
  await p.getByRole('button', { name: 'Fix the number or the name' }).click();
  await p.waitForSelector('.v-sheet', { timeout: 5000 });
  await p.locator('.v-sheet').getByLabel("Owner's name").fill('Kim Park');
  await p.locator('.v-sheet').getByRole('button', { name: 'Save' }).click();
  await p.waitForSelector('.v-sheet', { state: 'detached', timeout: 5000 }).catch(() => {});
  const fix = posted(store, 'contact')[0] || {};
  ok(Object.keys(fix).sort().join() === 'leadId,owner' && /Owner: Kim Park/.test(await p.locator('.rm-lead').innerText()), 'the contact fix posts the owner alone and the card shows it');

  /* 5. The call room */
  await dial(p);
  ok(rel(p) === '/call/C1' && await chrome(p) === 'focused' && await tabsHidden(p), 'the call room hides the tab bar');
  ok(/^Step 1 of 8: Answer$/.test(await p.locator('.rm-step').innerText()), `it opens on "Step 1 of 8" (${await p.locator('.rm-step').innerText()})`);
  await p.locator('.rm-next').click(); await p.locator('.rm-next').click();
  const open = await p.locator('.rm-line .cs-line').innerText();
  ok(/^Step 3 of 8: Open$/.test(await p.locator('.rm-step').innerText()) && /I'm Billy/.test(open) && !/I'm Rob|it's Rob/i.test(open), `the opening line names Billy, not Rob ("${open.slice(0, 48)}...")`);
  await p.getByRole('button', { name: 'My nephew does it' }).click();
  ok(/Makes sense/.test(await p.locator('.rm-respond').innerText()), 'an If they say chip shows its answer');
  await p.getByLabel('What they said').fill('Their nephew built the site in 2019');
  ok(await p.evaluate(() => JSON.parse(sessionStorage.getItem('rm_said_C1') || 'null')) === 'Their nephew built the site in 2019' && posted(store, 'outcome').length === 0, 'What they said is kept on the phone as he types, with no write yet');
  await p.locator('.rm-objections').click();
  await p.waitForSelector('.ob-cards', { timeout: 5000 });
  ok(await p.locator('.ob-card').count() >= 5, 'Objections opens the console\'s own cards');
  await p.locator('.v-sheet').getByRole('button', { name: 'Close' }).first().click();
  await p.waitForSelector('.ob-cards', { state: 'detached', timeout: 5000 }).catch(() => {});

  /* 6. No answer, a voicemail, the text */
  await endCall(p);
  const choices = await p.locator('.rm-outcome .v-btn-label').allInnerTexts();
  ok(choices.join(' | ') === 'No answer | Call back | Booked | Not interested | Wrong number or do not call', `the outcome choices: ${choices.join(', ')}`);
  await p.locator('.rm-o-noanswer').click();
  ok(await p.getByRole('heading', { name: 'Did you leave a voicemail?' }).count() === 1 || await p.getByText('Did you leave a voicemail?').count() >= 1, 'No answer asks whether he left a voicemail');
  await p.locator('.rm-vm-yes').click();
  await p.waitForSelector('.rm-text-it', { timeout: 5000 });
  const na = posted(store, 'outcome')[0] || {};
  ok(na.leadId === 'C1' && na.outcome === 'no-answer' && na.voicemail === true && na.note === 'Their nephew built the site in 2019', 'the no answer is one write with the voicemail and his note');
  const sms = await p.locator('a.rm-text-it').getAttribute('href');
  ok(/^sms:/.test(sms) && /it's Billy from Visualize/.test(decodeURIComponent(sms)) && !/\bwe\b/i.test(decodeURIComponent(sms.split('body=')[1] || '')), 'the follow up text is an sms: link, says Billy, and never says we');
  await p.locator('.rm-text-skip').click();
  await p.waitForFunction(() => /\/lead\/C2$/.test(location.pathname), null, { timeout: 5000 }).catch(() => {});
  ok(rel(p) === '/lead/C2', `then the next lead on the list (${rel(p)})`);

  /* 7. Call back: tomorrow at 9:00 AM New York by default */
  await dial(p); await endCall(p);
  await p.locator('.rm-o-callback').click();
  await p.waitForSelector('.v-sheet input[type="date"]', { timeout: 5000 });
  ok(await p.locator('.v-sheet').getByRole('button', { name: 'Clear' }).count() === 0, 'the callback picker offers no Clear here');
  await p.locator('.v-sheet').getByRole('button', { name: /^Save|^Set/ }).first().click();
  await p.waitForFunction(() => /\/lead\/C3$/.test(location.pathname), null, { timeout: 5000 }).catch(() => {});
  const cb = posted(store, 'outcome')[1] || {};
  const nyHour = cb.callbackAt ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(new Date(cb.callbackAt)) : '';
  ok(cb.outcome === 'callback' && nyHour === '09:00' && new Date(cb.callbackAt).getTime() > Date.now(), `the callback defaults to tomorrow at 9:00 AM New York (${cb.callbackAt})`);

  /* 8. Not interested: the decline sheet */
  await dial(p); await endCall(p);
  await p.locator('.rm-o-no').click();
  await p.waitForSelector('.dc-reasons', { timeout: 5000 });
  await p.locator('.dc-reason').first().click();
  await p.locator('.v-sheet').getByRole('button', { name: 'Decline' }).click();
  await p.waitForFunction(() => /\/lead\/C6$/.test(location.pathname), null, { timeout: 5000 }).catch(() => {});
  const no = posted(store, 'outcome')[2] || {};
  ok(no.outcome === 'no' && !!no.reason && store.leads.find(l => l._id === 'C3').stage === 'declined' && store.leads.some(l => l._id === 'C3'), 'Not interested declines the lead with a reason; the record is still there');
  ok(rel(p) === '/lead/C6', `the skipped lead comes back at the end of the queue (${rel(p)})`);

  /* 9. Wrong number, then the summary */
  await dial(p); await endCall(p);
  await p.locator('.rm-o-wrong').click();
  await p.waitForSelector('.cc-osheet--wrong-number', { timeout: 5000 });
  await p.locator('.cc-osheet--wrong-number').getByRole('button', { name: 'Log' }).click();
  await p.waitForSelector('.rm-summary', { timeout: 8000 });
  ok(rel(p) === '/summary' && await chrome(p) === 'focused', 'when the queue is done the summary opens, focused');
  const sum = await p.locator('.rm-summary').innerText();
  ok(/Dover shops, done\./.test(sum) && /4 calls in 0h 0\dm/.test(sum), `"Dover shops, done." and "4 calls in 0h 0Xm"`);
  const sLabels = await p.locator('.rm-summary .v-stat-label').allInnerTexts();
  ok(sLabels.join() === 'Calls,Talked,Booked,Callbacks,No answer,Not interested', `the six numbers: ${sLabels.join(', ')}`);
  ok(/Kims Cafe/.test(sum) && /Voicemail text not sent/.test(sum) && /1 callback scheduled/.test(sum), 'Still to do: the voicemail text not sent and the callback scheduled');
  await p.waitForTimeout(300);
  const rec = posted(store, 'session');
  ok(rec.length === 1 && rec[0].list === 'Dover shops' && rec[0].stats.calls === 4 && rec[0].stats.talked === 2 && rec[0].stats.callbacks === 1 && rec[0].stats.noAnswer === 1 && rec[0].stats.notInterested === 1, `one session record with its numbers (${JSON.stringify(rec[0]?.stats)})`);
  await p.locator('.rm-done').click();
  await p.waitForSelector('.rm-today', { timeout: 5000 });
  ok(rel(p) === '/' && await chrome(p) === 'tabs', 'Done for today lands on Calls with the tab bar back');

  /* 10. Callbacks */
  await p.locator('.sh-tabs .sh-tab[aria-label="Callbacks"]').click();
  await p.waitForSelector('.rm-sections', { timeout: 5000 });
  const sections = await p.locator('.rm-sections [data-section]').evaluateAll(els => els.map(e => e.getAttribute('data-section')));
  ok(rel(p) === '/callbacks' && sections.includes('tomorrow') && sections.includes('retry') && !sections.includes('dueNow'), `Callbacks: its sections (${sections.join(', ')})`);
  const retry = await p.locator('[data-section="retry"]').innerText();
  ok(/Rang Out Co/.test(retry) && /Kims Cafe/.test(retry), 'No answer, try again holds the leads he called that rang out');

  /* 11. Me, sign out */
  await p.locator('.sh-tabs .sh-tab[aria-label="Me"]').click();
  await p.waitForSelector('.rm-booked', { timeout: 5000 });
  const me = await p.locator('.rm-booked').innerText();
  ok(/Booked By Billy/.test(me) && /Quoted By Billy/.test(me) && /Quoted/.test(me) && await p.getByRole('radio', { name: 'Booked' }).count() === 1, 'Me > Booked: each lead he booked with its status word');
  await p.getByRole('button', { name: 'Sign out' }).click();
  await p.waitForSelector('.rm-signin', { timeout: 5000 });
  const left = await p.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('rm_')));
  ok(posted(store, 'logout').length === 0 && store.signedIn === false && left.length === 0, 'Sign out clears the session and everything the room kept on the phone');

  ok(S.adminCalls.length === 0, `nothing in the walk called an admin endpoint (${S.adminCalls.slice(0, 2).join(', ') || 'none'})`);
  ok(S.errors.length === 0, `no page errors (${S.errors.slice(0, 2).join(' | ') || 'none'})`);
  await S.ctx.close();
  await sorting(width);
  await booking(width);
}

/* Sorting (milestone 3): Triage, Leads with the batch bar, Lists, the New list sheet and the confirm before a lead leaves a list Rob calls. */
async function sorting(width) {
  console.log(`\n── ${width}px, sorting ──`);
  const S = await session(width); const p = S.page; const store = S.store;
  const seg = (name) => p.locator('.rm-strip').getByRole('radio', { name });
  const sheet = () => p.locator('.v-sheet').last();
  const sheetGone = () => p.waitForSelector('.v-sheet', { state: 'detached', timeout: 5000 }).catch(() => {});
  const tick = (id) => p.locator(`[data-row-id="${id}"] .rm-pick-box`).click();
  const top = () => p.locator('.rm-triage-card').getAttribute('data-triage-id');
  const waitTop = (id) => p.waitForSelector(`.rm-triage-card[data-triage-id="${id}"]`, { timeout: 5000 }).catch(() => {});

  /* 1. The strip and Triage */
  await p.goto(ROOM, { waitUntil: 'networkidle' });
  await p.waitForSelector('.rm-today', { timeout: 8000 });
  const segs = await p.locator('.rm-strip [role="radio"]').allInnerTexts();
  ok(segs.map(x => x.trim()).join(' | ') === 'Today | Triage 3 | Leads | Lists', `the strip: ${segs.map(x => x.trim()).join(' | ')}`);
  await seg(/^Triage/).click();
  await waitTop('C9');
  ok(rel(p) === '/?section=triage' && await chrome(p) === 'tabs', `Triage is a segment of Calls, still a root (${rel(p)})`);
  const tcard = await p.locator('.rm-triage-card').innerText();
  ok(await top() === 'C9' && /Triage Top/.test(tcard) && /Score 90/.test(tcard), 'Triage shows one lead, the highest score first');
  ok(/Found .* by the nightly scraper|Found .* by an import|Added by hand/.test(tcard) && /Google/.test(tcard) && /Website/.test(tcard) && /Phone/.test(tcard) && /Instagram/.test(tcard), 'the card: when and where it was found, Google, the website, the phone, Instagram');
  const acts = await p.locator('.rm-triage-acts .v-btn-label').allInnerTexts();
  ok(acts.join() === 'Decline,Not now,Accept', `its buttons: ${acts.join(', ')}`);

  /* 2. Not now: to the back, kept on the lead */
  await p.locator('.rm-t-later').click();
  await waitTop('C10');
  ok(posted(store, 'triage')[0]?.decision === 'snooze' && posted(store, 'triage')[0]?.leadId === 'C9' && !!store.leads.find(l => l._id === 'C9').triageSnoozedAt && await top() === 'C10', 'Not now sends it to the back (triageSnoozedAt) and the next one comes up');
  ok((await seg(/^Triage/).innerText()).trim() === 'Triage 3', 'and it still counts as waiting');

  /* 3. Accept: Put it on a list */
  await p.locator('.rm-t-accept').click();
  await p.waitForSelector('.rm-put', { timeout: 5000 });
  const choices = await sheet().locator('.rm-choice').evaluateAll(els => els.map(e => e.getAttribute('data-choice')));
  ok(await sheet().getByRole('heading', { name: 'Put it on a list' }).count() === 1 && choices.join() === 'CL1,CL2,new,none', `"Put it on a list": the open lists newest first, New list, No list yet (${choices.join(', ')})`);
  ok(/Rob calls it/.test(await sheet().locator('[data-choice="CL2"]').innerText()) && !/Rob calls it/.test(await sheet().locator('[data-choice="CL1"]').innerText()) && await sheet().getByRole('button', { name: 'Accept and add' }).count() === 1, 'a list Rob calls is marked "Rob calls it"; the button reads Accept and add');
  await sheet().getByRole('radio', { name: /No list yet, just add it to Leads/ }).click();
  await sheet().getByRole('button', { name: 'Accept and add' }).click();
  await waitTop('C11');
  const acc = posted(store, 'triage')[1] || {};
  ok(acc.decision === 'accept' && acc.leadId === 'C10' && !('listId' in acc) && !('newList' in acc) && store.leads.find(l => l._id === 'C10').stage === 'lead', 'No list yet accepts it straight to Leads');
  ok((await seg(/^Triage/).innerText()).trim() === 'Triage 2', 'the strip counts down to Triage 2');
  await p.locator('.rm-t-accept').click();
  await p.waitForSelector('.rm-put', { timeout: 5000 });
  await sheet().getByRole('radio', { name: /^New list/ }).click();
  ok(await sheet().getByRole('button', { name: 'Accept and add' }).isDisabled(), 'a new list needs a name first');
  await sheet().getByLabel('List name').fill('Fresh picks');
  await sheet().getByRole('button', { name: 'Accept and add' }).click();
  await waitTop('C9');
  const acc2 = posted(store, 'triage')[2] || {};
  ok(acc2.newList === 'Fresh picks' && store.lists.some(l => l.name === 'Fresh picks' && l.leadIds.includes('C11')) && await top() === 'C9', 'New list makes the list, puts the lead on it, and the one sent to the back returns last');

  /* 4. Decline, then the pile is clear */
  await p.locator('.rm-t-decline').click();
  await p.waitForSelector('.dc-reasons', { timeout: 5000 });
  await p.locator('.dc-reason').first().click();
  await sheet().getByRole('button', { name: 'Decline' }).click();
  await p.waitForSelector('text=Triage is clear', { timeout: 5000 }).catch(() => {});
  const dec = posted(store, 'triage')[3] || {};
  ok(dec.decision === 'decline' && !!dec.reason && store.leads.find(l => l._id === 'C9').stage === 'declined', 'Decline goes through the decline sheet with a reason; the record stays');
  ok(await p.getByText('Triage is clear').count() === 1 && (await seg(/^Triage/).innerText()).trim() === 'Triage', 'an empty pile says Triage is clear and the strip drops the number');

  /* 5. Leads: search, chips, rows */
  await seg('Leads').click();
  await p.waitForSelector('.rm-leads', { timeout: 5000 });
  const total = store.leads.filter(l => ['triage', 'lead', 'nurture'].includes(l.stage)).length;
  ok(rel(p) === '/?section=leads' && await p.locator('.rm-pick').count() === total, `Leads lists every lead on his side of the line (${total})`);
  const chipText = await p.locator('.rm-chiprow .v-chip').allInnerTexts();
  ok(chipText.length === 3 && /^All\s*\d+$/.test(chipText[0].replace(/\n/g, ' ').trim()) && /^No list\s*\d+$/.test(chipText[1].replace(/\n/g, ' ').trim()) && /^Rob's list\s*1$/.test(chipText[2].replace(/\n/g, ' ').trim()), `three chips with counts: ${chipText.map(x => x.replace(/\n/g, ' ').trim()).join(', ')}`);
  const row = p.locator('[data-row-id="C4"]');
  const box = await row.locator('.v-check').boundingBox();
  ok(box.width >= 44 && box.height >= 44 && /Dover Detail Co/.test(await row.innerText()) && /Score \d+/.test(await row.innerText()) && /Rob Tuesday/.test(await row.innerText()), 'a row: a 44px checkbox, the name, "type · city · score", the list pill');
  await p.getByLabel('Search leads').fill('middletown');
  await p.waitForTimeout(100);
  const cityRows = await p.locator('.rm-pick').count();
  ok(cityRows > 0 && cityRows < total && (await p.locator('.rm-pick .rm-row-sub').allInnerTexts()).every(t => /Middletown|No list/.test(t) || !/ · /.test(t)), `search matches the city (${cityRows} rows)`);
  await p.getByLabel('Search leads').fill('zzzz');
  await p.waitForSelector('[data-state="no-results"]', { timeout: 5000 }).catch(() => {});
  ok(/Nothing matches "zzzz"/i.test(await p.locator('[data-state="no-results"]').innerText()), 'a search with no match names the search (NoResults, not the first time empty state)');
  await p.locator('[data-state="no-results"]').getByRole('button').click();
  await p.locator('[data-chip="rob"]').click();
  ok(await p.locator('.rm-pick').count() === 1 && await p.locator('[data-row-id="C4"]').count() === 1, "Rob's list shows the one lead on a list Rob calls");
  await p.locator('[data-chip="all"]').click();

  /* 6. Locked when Rob switched the moves off */
  store.me.moveOffRobLists = false;
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('.rm-leads', { timeout: 8000 });
  ok(await p.locator('[data-row-id="C4"] .rm-lock').count() === 1 && await p.locator('[data-row-id="C4"] input[type="checkbox"]').count() === 0 && await p.locator('[data-row-id="C5"] input[type="checkbox"]').count() === 1, 'with the switch off a lead on Rob\'s list shows locked and cannot be ticked');
  await p.locator('[data-row-id="C4"] .v-stretch').click();
  await p.waitForSelector('.rm-lead', { timeout: 5000 });
  ok(rel(p) === '/lead/C4?from=leads' && await p.locator('.rm-call').isDisabled() && /Locked on Rob's list/.test(await p.locator('.rm-call').innerText()) && await p.locator('a.rm-call').count() === 0, 'its lead card is locked too: no Call, no Move');
  await p.locator('.sh-top .sh-top-back').click();
  await p.waitForSelector('.rm-leads', { timeout: 5000 });
  ok(rel(p) === '/?section=leads', `Back from a lead opened in Leads returns to Leads (${rel(p)})`);
  store.me.moveOffRobLists = true;
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('.rm-leads', { timeout: 8000 });

  /* 7. The selection bar and the confirm */
  await tick('C5'); await tick('C4');
  await p.waitForSelector('.rm-selbar', { timeout: 5000 });
  const bar = await p.locator('.rm-selbar').innerText();
  ok(/2 selected/.test(bar) && ['Add to list', 'Decline', 'Clear'].every(x => bar.includes(x)), 'ticking rows raises the bar: 2 selected, Add to list, Decline, Clear');
  await p.locator('.rm-sel-add').click();
  await p.waitForSelector('.rm-put', { timeout: 5000 });
  await sheet().locator('[data-choice="CL1"]').click();
  await sheet().locator('.rm-put-go').click();
  await p.waitForSelector('.rm-move', { timeout: 5000 });
  const ask = await p.locator('.rm-move').innerText();
  ok(/That one is on Rob's list\./i.test(ask) && /Dover Detail Co is on Rob Tuesday, which Rob calls\. Move it to Dover shops\?/.test(ask) && /Rob will see this in your day\./.test(ask) && /Move it/.test(ask) && /Leave it/.test(ask), 'moving a lead off a list Rob calls asks first, in the prompt\'s words');
  ok(posted(store, 'batch').length === 0, 'and nothing is written before the answer');
  await p.locator('.rm-move-leave').click();
  await p.waitForSelector('.rm-move', { state: 'detached', timeout: 5000 }).catch(() => {});
  await p.waitForFunction(() => !document.querySelector('.rm-selbar'), null, { timeout: 5000 }).catch(() => {});
  const b1 = posted(store, 'batch');
  ok(b1.length === 1 && b1[0].op === 'list' && b1[0].leadIds.join() === 'C5' && b1[0].listId === 'CL1' && !b1[0].confirm && store.leads.find(l => l._id === 'C4').listId === 'CL2', 'Leave it leaves that one where it is and adds the rest in one batch write');
  await tick('C4');
  await p.locator('.rm-sel-add').click();
  await p.waitForSelector('.rm-put', { timeout: 5000 });
  await sheet().locator('[data-choice="CL1"]').click();
  await sheet().locator('.rm-put-go').click();
  await p.waitForSelector('.rm-move', { timeout: 5000 });
  await p.locator('.rm-move-go').click();
  await p.waitForFunction(() => !document.querySelector('.rm-selbar'), null, { timeout: 5000 }).catch(() => {});
  const b2 = posted(store, 'batch')[1] || {};
  ok(b2.confirm === true && b2.leadIds.join() === 'C4' && store.leads.find(l => l._id === 'C4').listId === 'CL1', 'Move it sends the one write with the confirm, and the lead moves');
  await tick('C12'); await tick('C8');
  await p.locator('.rm-sel-decline').click();
  await p.waitForSelector('.dc-reasons', { timeout: 5000 });
  await p.locator('.dc-reason').first().click();
  await sheet().getByRole('button', { name: 'Decline' }).click();
  await p.waitForFunction(() => !document.querySelector('.rm-selbar'), null, { timeout: 5000 }).catch(() => {});
  const b3 = posted(store, 'batch')[2] || {};
  ok(posted(store, 'batch').length === 3 && b3.op === 'decline' && b3.leadIds.length === 2 && !!b3.reason && store.leads.find(l => l._id === 'C12').stage === 'declined', 'Decline on a selection is one batch write with a reason');
  await tick('C1');
  await p.locator('.rm-sel-clear').click();
  ok(await p.locator('.rm-selbar').count() === 0 && await p.locator('.rm-pick.is-on').count() === 0, 'Clear drops the selection and the bar');

  /* 8. Lists and the New list sheet */
  await seg('Lists').click();
  await p.waitForSelector('.rm-lists', { timeout: 5000 });
  const cards = await p.locator('.rm-listcard').evaluateAll(els => els.map(e => e.innerText.replace(/\n+/g, ' | ')));
  const dover = cards.find(c => /Dover shops/.test(c)) || ''; const robs = cards.find(c => /Rob Tuesday/.test(c)) || ''; const due = cards.find(c => /Callbacks due/.test(c)) || '';
  ok(/Billy calls it/.test(dover) && /\d+ left of \d+/.test(dover) && /Made by Billy/.test(dover) && await p.locator('[data-list-id="CL1"] .v-progress, [data-list-id="CL1"] [role="progressbar"]').count() >= 1, `a list card: the name, Billy calls it, the progress bar, N left of M, Made by Billy (${dover.slice(0, 70)})`);
  ok(/Rob calls it/.test(robs) && !/Made by Billy/.test(robs) && /Fills itself/.test(due), 'a list Rob calls says so; Callbacks due says Fills itself');
  ok(await p.locator('[data-list-id="CL2"] button').count() === 0 && await p.locator('[data-list-id="CL3"] button').count() === 0, 'neither Rob\'s list nor Callbacks due offers Billy a control');
  await p.locator('.rm-new-list').click();
  await p.waitForSelector('.rm-newlist', { timeout: 5000 });
  const fills = await sheet().getByRole('radiogroup', { name: 'Fill it with' }).getByRole('radio').allInnerTexts();
  const whos = await sheet().getByRole('radiogroup', { name: 'Who calls it' }).getByRole('radio').allInnerTexts();
  ok(await sheet().getByLabel('Name').count() === 1 && fills.map(x => x.trim()).join(' | ') === 'A filter | By hand | Empty' && whos.map(x => x.trim()).join(' | ') === 'Me | Rob', `New list: Name, Fill it with (${fills.map(x => x.trim()).join(' | ')}), Who calls it (${whos.map(x => x.trim()).join(' | ')})`);
  ok(await sheet().getByRole('group', { name: 'Business type' }).count() === 1 && await sheet().getByRole('group', { name: 'City' }).count() === 1 && await sheet().getByRole('button', { name: 'No list yet' }).count() === 1, 'the filter offers chips for business type, city and No list yet');
  const line = () => sheet().locator('.rm-fill-line').innerText();
  const m0 = /^(\d+) leads? match(?:es)?\.(?: (\d+) (?:is|are) on a list already and stays? where (?:it is|they are)\.)? (\d+) will be added\.$/.exec(await line());
  ok(!!m0 && Number(m0[1]) - Number(m0[2] || 0) === Number(m0[3]), `the count comes before anything is written: "${await line()}"`);
  await sheet().getByRole('group', { name: 'City' }).getByRole('button', { name: /Smyrna/ }).click();
  const m1 = /^(\d+) leads? match(?:es)?\..* (\d+) will be added\.$/.exec(await line());
  const cta = await sheet().locator('.rm-newlist-go').innerText();
  ok(!!m1 && Number(m1[1]) < Number(m0[1]) && cta.trim() === `Make list of ${m1[2]}`, `a chip narrows it and the button reads "${cta.trim()}"`);
  await sheet().locator('.rm-newlist-go').click();
  ok(/Give the list a name/.test(await sheet().innerText()) && posted(store, 'list').filter(b => b.op === 'create').length === 0, 'no name, no list: it asks for one');
  await sheet().getByLabel('Name').fill('Smyrna run');
  await sheet().locator('.rm-newlist-go').click();
  await sheetGone();
  const made = posted(store, 'list').find(b => b.op === 'create') || {};
  const madeList = store.lists.find(l => l.name === 'Smyrna run');
  ok(made.name === 'Smyrna run' && made.callerId === 'billy' && made.fill?.mode === 'filter' && made.fill.cities.join() === 'Smyrna' && madeList && madeList.leadIds.length === Number(m1[2]), `Make list writes once and adds exactly the ${m1[2]} it promised`);
  await p.waitForSelector(`[data-list-id="${madeList?._id}"]`, { timeout: 5000 }).catch(() => {});
  ok(await p.locator(`[data-list-id="${madeList?._id}"]`).count() === 1, 'and the new list has its card');

  /* 9. By hand: Leads with checkboxes, Rob calls it */
  await p.locator('.rm-new-list').click();
  await p.waitForSelector('.rm-newlist', { timeout: 5000 });
  await sheet().getByLabel('Name').fill('Hand picked');
  await sheet().getByRole('radiogroup', { name: 'Fill it with' }).getByRole('radio', { name: 'By hand' }).click();
  await sheet().getByRole('radiogroup', { name: 'Who calls it' }).getByRole('radio', { name: 'Rob' }).click();
  await sheet().locator('.rm-newlist-go').click();
  await p.waitForSelector('[data-card="draft"]', { timeout: 5000 });
  ok(rel(p) === '/?section=leads' && /Hand picked/.test(await p.locator('[data-card="draft"]').innerText()), 'By hand opens Leads with the list in the making');
  await tick('C1'); await tick('C2');
  ok((await p.locator('.rm-sel-make').innerText()).trim() === 'Make list of 2' && await p.locator('.rm-sel-add').count() === 0, 'the bar\'s one action is Make list of 2');
  await p.locator('.rm-sel-make').click();
  await p.waitForSelector('.rm-lists', { timeout: 5000 });
  const hand = posted(store, 'list').filter(b => b.op === 'create')[1] || {};
  const handCard = (await p.locator('.rm-listcard').evaluateAll(els => els.map(e => e.innerText.replace(/\n+/g, ' | ')))).find(c => /Hand picked/.test(c)) || '';
  ok(hand.fill?.mode === 'hand' && hand.fill.leadIds.join() === 'C1,C2' && hand.callerId === 'rob' && rel(p) === '/?section=lists' && /Rob calls it/.test(handCard) && /Made by Billy/.test(handCard), 'Make list writes the picked leads once, for Rob to call, and lands on Lists');

  /* 10. Rename, and Start from a card */
  await p.locator('[data-list-id="CL1"] .rm-list-rename').click();
  await p.waitForSelector('.v-sheet', { timeout: 5000 });
  await sheet().getByLabel('Name').fill('Dover shops, round two');
  await sheet().getByRole('button', { name: 'Save' }).click();
  await sheetGone();
  ok(posted(store, 'list').some(b => b.op === 'rename' && b.name === 'Dover shops, round two') && /Dover shops, round two/.test(await p.locator('[data-list-id="CL1"]').innerText()), 'a list Billy made can be renamed');

  /* 11. The lead card of a lead on Rob's list: Move it to my list */
  store.leads.find(l => l._id === 'C7').listId = 'CL2'; store.lists.find(l => l._id === 'CL2').leadIds.push('C7');
  await p.goto(`${ROOM}/lead/C7`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.rm-lead', { timeout: 8000 });
  ok(await p.locator('a.rm-call').count() === 0 && /Move it to my list/.test(await p.locator('.rm-move-mine').innerText()), 'a lead on a list Rob calls offers Move it to my list instead of Call');
  await p.locator('.rm-move-mine').click();
  await p.waitForSelector('.rm-put', { timeout: 5000 });
  ok(await sheet().locator('[data-choice="CL2"]').count() === 0, 'the list it is on is not offered');
  await sheet().locator('[data-choice="CL1"]').click();
  await sheet().locator('.rm-put-go').click();
  await p.waitForSelector('.rm-move', { timeout: 5000 });
  await p.locator('.rm-move-go').click();
  await p.waitForSelector('a.rm-call', { timeout: 5000 }).catch(() => {});
  const mv = posted(store, 'batch').slice(-1)[0] || {};
  ok(mv.confirm === true && mv.leadIds.join() === 'C7' && await p.locator('a.rm-call').count() === 1, 'after the confirm it is on his list and Call is a tel: link');

  ok(S.adminCalls.length === 0, `nothing in the sorting walk called an admin endpoint (${S.adminCalls.slice(0, 2).join(', ') || 'none'})`);
  ok(S.errors.length === 0, `no page errors (${S.errors.slice(0, 2).join(' | ') || 'none'})`);
  await S.ctx.close();

  /* 12. First time: nothing to sort, no leads, no lists */
  const E = await session(width, { empty: true }); const e = E.page;
  await e.goto(`${ROOM}?section=triage`, { waitUntil: 'networkidle' });
  await e.waitForSelector('.v-empty', { timeout: 8000 }).catch(() => {});
  ok(await e.getByText('Triage is clear').count() === 1, 'first time, Triage: Triage is clear');
  await e.locator('.rm-strip').getByRole('radio', { name: 'Leads' }).click();
  await e.waitForSelector('text=No leads yet', { timeout: 5000 }).catch(() => {});
  ok(await e.getByText('No leads yet').count() === 1 && await e.locator('[data-state="no-results"]').count() === 0, 'first time, Leads: the empty state, not No results');
  await e.locator('.rm-strip').getByRole('radio', { name: 'Lists' }).click();
  await e.waitForSelector('text=No lists yet', { timeout: 5000 }).catch(() => {});
  ok(await e.getByText('No lists yet').count() === 1 && await e.locator('.rm-lists .v-empty').getByRole('button', { name: 'New list' }).count() === 1, 'first time, Lists: No lists yet with New list');
  await E.ctx.close();
}
/* Booking (milestone 4): Rob's open times, the slot taken since the screen loaded, the one write, the Booked screen, the next lead. */
async function booking(width) {
  console.log(`\n── ${width}px, booking ──`);
  const S = await session(width); const p = S.page; const store = S.store;
  await p.goto(`${ROOM}/lead/C5`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.rm-lead', { timeout: 8000 });
  await dial(p);
  await p.getByLabel('What they said').fill('Wants a new sign before spring');
  await endCall(p);
  await p.locator('.rm-o-booked').click();
  await p.waitForSelector('.rm-booking', { timeout: 5000 });
  ok(rel(p) === '/book/C5' && await chrome(p) === 'focused' && await tabsHidden(p) && /book free range bakery/i.test(await p.locator('.sh-top-title').innerText()), `Booked opens the booking screen, focused (${rel(p)})`);
  await p.waitForSelector('.rm-slots .rm-slot', { timeout: 5000 });
  const days = await p.locator('.rm-days .v-chip').count();
  ok(days >= 2 && await p.locator('.rm-slots .rm-slot').count() >= 1 && /Rob's open times/.test(await p.locator('.rm-booking').innerText()), `Rob's open times: a day strip (${days} days) and a grid of times`);
  ok(await p.getByLabel('What should Rob know?').inputValue() === 'Wants a new sign before spring', '"What should Rob know?" starts with what he typed on the call');
  ok(await p.locator('.rm-book').isDisabled() && (await p.locator('.rm-book').innerText()).trim() === 'Pick a time', 'nothing can be booked until a time is picked');
  const first = p.locator('.rm-slots .rm-slot').first();
  const firstIso = await first.getAttribute('data-slot');
  await first.click();
  const label = (await p.locator('.rm-book').innerText()).trim();
  ok(/^Book (Today|Tomorrow|[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}) \d{1,2}:\d{2} (AM|PM)$/.test(label) && !(await p.locator('.rm-book').isDisabled()), `the button reads Book <day time> ("${label}")`);

  /* The slot was taken while he looked: 409, said out loud, the open times read again. */
  store.taken = firstIso;
  await p.locator('.rm-book').click();
  await p.waitForSelector('text=That time was just taken. Pick another.', { timeout: 5000 }).catch(() => {});
  await p.waitForFunction((iso) => !document.querySelector(`.rm-slot[data-slot="${iso}"]`) && !!document.querySelector('.rm-slot'), firstIso, { timeout: 5000 }).catch(() => {});
  ok(await p.getByText('That time was just taken. Pick another.').count() >= 1 && await p.locator(`.rm-slot[data-slot="${firstIso}"]`).count() === 0 && rel(p) === '/book/C5' && store.leads.find(l => l._id === 'C5').stage === 'lead' && (await p.locator('.rm-book').innerText()).trim() === 'Pick a time', 'a time taken since the screen loaded is refused, said, and gone from the grid; nothing was booked');

  /* The booking. */
  await p.locator('.rm-days .v-chip').nth(1).click();
  const slot = p.locator('.rm-slots .rm-slot').first();
  const iso = await slot.getAttribute('data-slot');
  await slot.click();
  await p.locator('.rm-book').click();
  await p.waitForSelector('.rm-bookedscreen', { timeout: 8000 });
  const sent = posted(store, 'book').slice(-1)[0] || {};
  ok(Object.keys(sent).sort().join() === 'at,leadId,notes' && sent.leadId === 'C5' && sent.at === iso && sent.notes === 'Wants a new sign before spring' && store.leads.find(l => l._id === 'C5').stage === 'booked', 'Book is one write: the lead, the time and his notes');
  const scr = await p.locator('.rm-bookedscreen').innerText();
  ok(rel(p) === '/booked' && await chrome(p) === 'focused' && /^Booked\.$/m.test(scr) && /Call with Rob/i.test(scr) && /\d{1,2}:\d{2} (AM|PM)/.test(await p.locator('[data-card="time"]').innerText()), 'the Booked screen: "Booked." and the time card');
  const sms = await p.locator('a.rm-booked-text').getAttribute('href');
  const body = decodeURIComponent((sms || '').split('body=')[1] || '');
  ok(/^sms:/.test(sms || '') && /it's Billy from Visualize/.test(body) && /set with Rob/.test(body) && /\bI'll\b/.test(body) && !/\bwe\b|\bour\b/i.test(body), `Text it is an sms: link with the line filled in, in the first person ("${body.slice(0, 44)}...")`);
  ok(posted(store, 'book').length === 2 && S.adminCalls.length === 0, 'and tapping nothing sends anything: the text is his to send');
  const ticks = await p.locator('[data-card="rob-has-it"] .rm-tick').evaluateAll(els => els.map(e => `${e.getAttribute('data-on')}:${e.innerText.trim()}`));
  ok(ticks.length === 3 && ticks.every(t => t.startsWith('1:')) && /Push sent to Rob/.test(ticks[0]) && /notes are on the lead/.test(ticks[1]) && /Confirmation email drafted for Rob/.test(ticks[2]), `Rob has it: ${ticks.map(t => t.slice(2)).join(', ')}`);
  ok(await p.evaluate(() => !sessionStorage.getItem('rm_said_C5')), 'what he typed is cleared from the phone once it is on the lead');

  /* Next lead: this was a session of one, so the summary. */
  await p.locator('.rm-booked-next').click();
  await p.waitForSelector('.rm-summary', { timeout: 8000 });
  await p.waitForTimeout(300);
  const rec = posted(store, 'session').slice(-1)[0] || {};
  ok(rel(p) === '/summary' && rec.stats?.booked === 1 && rec.stats?.calls === 1 && rec.stats?.talked === 1, `Next lead moves on (here to the summary) and the session counts the booking (${JSON.stringify(rec.stats)})`);
  await p.locator('.rm-done').click();
  await p.waitForSelector('.rm-today', { timeout: 5000 });
  await p.locator('.sh-tabs .sh-tab[aria-label="Me"]').click();
  await p.waitForSelector('.rm-booked', { timeout: 5000 });
  ok(/Free Range Bakery/.test(await p.locator('.rm-booked').innerText()), 'Me > Booked lists it');
  await p.goto(`${ROOM}/lead/C5`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.v-empty', { timeout: 8000 }).catch(() => {});
  ok(/That lead is not here/i.test(await p.locator('.v-empty').innerText()), 'and the lead itself is gone from his side of the line');

  /* No open times, and the open times failing to load. */
  store.noSlots = true;
  await p.goto(`${ROOM}/book/C1`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.rm-booking .v-empty', { timeout: 8000 }).catch(() => {});
  ok(/No open times/i.test(await p.locator('.rm-booking .v-empty').innerText()) && await p.locator('.rm-book').isDisabled(), 'with nothing open the screen says No open times and Book stays off');
  ok(await p.locator('.sh-top .sh-top-back').count() === 1, 'the booking screen has Back in the top bar');
  await p.locator('.sh-top .sh-top-back').click();
  await p.waitForSelector('.rm-lead', { timeout: 5000 });
  ok(rel(p) === '/lead/C1', `Back from booking returns to the lead card (${rel(p)})`);
  store.noSlots = false; store.failSlots = true;
  await p.goto(`${ROOM}/book/C1`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.rm-booking .v-error, .rm-booking [data-state="error"]', { timeout: 8000 }).catch(() => {});
  ok(/The open times did not load/i.test(await p.locator('.rm-booking').innerText()) && await p.locator('.rm-booking').getByRole('button', { name: /Retry|Try again/ }).count() === 1, 'when the open times do not load the screen says so with Retry');
  store.failSlots = false;
  await p.locator('.rm-booking').getByRole('button', { name: /Retry|Try again/ }).click();
  await p.waitForSelector('.rm-slots .rm-slot', { timeout: 5000 }).catch(() => {});
  ok(await p.locator('.rm-slots .rm-slot').count() >= 1, 'Retry reads them again');

  ok(S.adminCalls.length === 0, `nothing in the booking walk called an admin endpoint (${S.adminCalls.slice(0, 2).join(', ') || 'none'})`);
  ok(S.errors.length === 0, `no page errors (${S.errors.slice(0, 2).join(' | ') || 'none'})`);
  await S.ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} failed.` : '\nAll Call Room browser checks pass.');
process.exit(fails ? 1 : 0);
