/* Gesture test (CRM mobile revamp, milestone 6): the touch gestures of the phone app, driven with real touch events (CDP) at 390.
 *
 *   edge Back      a drag from the left edge moves the screen with the finger, the screen it returns to shows beneath it, a release
 *                  past 40 percent completes it through history, a short one springs back; it does not start on a sideways scroller
 *   sheet          a bottom sheet follows the finger, the screen behind scales back (never under 0.96) and returns, a release past a
 *                  third (or a flick) dismisses, a short one springs back; the body drags it too when scrolled to the top
 *   row swipe      a lead row follows the finger, arms past the threshold, commits on release (a callback write), reverts below it
 *   long press     a lead, client and project row opens its sheet and the tap that follows does not open the record
 *   scrollers      none of these fire on a sideways scrolling area
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/gesture-test.mjs            AUDIT_BASE=http://127.0.0.1:4331 node scripts/gesture-test.mjs
 */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const W = 390; const H = 844;

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const results = []; let failures = 0;
const step = async (name, fn) => {
  const page = await ctx.newPage();
  try { const note = await fn(page); results.push({ name, ok: true, note: note || '' }); }
  catch (e) { failures++; results.push({ name, ok: false, note: String(e.message || e).split('\n')[0].slice(0, 200) }); }
  await page.close();
};
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

