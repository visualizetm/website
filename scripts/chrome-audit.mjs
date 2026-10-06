/* Chrome audit (CRM mobile revamp, milestone 6): what surrounds every phone screen.
 *
 * Every admin screen and state in scripts/audit-screens.mjs is loaded at 390 with a touch profile, and the chrome mode the shell
 * reports (data-chrome on .sh-root, src/shell/chrome.js) is checked against what is on the screen:
 *
 *   tabs      the tab bar is visible at its full height, More or a tab is current, the top bar offers Search, Quick add and
 *             Notifications (and no Back), the tab labels are at least 11px
 *   focused   the tab bar is hidden (not just covered), the top bar is Back and the title and nothing from the global set; the
 *             only other controls are the ones the screen declared (its Done)
 *   always    controls never accumulate: a tabs screen has at most three top bar controls, a focused one at most Back plus one
 *             declared action
 *
 * Screens that must be tabs (the section roots and the More screen) and screens that must be focused (a record, an editor, a step,
 * the Call Console's room, queue and summary, the setup pages) are named below, so a screen cannot slip into the wrong mode without
 * this failing. Other states (a sheet over a list) only have to be consistent.
 *
 *   node scripts/chrome-audit.mjs        AUDIT_BASE=http://127.0.0.1:4331 node scripts/chrome-audit.mjs
 */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
import { SCREENS } from './audit-screens.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const ONLY = process.env.AUDIT_ONLY || '';

const MUST_TABS = /^(dashboard|pipeline|overview|docs-all|leads-list|leads-declined|leads-nurture|triage-pile|triage-search|lists-grid|deals-list|deals-board|calendar-(day|week|month)|clients-list|projects-list|projects-archived|orders-list|concepts-list|reviews-list|submissions-list|calls-lists|calls-builder|landing|design|more|settings-profile|back-[a-z]+)$/;
const MUST_FOCUSED = /^(leads-detail|triage-record|deals-detail|clients-detail|clients-money|clients-profile.*|lists-detail|lists-fill|calls-(queue|room|summary)|project-new.*|clients-showcase.*|planner-(on|off|empty|ideas.*)|clients-tasks.*|concepts-editor(?!-menu).*|orders-detail|submissions-detail|reviews-sheet|settings-(notifications|integrations|doc-templates|data|danger-zone|emails)|docs-client|clients-docs-empty|doc-(empty|blocks|keyboard|save-failed))$/;
const GLOBAL = ['Search', 'Quick add', 'Notifications'];

