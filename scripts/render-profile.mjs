/* Render cost (Prompt 15): the Leads kanban with 400 leads and the Calendar
 * month with 60 events, measured in Chromium on the fixture backed mocks.
 * Reports scripting time to first settled render, the long tasks during it,
 * and the interaction cost of one filter toggle, one card move, and one
 * month step, from the CDP performance counters. Run before and after a
 * memoization change to see what it bought.
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/render-profile.mjs
 */
import { chromium } from 'playwright-core';
import { leads, json, mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const N_LEADS = Number(process.env.PROFILE_LEADS || 400);
const N_EVENTS = Number(process.env.PROFILE_EVENTS || 60);

const STATUSES = ['not-called', 'callback', 'booked', 'no-answer', 'no'];
const big = Array.from({ length: N_LEADS }, (_, i) => ({ ...leads[i % 8], _id: 'B' + i, business: `Business ${i} ${['Detailing', 'Bakery', 'Gym', 'Salon'][i % 4]}`, callStatus: STATUSES[i % 5], priority: ['hot', 'warm', 'cold'][i % 3], stage: undefined, industry: ['Auto Detailing', 'Bakery', 'Fitness', 'Salon'][i % 4], createdAt: new Date(Date.now() - i * 3600e3).toISOString() }));
const today = new Date(); today.setHours(9, 0, 0, 0);
const busy = Array.from({ length: N_EVENTS }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + (i % 28) - 7); d.setHours(8 + (i % 9), (i % 2) * 30, 0, 0); return { ...leads[i % 8], _id: 'E' + i, business: `Event Lead ${i}`, stage: i % 2 ? 'booked' : undefined, callStatus: i % 2 ? 'booked' : 'callback', meeting: i % 2 ? { date: d.toISOString().slice(0, 10), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, type: 'call', location: '' } : undefined, callbackAt: i % 2 ? undefined : d.toISOString() }; });

async function metrics(cdp) { const m = (await cdp.send('Performance.getMetrics')).metrics; const g = (n) => m.find(x => x.name === n)?.value || 0; return { script: g('ScriptDuration') * 1000, layout: g('LayoutDuration') * 1000, style: g('RecalcStyleDuration') * 1000, nodes: g('Nodes'), heap: g('JSHeapUsedSize') / 1048576 }; }
const diff = (a, b) => ({ script: Math.round(b.script - a.script), layout: Math.round(b.layout - a.layout), style: Math.round(b.style - a.style), nodes: b.nodes, heap: b.heap.toFixed(1) });
const fmt = (d) => `script ${d.script}ms, layout ${d.layout}ms, style ${d.style}ms, ${d.nodes} nodes, heap ${d.heap}MB`;

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 844 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.setItem('vz_leads_view', JSON.stringify('kanban')); localStorage.setItem('vz_cal_view', JSON.stringify('month')); window.__long = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {} });
await mockRoutes(page);
await page.route('**/api/admin/call-leads**', r => (r.request().method() === 'GET' ? r.fulfill(json({ items: page.__cal ? busy : big })) : r.fulfill(json({ ok: true }))));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const settle = async (sel) => { await page.waitForSelector(sel, { timeout: 15000 }).catch(() => {}); await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel'), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(800); };
const longTasks = () => page.evaluate(() => { const l = window.__long.slice(); window.__long.length = 0; return l; });

console.log(`Leads kanban, ${N_LEADS} leads, 1280px`);
let before = await metrics(cdp);
await page.goto(`${BASE}/admin/leads`, { waitUntil: 'domcontentloaded' });
await settle('.ld-board');
let after = await metrics(cdp);
console.log(`  first render:      ${fmt(diff(before, after))}, long tasks ${JSON.stringify(await longTasks())}`);
before = after;
await page.locator('.ld-frow .v-chip', { hasText: /^Hot/ }).first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(600);
after = await metrics(cdp);
console.log(`  toggle Hot filter: ${fmt(diff(before, after))}, long tasks ${JSON.stringify(await longTasks())}`);
await page.locator('.ld-frow .v-chip', { hasText: /^Hot/ }).first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(600);
before = await metrics(cdp);
await page.locator('.lc-open').first().focus().catch(() => {});
await page.keyboard.press('Shift+ArrowRight').catch(() => {});
await page.waitForTimeout(600);
after = await metrics(cdp);
console.log(`  move one card:     ${fmt(diff(before, after))}, long tasks ${JSON.stringify(await longTasks())}`);
before = await metrics(cdp);
await page.fill('.ld-search input, input[aria-label="Search leads"]', 'Bakery').catch(() => {});
await page.waitForTimeout(700);
after = await metrics(cdp);
console.log(`  search "Bakery":   ${fmt(diff(before, after))}, long tasks ${JSON.stringify(await longTasks())}`);

console.log(`Calendar month, ${N_EVENTS} events, 1280px`);
page.__cal = true;
before = await metrics(cdp);
await page.goto(`${BASE}/admin/calendar`, { waitUntil: 'domcontentloaded' });
await settle('.cal-month');
after = await metrics(cdp);
console.log(`  first render:      ${fmt(diff(before, after))}, long tasks ${JSON.stringify(await longTasks())}`);
before = after;
await page.getByRole('button', { name: 'Next' }).first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(600);
after = await metrics(cdp);
console.log(`  next month:        ${fmt(diff(before, after))}, long tasks ${JSON.stringify(await longTasks())}`);
before = after;
await page.locator('.cal-filters .v-chip', { hasText: 'Meetings' }).first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(600);
after = await metrics(cdp);
console.log(`  toggle Meetings:   ${fmt(diff(before, after))}, long tasks ${JSON.stringify(await longTasks())}`);
await browser.close();
