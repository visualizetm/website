/* Regression walk (Prompt 15): docs/QA-CHECKLIST.md run in Playwright against
 * the audit fixtures, phone first (390) and desktop (1280). Every step is one
 * action and one expectation; a failed step is recorded and the walk goes on.
 * Writes answer ok through the mocks, so the optimistic UI is what is checked.
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/regression.mjs
 *   AUDIT_WIDTHS=390 node scripts/regression.mjs
 */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [390, 1280];
const T = 6000;

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const results = [];
let failures = 0;

for (const width of WIDTHS) {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: phone, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('vz_boot', '1'); localStorage.setItem('vz_theme', 'dark'); } catch {} });
  let signedIn = true;
  await page.route('**/api/admin/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authed: signedIn }) }));
  await mockRoutes(page);
  await page.route('**/api/admin/logout', r => { signedIn = false; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.route('**/api/admin/login', r => { signedIn = true; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  const goto = (p) => page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
  // Data lands after the 150ms skeleton delay: wait for the region to hold something, then for the skeleton to leave.
  const settle = async () => { await page.waitForFunction(() => { const c = document.querySelector('.sh-content'); return c && (c.querySelector('.v-skel, .v-card, .lc, .v-lrow, .v-empty, .v-error, .v-tr')); }, null, { timeout: 8000 }).catch(() => {}); await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel'), null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(250); };
  const dialog = () => page.locator('[role="dialog"]').last();
  const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(350); };
  const toastText = async () => page.locator('.v-toast').last().textContent({ timeout: 3000 }).catch(() => '');
  const expectVisible = async (loc, what) => { await loc.first().waitFor({ state: 'visible', timeout: T }); return what; };

  const step = async (n, name, fn) => {
    try { const note = await fn(); results.push({ width, n, name, ok: true, note: note || '' }); console.log(`  ok   [${width}] ${n}. ${name}${note ? `: ${note}` : ''}`); }
    catch (e) { failures++; results.push({ width, n, name, ok: false, note: String(e.message || e).split('\n')[0].slice(0, 140) }); console.log(`  FAIL [${width}] ${n}. ${name}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); }
  };
  const openLeadCard = async (name) => { await page.getByRole('button', { name: `Open ${name}` }).first().click({ timeout: T }); await page.waitForTimeout(500); };
  const tab = (name) => page.getByRole('tab', { name: new RegExp('^' + name) }).first().click({ timeout: T });

  console.log(`\nRegression walk at ${width}px`);
  await step(1, 'Open the app', async () => { await goto('/admin'); await expectVisible(page.locator('.sh-root'), ''); return 'shell up'; });
  await step(2, 'Dashboard greets Rob', async () => { await settle(); await expectVisible(page.locator('.db-greet'), ''); const t = await page.locator('.db-greet').textContent(); if (!/Good (morning|afternoon|evening), Rob/.test(t)) throw new Error(`greeting was "${t}"`); return t.trim(); });
  await step(3, 'Dashboard is filled', async () => { await expectVisible(page.locator('.db-funnel .db-step'), ''); const n = await page.locator('.v-stat').count(); if (n < 8) throw new Error(`${n} stat cards`); return `${n} stats, Today card ${await page.locator('.db-today').count() ? 'present' : 'missing'}`; });
  await step(4, 'Start call session opens the builder', async () => { await page.getByRole('button', { name: 'Start call session' }).first().click({ timeout: T }); await expectVisible(page.locator('.cc-start'), ''); return (await page.locator('.cc-start').textContent()).trim(); });
  await step(5, 'Start in the builder opens the queue or room', async () => { await page.locator('.cc-start').click({ timeout: T }); await page.waitForTimeout(600); const room = await page.locator('.cc-head').count(); const queue = await page.locator('.cc-qlist .lc').count(); if (!room && !queue) throw new Error('neither queue nor room'); return room ? 'room' : `queue with ${queue} leads`; });
  await step(6, 'The room shows the first lead', async () => { if (!(await page.locator('.cc-head').count())) { await page.locator('.cc-qlist .lc-open').first().click({ timeout: T }); } await expectVisible(page.locator('.cc-head .cc-biz'), ''); return (await page.locator('.cc-pos').first().textContent().catch(() => '')).trim(); });
  // The undo toast sits over the outcome bar on a phone for six seconds; dismiss it the way a thumb would before the next outcome.
  const dismissToasts = async () => { for (const x of await page.locator('.v-toast-x').all()) await x.click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(250); };
  const outcome = async (label, action) => { await dismissToasts(); await page.locator('.cc-outs button', { hasText: label }).first().click({ timeout: T }); await expectVisible(dialog(), ''); if (action) await action(); await dialog().getByRole('button', { name: /^(Log|Set callback|Book it)$/ }).click({ timeout: T }); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: T }); await page.waitForTimeout(400); return (await page.locator('.cc-pos').first().textContent().catch(() => '')).trim(); };
  await step(7, 'Log No answer', async () => `position ${await outcome('No answer')}`);
  await step(8, 'Log Callback with a quick time', async () => `position ${await outcome('Callback', async () => { await dialog().locator('.v-chip').first().click({ timeout: T }); })}`);
  await step(9, 'Log Wrong number', async () => `position ${await outcome('Wrong number')}`);
  await step(10, 'Log Said no', async () => { const pos = await outcome('Said no'); const t = await toastText(); if (!/Undo/i.test(t)) throw new Error(`no undo toast: "${t}"`); return `position ${pos}, undo toast`; });
  await step(11, 'Book a meeting', async () => { const pos = await outcome('Booked', async () => { const d = new Date(); d.setDate(d.getDate() + 2); await dialog().locator('input[type="date"]').fill(d.toISOString().slice(0, 10)); await dialog().locator('input[type="time"]').fill('10:00'); }); return `position ${pos}`; });
  await step(12, 'Booked lists the booked leads', async () => { await goto('/admin/booked'); await settle(); const n = await page.locator('.lc').count(); if (!n) throw new Error('no booked cards'); return `${n} booked`; });
  await step(13, 'Open a booked lead', async () => { await page.locator('.lc-open').first().click({ timeout: T }); await expectVisible(page.locator('.dt-profile'), ''); return 'detail open'; });
  await step(14, 'Add two pricing options', async () => { await page.locator('.dt-addopt').first().click({ timeout: T }); await page.locator('.dt-addopt').first().click({ timeout: T }); await page.waitForTimeout(400); const n = await page.locator('.dt-opt').count(); if (n < 2) throw new Error(`${n} options`); return `${n} options`; });
  await step(15, 'Mark as won converts to client', async () => { await page.locator('.dt-won').first().click({ timeout: T }); await dialog().getByRole('button', { name: /Won, convert to client/ }).click({ timeout: T }); await page.waitForTimeout(1200); const t = await toastText(); if (!/client|won/i.test(t)) throw new Error(`toast "${t}"`); return t.replace(/\s+/g, ' ').slice(0, 60); });
  await step(16, 'Open a client', async () => { await goto('/admin/clients'); await settle(); if (phone) await openLeadCard('Lead Business 11'); else await page.locator('.v-tr', { hasText: 'Lead Business 11' }).first().click({ timeout: T }); await expectVisible(page.getByRole('tab', { name: /^Projects/ }), ''); return 'client detail with tabs'; });
  await step(17, 'Create a project', async () => { await tab('Projects'); await page.locator('.cw-new-project').first().click({ timeout: T }); await expectVisible(dialog(), ''); await dialog().locator('.v-sheet-foot .v-btn, .v-modal-foot .v-btn').last().click({ timeout: T }); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: T }); await page.waitForTimeout(400); return 'sheet closed, project created'; });
  await step(18, 'Mark a payment paid', async () => { await tab('Payments'); await page.locator('.cw-mark-paid').first().click({ timeout: T }); await expectVisible(dialog(), ''); await dialog().locator('.v-modal-foot .v-btn, .v-sheet-foot .v-btn').last().click({ timeout: T }); await page.waitForTimeout(800); const t = await toastText(); return t ? t.replace(/\s+/g, ' ').slice(0, 60) : 'confirmed'; });
  await step(19, 'Start a retainer', async () => { await tab('Retainer'); await page.locator('.cw-start-retainer').first().click({ timeout: T }); await expectVisible(dialog(), ''); await dialog().getByRole('button', { name: 'Create' }).click({ timeout: T }); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: T }); await page.waitForTimeout(600); return 'retainer created'; });
  await step(20, 'Log a delivery on a retainer client', async () => { await goto('/admin/clients'); await settle(); if (phone) await openLeadCard('Lead Business 12'); else await page.locator('.v-tr', { hasText: 'Lead Business 12' }).first().click({ timeout: T }); await tab('Retainer'); await page.locator('.cw-log-delivery').first().click({ timeout: T }); await expectVisible(dialog(), ''); const num = dialog().locator('input[type="number"]').first(); if (await num.count()) await num.fill('2'); await dialog().getByRole('button', { name: 'Log' }).click({ timeout: T }); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: T }); return 'delivery logged'; });
  await step(21, 'New order sheet opens', async () => { await goto('/admin/orders'); await settle(); await page.getByRole('button', { name: /^New order/ }).first().click({ timeout: T }); await expectVisible(dialog(), ''); return 'sheet open'; });
  await step(22, 'Create an order with one item', async () => { await dialog().getByLabel('Name').first().fill('Walk In Customer'); await dialog().getByRole('button', { name: 'Add item' }).click({ timeout: T }); await page.waitForTimeout(300); await dialog().locator('.v-sheet-foot .v-btn').last().click({ timeout: T }); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: T }); await page.waitForTimeout(500); return 'order created'; });
  await step(23, 'Mark an order paid', async () => { await goto('/admin/orders'); await settle(); if (phone) await page.getByRole('button', { name: /^Open order for Person 0/ }).first().click({ timeout: T }); else await page.locator('.v-tr', { hasText: 'Person 0' }).first().click({ timeout: T }); await page.getByRole('button', { name: /^Mark paid/ }).first().click({ timeout: T }); await expectVisible(dialog(), ''); await dialog().locator('.v-modal-foot .v-btn').last().click({ timeout: T }); await page.waitForTimeout(800); const paid = await page.getByText(/^Paid \$/).count(); if (!paid) throw new Error('no paid line'); return 'paid line shown'; });
  await step(24, 'New pack sheet opens', async () => { await goto('/admin/concepts'); await settle(); await page.getByRole('button', { name: /^New pack/ }).first().click({ timeout: T }); await expectVisible(dialog(), ''); return 'sheet open'; });
  await step(25, 'Create a pack', async () => { await dialog().getByLabel('Title').fill('Regression pack'); await page.waitForTimeout(200); await dialog().getByRole('button', { name: 'Create' }).click({ timeout: T }); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: T }); await page.waitForTimeout(500); return 'pack created'; });
  await step(26, 'Log a review ask', async () => { await goto('/admin/reviews'); await settle(); await page.getByRole('button', { name: /^Open reviews for Lead Business 12/ }).first().click({ timeout: T }); await page.locator('.rv-log-ask').first().click({ timeout: T }); await page.waitForTimeout(800); const t = await toastText(); if (!/ask|logged/i.test(t)) throw new Error(`toast "${t}"`); return t.replace(/\s+/g, ' ').slice(0, 50); });
  await step(27, 'Calendar shows today', async () => { await goto('/admin/calendar'); await page.evaluate(() => localStorage.setItem('vz_cal_view', JSON.stringify('day'))); await goto('/admin/calendar'); await settle(); await expectVisible(page.locator('.cal-strip'), ''); const n = await page.locator('.cal-row').count(); return `${n} events today`; });
  await step(28, 'Notifications drawer opens', async () => { await page.locator('.sh-bell').first().click({ timeout: T }); await expectVisible(dialog(), ''); const n = await page.locator('.sh-notif').count(); await esc(); return `${n} items`; });
  await step(29, 'Theme switches to Light and back', async () => { await goto('/admin/settings'); await settle(); await page.getByRole('radio', { name: 'Light' }).click({ timeout: T }); await page.waitForTimeout(300); const light = await page.evaluate(() => document.documentElement.dataset.vTheme); if (light !== 'light') throw new Error(`theme is ${light}`); await page.getByRole('radio', { name: 'Dark' }).click({ timeout: T }); await page.waitForTimeout(300); return 'light then dark'; });
  await step(30, 'Reduce motion on and off', async () => { const sw = page.getByRole('switch', { name: 'Reduce motion' }); await sw.click({ timeout: T }); await page.waitForTimeout(300); const on = await page.evaluate(() => document.documentElement.dataset.vMotion); if (on !== 'reduce') throw new Error('data-v-motion not set'); await sw.click({ timeout: T }); await page.waitForTimeout(300); const off = await page.evaluate(() => document.documentElement.dataset.vMotion); if (off) throw new Error('still reduced'); return 'reduce then normal'; });
  await step(31, 'Sign out', async () => { if (phone) { await page.locator('.sh-tab--more').click({ timeout: T }); await dialog().getByRole('button', { name: 'Sign out' }).click({ timeout: T }); } else { await page.locator('.sh-top-avatarbtn').click({ timeout: T }); await page.getByRole('menuitem', { name: 'Sign out' }).click({ timeout: T }); } await expectVisible(page.locator('.aa-login'), ''); return 'login card'; });
  await step(32, 'Sign back in', async () => { await page.getByLabel('Password').fill('correct horse'); await page.waitForTimeout(200); await page.getByRole('button', { name: 'Sign in' }).click({ timeout: T }); await page.waitForTimeout(500); await expectVisible(page.locator('.sh-root'), ''); await settle(); await expectVisible(page.locator('.db-greet'), ''); return 'dashboard back'; });
  await ctx.close();
}
await browser.close();

let md = `\n| # | Step | 390 | 1280 |\n|---|---|---|---|\n`;
const steps = [...new Set(results.map(r => r.n))];
for (const n of steps) { const a = results.find(r => r.n === n && r.width === 390); const b = results.find(r => r.n === n && r.width === 1280); const cell = (r) => (r ? (r.ok ? `ok${r.note ? ` (${r.note})` : ''}` : `FAIL: ${r.note}`) : 'n/a'); md += `| ${n} | ${(a || b).name} | ${cell(a)} | ${cell(b)} |\n`; }
md += `\nSteps: ${results.length}. Failures: ${failures}.\n`;
console.log(md.replace(/\|/g, '|'));
process.exit(failures ? 1 : 0);