const url = (s) => `${BASE}${s.path}${s.open ? `${s.path.includes('?') ? '&' : '?'}open=${s.open}` : ''}`;
const read = () => {
  const root = document.querySelector('.sh-root'); const tabs = document.querySelector('.sh-tabs');
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const top = [...document.querySelectorAll('.sh-top button')].filter(vis).map(e => e.getAttribute('aria-label') || e.textContent.trim());
  const tabH = tabs ? Math.round(tabs.getBoundingClientRect().height) : 0;
  const labels = [...document.querySelectorAll('.sh-tab-label')].map(e => parseFloat(getComputedStyle(e).fontSize));
  return { chrome: root?.dataset.chrome || '', tabH, hidden: !!tabs?.classList.contains('is-hidden'), inert: tabs?.hasAttribute('inert'), top, minLabel: labels.length ? Math.min(...labels) : null, current: document.querySelector('.sh-tab.is-active .sh-tab-label')?.textContent || null };
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
const rows = []; let failures = 0;
for (const s of SCREENS) {
  if (s.marketing || s.boot || s.session === false) continue;
  if (ONLY && !s.id.startsWith(ONLY)) continue;
  if (s.minWidth && 390 < s.minWidth) continue;
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.removeItem('vz_motion'); } catch {} });
  await mockRoutes(page, { session: true });
  const goto = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  const bad = [];
  let r = null;
  try {
    if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, 390); }
    await goto(url(s));
    if (s.act) { await page.waitForTimeout(s.open ? 900 : 700); await s.act(page, 390); }
    await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    r = await page.evaluate(read);
    const mode = r.chrome;
    if (!['tabs', 'focused'].includes(mode)) bad.push(`mode "${mode}"`);
    if (mode === 'tabs') {
      if (r.tabH < 50 || r.hidden) bad.push(`tabs mode but the tab bar is ${r.tabH}px${r.hidden ? ' and hidden' : ''}`);
      if (r.top.includes('Back')) bad.push('tabs mode with a Back');
      if (!GLOBAL.every(g => r.top.includes(g))) bad.push(`tabs mode lacks ${GLOBAL.filter(g => !r.top.includes(g)).join(', ')}`);
      if (r.top.length > 3) bad.push(`${r.top.length} top bar controls`);
    }
    if (mode === 'focused') {
      if (r.tabH > 4 || !r.hidden || !r.inert) bad.push(`focused mode but the tab bar is ${r.tabH}px${r.hidden ? '' : ', not hidden'}${r.inert ? '' : ', not inert'}`);
      if (!r.top.includes('Back')) bad.push('focused mode without a Back');
      const extra = r.top.filter(t => t !== 'Back' && !GLOBAL.includes(t));
      if (r.top.some(t => GLOBAL.includes(t))) bad.push(`focused mode keeps ${r.top.filter(t => GLOBAL.includes(t)).join(', ')}`);
      if (extra.length > 1) bad.push(`${extra.length} declared actions (${extra.join(', ')})`);
    }
    if (r.minLabel !== null && r.minLabel < 11) bad.push(`tab labels ${r.minLabel}px`);
    if (MUST_TABS.test(s.id) && mode !== 'tabs') bad.push(`must be tabs, is ${mode}`);
    if (MUST_FOCUSED.test(s.id) && mode !== 'focused') bad.push(`must be focused, is ${mode}`);
  } catch (e) { bad.push(String(e.message || e).split('\n')[0].slice(0, 100)); }
  if (bad.length) failures++;
  rows.push({ id: s.id, state: `${s.screen}: ${s.label}`, r, bad });
  console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${s.id.padEnd(30)} ${r ? `${r.chrome.padEnd(8)} tab ${String(r.tabH).padStart(2)}px top [${r.top.join(', ')}]` : ''}${bad.length ? '  ' + bad.join('; ') : ''}`);
  await page.close();
}

/* Controls are replaced between states, never added: walk a list, a record, its editor or step, and back, counting the top bar. */
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.removeItem('vz_call_session'); } catch {} });
await mockRoutes(page, { session: true });
if (!ONLY) {
  const seq = [];
  await page.goto(`${BASE}/admin/clients`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800); seq.push(['clients list', await page.evaluate(read)]);
  await page.locator('.sh-content [data-row-id] .v-stretch').first().evaluate(el => el.click()); await page.waitForTimeout(900); seq.push(['client record', await page.evaluate(read)]);
  await page.goBack(); await page.waitForTimeout(700); seq.push(['back to the list', await page.evaluate(read)]);
  await page.locator('.sh-tab--more').click(); await page.waitForTimeout(700); seq.push(['more', await page.evaluate(read)]);
  await page.goto(`${BASE}/admin/clients/L11/showcase`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900); seq.push(['showcase overview', await page.evaluate(read)]);
  await page.getByRole('button', { name: /^Website/ }).first().click().catch(() => {}); await page.waitForTimeout(800); seq.push(['showcase step', await page.evaluate(read)]);
  await page.goBack(); await page.waitForTimeout(700); seq.push(['showcase overview again', await page.evaluate(read)]);
  for (const [name, v] of seq) {
    const max = v.chrome === 'focused' ? 2 : 3;
    const ok = v.top.length <= max && (v.chrome !== 'focused' || v.top[0] === 'Back');
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} walk: ${name.padEnd(24)} ${v.chrome.padEnd(8)} top [${v.top.join(', ')}]`);
  }
}
await page.close();
await browser.close();
console.log(`\nStates: ${rows.length}. Failures: ${failures}.`);
process.exit(failures ? 1 : 0);
