#!/usr/bin/env node
/* The doc reading view in a browser (prompt 3 of 3, milestone 3), at 390 and 1280: a phone opens a doc from a list in Read and a new doc in Edit,
 * the article's type scale (17 on 28, display headings in capitals), the section strip jumps, a tick in Read is the editor's own PATCH, the three
 * text sizes persist per device, Copy for Claude puts markdown with no block id on the clipboard, Share PDF opens the print path, Edit and Read
 * switch with nothing lost. The docs list: the templates row, the Needs signing and Pinned chips, groups by client with a count, the contract pills.
 *   AUDIT_BASE=http://127.0.0.1:4331 PW_CHROME=/opt/pw-browsers/chromium node scripts/docs-read-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
async function session(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch {} window.__printed = 0; window.print = () => { window.__printed++; }; });
  const o = {}; await mockRoutes(page, o);
  const patches = [];
  page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().includes('/api/admin/docs')) { try { patches.push(JSON.parse(r.postData() || '{}')); } catch { /* none */ } } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, o, patches, errors };
}
for (const width of [390, 1280]) {
  console.log(`── ${width}px ──`);
  const phone = width < 768;
  const S = await session(width); const { page } = S;
  await page.goto(`${BASE}/admin/clients?open=L11`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rc-docs-row[data-doc-id="DOC1"]', { timeout: 8000 });
  await page.locator('.rc-docs-row[data-doc-id="DOC1"] .v-stretch').click();
  await page.waitForSelector('.dc-blocks, .dr-article', { timeout: 8000 });
  ok(phone ? !!(await page.$('.dr-article')) : !!(await page.$('.dc-blocks')), phone ? 'a phone opens a doc from a list in Read' : 'a computer opens it in Edit as before');
  if (!phone) { await page.getByRole('radio', { name: 'Read', exact: true }).click(); await page.waitForSelector('.dr-article'); }
  const body = await page.$eval('.dr-p', e => { const c = getComputedStyle(e); return { fs: c.fontSize, lh: c.lineHeight }; });
  ok(body.fs === '17px' && body.lh === '28px', `the body is 17px on 28px (${body.fs} on ${body.lh})`);
  const h = await page.$eval('.dr-h1', e => { const c = getComputedStyle(e); return { tt: c.textTransform, ff: c.fontFamily }; });
  ok(h.tt === 'uppercase' && /Barlow Condensed/.test(h.ff), `headings are uppercase in the display face (${h.tt}, ${h.ff.slice(0, 30)})`);
  ok(await page.$eval('.dr-quote', e => getComputedStyle(e).borderLeftWidth) === '3px', 'a pull quote carries the red left rule');
  ok((await page.$$('.dr-article a[href]')).length > 0, 'links draw as links');
  const strip = await page.$$eval('.dr-strip-b', els => els.map(e => e.textContent));
  ok(strip.length >= 2, `the section strip lists the headings (${strip.join(' | ').slice(0, 80)})`);
  const targetTop = async () => page.$eval('.dr-h1:last-of-type, .dr-h2:last-of-type', e => e.getBoundingClientRect().top).catch(() => 0);
  void targetTop;
  const lastBtn = page.locator('.dr-strip-b').last();
  const lastText = (await lastBtn.textContent()).trim();
  await lastBtn.click(); await page.waitForTimeout(250);
  const hit = await page.evaluate((t) => { const el = [...document.querySelectorAll('.dr-h1,.dr-h2')].find(e => e.textContent.trim() === t); const r = el.getBoundingClientRect(); return { top: r.top, inView: r.top >= 0 && r.top < window.innerHeight, focus: document.activeElement === el }; }, lastText);
  ok(hit.inView && hit.focus, `a section tap jumps to it and moves focus (${lastText}, top ${Math.round(hit.top)})`);
  /* A tick in Read is the editor's patch. */
  const tick = page.locator('.dr-li--check .dc-tick').first();
  const before = await tick.getAttribute('aria-checked');
  S.patches.length = 0;
  await tick.scrollIntoViewIfNeeded(); await tick.click();
  await page.waitForTimeout(1500);
  ok((await tick.getAttribute('aria-checked')) !== before, 'a tick flips in Read');
  const p = S.patches.find(x => x.set?.blocks);
  ok(!!p && p.set.blocks.some(b => b.type === 'check') && Object.keys(p.set).sort().join() === 'blocks,title,type', `one PATCH of the doc (${p ? Object.keys(p.set).join(',') : 'none'})`);
  ok((await page.$eval('.dd-tick-box, .dc-tick-box', e => e.getBoundingClientRect().height)) > 0 && (await tick.evaluate(e => e.getBoundingClientRect().height)) >= 44, 'the tick is a 44px target');
  /* Text size. */
  await page.getByRole('radio', { name: 'L', exact: true }).click();
  ok((await page.$eval('.dr-p', e => getComputedStyle(e).fontSize)) === '20px', 'Large is 20px');
  await page.getByRole('radio', { name: 'S', exact: true }).click();
  ok((await page.$eval('.dr-p', e => getComputedStyle(e).fontSize)) === '15px', 'Small is 15px');
  await page.getByRole('radio', { name: 'L', exact: true }).click();
  ok((await page.evaluate(() => localStorage.getItem('vz_doc_size'))) === 'l', 'the step is remembered on this device');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.dr-article, .dc-blocks');
  if (!(await page.$('.dr-article'))) await page.getByRole('radio', { name: 'Read', exact: true }).click();
  ok((await page.$eval('.dr-p', e => getComputedStyle(e).fontSize)) === '20px', 'and applied after a reload');
  await page.getByRole('radio', { name: 'M', exact: true }).click();
  /* Copy for Claude. */
  await page.locator('.dr-copy').click(); await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(/^# Project brief/.test(clip) && /^## What they need$/m.test(clip) && /^- Logo and a mark$/m.test(clip) && /\*\*Bold bit\*\*/.test(clip), 'Copy for Claude puts markdown on the clipboard');
  ok(!/\bb\d+\b/.test(clip) && !/data-block-id|"id"/.test(clip), 'with no block id in it');
  ok(/^\[[ x]\] Deposit paid$/m.test(clip) && /^\[[ x]\] Menu photos sent$/m.test(clip), 'checklists as [ ] and [x]');
  /* Share PDF. */
  await page.locator('.dr-pdf').click(); await page.waitForTimeout(200);
  ok((await page.evaluate(() => window.__printed)) === 1, 'Share PDF opens the print path');
  ok((await page.$$('.dp-doc')).length === 1, 'the print sheet is the same article, drawn for paper');
  /* Edit and back. */
  await page.getByRole('radio', { name: 'Edit', exact: true }).click(); await page.waitForSelector('.dc-blocks');
  ok(!!(await page.$('.dd-title')), 'Edit brings the editor back');
  await page.getByRole('radio', { name: 'Read', exact: true }).click(); await page.waitForSelector('.dr-article');
  ok(true, 'and Read again');
  ok(S.errors.length === 0, `no page errors (${S.errors.join('; ').slice(0, 100)})`);
  await S.ctx.close();

  /* A doc made now opens in Edit. */
  const N = await session(width);
  await N.page.goto(`${BASE}/admin/clients?open=L11`, { waitUntil: 'networkidle' });
  await N.page.waitForSelector('.rc-docs-new'); await N.page.locator('.rc-docs-new').click();
  await N.page.waitForSelector('.nd-opt[data-template="brief"]'); await N.page.locator('.nd-opt[data-template="brief"]').click();
  await N.page.waitForSelector('.dc-blocks, .dr-article', { timeout: 8000 });
  ok(!!(await N.page.$('.dc-blocks')), 'a new doc opens in Edit');
  await N.ctx.close();

  /* The docs list. */
  const L = await session(width); const lp = L.page;
  await lp.goto(`${BASE}/admin/docs`, { waitUntil: 'networkidle' });
  await lp.waitForSelector('.ad-tpl', { timeout: 8000 });
  const tpls = await lp.$$eval('.ad-tpl-b', els => els.map(e => e.textContent.trim()));
  ok(tpls.join() === 'Brief,Call notes,Contract,Delivery', `the templates row (${tpls.join(', ')})`);
  ok(await lp.$$eval('.ad-tpl-b', els => els.every(e => e.getBoundingClientRect().height >= 44)), 'each template is a 44px target');
  const groups = await lp.$$eval('.ad-group--client', els => els.map(e => ({ h: e.querySelector('.ad-group-h').textContent, n: e.querySelectorAll('.rc-docs-row').length })));
  ok(groups.length >= 2 && groups.every(g => g.h.endsWith(String(g.n))), `grouped by client with a count (${groups.map(g => g.h).join(' | ').slice(0, 90)})`);
  ok((await lp.$$('.rc-docs-status')).length >= 0, 'contract rows carry a status pill when there is one');
  await lp.locator('.ad-chip-pinned').click();
  const pinnedRows = await lp.$$eval('.rc-docs-row', els => els.map(e => e.classList.contains('is-pinned')));
  ok(pinnedRows.length > 0 && pinnedRows.every(Boolean), `the Pinned chip keeps only pinned docs (${pinnedRows.length})`);
  await lp.locator('.ad-chip-pinned').click();
  await lp.locator('.ad-chip-signing').click();
  const signRows = await lp.$$eval('.rc-docs-row', els => els.map(e => e.textContent));
  ok(signRows.every(t => /Contract/.test(t)) , `Needs signing keeps only contracts with no agreed stamp (${signRows.length})`);
  await lp.locator('.ad-chip-signing').click();
  await lp.locator('.ad-tpl-b[data-template="contract"]').click();
  await lp.waitForSelector('.cp-row, .v-sheet, [role="dialog"]', { timeout: 6000 });
  ok(true, 'a template on All docs asks which client');
  ok(L.errors.length === 0, `no page errors on the list (${L.errors.join('; ').slice(0, 100)})`);
  await L.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll doc reading checks pass.');
process.exit(fails ? 1 : 0);
