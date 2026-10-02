/* Empty audit (CRM mobile revamp, milestone 6): every list screen in its two empty states, at 390.
 *
 *   first time   the list holds nothing: an EmptyState (data-state="empty") that says what the screen is for and carries one primary
 *                action, at least 44px tall
 *   no results   the list holds rows but the search matches none: a NoResults (data-state="no-results") whose title names what was
 *                searched, with one Clear action, at least 44px tall
 *
 * The two must render, must not be the same words, and the no results one must never be the first time one. Deals and Projects are
 * asserted by name (they were a blank page and the wrong card). A screen with no search or filter that can empty it is listed as
 * having no no results state, with the reason.
 *
 *   node scripts/empty-audit.mjs        AUDIT_BASE=http://127.0.0.1:4331 node scripts/empty-audit.mjs
 */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const JUNK = 'zzqqxx';
const SCREENS = [
  { id: 'Leads', path: '/admin/leads', resource: 'leads', search: true },
  { id: 'Triage', path: '/admin/triage', resource: 'leads', search: true },
  { id: 'Deals', path: '/admin/deals', resource: 'leads', search: true, named: true },
  { id: 'Clients', path: '/admin/clients', resource: 'leads', search: true },
  { id: 'Projects', path: '/admin/projects', resource: 'projects', search: true, named: true },
  { id: 'Orders', path: '/admin/orders', resource: 'orders', search: true },
  { id: 'Reviews', path: '/admin/reviews', resource: 'leads', search: true },
  { id: 'Submissions', path: '/admin/submissions', resource: 'submissions', search: true },
  { id: 'Lists', path: '/admin/lists', resource: 'lists', search: false, why: 'the lists screen has no search; a list that is empty is the first time state' },
  { id: 'Concepts', path: '/admin/concepts', resource: 'sets', search: false, why: 'a status filter narrows it; the filter state is its own copy (concepts.filter)' },
];
const grab = () => {
  const e = document.querySelector('.sh-content [data-state]');
  if (!e) return null;
  const b = e.querySelector('button, a[href]'); const r = b?.getBoundingClientRect();
  return { kind: e.dataset.state, title: e.querySelector('.v-empty-title')?.textContent.trim() || '', desc: e.querySelector('.v-empty-desc')?.textContent.trim() || '', action: b ? b.textContent.trim() : '', h: r ? Math.round(r.height) : 0, w: r ? Math.round(r.width) : 0 };
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0; const rows = [];
for (const s of SCREENS) {
  const bad = [];
  const mk = async (opts) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.setItem('vz_leads_view', JSON.stringify('list')); localStorage.removeItem('vz_call_session'); } catch {} });
    await mockRoutes(page, opts);
    await page.goto(BASE + s.path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1100);
    return { ctx, page };
  };
  let first = null; let none = null;
  { const { ctx, page } = await mk({ empty: [s.resource] }); first = await page.evaluate(grab); await ctx.close(); }
  if (!first || first.kind !== 'empty') bad.push(`first time state missing (${first ? first.kind : 'nothing rendered'})`);
  else {
    if (!first.title || !first.desc) bad.push('first time state has no title or description');
    if (!first.action || first.h < 44) bad.push(`first time action ${first.action ? first.h + 'px' : 'missing'}`);
  }
  if (s.search) {
    const { ctx, page } = await mk({});
    const box = page.locator('.sh-content input[type="search"], .sh-content input[aria-label^="Search"], .sh-content input[placeholder*="earch" i]').first();
    if (!(await box.count())) bad.push('no search box to empty the list with');
    else { await box.fill(JUNK); await page.waitForTimeout(900); none = await page.evaluate(grab); }
    await ctx.close();
    if (!none || none.kind !== 'no-results') bad.push(`no results state ${none ? 'is the ' + none.kind + ' state ("' + none.title + '")' : 'is blank'}`);
    else {
      if (!none.title.includes(JUNK)) bad.push(`the no results title does not name the search ("${none.title}")`);
      if (!/clear|show all/i.test(none.action) || none.h < 44) bad.push(`no results action "${none.action}" ${none.h}px`);
      if (first && none.title === first.title) bad.push('both states carry the same title');
    }
  }
  if (bad.length) failures++;
  rows.push({ id: s.id, first, none, bad });
  console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${s.id.padEnd(12)} first: ${first ? `"${first.title}" [${first.action} ${first.h}px]` : 'none'}  |  none: ${s.search ? (none ? `"${none.title}" [${none.action} ${none.h}px]` : 'none') : 'n/a, ' + s.why}${bad.length ? '\n         ' + bad.join('\n         ') : ''}`);
}
await browser.close();
console.log(`\nScreens: ${rows.length}. Failures: ${failures}.`);
process.exit(failures ? 1 : 0);
