/* Screenshots for a build report at 390 (planner dashboard and task system):
 * the admin Tasks screen (the overview and a checklist step), Next up, the
 * planner editor's ideas inbox and its ad editor, and the client's planner
 * (Home, Posts, Ads, Ideas, a post, an image ad, a video ad, the Suggest
 * sheet). Mocked APIs through audit-fixtures, so it runs anywhere.
 *
 *   npx vite preview --port 4330 &
 *   SHOTS_OUT=/tmp/shots node scripts/report-shots.mjs
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const OUT = process.env.SHOTS_OUT || 'report-shots';
const T = 'plnrTESTtoken0123456789abcdEF';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block', colorScheme: 'dark' });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.setItem('vz_leads_view', JSON.stringify('list')); } catch {} });
await mockRoutes(page, {});
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log(`  ${name}.png`); };
const go = async (path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(900); };
const click = async (sel) => { await page.locator(sel).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500); };

await go('/admin/clients/L11/tasks'); await shot('admin-tasks');
await click('.tk-body .v-stretch'); await shot('admin-tasks-checklist');
await click('.tk-add'); await shot('admin-tasks-quick-add');
await go('/admin'); await shot('admin-next-up');
await go('/admin/clients/L11/planner?ideas=1'); await shot('admin-ideas-inbox');
await go('/admin/clients/L11/planner');
await page.locator('.pl-post').filter({ hasText: 'October interior offer' }).first().locator('.v-stretch').click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(700); await shot('admin-planner-ad-sheet');
await page.locator('.v-sheet').evaluate(el => { const b = el.querySelector('.v-sheet-body, .v-sheet-scroll') || el; b.scrollTop = 900; }).catch(() => {});
await shot('admin-planner-ad-section');

await go(`/planner/${T}`); await shot('client-home');
await go(`/planner/${T}?tab=posts`); await click('.pl-view:has-text("List")'); await shot('client-posts');
await click('.pl-row:has-text("Needs you")'); await shot('client-post-detail');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await go(`/planner/${T}?tab=ads`); await shot('client-ads');
await click('.pl-row:has-text("October interior offer")'); await shot('client-ad-detail-image');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await click('.pl-row:has-text("Ceramic coat reel")'); await shot('client-ad-detail-video');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await go(`/planner/${T}?tab=ideas`); await shot('client-ideas');
await click('.pl-suggest'); await shot('client-suggest-sheet');

await browser.close();
console.log(`report shots in ${OUT}`);
