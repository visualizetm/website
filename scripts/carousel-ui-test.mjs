#!/usr/bin/env node
/* Carousel posts in a browser (carousel job), at 390 and 1280, against the audit fixtures (scripts/audit-fixtures.mjs: PO30 is
 * a seven slide carousel with a square slide 3, PO1 a single picture post).
 *
 *   Rob's editor and board (milestone 2): the slide strip (numbered 4:5 thumbnails, Cover on slide 1, the counter, the ratio
 *   line), Move left and Move right as one write that moves imageUrl with the cover, Remove with Undo on the toast, a slide
 *   added by link (a bad link refused), twenty as the limit (adds off, the counter says so), drag only for a mouse, 44px
 *   controls, a single picture post unchanged, and the board card's stack icon and count.
 *
 *   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/carousel-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, posts as fixturePosts } from './audit-fixtures.mjs';

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

await browser.close();
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
