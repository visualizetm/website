#!/usr/bin/env node
/* Next up on the home page, in a browser against the audit fixtures (the home page job). Run at 390 and 1280 by default.
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 node scripts/home-nextup-test.mjs
 * Checks, per width: the three cards (Today, Coming up, Overdue, in that order) above the range control and the KPIs; the check on a task completes it (a PATCH of
 * the checklists, never a nextAction doneAt), the row stays, struck through, X of Y done counts it, the overview chip and the live region
 * follow, Undo takes it back; Tomorrow on a task and on a callback writes 9:00 AM New York tomorrow and the row leaves Overdue, Undo
 * brings it back; the check on a callback opens the Log outcome sheet and writes nothing until an outcome is saved; the check on a rule
 * action opens its record; Coming up is folded on a phone and open on a computer and the choice is remembered. */
import { chromium } from 'playwright-core';
import { mockRoutes, leads as FIXTURE_LEADS } from './audit-fixtures.mjs';
import { tomorrowNineNY } from '../src/lib/nextAction.js';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WIDTHS = (process.env.AUDIT_WIDTHS || '320,390,1280').split(',').map(Number);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

for (const w of WIDTHS) {
  const phone = w < 768;
  console.log(`\n[${w}px]`);
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block' }); // the worker would answer the API itself, past the mocks
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); if (!sessionStorage.getItem('nu-test')) { localStorage.removeItem('vz_home_coming'); sessionStorage.setItem('nu-test', '1'); } } catch {} });
  await mockRoutes(page, { session: true });
  const writes = [];
  await page.route('**/api/admin/call-leads**', (r) => { const req = r.request(); if (req.method() === 'GET') return r.fallback(); let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch { /* not JSON */ } writes.push({ method: req.method(), body }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, item: {} }) }); });
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.nh-row', { timeout: 10000 });
  await page.waitForTimeout(900);

  const chip = async (id) => Number((await page.locator(`[data-ov="${id}"] .v-ov-n`).first().textContent()).trim());
  const today = page.locator('[data-card="next-today"]'); const overdue = page.locator('[data-card="next-overdue"]'); const coming = page.locator('[data-card="next-coming"]');
  const lastWrite = () => writes[writes.length - 1];
  const nine = new Date(tomorrowNineNY(Date.now())).toISOString();

  // Order: greeting, Next up, then the range control and the KPIs.
  const y = await page.evaluate(() => { const top = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? -1; return { greet: top('.an-greet'), today: top('[data-card="next-today"]'), range: top('.an-rangebar'), kpis: top('[data-card="kpis"]') }; });
  ok(y.greet < y.today && y.today < y.range && y.range < y.kpis, `greeting, Next up, range, KPIs in that order (${JSON.stringify(y)})`);
  ok(await page.locator('[data-card="open-tasks"]').count() === 0, 'the old Open tasks card is gone');
  /* The fixtures are dated against the clock, so what is due today moves through the day: the rows must equal what the chips count. */
  const nToday = await today.locator('.nh-row').count(); const nOver = await overdue.locator('.nh-row').count();
  ok(nToday > 0 && nToday === await chip('today') && nOver > 0 && nOver === Math.min(5, await chip('overdue')), `Today shows every row the chip counts (${nToday}) and Overdue up to five (${nOver})`);
  /* Today, Coming up, Overdue: that order down the page at every width, and in the document, so the tab order and a screen reader follow it. */
  const box = await page.evaluate(() => { const r = (s) => { const b = document.querySelector(`[data-card="${s}"]`).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; }; const dom = [...document.querySelectorAll('[data-card="next-today"],[data-card="next-coming"],[data-card="next-overdue"]')].map((e) => e.dataset.card); return { t: r('next-today'), c: r('next-coming'), o: r('next-overdue'), dom }; });
  ok(box.dom.join() === 'next-today,next-coming,next-overdue', `the cards run Today, Coming up, Overdue in the document (${box.dom})`);
  ok(box.t.top <= box.c.top + 1 && box.c.top < box.o.top && box.c.bottom <= box.o.top + 1, 'Coming up sits above Overdue and no higher than Today');
  if (phone) ok(Math.abs(box.t.left - box.c.left) < 2 && Math.abs(box.c.left - box.o.left) < 2 && box.t.bottom <= box.c.top + 1, 'the three cards stack on a phone');
  else ok(Math.abs(box.t.top - box.c.top) < 4 && box.t.right <= box.c.left + 1 && box.o.top >= Math.max(box.t.bottom, box.c.bottom) - 1 && Math.abs(box.o.left - box.t.left) < 2 && Math.abs(box.o.right - box.c.right) < 2, 'from 768 up Today and Coming up share a row and Overdue takes the full row under them');

  // 1. The check on a task.
  const todayChip0 = await chip('today'); const overChip0 = await chip('overdue');
  const taskCheck = today.getByRole('button', { name: /^Mark done:/ }).first();
  const taskName = (await taskCheck.getAttribute('aria-label')).replace('Mark done: ', '');
  const doneBefore = writes.length;
  await taskCheck.click();
  await page.waitForTimeout(500);
  const w1 = lastWrite();
  ok(writes.length === doneBefore + 1 && w1.method === 'PATCH' && Array.isArray(w1.body?.set?.checklists), `the check on a task patches its checklists (${JSON.stringify(w1?.body).slice(0, 90)})`);
  ok(!JSON.stringify(w1.body).includes('doneAt":"20') || JSON.stringify(w1.body?.set?.nextAction || {}).indexOf('"doneAt":"20') === -1, 'the check on a task writes no nextAction doneAt of its own');
  const doneRow = today.locator('.nh-row.is-done');
  ok(await doneRow.count() === 1, 'the finished row stays in Today');
  ok(/line-through/.test(await doneRow.locator('.nh-title').evaluate(e => getComputedStyle(e).textDecorationLine)), 'the finished title is struck through');
  ok((await doneRow.locator('.nh-when').textContent()).trim() === 'Done', 'the finished row says Done');
  ok((await today.locator('.nh-prog-t').textContent()).trim() === `1 of ${nToday} done`, `X of Y reads 1 of ${nToday} done`);
  ok(await chip('today') === todayChip0 - 1, `the due today chip dropped from ${todayChip0} to ${await chip('today')}`);
  ok(/Marked done/.test(await page.locator('[role="status"][aria-live="polite"]').allTextContents().then(a => a.join(' '))), 'the polite live region says Marked done');
  ok(await page.getByText(/done for/).first().isVisible(), 'an Undo toast is up');
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await page.waitForTimeout(500);
  ok(await today.locator('.nh-row.is-done').count() === 0 && await chip('today') === todayChip0, 'Undo reopens the task and the chip counts back');
  ok(lastWrite().body?.set?.checklists?.some(l => l.items.some(i => i.done === false)), 'the Undo patch carries the checklists again');
  void taskName;

  // 2. Tomorrow on a task, then on a callback.
  const taskTomorrow = overdue.getByRole('button', { name: /^Move to tomorrow: Make graphics/ });
  const n0 = writes.length;
  await taskTomorrow.click();
  await page.waitForTimeout(150);
  ok(await overdue.locator('.nh-row.is-leaving').count() === 1, 'the row fades before it goes');
  await page.waitForTimeout(700);
  const w2 = writes[n0];
  const due = w2?.body?.set?.checklists?.flatMap(l => l.items).map(i => i.due) || [];
  ok(due.includes(nine), `Tomorrow on a task writes 9:00 AM New York tomorrow (${nine})`);
  ok(await overdue.locator('.nh-row').count() === Math.min(5, overChip0 - 1) && Number((await overdue.locator('.nh-count').textContent()).trim()) === overChip0 - 1 && await chip('overdue') === overChip0 - 1, 'the row left Overdue, the count and the chip dropped');
  ok(/moved to tomorrow/i.test(await page.locator('.v-toast, [role="status"]').allTextContents().then(a => a.join(' '))), 'a toast says it moved, with Undo');
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await page.waitForTimeout(500);
  ok(await overdue.locator('.nh-row').count() === Math.min(5, overChip0) && await chip('overdue') === overChip0, 'Undo puts the row back in Overdue');

  const cbTomorrow = overdue.getByRole('button', { name: /^Move to tomorrow: Call back/ });
  const n1 = writes.length;
  await cbTomorrow.click();
  await page.waitForTimeout(900);
  const w3 = writes[n1];
  /* the shared patch helper adds the recomputed nextAction to any write that touches callbackAt; nothing else rides along */
  ok(w3?.body?.set && Object.keys(w3.body.set).filter(k => k !== 'nextAction').join() === 'callbackAt' && w3.body.set.callbackAt === nine, `Tomorrow on a callback writes callbackAt alone (plus the recomputed nextAction), 9:00 AM New York tomorrow (${JSON.stringify(w3?.body?.set).slice(0, 110)})`);
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await page.waitForTimeout(500);

  // 3. The check on a callback opens the Log outcome sheet and writes nothing.
  const cbCheck = today.getByRole('button', { name: /^Log the outcome: Call back/ }).first();
  const n2 = writes.length;
  await cbCheck.click();
  await page.waitForTimeout(500);
  ok(await page.getByRole('dialog', { name: 'Log the outcome' }).count() === 1 || await page.getByText('Log the outcome').first().isVisible(), 'the check on a callback opens the Log outcome sheet');
  ok(writes.length === n2, 'and writes nothing yet');
  for (const label of ['Booked', 'Callback', 'No answer', 'Said no', 'Wrong number']) ok(await page.getByRole('button', { name: label }).first().isVisible().catch(() => false), `the sheet offers ${label}`);
  await page.getByRole('button', { name: 'No answer' }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  await page.waitForTimeout(700);
  const w4 = writes[writes.length - 1];
  ok(writes.length === n2 + 1 && w4.body?.set?.callStatus === 'no-answer' && w4.body.set.callLog?.some(e => e.outcome === 'no-answer'), `a saved outcome writes the call log (${JSON.stringify(w4?.body?.set).slice(0, 100)})`);
  ok(await today.locator('.nh-row.is-done').count() === 1, 'the callback row shows done once the outcome is saved');

  // 4. The check on a rule action opens the record.
  const ruleCheck = today.getByRole('button', { name: /^Open at this step: Chase the invoice/ }).first();
  const n3 = writes.length;
  await ruleCheck.click();
  await page.waitForTimeout(900);
  ok(writes.length === n3 && !/\/admin\/?$/.test(page.url()), `the check on a rule action opens the record and writes nothing (${page.url().replace(BASE, '')})`);

  // 5. Coming up: folded on a phone, open on a computer, remembered.
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.nh-row', { timeout: 8000 }).catch(async () => { console.log('   no rows after reload:', page.url(), (await page.evaluate(() => document.body.innerText)).slice(0, 160).replace(/\n/g, ' | ')); });
  const head = coming.locator('.nh-coming-head');
  const open0 = (await head.getAttribute('aria-expanded')) === 'true';
  ok(open0 === !phone, `Coming up is ${phone ? 'folded on a phone' : 'open on a computer'}`);
  await head.click();
  await page.waitForTimeout(500);
  ok((await head.getAttribute('aria-expanded')) === String(!open0) && await page.evaluate(() => localStorage.getItem('vz_home_coming')) === (open0 ? '0' : '1'), 'the toggle flips aria-expanded and is remembered');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.nh-row');
  ok((await coming.locator('.nh-coming-head').getAttribute('aria-expanded')) === String(!open0), 'the choice survives a reload');

  // 6. Nine overdue (Rob's real number): five rows, "Show 4 more", open in place, "Show fewer"; Today is never capped.
  const day = 864e5;
  const extra = Array.from({ length: 4 }, (_, i) => ({ _id: `XO${i}`, business: `Extra Overdue Co ${i + 1}`, stage: 'lead', callStatus: 'callback', callbackAt: new Date(Date.now() - (6 + i) * day).toISOString(), phone: '(302) 555-01' + String(10 + i) }));
  const extraToday = Array.from({ length: 4 }, (_, i) => ({ _id: `XT${i}`, business: `Extra Today Co ${i + 1}`, stage: 'lead', callStatus: 'callback', callbackAt: new Date(Date.now() - (i + 1) * 60e3).toISOString(), phone: '(302) 555-02' + String(10 + i) }));
  /* Six callbacks a few days out: Coming up gets longer than the skeleton's old cap of four rows. */
  const extraLater = Array.from({ length: 6 }, (_, i) => ({ _id: `XL${i}`, business: `Extra Later Co ${i + 1}`, stage: 'lead', callStatus: 'callback', callbackAt: new Date(Date.now() + (2 + (i % 4)) * day + i * 36e5).toISOString(), phone: '(302) 555-03' + String(10 + i) }));
  const bigBody = JSON.stringify({ items: [...FIXTURE_LEADS, ...extra, ...extraToday, ...extraLater] });
  const page2 = await ctx.newPage();
  await mockRoutes(page2, { session: true });
  await page2.route('**/api/admin/call-leads**', async (r) => { if (r.request().method() !== 'GET' || r.request().url().includes('deleted=1')) return r.fallback(); return r.fulfill({ status: 200, contentType: 'application/json', body: bigBody }); });
  await page2.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page2.waitForSelector('.nh-row');
  await page2.waitForTimeout(800);
  const od = page2.locator('[data-card="next-overdue"]'); const td = page2.locator('[data-card="next-today"]');
  const chip2 = async (id) => Number((await page2.locator(`[data-ov="${id}"] .v-ov-n`).first().textContent()).trim());
  const totalOver = await chip2('overdue'); const totalToday = await chip2('today');
  ok(totalOver === overChip0 + 4 && totalOver > 5, `four more overdue make ${totalOver}`);
  ok(await od.locator('.nh-row').count() === 5, `${totalOver} overdue show five rows (${await od.locator('.nh-row').count()})`);
  ok(Number((await od.locator('.nh-count').textContent()).trim()) === totalOver, `the count pill says ${totalOver}`);
  ok(await td.locator('.nh-row').count() === totalToday && totalToday >= 7, `Today shows all ${totalToday}, never capped (${await td.locator('.nh-row').count()})`);
  const hidden = totalOver - 5;
  const more = od.getByRole('button', { name: new RegExp(`^Show ${hidden} more$`) });
  ok(await more.count() === 1 && (await more.getAttribute('aria-expanded')) === 'false', `a "Show ${hidden} more" button with aria-expanded false`);
  await more.click();
  await page2.waitForTimeout(300);
  ok(await od.locator('.nh-row').count() === totalOver && (await od.getByRole('button', { name: /^Show fewer$/ }).getAttribute('aria-expanded')) === 'true', `it expands in place to ${totalOver} rows`);
  await od.getByRole('button', { name: /^Show fewer$/ }).click();
  await page2.waitForTimeout(300);
  ok(await od.locator('.nh-row').count() === 5, 'and folds back to five');

  // 6b. The skeleton holds the place of the two cards that share the first row, whatever their length: Overdue starts where it started
  // in the skeleton. The stored counts come from the load just above (Today past six rows, Coming up past four).
  const nLater = await page2.locator('[data-card="next-coming"] .nh-row--later').count();
  const page5 = await ctx.newPage();
  await mockRoutes(page5, { session: true });
  await page5.route('**/api/admin/call-leads**', async (r) => { if (r.request().method() !== 'GET' || r.request().url().includes('deleted=1')) return r.fallback(); await new Promise((res) => setTimeout(res, 1800)); return r.fulfill({ status: 200, contentType: 'application/json', body: bigBody }); });
  await page5.goto(`${BASE}/admin`, { waitUntil: 'commit' });
  await page5.waitForSelector('.nh[aria-busy="true"] .nh-wide', { timeout: 8000 });
  const skelTop = await page5.evaluate(() => document.querySelector('.nh[aria-busy="true"] .nh-wide').getBoundingClientRect().top);
  await page5.waitForSelector('[data-card="next-overdue"]', { timeout: 12000 });
  await page5.waitForTimeout(500);
  const loadedTop = await page5.evaluate(() => document.querySelector('[data-card="next-overdue"]').getBoundingClientRect().top);
  const comingOpenNow = (await page5.locator('[data-card="next-coming"] .nh-coming-head').getAttribute('aria-expanded')) === 'true';
  ok(totalToday >= 7 && (nLater >= 5 || !comingOpenNow), `the long case is real: Today has ${totalToday} rows, Coming up ${nLater} and is ${comingOpenNow ? 'open' : 'folded'}`);
  ok(Math.abs(skelTop - loadedTop) <= 4, `Overdue starts at ${Math.round(skelTop)}px in the skeleton and ${Math.round(loadedTop)}px when the data lands (no jump)`);
  await page5.close();

  // 7. The empty and the error states.
  const page3 = await ctx.newPage();
  await mockRoutes(page3, { session: true, empty: ['leads'] });
  await page3.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page3.waitForSelector('[data-card="next-today"]');
  await page3.waitForTimeout(600);
  ok(await page3.getByText('Today is clear. Nice work.').isVisible(), 'Today says "Today is clear. Nice work." with nothing due');
  ok(await page3.getByText("Nothing overdue. You're caught up.").isVisible(), 'Overdue says "Nothing overdue. You\'re caught up."');
  ok(await page3.locator('.nh-clear.is-good').evaluate(e => getComputedStyle(e).color) !== await page3.locator('.nh-card--today .nh-clear').evaluate(e => getComputedStyle(e).color), 'the overdue line is green, the today line is not');
  const page4 = await ctx.newPage();
  await mockRoutes(page4, { session: true, fail: ['leads'] });
  await page4.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page4.waitForTimeout(1200);
  ok(await page4.locator('.v-error').count() > 0 && await page4.getByRole('button', { name: /try again|retry/i }).count() > 0, 'a leads failure shows the error state with Retry where Next up goes');
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nhome-nextup-test: all passed');
process.exit(fails ? 1 : 0);
