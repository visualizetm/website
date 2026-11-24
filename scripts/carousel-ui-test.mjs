#!/usr/bin/env node
/* Carousel posts in a browser (carousel job), at 390 and 1280, against the audit fixtures (scripts/audit-fixtures.mjs: PO30 is
 * a seven slide carousel with a square slide 3, PO1 a single picture post).
 *
 *   Rob's editor and board (milestone 2): the slide strip (numbered 4:5 thumbnails, Cover on slide 1, the counter, the ratio
 *   line), Move left and Move right as one write that moves imageUrl with the cover, Remove with Undo on the toast, a slide
 *   added by link (a bad link refused), twenty as the limit (adds off, the counter says so), drag only for a mouse, 44px
 *   controls, a single picture post unchanged, and the board card's stack icon and count.
 *
 *   The client planner and Rob's preview (milestone 3): the post page's carousel (scroll snap, the "1 / 4" counter in a live
 *   region and the dots, alt or "Slide 2 of 4", the first picture eager and the rest lazy in boxes sized before they load, no
 *   layout shift), a finger's swipe landing on a whole slide with the counter following and the page not going Back, the arrow
 *   keys, Previous and Next at 768 and up only, a change note prefixed "Slide 3: " in the one request-change body (the post page
 *   and Review), Save 5 to photos as one share of five named files with the progress and done lines, a slide that did not save
 *   named with Try slide 2 again saving only that one, the List's "Carousel, 4 slides" and the feed's stack icon, a single
 *   picture post unchanged, and Rob's preview drawing the carousel with no write control.
 *
 *   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/carousel-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, appSignIn, posts as fixturePosts, APP_PLANNER_TOKEN, APP_CAROUSEL_TOKEN } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
let passes = 0; let fails = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`ok   ${m}`); } else { fails++; console.log(`FAIL ${m}`); } };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const PO30 = fixturePosts.find(p => p._id === 'PO30');
const urls30 = PO30.slides.map(s => s.url);

async function session(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, isMobile: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* none */ } });
  await mockRoutes(page, {});
  const writes = [];
  page.on('request', (r) => { if (['PATCH', 'POST'].includes(r.method()) && /\/api\/admin\/posts/.test(r.url())) { let b = {}; try { b = JSON.parse(r.postData() || '{}'); } catch { /* none */ } writes.push(b); } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, writes, errors };
}
const until = (page, sel, t = 6000) => page.waitForSelector(sel, { timeout: t }).then(() => true).catch(() => false);
const openEditor = async (page, width, id, text) => {
  if (width < 768) { await page.goto(`${BASE}/admin/clients/L11/planner/${id}`, { waitUntil: 'domcontentloaded' }); return; }
  await page.goto(`${BASE}/admin/clients/L11/planner`, { waitUntil: 'domcontentloaded' });
  await until(page, '.pb-card');
  await page.locator('.pb-card').filter({ hasText: text }).first().locator('.v-stretch').click();
};
const slideWrites = (writes) => writes.filter(w => w?.set && Array.isArray(w.set.slides));

