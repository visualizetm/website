#!/usr/bin/env node
/* Billy's Call Room in a browser (part 1 of 2), at 390 and 1280, against the mocked caller endpoints (audit-fixtures.mjs,
 * which answer through the server's own whitelist): the sign in page, the chrome modes (tabs on the three roots, focused on
 * the lead card and the summary, the tab bar hidden in the call room), Today, Start calling (the callbacks due now first),
 * the lead card, Skip for now, the call room (Step N of 8, lines that say Billy, If they say, What they said kept on the
 * device, Objections), every outcome (no answer with the voicemail text as an sms: link, a callback tomorrow at 9:00 AM New
 * York, not interested through the decline sheet, wrong number), the session summary and its record, the Callbacks tab,
 * Me > Booked, sign out. Nothing in the walk may call an admin endpoint.
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

async function session(width, { signedOut = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  /* A tel: or sms: link opens another app on a phone. Headless Chromium has none and swallows the next tap instead, so the test stops the
     navigation itself (the link's own click handler still runs) and reads the href. */
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); } catch { /* none */ } document.addEventListener('click', (e) => { const a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"], a[href^="sms:"]') : null; if (a) e.preventDefault(); }, true); });
  const store = callerStore();
  await mockRoutes(page, { caller: store, callerSignedOut: signedOut });
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
  ok(['No answer', 'Call back', 'Not interested', 'Wrong number or do not call'].every(c => choices.includes(c)), `the outcome choices: ${choices.join(', ')}`);
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
}
await browser.close();
console.log(fails ? `\n${fails} failed.` : '\nAll Call Room browser checks pass.');
process.exit(fails ? 1 : 0);
