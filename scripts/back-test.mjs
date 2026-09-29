/* Back test (Back, done once): for every list screen at 390 and 1280, apply a
 * filter, scroll, open the third row, tap Back, and assert the same path,
 * the same filter chips selected, the same scroll position within 8px and
 * the same row highlighted. Then the same with the browser's back. Then the
 * editors, the setup pages and the console modes. The run fails when any
 * screen one level deep has no Back control.
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/back-test.mjs
 *   AUDIT_WIDTHS=390 node scripts/back-test.mjs
 */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [390, 1280];
const T = 6000;
const SCROLL_PX = 8;
const ONLY = process.env.BACK_ONLY || ''; // one screen id, for a quick re-run

/* The list screens: path, the storage the list view needs, and how a row opens. */
const SCREENS = [
  { id: 'leads', path: '/admin/leads', ls: { vz_leads_view: 'list' } },
  { id: 'triage', path: '/admin/triage' },
  { id: 'lists', path: '/admin/lists' },
  { id: 'lists-inside', path: '/admin/lists', open: 'LS1', inside: true },
  { id: 'deals', path: '/admin/deals' },
  { id: 'clients', path: '/admin/clients' },
  { id: 'projects', path: '/admin/projects' },
  { id: 'orders', path: '/admin/orders' },
  { id: 'reviews', path: '/admin/reviews' },
  { id: 'submissions', path: '/admin/submissions' },
  { id: 'dashboard', path: '/admin' },
  { id: 'calendar', path: '/admin/calendar', ls: { vz_cal_view: 'day' } },
];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const results = [];
let failures = 0;