for (const width of [390, 1280]) {
  console.log(`\n${width}px`);
  /* The board card. */
  if (width >= 768) {
    const { ctx, page } = await session(width);
    await page.goto(`${BASE}/admin/clients/L11/planner`, { waitUntil: 'domcontentloaded' });
    await until(page, '.pb-card');
    const car = page.locator('.pb-card').filter({ hasText: 'Before and after' }).first();
    ok(await car.locator('.pb-slides').count() === 1 && (await car.locator('.pb-slides').getAttribute('aria-label')) === '7 pictures' && (await car.locator('.pb-slides').innerText()).trim() === '7' && await car.locator('.pb-slides svg').count() === 1, 'the board card of a carousel carries the stack icon and 7');
    ok(await page.locator('.pb-card').filter({ hasText: 'Peach dumplings' }).first().locator('.pb-slides').count() === 0, 'a single picture card has no stack icon');
    const src = await car.locator('.pb-thumb img').getAttribute('src');
    ok(src === urls30[0], 'the card shows the cover');
    await ctx.close();
  }

  /* The editor's slide strip. */
  const { ctx, page, writes, errors } = await session(width);
  await openEditor(page, width, 'PO30', 'Before and after');
  ok(await until(page, '.ss-item'), 'a carousel opens on the slide strip');
  ok(await page.locator('.ss-item').count() === 7 && (await page.locator('.ss-count').innerText()).trim() === '7 slides. Slide 1 is the cover.', 'seven numbered thumbnails and the counter');
  ok(await page.locator('.ss-item').first().locator('.ss-cover').count() === 1 && await page.locator('.ss-cover').count() === 1 && (await page.locator('.ss-num').allInnerTexts()).join(',') === '1,2,3,4,5,6,7', 'Cover on slide 1 only, each numbered in order');
  ok(await until(page, '.ss-warn') && (await page.locator('.ss-warn').innerText()).includes('Slide 3 is 1:1. Instagram crops a carousel to the first slide\'s shape.'), 'the square slide 3 gets the soft ratio line');
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'), null, { timeout: 4000 }).catch(() => {}); // measured at rest, not mid entrance
  const boxes = await page.locator('.ss-ctl button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  ok(boxes.length === 21 && boxes.every(h => h >= 44), `Move left, Move right and Remove on each thumbnail, every one 44px (${Math.min(...boxes)})`);
  ok(await page.locator('.ss-item').first().locator('[data-move="left"]').isDisabled() && await page.locator('.ss-item').last().locator('[data-move="right"]').isDisabled(), 'the first slide cannot move left, the last cannot move right');
  const fine = await page.evaluate(() => matchMedia('(pointer: fine)').matches);
  const draggable = await page.locator('.ss-item[draggable="true"]').count();
  ok(fine ? draggable === 7 : draggable === 0, `drag only for a mouse (pointer fine ${fine}, ${draggable} draggable)`);
  writes.length = 0;
  await page.getByRole('button', { name: 'Move slide 2 left' }).click();
  await page.waitForTimeout(2200);
  const mv = slideWrites(writes).pop();
  ok(mv && mv.set.slides.map(s => s.url).join(' ') === [urls30[1], urls30[0], ...urls30.slice(2)].join(' ') && mv.set.imageUrl === urls30[1], 'Move slide 2 left is one write with the new order and the new cover as imageUrl');
  ok((await page.locator('.ss-item').first().locator('img').getAttribute('src')) === urls30[1] && await page.locator('.ss-item').first().locator('.ss-cover').count() === 1, 'the moved slide is now slide 1, with Cover');
  ok(await page.evaluate(() => document.activeElement?.closest?.('[data-slide]')?.getAttribute('data-slide')) === '0', 'focus follows the slide that moved');
  await page.getByRole('button', { name: 'Remove slide 3' }).click();
  ok(await page.locator('.ss-item').count() === 6 && await until(page, '.v-toast:has-text("Slide 3 removed.")', 3000), 'Remove takes the slide off at once, with no confirm, and the toast says which');
  await page.locator('.v-toast').getByRole('button', { name: /Undo/ }).click().catch(() => {});
  ok(await page.locator('.ss-item').count() === 7, 'Undo on the toast puts it back');
  await page.getByLabel('Add a slide by link').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  ok(await until(page, '.ss .v-field-msg--error', 2000) && await page.locator('.ss-item').count() === 7, 'a link that is not a picture link is refused');
  for (let i = 8; i <= 20; i++) { await page.getByLabel('Add a slide by link').fill(`https://res.cloudinary.com/demo/image/upload/extra-${i}.jpg`); await page.getByRole('button', { name: 'Add', exact: true }).click(); }
  ok(await page.locator('.ss-item').count() === 20 && (await page.locator('.ss-count').innerText()).trim() === "20 of 20, Instagram's limit.", 'a link adds one slide at the end; at twenty the counter says the limit');
  ok(await page.getByLabel('Add a slide by link').isDisabled() && await page.getByRole('button', { name: 'Add', exact: true }).isDisabled(), 'at twenty the adds are off');
  await page.waitForTimeout(2500);
  const last = slideWrites(writes).pop();
  ok(last && last.set.slides.length === 20 && last.set.slides[19].url.endsWith('extra-20.jpg'), 'the twenty slides are saved in order');
  ok(errors.length === 0, `no page errors (${errors.join('; ').slice(0, 120)})`);
  await ctx.close();

  /* A single picture post: exactly as before. */
  const s2 = await session(width);
  await openEditor(s2.page, width, 'PO2', 'Behind the counter');
  await until(s2.page, '.sc-imgfield');
  ok(await s2.page.locator('.ss-item').count() === 0 && await s2.page.locator('.sc-imgfield').count() === 1, 'a single picture post keeps its one image field, no strip');
  await s2.ctx.close();
}

/* The client planner (milestone 3). Writes to /api/planner are answered here, recorded and never applied to the shared fixtures. */
async function client(width, token = APP_PLANNER_TOKEN, init) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, isMobile: width < 768, serviceWorkers: 'block', acceptDownloads: true });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  await page.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* none */ } });
  await mockRoutes(page, {});
  const sent = [];
  await page.route('**/api/planner**', (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* none */ }
    sent.push(b);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: b.action === 'approve' ? 'approved' : 'making' }) });
  });
  await appSignIn(page, token, BASE);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, sent, errors };
}
const PO31 = fixturePosts.find(p => p._id === 'PO31');
const PO32 = fixturePosts.find(p => p._id === 'PO32');
const count = (page) => page.locator('.pl-car-count').innerText().then(t => t.trim()).catch(() => '');

