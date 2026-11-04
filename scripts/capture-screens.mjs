#!/usr/bin/env node
/* One screenshot of every nav entry at 390 and 1280 into docs/screens/ (prompt 3 of 3): the audit fixtures, the dark theme, the page as it
 * settles. The file is <id>-<width>.png, ids from src/shell/nav.js. Re-run it after any change to a screen's shape.
 *   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/capture-screens.mjs [id ...] */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { mockRoutes } from './audit-fixtures.mjs';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'docs/screens';
mkdirSync(OUT, { recursive: true });
/* The nav's own entries (nav.js), by id, with the path each opens. Planner has no page of its own: it is a client's planner. */
export const ENTRIES = [
  ['dashboard', '/admin'], ['pipeline', '/admin/pipeline'], ['triage', '/admin/calls?section=triage'], ['leads', '/admin/calls?section=leads'], ['calls', '/admin/calls'],
  ['lists', '/admin/calls?section=lists'], ['deals', '/admin/deals'], ['calendar', '/admin/calendar'], ['overview', '/admin/overview'], ['clients', '/admin/clients'],
  ['projects', '/admin/projects'], ['docs', '/admin/docs'], ['invoices', '/admin/invoices'], ['drafts', '/admin/drafts'], ['planner', '/admin/clients/L11/planner'],
  ['tasks', '/admin/tasks'], ['orders', '/admin/orders'], ['concepts', '/admin/concepts'], ['reviews', '/admin/reviews'], ['submissions', '/admin/submissions'],
  ['landing', '/admin/landing'], ['settings', '/admin/settings'], ['design', '/admin/design'], ['deleted', '/admin/settings/deleted'], ['more', '/admin/more'],
];
const only = process.argv.slice(2);
const list = only.length ? ENTRIES.filter(([id]) => only.includes(id)) : ENTRIES;
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let n = 0;
for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, hasTouch: w < 600, serviceWorkers: 'block', deviceScaleFactor: 1 });
  for (const [id, path] of list) {
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* none */ } });
    await mockRoutes(page, { session: true });
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1400);
      await page.screenshot({ path: `${OUT}/${id}-${w}.png` });
      n++;
    } catch (e) { console.log(`FAIL ${id} ${w}: ${String(e.message).split('\n')[0]}`); }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`${n} screenshots in ${OUT}`);
