#!/usr/bin/env node
/* The top bar on a computer (Billy's Call Room 1b): the search keeps a usable width and the overview strip gives way first.
 * From 768 to 1720, with the sidebar open and collapsed, on a screen with all three overview pills: the search is 180px or more,
 * its input can be typed into, the strip and the search never overlap each other, the title or the right cluster, nothing leaves
 * the bar, the page does not scroll sideways, and all three pills are still there (dropped labels and a second line are how the
 * strip gives way; a missing pill is not).
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/topbar-test.mjs
 *   TOPBAR_WIDTHS=768,1280 node scripts/topbar-test.mjs    # a shorter list; TOPBAR_STEP=7 sweeps every 7px */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const MIN_SEARCH = 180;
const STEP = Number(process.env.TOPBAR_STEP) || 0;
const WIDTHS = process.env.TOPBAR_WIDTHS ? process.env.TOPBAR_WIDTHS.split(',').map(Number)
  : STEP ? Array.from({ length: Math.floor((1720 - 768) / STEP) + 1 }, (_, i) => 768 + i * STEP)
    : [768, 800, 820, 834, 900, 1024, 1099, 1100, 1180, 1280, 1366, 1440, 1600, 1720];
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0; let twoRows = []; let labelsOn = [];
for (const collapsed of [false, true]) for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript((c) => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); if (c) localStorage.setItem('vz_shell_collapsed', 'true'); } catch { /* none */ } }, collapsed);
  await mockRoutes(page, {});
  await page.goto(`${BASE}/admin/clients`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.sh-top-center .v-ov-chip').length === 3 && !document.querySelector('.sh-top-center .v-ov[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: Math.round(b.width), h: Math.round(b.height) }; };
    const q = (s) => box(document.querySelector(s));
    const top = q('.sh-top'); const cmd = q('.sh-top-center .sh-cmd'); const input = q('.sh-top-center input[aria-label="Search"]'); const left = q('.sh-top-left'); const right = q('.sh-top-right');
    const chips = [...document.querySelectorAll('.sh-top-center .v-ov-chip')].map(box).filter(c => c.w > 0);
    const hit = (a, b) => !!a && !!b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    return {
      bar: top?.h, search: cmd?.w || 0, input: input?.w || 0, pills: chips.length, rows: new Set(chips.map(c => Math.round(c.t))).size,
      labels: [...document.querySelectorAll('.sh-top-center .v-ov-label')].some(e => e.getBoundingClientRect().width > 0),
      overlap: [chips.some(c => hit(c, cmd)) && 'the strip and the search', (chips.some(c => hit(c, left)) || hit(cmd, left)) && 'the title', (chips.some(c => hit(c, right)) || hit(cmd, right)) && 'the right cluster', chips.some((c, i) => chips.some((d, j) => j > i && hit(c, d))) && 'two pills'].filter(Boolean),
      out: !!top && [...chips, cmd, left, right].filter(Boolean).some(x => x.r > top.r + 1 || x.l < top.l - 1 || x.b > top.b + 1 || x.t < top.t - 1),
      sideways: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  /* The input has to take a real click and real typing, which is what a 0px field refused. */
  let typed = '';
  try { await page.locator('.sh-top-center input[aria-label="Search"]').click({ timeout: 3000 }); await page.keyboard.type('lead'); typed = await page.locator('.sh-top-center input[aria-label="Search"]').inputValue(); } catch { typed = ''; }
  const bad = [];
  if (r.search < MIN_SEARCH) bad.push(`the search is ${r.search}px`);
  if (typed !== 'lead') bad.push('the search could not be typed into');
  if (r.pills !== 3) bad.push(`${r.pills} pills`);
  if (r.overlap.length) bad.push(`overlaps ${r.overlap.join(', ')}`);
  if (r.out) bad.push('something leaves the bar');
  if (r.sideways) bad.push('the page scrolls sideways');
  if (r.rows > 1) twoRows.push(`${width}${collapsed ? ' rail' : ''}`);
  if (r.labels) labelsOn.push(`${width}${collapsed ? ' rail' : ''}`);
  if (bad.length) fails++;
  if (bad.length || process.env.TOPBAR_VERBOSE) console.log(`${bad.length ? 'FAIL' : 'ok  '} ${String(width).padStart(4)} ${collapsed ? 'rail' : 'open'}: search ${r.search}px, ${r.pills} pills on ${r.rows} row${r.rows === 1 ? '' : 's'}, labels ${r.labels ? 'on' : 'off'}, bar ${r.bar}px${bad.length ? '  ' + bad.join('; ') : ''}`);
  await ctx.close();
}
await browser.close();
console.log(`${WIDTHS.length * 2} top bars checked (${WIDTHS[0]} to ${WIDTHS[WIDTHS.length - 1]}, sidebar open and collapsed). The strip wraps at: ${twoRows.join(', ') || 'none'}. Labels show at: ${labelsOn.join(', ') || 'none'}.`);
console.log(fails ? `${fails} failed.` : 'All top bar checks pass.');
process.exit(fails ? 1 : 0);