for (const width of [390, 1280]) {
  console.log(`\n${width}px, the client planner`);
  {
    const { ctx, page, sent, errors } = await client(width);
    await page.goto(`${BASE}/app/planner?post=PO31`, { waitUntil: 'domcontentloaded' });
    ok(await until(page, '.pl-car'), 'a carousel post opens on the carousel');
    const slides = page.locator('.pl-car-slide');
    ok(await slides.count() === 4 && await count(page) === '1 / 4' && (await page.locator('.pl-car-count').getAttribute('aria-live')) === 'polite', 'four slides, the counter reads 1 / 4 in a polite live region');
    ok(await page.locator('.pl-car-dot').count() === 4 && await page.locator('.pl-car-dot.is-on').count() === 1 && await page.locator('.pl-car-dot').first().evaluate(e => e.classList.contains('is-on')), 'four dots, the first one on');
    const imgs = await page.locator('.pl-car-slide img').evaluateAll(els => els.map(e => ({ alt: e.alt, loading: e.getAttribute('loading'), w: e.getAttribute('width'), h: e.getAttribute('height') })));
    ok(imgs.map(i => i.alt).join('|') === PO31.slides.map((s, k) => s.alt || `Slide ${k + 1} of 4`).join('|'), `each slide's alt is its own or "Slide n of 4" (${imgs[1]?.alt})`);
    ok(imgs[0].loading === 'eager' && imgs.slice(1).every(i => i.loading === 'lazy') && imgs.every(i => i.w === '1080' && i.h === '1350'), 'the first picture loads at once, the rest lazily, each with its size');
    const css = await page.locator('.pl-car-track').evaluate(e => { const c = getComputedStyle(e); const s = getComputedStyle(e.firstElementChild); return { snap: c.scrollSnapType, over: c.overscrollBehaviorX, align: s.scrollSnapAlign, ox: c.overflowX }; });
    ok(/x/.test(css.snap) && /mandatory/.test(css.snap) && css.over === 'contain' && /start|center/.test(css.align) && /auto|scroll/.test(css.ox), `native scroll snap, no library (${css.snap}, overscroll ${css.over})`);
    const boxes = await slides.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    ok(boxes.every(([w, h]) => w > 0 && Math.abs(h - w * 1.25) <= 2), `every slide's 4:5 box is reserved before it loads (${boxes[0]})`);
    const btnShown = await page.locator('.pl-car-next').isVisible();
    if (width >= 768) {
      const bb = await page.locator('.pl-car-btn').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      ok(btnShown && bb.every(x => x >= 44) && await page.locator('.pl-car-prev').isDisabled(), `Previous and Next at 44px on a wider screen, Previous off on slide 1 (${bb})`);
      await page.locator('.pl-car-next').click();
      await page.waitForTimeout(700);
      ok(await count(page) === '2 / 4' && await page.locator('.pl-car-dot').nth(1).evaluate(e => e.classList.contains('is-on')), 'Next moves to slide 2, the counter and the dot follow');
      await page.locator('.pl-car-prev').click(); await page.waitForTimeout(700);
      ok(await count(page) === '1 / 4', 'Previous comes back');
    } else {
      ok(!btnShown && !(await page.locator('.pl-car-prev').isVisible()), 'no Previous and Next buttons on a phone: a swipe');
      const box = await page.locator('.pl-car-track').boundingBox();
      const cdp = await ctx.newCDPSession(page);
      const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      const y = box.y + box.height / 2;
      await t('touchStart', box.x + box.width - 30, y);
      for (let i = 1; i <= 12; i++) { await t('touchMove', box.x + box.width - 30 - (box.width * 0.7 * i) / 12, y); await page.waitForTimeout(16); }
      await t('touchEnd'); await page.waitForTimeout(900);
      const at = await page.locator('.pl-car-track').evaluate(e => ({ left: e.scrollLeft, w: e.clientWidth }));
      ok(await count(page) === '2 / 4' && Math.abs(at.left - at.w) <= 2, `a finger's swipe lands on slide 2, whole, and the counter says 2 / 4 (${at.left}/${at.w})`);
      await t('touchStart', box.x + 4, y);
      for (let i = 1; i <= 12; i++) { await t('touchMove', box.x + 4 + (box.width * 0.8 * i) / 12, y); await page.waitForTimeout(16); }
      await t('touchEnd'); await page.waitForTimeout(900);
      ok(page.url().includes('post=PO31') && await count(page) === '1 / 4', 'a swipe that starts at the left edge inside the carousel goes back a slide, never Back off the page');
    }
    await page.locator('.pl-car-track').focus();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
    ok(await count(page) === '3 / 4', 'the arrow keys move between slides when the carousel has focus');
    await page.keyboard.press('End'); await page.waitForTimeout(600);
    const atEnd = await count(page);
    await page.keyboard.press('Home'); await page.waitForTimeout(600);
    ok(atEnd === '4 / 4' && await count(page) === '1 / 4', 'End and Home go to the last and the first');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700);
    const cls = await page.evaluate(() => window.__cls);
    ok(cls < 0.05, `nothing shifts while the slides load and move (CLS ${cls.toFixed(4)})`);
    await page.locator('.pl-ask').click();
    await until(page, '[role="dialog"]');
    await page.locator('#pl-change-note').fill('Brighter please');
    await page.locator('.pl-send-change').click();
    await page.waitForTimeout(800);
    const ch = sent.find(b => b.action === 'request-change');
    ok(ch && ch.postId === 'PO31' && ch.note === 'Slide 3: Brighter please' && Object.keys(ch).sort().join(',') === 'action,note,postId,reason', `the change note names the slide on view, in the one request-change body (${ch && ch.note})`);
    ok(errors.length === 0, `no page errors (${errors.join('; ').slice(0, 120)})`);
    await ctx.close();
  }
  /* Review opening on a carousel (plnrCARO: only the carousel waits). */
  {
    const { ctx, page, sent } = await client(width, APP_CAROUSEL_TOKEN);
    await page.goto(`${BASE}/app/planner?review=1`, { waitUntil: 'domcontentloaded' });
    ok(await until(page, '.pl-review .pl-car') && await count(page) === '1 / 4', 'Review shows a carousel as one swipeable post');
    await page.locator('.pl-car-track').focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
    await page.locator('.pl-ask').click();
    await until(page, '[role="dialog"]');
    await page.getByRole('radio', { name: 'Different photo' }).click().catch(() => {});
    await page.locator('.pl-send-change').click();
    await page.waitForTimeout(800);
    const ch = sent.find(b => b.action === 'request-change');
    ok(ch && ch.postId === 'PO31' && /^Slide 2: \S/.test(ch.note) && ch.reason === 'photo', `Review's change note is prefixed too, the reason kept (${ch && ch.note})`);
    await ctx.close();
  }
  /* Save 5 to photos: one share of five named files. */
  {
    const init = () => { window.__shared = []; navigator.canShare = (d) => !!(d && d.files && d.files.length); navigator.share = async (d) => { window.__shared.push((d.files || []).map(f => f.name)); }; };
    const { ctx, page } = await client(width, APP_PLANNER_TOKEN, init);
    await page.route('**/showcase/fixtures/portrait.svg?d=*', async (r) => { if (r.request().resourceType() === 'fetch') await new Promise(res => setTimeout(res, 150)); return r.fallback(); });
    await page.goto(`${BASE}/app/planner?post=PO32`, { waitUntil: 'domcontentloaded' });
    await until(page, '.pl-postit');
    const step = page.locator('.pl-step-btn').first();
    ok((await step.locator('.pl-step-title').innerText()).trim() === 'Save 5 to photos' && (await step.locator('.pl-step-help').innerText()).trim() === 'They land in your photos, in order.', 'the save step reads Save 5 to photos');
    await step.click();
    ok(await until(page, '.pl-save-line:has-text("Saving ")', 3000), 'progress reads Saving i of 5 while it gathers them');
    ok(await until(page, '.pl-save-line:has-text("Saved 5 to photos")', 6000), 'then Saved 5 to photos');
    const shared = await page.evaluate(() => window.__shared);
    const want = [1, 2, 3, 4, 5].map(n => `-0${n}.svg`);
    ok(shared.length === 1 && shared[0].length === 5 && shared[0].every((nm, i) => nm.endsWith(want[i]) && nm.includes(PO32.date)), `one share with all five files, named in order with the date (${(shared[0] || []).slice(0, 2).join(', ')})`);
    ok(await step.evaluate(e => e.closest('.pl-step').classList.contains('is-done')), 'the step is ticked');
    await ctx.close();
  }
  /* One that did not save: named, and only that one tried again. */
  {
    const { ctx, page } = await client(width);
    let refuse = true; const fetched = [];
    await page.route('**/showcase/fixtures/portrait.svg?d=*', (r) => { if (r.request().resourceType() !== 'fetch') return r.fallback(); fetched.push(new URL(r.request().url()).search); return refuse && r.request().url().endsWith('d=2') ? r.abort() : r.fallback(); });
    await page.goto(`${BASE}/app/planner?post=PO32`, { waitUntil: 'domcontentloaded' });
    await until(page, '.pl-postit');
    const step = page.locator('.pl-step-btn').first();
    await step.click();
    ok(await until(page, '.pl-save-line:has-text("Slide 2 did not save.")', 6000) && (await step.locator('.pl-step-title').innerText()).trim() === 'Try slide 2 again', 'a slide that did not save is named, and the step offers Try slide 2 again');
    refuse = false; fetched.length = 0;
    await step.click();
    ok(await until(page, '.pl-save-line:has-text("Saved 5 to photos")', 6000) && fetched.join(',') === '?d=2', `the retry saves only slide 2 (${fetched.join(',')})`);
    await ctx.close();
  }
  /* The List and the feed. */
  {
    const { ctx, page } = await client(width);
    await page.goto(`${BASE}/app/planner?tab=plan`, { waitUntil: 'domcontentloaded' });
    await until(page, '.pl-seg');
    await page.getByRole('radio', { name: 'List' }).first().click();
    await page.waitForTimeout(400);
    const row = page.locator('.pl-row').filter({ hasText: 'Four kitchens' }).first();
    ok((await row.locator('.pl-row-sub').innerText()).trim() === 'Carousel, 4 slides' && /Carousel, 4 slides/.test(await row.locator('.v-stretch').getAttribute('aria-label')), 'the List says Carousel, 4 slides under the caption, and the row names it');
    ok(await page.locator('.pl-row').filter({ hasText: 'Peach dumplings' }).first().locator('.pl-row-sub').count() === 0, 'a single picture row has no carousel line');
    await page.getByRole('radio', { name: 'Feed' }).first().click();
    await page.waitForTimeout(400);
    ok(await page.locator('.pl-media-stack[aria-label="4 pictures"]').count() === 1 && await page.locator('.pl-media-stack[aria-label="7 pictures"]').count() === 1, 'the feed shows the cover with the stack icon and the count');
    await page.goto(`${BASE}/app/planner?post=PO1`, { waitUntil: 'domcontentloaded' });
    await until(page, '.pl-ig');
    ok(await page.locator('.pl-car').count() === 0 && await page.locator('.pl-ig .pl-media img').count() === 1, 'a single picture post shows its one picture, as before');
    await ctx.close();
  }
  /* Rob's preview: the same carousel, no write control. */
  {
    const { ctx, page } = await session(width);
    await page.goto(`${BASE}/admin/preview/planner/L11?post=PO31`, { waitUntil: 'domcontentloaded' });
    ok(await until(page, '.pl-car', 8000) && await page.locator('.pl-car-slide').count() === 4, "Rob's preview draws the same carousel");
    ok(await page.locator('.pl-actionbar, .pl-approve, .pl-ask, .pl-postit').count() === 0, "Rob's preview has no write control");
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