async function open(page, path, extra = {}) {
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.removeItem('vz_call_session'); localStorage.setItem('vz_leads_view', JSON.stringify('list')); } catch {} });
  await mockRoutes(page, extra);
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const cdp = await ctx.newCDPSession(page);
  const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  return { t, wait: (ms) => page.waitForTimeout(ms) };
}
const drag = async (g, x0, y0, x1, y1, steps = 10, pause = 16) => { await g.t('touchStart', x0, y0); for (let i = 1; i <= steps; i++) { await g.t('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); await g.wait(pause); } };
const openRecord = async (page) => { await page.locator('.sh-content [data-row-id] .v-stretch').nth(2).evaluate(el => el.click()); await page.waitForTimeout(900); };
const state = (page) => page.evaluate(() => ({ chrome: document.querySelector('.sh-root')?.dataset.chrome, edge: document.querySelector('.sh-col')?.dataset.edgeBack || '', tx: document.querySelector('.sh-col > .sh-content')?.style.transform || '', peek: !!document.querySelector('.sh-peek'), peekRows: !!document.querySelector('.sh-peek [data-row-id]'), path: location.pathname }));

await step('edge Back follows the finger and the previous screen shows beneath', async (page) => {
  const g = await open(page, '/admin/leads'); await openRecord(page);
  need((await state(page)).chrome === 'focused', 'the record is not a focused screen');
  await drag(g, 6, 400, 200, 402);
  const mid = await state(page);
  need(mid.edge === 'dragging', `state ${mid.edge}`); need(/translate3d\(1[5-9]\d|2\d\d/.test(mid.tx), `the screen did not follow (${mid.tx})`); need(mid.peek, 'no screen beneath'); need(mid.peekRows, 'the screen beneath is the plain ground, not the list');
  await g.t('touchMove', 260, 402); await g.t('touchEnd'); await g.wait(900);
  const done = await state(page); need(done.chrome === 'tabs', `chrome ${done.chrome} after the release`); need(!done.peek && !done.tx, 'the swipe left debris behind');
  return `followed to ${mid.tx}, completed to the list`;
});
await step('edge Back springs back below the threshold', async (page) => {
  const g = await open(page, '/admin/leads'); await openRecord(page);
  await drag(g, 6, 400, 90, 401, 6); await g.t('touchEnd'); await g.wait(800);
  const s = await state(page); need(s.chrome === 'focused' && !s.peek && !s.tx, `not back where it was: ${JSON.stringify(s)}`);
  return 'a short drag returned the record';
});
await step('edge Back completes on a flick', async (page) => {
  const g = await open(page, '/admin/leads'); await openRecord(page);
  await drag(g, 6, 400, 110, 401, 3, 8); await g.t('touchEnd'); await g.wait(900);
  need((await state(page)).chrome === 'tabs', 'a quick short flick did not go back');
  return 'a flick under 40 percent went back';
});
await step('edge Back does not start on a sideways scroller', async (page) => {
  const g = await open(page, '/admin/leads'); await openRecord(page);
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'gt-scroll'; d.style.cssText = 'position:fixed;left:0;top:300px;width:300px;height:120px;overflow-x:auto;z-index:99;background:#222'; d.innerHTML = '<div style="width:900px;height:100px">sideways</div>'; document.querySelector('.sh-content').appendChild(d); });
  await drag(g, 6, 350, 220, 352);
  const mid = await state(page); need(mid.edge === '' && !mid.peek && !mid.tx, `the swipe started on a scroller: ${JSON.stringify(mid)}`);
  await g.t('touchEnd'); await g.wait(300);
  return 'a scroller keeps its own swipe (the screen did not move)';
});
await step('a sheet follows the finger, the screen recedes (0.96 at most), a short drag springs back', async (page) => {
  const g = await open(page, '/admin/leads');
  await page.locator('.ld-stack .lc').first().evaluate(el => el.dispatchEvent(new Event('x'))).catch(() => {});
  const row = page.locator('.ld-stack .lc').first(); const box = await row.boundingBox();
  await g.t('touchStart', box.x + 60, box.y + 20); await g.wait(700); await g.t('touchEnd'); await g.wait(500);
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
  const rest = await page.evaluate(() => { const r = document.querySelector('.lay-root'); return { rec: r.getAttribute('data-v-recede'), v: Number(r.style.getPropertyValue('--v-recede')), scale: getComputedStyle(document.querySelector('.sh-col')).transform }; });
  need(rest.rec === 'on' && rest.v === 1, `the screen did not recede: ${JSON.stringify(rest)}`);
  const m = /matrix\(([\d.]+)/.exec(rest.scale); need(m && Number(m[1]) >= 0.96 && Number(m[1]) < 1, `scale ${rest.scale}`);
  const sb = await page.locator('.v-sheet-handle').boundingBox();
  await g.t('touchStart', sb.x + sb.width / 2, sb.y + 8); for (let y = 0; y <= 60; y += 15) { await g.t('touchMove', sb.x + sb.width / 2, sb.y + 8 + y); await g.wait(16); }
  const mid = await page.evaluate(() => ({ tr: document.querySelector('.v-sheet').style.transform, v: Number(document.querySelector('.lay-root').style.getPropertyValue('--v-recede')) }));
  need(/translateY\(\d+px\)/.test(mid.tr) && mid.v < 1 && mid.v > 0.7, `the sheet did not follow: ${JSON.stringify(mid)}`);
  await g.t('touchEnd'); await g.wait(500);
  need(await page.locator('[role="dialog"]').count() === 1, 'a short drag dismissed the sheet');
  return `receded to ${m[1]}, followed to ${mid.tr}, sprang back`;
});
await step('a sheet dismisses past a third of its height and the screen returns', async (page) => {
  const g = await open(page, '/admin/leads');
  const box = await page.locator('.ld-stack .lc').first().boundingBox();
  await g.t('touchStart', box.x + 60, box.y + 20); await g.wait(700); await g.t('touchEnd'); await g.wait(500);
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
  const sb = await page.locator('.v-sheet-handle').boundingBox(); const h = (await page.locator('.v-sheet').boundingBox()).height;
  await g.t('touchStart', sb.x + sb.width / 2, sb.y + 8); for (let y = 0; y <= h / 3 + 60; y += 25) { await g.t('touchMove', sb.x + sb.width / 2, sb.y + 8 + y); await g.wait(16); }
  await g.t('touchEnd'); await g.wait(700);
  need(await page.locator('[role="dialog"]').count() === 0, 'the sheet is still open');
  const back = await page.evaluate(() => ({ rec: document.querySelector('.lay-root').getAttribute('data-v-recede'), t: getComputedStyle(document.querySelector('.sh-col')).transform }));
  need(!back.rec && (back.t === 'none' || /matrix\(1,/.test(back.t)), `the screen did not return: ${JSON.stringify(back)}`);
  return 'dismissed, screen back at full size';
});
await step('a lead row follows the finger, arms and commits a callback, reverts below the threshold', async (page) => {
  const writes = []; page.on('request', r => { if (r.method() === 'PATCH' && /call-leads/.test(r.url())) writes.push(r.postData()); });
  const g = await open(page, '/admin/leads'); await g.wait(1500); writes.length = 0;
  const row = page.locator('.ld-stack .v-swipe').first(); const box = await row.boundingBox();
  await drag(g, box.x + 250, box.y + 25, box.x + 220, box.y + 26, 3); await g.wait(60);
  const small = await row.evaluate(el => ({ s: el.dataset.swipe, tx: el.querySelector('.v-swipe-fg').style.transform }));
  need(small.s === 'dragging' && /translate3d\(-/.test(small.tx), `a short drag: ${JSON.stringify(small)}`);
  await g.t('touchEnd'); await g.wait(500); need(writes.length === 0, 'a short swipe wrote');
  await drag(g, box.x + 280, box.y + 25, box.x + 120, box.y + 26, 8);
  const armed = await row.evaluate(el => ({ s: el.dataset.swipe, hint: el.querySelector('.v-swipe-hint')?.textContent.trim() }));
  need(armed.s === 'armed' && /Callback/.test(armed.hint), `not armed: ${JSON.stringify(armed)}`);
  await g.t('touchEnd'); await g.wait(700);
  need(writes.length === 1 && /callback/.test(writes[0]), `no callback write: ${JSON.stringify(writes)}`);
  need((await state(page)).path === '/admin/leads' && (await page.evaluate(() => !history.state?.usr?.open)), 'the swipe also opened the record');
  return 'followed, armed, wrote one callback, nothing else opened';
});
await step('a task row follows the finger, a swipe right completes it with one checklists write, a swipe left opens its sheet', async (page) => {
  const writes = []; page.on('request', r => { if (r.method() === 'PATCH' && /call-leads/.test(r.url())) writes.push(r.postData()); });
  const g = await open(page, '/admin/clients/L11/tasks'); await g.wait(600);
  /* The Content month list: its first open task can be swiped right (a done task offers no Done). */
  await page.locator('.tk-body .v-lrow').filter({ hasText: 'Content month' }).locator('.v-stretch').first().evaluate(el => el.click()); await g.wait(900);
  const row = page.locator('.tk-rows .v-swipe').first(); const box = await row.boundingBox();
  need(!!box, 'no task row on the checklist step');
  writes.length = 0;
  await drag(g, box.x + 120, box.y + 22, box.x + 150, box.y + 23, 3); await g.wait(60);
  const small = await row.evaluate(el => ({ s: el.dataset.swipe, tx: el.querySelector('.v-swipe-fg').style.transform }));
  need(small.s === 'dragging' && /translate3d\(/.test(small.tx), `a short drag: ${JSON.stringify(small)}`);
  await g.t('touchEnd'); await g.wait(500); need(writes.length === 0, 'a short swipe wrote');
  await drag(g, box.x + 60, box.y + 22, box.x + 220, box.y + 23, 8);
  const armed = await row.evaluate(el => ({ s: el.dataset.swipe, hint: el.querySelector('.v-swipe-hint')?.textContent.trim() }));
  need(armed.s === 'armed' && /Done/.test(armed.hint), `not armed: ${JSON.stringify(armed)}`);
  await g.t('touchEnd'); await g.wait(800);
  need(writes.length === 1 && /checklists/.test(writes[0]) && /"done":true/.test(writes[0]), `no checklists write: ${JSON.stringify(writes)}`);
  need(await page.locator('.tk-rows .tk-row.is-done').count() >= 1, 'the row did not read as done');
  const other = page.locator('.tk-rows .v-swipe').nth(1); const b2 = await other.boundingBox();
  if (b2) {
    await drag(g, b2.x + 280, b2.y + 22, b2.x + 120, b2.y + 23, 8); await g.t('touchEnd'); await g.wait(700);
    const t = await page.locator('[role="dialog"]').innerText().catch(() => '');
    need(/Pin as Next up|Auto/.test(t) && /Reschedule/.test(t) && /Delete task/.test(t), `the task sheet lacks its actions: ${t.slice(0, 80)}`);
  }
  return `followed, armed, one checklists write, ${b2 ? 'the sheet from a swipe left' : 'one row only'}`;
});
await step('long press opens the lead sheet and the tap that follows does not open the record', async (page) => {
  const g = await open(page, '/admin/leads');
  const box = await page.locator('.ld-stack .lc').first().boundingBox();
  await g.t('touchStart', box.x + 60, box.y + 20); await g.wait(700); await g.t('touchEnd'); await g.wait(500);
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
  const t = await page.locator('[role="dialog"]').innerText(); need(/Open the record/.test(t) && /Phone/.test(t), `the sheet lacks the essentials: ${t.slice(0, 80)}`);
  need(await page.evaluate(() => !history.state?.usr?.open), 'the long press opened the record');
  return 'sheet with the essentials and the actions';
});
await step('long press opens a client sheet and a project sheet', async (page) => {
  const g = await open(page, '/admin/clients');
  let box = await page.locator('.cl-stack .v-swipe').first().boundingBox();
  await g.t('touchStart', box.x + 60, box.y + 20); await g.wait(700); await g.t('touchEnd'); await g.wait(500);
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 }); need(/Open/.test(await page.locator('[role="dialog"]').innerText()), 'the client sheet has no Open');
  await page.keyboard.press('Escape'); await g.wait(500);
  await page.goto(BASE + '/admin/projects', { waitUntil: 'networkidle' }); await g.wait(900);
  box = await page.locator('.pj-stack .v-swipe').first().boundingBox();
  await g.t('touchStart', box.x + 60, box.y + 20); await g.wait(700); await g.t('touchEnd'); await g.wait(500);
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 }); need(/Open the client/.test(await page.locator('[role="dialog"]').innerText()), 'the project sheet has no Open');
  return 'client and project sheets';
});
await step('a row swipe does not fire on a sideways scroller', async (page) => {
  const writes = []; page.on('request', r => { if (r.method() === 'PATCH') writes.push(r.url()); });
  const g = await open(page, '/admin/leads'); await g.wait(1500); writes.length = 0;
  const rail = page.locator('.ld-frow-chips, .ld-chiprail, [class*="chips"]').first();
  const b = await rail.boundingBox(); need(b, 'no chip rail');
  const before = await rail.evaluate(el => el.scrollLeft);
  await drag(g, b.x + 300, b.y + b.height / 2, b.x + 60, b.y + b.height / 2, 8); await g.t('touchEnd'); await g.wait(400);
  need(writes.length === 0, 'the rail drag wrote something');
  need(await page.locator('.v-swipe[data-swipe="armed"]').count() === 0, 'a row armed');
  return `rail scrolled ${before} to ${await rail.evaluate(el => el.scrollLeft)}`;
});

await browser.close();
console.log('\n| Step | Result | Note |\n|---|---|---|');
for (const r of results) console.log(`| ${r.name} | ${r.ok ? 'ok' : 'FAIL'} | ${r.note} |`);
console.log(`\nSteps: ${results.length}. Failures: ${failures}.`);
process.exit(failures ? 1 : 0);
