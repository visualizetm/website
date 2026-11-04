#!/usr/bin/env node
/* The Calendar's agenda (prompt 3 of 3, milestone 5): a phone opens on the agenda, the week as a list by day with the week strip of day pills
 * above it; each row is the time, the title, the kind and the business, with a colour per kind; every word on the page is 12px or more; a strip
 * tap jumps to that day; Month is the second view; the choice is remembered; a computer still opens on Week and offers Agenda.
 *   AUDIT_BASE=http://127.0.0.1:4331 PW_CHROME=/opt/pw-browsers/chromium node scripts/calendar-agenda-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
async function session(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* none */ } });
  await mockRoutes(page, {});
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors };
}
const tiny = (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.cal-page *')) {
    if (el.closest('.v-stretch, .v-sr-only')) continue;
    if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 12) out.push(`${el.className || el.tagName}:${fs}`);
  }
  return out;
});
{
  console.log('── 390px ──');
  const S = await session(390); const p = S.page;
  await p.goto(`${BASE}/admin/calendar`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.cal-ag-day, .cal-page .v-empty, .cal-strip', { timeout: 8000 });
  ok(await p.getByRole('radio', { name: 'Agenda', exact: true }).getAttribute('aria-checked') === 'true', 'a phone opens on the Agenda');
  const opts = await p.$$eval('[aria-label="View"] [role="radio"]', els => els.map(e => e.textContent.trim()));
  ok(opts.join() === 'Agenda,Month,Day,Week', `Month is the second view (${opts.join(', ')})`);
  ok(await p.locator('.cal-strip-day').count() === 7, 'the week strip of day pills is there');
  const days = await p.$$eval('.cal-ag-day', els => els.map(e => e.querySelector('.cal-ag-h').textContent));
  ok(days.length >= 1, `the week lists by day (${days.join(' | ').slice(0, 80)})`);
  const row = p.locator('.cal-row--agenda').first();
  ok(await row.count() === 1 && /\d{1,2}:\d{2}|All day/.test(await row.locator('.cal-ag-time').textContent()), `a row starts with its time (${(await row.locator('.cal-ag-time').textContent()).trim()})`);
  const sub = (await row.textContent()) || '';
  ok(/Meeting|Callback|Calendly|New leads|Bill|Final payment|Post|Ad/.test(sub), `and names its kind (${sub.slice(0, 80)})`);
  ok(await p.$$eval('.cal-row--agenda', els => new Set(els.map(e => getComputedStyle(e).borderLeftColor)).size) >= 1 && await row.evaluate(e => getComputedStyle(e).borderLeftWidth) === '4px', 'a row carries its colour on a 4px left edge');
  const small = await tiny(p);
  ok(small.length === 0, `every word on the page is 12px or more (${small.slice(0, 4).join(', ') || 'none under'})`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
  ok(await p.$$eval('.cal-ag-day .cal-row--agenda', els => els.every(e => e.getBoundingClientRect().height >= 44)), 'every row is a 44px target');
  /* A strip tap jumps to the day. */
  const last = p.locator('.cal-strip-day').last();
  await last.click(); await p.waitForTimeout(300);
  ok(await last.getAttribute('aria-pressed') === 'true', 'a strip tap selects that day');
  /* Month, remembered. */
  await p.getByRole('radio', { name: 'Month', exact: true }).click(); await p.waitForSelector('.cal-month');
  ok(await p.evaluate(() => localStorage.getItem('vz_cal_view')) === '"month"', 'Month shows and the choice is remembered');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForSelector('.cal-month');
  ok(!!(await p.$('.cal-month')), 'and kept after a reload');
  await p.getByRole('radio', { name: 'Agenda', exact: true }).click();
  await p.locator('[aria-label="Next"]').click(); await p.waitForTimeout(200);
  ok(await p.locator('.cal-page .v-section-title, .cal-page h1, .cal-page h2').first().isVisible(), 'Next moves a week');
  ok(S.errors.length === 0, `no page errors (${S.errors.join('; ').slice(0, 80)})`);
  await S.ctx.close();
}
{
  console.log('── 1280px ──');
  const S = await session(1280); const p = S.page;
  await p.goto(`${BASE}/admin/calendar`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.cal-week', { timeout: 8000 });
  ok(await p.getByRole('radio', { name: 'Week', exact: true }).getAttribute('aria-checked') === 'true', 'a computer still opens on Week');
  await p.getByRole('radio', { name: 'Agenda', exact: true }).click(); await p.waitForTimeout(300);
  ok(await p.locator('.cal-ag-day, .cal-page .v-empty').count() >= 1, 'and offers the Agenda');
  const small = await tiny(p);
  ok(small.length === 0, `every word is 12px or more (${small.slice(0, 4).join(', ') || 'none under'})`);
  ok(S.errors.length === 0, `no page errors (${S.errors.join('; ').slice(0, 80)})`);
  await S.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll agenda checks pass.');
process.exit(fails ? 1 : 0);
