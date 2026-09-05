/* Keyboard walk (Prompt 15): Tab through every loaded screen state and
 * record each stop: does it show a visible focus ring, is it inside the
 * viewport, does it have an accessible name. Then, on the screens that own
 * them, exercise the patterns by key: Escape closes a Sheet and returns
 * focus, arrow keys move Tabs and SegmentedControl, Enter opens a Table row,
 * Shift+Arrow moves a kanban card, the command bar opens on slash.
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/keyboard-audit.mjs
 *   AUDIT_ONLY=leads AUDIT_WIDTHS=1280 node scripts/keyboard-audit.mjs
 */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
import { SCREENS } from './audit-screens.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [390, 1280];
const ONLY = process.env.AUDIT_ONLY || '';
const STOPS = Number(process.env.AUDIT_STOPS || 40);
const url = (s) => `${BASE}${s.path}${s.open ? `?open=${s.open}` : ''}`;

const focusInfo = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'body' };
  const cs = getComputedStyle(el);
  // The kit draws rings with outline on :focus-visible, or on a parent through :has() for stretched buttons.
  const ringOn = (n) => { const c = getComputedStyle(n); return (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || /rgb|#/.test(c.boxShadow) && c.boxShadow !== 'none'; };
  let ring = ringOn(el); let p = el.parentElement; let hops = 0;
  while (!ring && p && hops < 3) { if (ringOn(p)) ring = true; p = p.parentElement; hops++; }
  const r = el.getBoundingClientRect();
  const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const name = el.getAttribute('aria-label') || el.getAttribute('title') || (el.labels && el.labels[0]?.textContent) || el.textContent?.trim() || el.getAttribute('placeholder') || '';
  return { tag: el.tagName.toLowerCase(), cls: String(el.className).split(' ').slice(0, 2).join('.'), role: el.getAttribute('role') || '', ring, inView, name: name.slice(0, 40), inDialog: !!el.closest('[role="dialog"]') };
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0; const rows = [];
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 500, serviceWorkers: 'block' });
  for (const s of SCREENS) {
    if (s.boot || s.static || (ONLY && !s.id.startsWith(ONLY))) continue;
    if (s.minWidth && width < s.minWidth) continue;
    if (s.maxWidth && width > s.maxWidth) continue;
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch {} });
    await mockRoutes(page);
    const goto = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
    await goto(url(s));
    if (s.act) { await page.waitForTimeout(s.open ? 900 : 700); await s.act(page, width); }
    await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(700);
    const stops = []; const seen = new Set(); let noRing = 0; let offscreen = 0; let unnamed = 0; let bodyStops = 0;
    for (let i = 0; i < STOPS; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(focusInfo);
      if (f.tag === 'body') { bodyStops++; if (bodyStops > 2) break; continue; }
      const key = `${f.tag}.${f.cls}:${f.name}`;
      if (seen.has(key) && i > 5) break; // wrapped around
      seen.add(key);
      stops.push(f);
      if (!f.ring) noRing++;
      if (!f.inView && !f.inDialog) offscreen++;
      if (!f.name && f.tag !== 'input' && f.tag !== 'textarea') unnamed++;
    }
    const gaps = [];
    if (noRing) gaps.push(`${noRing} without a visible ring`);
    if (unnamed) gaps.push(`${unnamed} unnamed`);
    if (!stops.length) gaps.push('no focus stops');
    const bad = stops.filter(f => !f.ring || (!f.name && f.tag !== 'input' && f.tag !== 'textarea')).slice(0, 4).map(f => `${f.tag}.${f.cls}${f.name ? ` "${f.name}"` : ''}${f.ring ? '' : ' (no ring)'}`);
    rows.push({ width, screen: s.screen, state: s.label, stops: stops.length, noRing, unnamed, offscreen, gaps, bad });
    if (gaps.length) failures++;
    console.log(`  ${(gaps.length ? 'GAP' : 'ok ').padEnd(4)} [${width}px] ${s.screen}: ${s.label}  stops=${stops.length}${gaps.length ? '  ' + gaps.join(', ') + (bad.length ? ': ' + bad.join('; ') : '') : ''}`);
    await page.close();
  }

  /* Pattern checks on the screens that own them. */
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.setItem('vz_leads_view', JSON.stringify('kanban')); } catch {} });
  await mockRoutes(page);
  const check = (label, ok, detail = '') => { rows.push({ width, screen: 'Patterns', state: label, ok, detail }); if (!ok) failures++; console.log(`  ${ok ? 'ok ' : 'GAP'} [${width}px] Patterns: ${label}${detail ? `  ${detail}` : ''}`); };
  await page.goto(`${BASE}/admin/settings`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  // Tabs: arrow keys move the selected tab
  await page.getByRole('tab', { name: /^Profile/ }).focus().catch(() => {});
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  check('Tabs move with arrow keys', await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim().startsWith('Notifications')));
  // SegmentedControl: arrow keys move the radio
  await page.getByRole('tab', { name: /^Profile/ }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('radio', { name: 'Dark' }).focus().catch(() => {});
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const seg = await page.evaluate(() => document.querySelector('[role="radiogroup"][aria-label="Theme"] [role="radio"][aria-checked="true"]')?.textContent?.trim());
  check('SegmentedControl moves with arrow keys', seg === 'Light', `selected ${seg}`);
  await page.getByRole('radio', { name: 'Dark' }).click({ timeout: 3000 }).catch(() => {});
  // Sheet: opens, traps focus, Escape closes and returns focus
  await page.getByRole('tab', { name: /^Data/ }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  const opener = page.locator('.st-import-leads').first();
  await opener.focus().catch(() => {});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const inDialog = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  const stillIn = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
  const returned = await page.evaluate(() => document.activeElement?.classList.contains('st-import-leads'));
  check('Sheet traps focus, Escape closes and returns focus', inDialog && stillIn && closed && returned, `focus in dialog ${inDialog}, stayed ${stillIn}, closed ${closed}, returned ${returned}`);
  // Menu: opens on Enter, Escape returns focus
  await page.goto(`${BASE}/admin/leads`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  const menuBtn = page.locator('.lc-menu .v-ibtn').first();
  if (await menuBtn.count()) {
    await menuBtn.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const menuOpen = await page.evaluate(() => !!document.querySelector('[role="menu"]') && !!document.activeElement?.closest('[role="menu"]'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const back = await page.evaluate(() => !document.querySelector('[role="menu"]') && document.activeElement?.closest('.lc-menu') != null);
    check('Menu opens on Enter, Escape closes and returns focus', menuOpen && back, `open ${menuOpen}, returned ${back}`);
  }
  if (width >= 1024) {
    // Kanban: Shift+ArrowRight moves the focused card one column
    const card = page.locator('.ld-col[data-col="not-called"] .lc-open').first();
    if (await card.count()) {
      const name = await card.getAttribute('aria-label');
      await card.focus(); await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(700);
      const moved = await page.evaluate((n) => !!document.querySelector(`.ld-col[data-col="callback"] .lc-open[aria-label="${n}"]`), name);
      check('Kanban card moves with Shift+Arrow', moved, name || '');
    }
    // Table: Enter opens a row
    await page.evaluate(() => localStorage.setItem('vz_leads_view', JSON.stringify('list')));
    await page.goto(`${BASE}/admin/leads`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(700);
    const row = page.locator('.v-tr').first();
    if (await row.count()) { await row.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(700); check('Table row opens on Enter', !!(await page.locator('.dt-profile').count())); }
    // Command bar: slash opens it, arrows move, Escape closes
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {});
    await page.keyboard.press('/'); await page.waitForTimeout(400);
    const cmdFocused = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox');
    await page.keyboard.type('Lead Business'); await page.waitForTimeout(500);
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
    const active = await page.evaluate(() => document.querySelectorAll('.sh-cmd-row.is-active').length);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const cmdClosed = await page.evaluate(() => !document.querySelector('.sh-cmd-pop'));
    check('Command bar opens on slash, arrows move, Escape closes', cmdFocused && active === 1 && cmdClosed, `focused ${cmdFocused}, active rows ${active}, closed ${cmdClosed}`);
  }
  await page.close();
  await ctx.close();
}
await browser.close();
console.log(`\nScreens walked: ${rows.filter(r => r.stops != null).length}. Gaps: ${failures}.`);
process.exit(failures ? 1 : 0);