for (const width of WIDTHS) {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: phone, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('vz_boot', '1'); localStorage.setItem('vz_theme', 'dark'); } catch {} });
  await page.route('**/api/admin/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authed: true }) }));
  await mockRoutes(page);
  const goto = (p) => page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const settle = async () => { await page.waitForFunction(() => { const c = document.querySelector('.sh-content'); return c && c.querySelector('.v-card, .lc, .v-lrow, .v-empty, .v-error, .v-tr, [data-row-id]') && !c.querySelector('.v-skel'); }, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(350); };
  /* The init script clears storage on every load, so a screen's storage rides in an init script of its own (they accumulate, later keys win). */
  const setLS = (kv) => page.addInitScript((o) => { try { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, JSON.stringify(v)); } catch {} }, kv);
  const pathOf = () => page.evaluate(() => location.pathname + location.search);
  const backBtn = () => page.locator('.sh-top-back');
  const hasBack = async () => (await backBtn().count()) > 0 && await backBtn().first().isVisible().catch(() => false);
  /* The control: the top bar's Back, or the Close of a record shown in a sheet (a phone's order, review or submission), which runs the same history back. */
  const pressBack = async () => { const x = page.locator('[role="dialog"] .v-sheet-x'); if (await x.count() && await x.first().isVisible().catch(() => false)) { await x.first().click({ timeout: T }); return 'sheet close'; } await backBtn().first().click({ timeout: T }); return 'top bar'; };
  const mainScroll = () => page.evaluate(() => { const el = [...document.querySelectorAll('.sh-content .lay-scroll')].find(e => !e.closest('.aa-panel') && !e.closest('.v-sheet, .v-modal')); return el ? Math.round(el.scrollTop) : 0; });
  const scrollMain = (top) => page.evaluate((t) => { const el = [...document.querySelectorAll('.sh-content .lay-scroll')].find(e => !e.closest('.aa-panel') && !e.closest('.v-sheet, .v-modal')); if (!el) return 0; el.style.scrollBehavior = 'auto'; el.scrollTop = t; return Math.round(el.scrollTop); }, top);
  const chipsOn = () => page.evaluate(() => [...document.querySelectorAll('.sh-content .v-chip.is-selected')].filter(c => !c.closest('[role="dialog"]')).map(c => c.textContent.trim()));
  const rows = () => page.locator('.sh-content [data-row-id]:visible');
  const openRow = async (row) => { const s = row.locator('.v-stretch'); if (await s.count()) await s.first().evaluate(el => el.click()); else await row.click({ timeout: T }); };
  const waitScroll = async (want) => { const t0 = Date.now(); let got = 0; while (Date.now() - t0 < 3500) { got = await mainScroll(); if (Math.abs(got - want) <= SCROLL_PX) return got; await page.waitForTimeout(100); } return got; };

  const step = async (name, fn) => {
    try { const note = await fn(); results.push({ width, name, ok: true, note: note || '' }); console.log(`  ok   [${width}] ${name}${note ? `: ${note}` : ''}`); }
    catch (e) { failures++; results.push({ width, name, ok: false, note: String(e.message || e).split('\n')[0].slice(0, 140) }); console.log(`  FAIL [${width}] ${name}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); if (process.env.BACK_SHOT) await page.screenshot({ path: `${process.env.BACK_SHOT}/back-fail-${width}-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png` }).catch(() => {}); }
  };

  /* One list screen: filter, scroll, open the third row, Back (the control, then the browser). */
  const walk = async (s) => {
    for (const how of ['control', 'browser']) {
      await step(`${s.id}: Back (${how}) restores path, chips, scroll and the row`, async () => {
        if (s.ls) await setLS(s.ls);
        await goto(s.path); await settle();
        if (s.open) { await page.locator(`[data-row-id="${s.open}"] .v-stretch`).first().click({ timeout: T }); await settle(); }
        const chip = page.locator('.sh-content .v-chip').filter({ hasNot: page.locator('[role="dialog"] *') }).nth(1);
        let chipNote = 'no chip';
        if (await chip.count() && await chip.isVisible().catch(() => false)) { await chip.click({ timeout: T }); await page.waitForTimeout(300); chipNote = `chip ${(await chip.textContent()).trim().slice(0, 18)}`; }
        const wantChips = await chipsOn();
        const path0 = await pathOf();
        await scrollMain(240);
        const n = await rows().count();
        if (!n) throw new Error('no rows');
        const row = rows().nth(Math.min(2, n - 1));
        await row.scrollIntoViewIfNeeded();
        const id = await row.getAttribute('data-row-id');
        const wantScroll = await mainScroll();
        await openRow(row);
        await page.waitForTimeout(600);
        /* A desktop calendar block opens a popover first; its Open lead is the record open. */
        const pop = page.locator('.v-popover button, .v-pop button, [role="dialog"] button').filter({ hasText: /^Open lead/ });
        if (await pop.count()) { await pop.first().click({ timeout: T }); await page.waitForTimeout(600); }
        if (!(await hasBack())) throw new Error(`no Back control one level deep (path ${await pathOf()}, rows ${n}, row ${id}, record ${await page.locator('.rc-head').count()})`);
        if (how === 'control') await pressBack(); else await page.goBack({ waitUntil: 'commit' });
        await page.waitForTimeout(400);
        const path1 = await pathOf();
        if (path1 !== path0) throw new Error(`path ${path1}, wanted ${path0}`);
        await settle();
        const got = await waitScroll(wantScroll);
        if (Math.abs(got - wantScroll) > SCROLL_PX) throw new Error(`scroll ${got}, wanted ${wantScroll}`);
        const chips1 = await chipsOn();
        if (chips1.join('|') !== wantChips.join('|')) throw new Error(`chips ${chips1.join(',') || 'none'}, wanted ${wantChips.join(',') || 'none'}`);
        await page.locator(`.sh-content [data-row-id="${id}"].nav-restored`).first().waitFor({ state: 'attached', timeout: 3500 }).catch(() => { throw new Error(`row ${id} not highlighted`); });
        return `${chipNote}, scroll ${got}, row ${id}`;
      });
    }
  };
  console.log(`\nBack test at ${width}px`);
  for (const s of SCREENS) if (!ONLY || s.id === ONLY) await walk(s);
  if (ONLY) { await ctx.close(); continue; }

  /* The editors and the setup pages: opened from a record, Back returns to the record. */
  const fromRecord = async (name, path, rowId, menuItem, expect) => {
    await step(`${name}: Back returns to the record`, async () => {
      await setLS({ vz_leads_view: 'list' });
      await goto(path); await settle();
      await openRow(page.locator(`[data-row-id="${rowId}"]`).first());
      await page.locator('.rc-head').first().waitFor({ state: 'visible', timeout: T });
      await page.getByRole('button', { name: 'More actions' }).first().click({ timeout: T });
      await page.getByRole('menuitem', { name: menuItem }).first().click({ timeout: T });
      await page.locator(expect).first().waitFor({ state: 'visible', timeout: T });
      if (!(await hasBack())) throw new Error('no Back control on the page');
      await backBtn().first().click({ timeout: T });
      await page.locator('.rc-head').first().waitFor({ state: 'visible', timeout: T });
      const p = await pathOf(); if (!p.startsWith(path)) throw new Error(`path ${p}`);
      return 'record back';
    });
  };
  await fromRecord('Showcase editor', '/admin/clients', 'L11', /^Showcase/, '.sc-shell, .sc-topbar, .sh-content .v-section-head');
  await fromRecord('Planner editor', '/admin/clients', 'L11', /^Planner/, '.pl-topbar, .pl-shell, .sh-content .v-section-head');
  await step('Concepts editor: Back returns to the Concepts list', async () => {
    await goto('/admin/concepts'); await settle();
    await page.getByRole('button', { name: /^Open Lead Business 8/ }).first().click({ timeout: T });
    await page.locator('.ce-dir').first().waitFor({ state: 'visible', timeout: T });
    if (!(await hasBack())) throw new Error('no Back control on the editor');
    await backBtn().first().click({ timeout: T }); await settle();
    if (!(await pathOf()).startsWith('/admin/concepts')) throw new Error(`path ${await pathOf()}`);
    await page.locator('[data-row-id="L8"].nav-restored, .sh-content .nav-restored').first().waitFor({ state: 'attached', timeout: 3500 });
    return 'list, row highlighted';
  });
  await fromRecord('New project page', '/admin/clients', 'L11', 'New project', '.pn-shell');
  await step('Fill from filters: Back returns to the list', async () => {
    await goto('/admin/lists'); await settle();
    await page.getByRole('button', { name: /^Tuesday morning .* actions$/ }).first().click({ timeout: T });
    await page.getByRole('menuitem', { name: 'Fill from filters' }).click({ timeout: T });
    await page.locator('.lf-shell').first().waitFor({ state: 'visible', timeout: T });
    if (!(await hasBack())) throw new Error('no Back control on the fill page');
    await backBtn().first().click({ timeout: T }); await settle();
    if (!(await pathOf()).startsWith('/admin/lists')) throw new Error(`path ${await pathOf()}`);
    if (await hasBack()) throw new Error('a Back control at the Lists root');
    return 'lists root, no Back';
  });
  /* The console: queue and room are entries; the builder is the root. */
  await step('Call Console modes: Back walks room, queue, builder', async () => {
    await goto('/admin/calls'); await page.evaluate(() => localStorage.removeItem('vz_call_session')); await goto('/admin/calls'); await settle();
    await page.getByRole('button', { name: 'Quick session' }).first().click({ timeout: T }); await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^Start call session/ }).first().click({ timeout: T }); await page.waitForTimeout(600);
    if (!(await hasBack())) throw new Error('no Back control in the session');
    const modes = [];
    if (phone) { await page.locator('.cc-qcard .v-stretch').first().click({ timeout: T }); await page.waitForTimeout(500); modes.push('room'); if (!(await hasBack())) throw new Error('no Back control in the room'); await backBtn().first().click({ timeout: T }); await page.waitForTimeout(400); modes.push('queue'); if (!(await hasBack())) throw new Error('no Back control in the queue'); }
    await backBtn().first().click({ timeout: T }); await page.waitForTimeout(400); modes.push('builder');
    if (await hasBack()) throw new Error('a Back control at the builder root');
    return modes.join(' > ');
  });
  /* Section roots have no Back; the deeper Settings screens do. */
  await step('Section roots have no Back', async () => {
    const roots = ['/admin', '/admin/triage', '/admin/leads', '/admin/lists', '/admin/calls', '/admin/deals', '/admin/clients', '/admin/projects', '/admin/orders', '/admin/reviews', '/admin/landing', '/admin/submissions', '/admin/settings', '/admin/design'];
    const bad = [];
    for (const r of roots) { await goto(r); await page.waitForTimeout(500); if (await hasBack()) bad.push(r); }
    if (bad.length) throw new Error(`Back at ${bad.join(', ')}`);
    return `${roots.length} roots`;
  });
  await step('Settings: a tab on the phone, Recently deleted and Design have Back', async () => {
    await goto('/admin/settings'); await settle();
    const notes = [];
    if (phone) { await page.getByRole('tab', { name: /^Notifications/ }).first().click({ timeout: T }); await page.waitForTimeout(400); if (!(await hasBack())) throw new Error('no Back on a Settings tab'); await backBtn().first().click({ timeout: T }); await page.waitForTimeout(400); notes.push('tab'); }
    await goto('/admin/settings/deleted'); await page.waitForTimeout(600); if (!(await hasBack())) throw new Error('no Back on Recently deleted'); notes.push('deleted');
    await goto('/admin/settings'); await settle(); await page.getByRole('tab', { name: /^Danger/ }).first().click({ timeout: T }); await page.waitForTimeout(500); await page.getByRole('button', { name: /^Open design system/ }).first().click({ timeout: T }); await page.waitForTimeout(600); if (!(await hasBack())) throw new Error('no Back on Design opened from Settings'); notes.push('design');
    return notes.join(', ');
  });
  await step('Deep link: a record with no origin shows Back to its section root', async () => {
    await goto('/admin/leads?open=L3'); await settle(); await page.locator('.rc-head').first().waitFor({ state: 'visible', timeout: T });
    if (!(await hasBack())) throw new Error('no Back on a deep linked record');
    await backBtn().first().click({ timeout: T }); await page.waitForTimeout(500);
    const p = await pathOf(); if (!p.startsWith('/admin/leads')) throw new Error(`path ${p}`);
    if (await hasBack()) throw new Error('Back still shown at the root');
    return 'leads root';
  });
  await ctx.close();
}
await browser.close();

console.log(`\n| Step | ${WIDTHS.join(' | ')} |\n|---|${WIDTHS.map(() => '---').join('|')}|`);
const names = [...new Set(results.map(r => r.name))];
for (const name of names) console.log(`| ${name} | ${WIDTHS.map(w => { const r = results.find(x => x.width === w && x.name === name); return r ? `${r.ok ? 'ok' : 'FAIL'}${r.note ? ` (${r.note})` : ''}` : ''; }).join(' | ')} |`);
console.log(`\n${failures ? `${failures} failing` : 'All steps pass'}.`);
process.exit(failures ? 1 : 0);
