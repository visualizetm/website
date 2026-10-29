#!/usr/bin/env node
/* Screenshots of the home's Next up block into docs/screens/: 390 (the top of the page, and Overdue expanded) and 1280, light and dark, with
 * nine overdue and three due today, the shape of Rob's real data (four extra overdue callbacks over the audit fixtures).
 *   AUDIT_BASE=http://127.0.0.1:4330 node scripts/home-nextup-screens.mjs */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { mockRoutes, leads as FIXTURE_LEADS } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/screens';
mkdirSync(OUT, { recursive: true });
const day = 864e5;
const extra = Array.from({ length: 4 }, (_, i) => ({ _id: `XO${i}`, business: ['Lia\'s Catering', 'Bay Roofing', 'Harbor Dental', 'Maple Street Salon'][i], stage: 'lead', callStatus: 'callback', callbackAt: new Date(Date.now() - (6 + i) * day).toISOString(), phone: '(302) 555-01' + String(10 + i) }));
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const theme of ['dark', 'light']) for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, hasTouch: w < 600, serviceWorkers: 'block', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript((t) => { try { localStorage.setItem('vz_theme', t); localStorage.setItem('vz_boot', '1'); localStorage.removeItem('vz_home_coming'); } catch {} }, theme);
  await mockRoutes(page, { session: true });
  await page.route('**/api/admin/call-leads**', (r) => (r.request().method() !== 'GET' || r.request().url().includes('deleted=1') ? r.fallback() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [...FIXTURE_LEADS, ...extra] }) })));
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.nh-row');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/home-${w}-${theme}.png` });
  if (w < 600) {
    await page.locator('[data-card="next-overdue"]').getByRole('button', { name: /^Show \d+ more$/ }).click();
    await page.waitForTimeout(400);
    await page.locator('[data-card="next-overdue"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('[data-card="next-overdue"]').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/home-${w}-${theme}-overdue-expanded.png` });
  }
  await ctx.close();
}
await browser.close();
console.log('wrote', OUT);
