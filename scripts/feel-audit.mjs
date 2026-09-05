/* Feel audit (Prompt 14). Walks every admin screen and state the layout audit
 * knows and records, per state and width:
 *
 *   skeleton  a forced loading state (?loading=1) renders a skeleton in the region
 *   fit       the skeleton's outermost blocks sit where the loaded blocks sit:
 *             blocks are grouped into rows by top edge; every row above the fold
 *             must start within 4px of its loaded row (top and left), and blocks
 *             200px or wider must also match in width. Text line skeletons under
 *             40px tall are not blocks (loaded text is not measured either), and
 *             chip widths are data driven, so narrow controls compare position only.
 *   entrance  the loaded state arrives through Stagger, Reveal, or a row entrance
 *   empty     an EmptyState renders when the screen's resource is empty
 *   error     an ErrorState renders when the screen's resource answers 500
 *   cls       cumulative layout shift while real data lands over the skeleton
 *
 * Same Playwright setup and fixtures as the layout audit (scripts/audit-fixtures.mjs).
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/feel-audit.mjs
 *   AUDIT_WIDTHS=390,1280 AUDIT_THEME=both AUDIT_MOTION=both node scripts/feel-audit.mjs
 *   AUDIT_ONLY=calendar node scripts/feel-audit.mjs          # one screen group
 *   AUDIT_OUT=/tmp/feel.json node scripts/feel-audit.mjs     # save the tables as JSON
 *   node scripts/feel-audit.mjs --boot                       # time to first shell paint, throttled
 *
 * Exits 1 when any expected check is missing, so it can gate a build.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { mockRoutes, leads } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [390, 1280];
const THEMES = process.env.AUDIT_THEME === 'both' ? ['dark', 'light'] : [process.env.AUDIT_THEME || 'dark'];
const MOTIONS = process.env.AUDIT_MOTION === 'both' ? ['normal', 'reduce'] : [process.env.AUDIT_MOTION || 'normal'];
const ONLY = process.env.AUDIT_ONLY || '';
const OUT = process.env.AUDIT_OUT || '';
const BOOT = process.argv.includes('--boot');
const BOXES = !!process.env.AUDIT_BOXES; // print the skeleton and loaded block lists per state, for tuning skeletons
const FIT_PX = 4;
const VIEW_H = 844;

const SESSION = (mode) => ({ ids: ['L0', 'L1', 'L3', 'L4', 'L6', 'L7'], idx: 0, stats: {}, logged: {}, startedAt: Date.now(), size: 6, mode });
const setLS = (page, k, v) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]).catch(() => {});
const rmLS = (page, k) => page.evaluate((k) => localStorage.removeItem(k), k).catch(() => {});
const click = (loc, t = 4000) => loc.first().click({ timeout: t }).catch(() => {});
const tab = (page, name) => click(page.getByRole('tab', { name: new RegExp('^' + name) }), 3000);
const openRow = async (page, width, text, mobileName) => {
  if (width >= 1024) await click(page.locator('.v-tr', { hasText: text }));
  else await click(page.getByRole('button', { name: mobileName }));
};

/* Every screen and state. `region` is where the checks look; `resource` is the
 * mocked endpoint that drives the empty and error states; `open` is the record
 * the forced loading variant deep links to (a skeleton must show while it resolves). */
const SCREENS = [
  { id: 'boot', screen: 'Boot and login', label: 'boot, signed in hint', path: '/admin', region: '#root', boot: 'authed', static: true },
  { id: 'boot-fresh', screen: 'Boot and login', label: 'boot, no hint', path: '/admin', region: '#root', boot: 'fresh', static: true },
  { id: 'login', screen: 'Boot and login', label: 'login form', path: '/admin', region: '.aa-loginpage', session: false, static: true, resource: null },

  { id: 'dashboard', screen: 'Dashboard', label: 'dashboard', path: '/admin', resource: 'leads', prep: (p) => rmLS(p, 'vz_call_session') },

  { id: 'leads-kanban', screen: 'Leads', label: 'list, kanban', path: '/admin/leads', resource: 'leads', minWidth: 1024, prep: (p) => setLS(p, 'vz_leads_view', 'kanban') },
  { id: 'leads-list', screen: 'Leads', label: 'list, cards or table', path: '/admin/leads', resource: 'leads', prep: (p) => setLS(p, 'vz_leads_view', 'list') },
  { id: 'leads-detail', screen: 'Leads', label: 'lead detail', path: '/admin/leads', open: 'L0', region: '.aa-main.ld-main', resource: 'leads', detail: true, prep: (p) => setLS(p, 'vz_leads_view', 'list'), act: (p, w) => click(p.locator(w >= 1024 ? '.v-tr' : '.lc')) },

  { id: 'calls-builder', screen: 'Call Console', label: 'builder', path: '/admin/calls', resource: 'leads', prep: (p) => rmLS(p, 'vz_call_session') },
  { id: 'calls-queue', screen: 'Call Console', label: 'queue', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('queue')) },
  { id: 'calls-room', screen: 'Call Console', label: 'room', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('room')) },
  { id: 'calls-summary', screen: 'Call Console', label: 'summary', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('summary')) },

  { id: 'booked-list', screen: 'Booked', label: 'list', path: '/admin/booked', resource: 'leads' },
  { id: 'booked-detail', screen: 'Booked', label: 'detail', path: '/admin/booked', open: 'L8', region: '.aa-main.bk-main', resource: 'leads', detail: true, act: (p) => click(p.locator('.lc')) },

  { id: 'calendar-day', screen: 'Calendar', label: 'day', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'day') },
  { id: 'calendar-week', screen: 'Calendar', label: 'week', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'week') },
  { id: 'calendar-month', screen: 'Calendar', label: 'month', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'month') },

  { id: 'clients-list', screen: 'Clients', label: 'list', path: '/admin/clients', resource: 'leads' },
  { id: 'clients-detail', screen: 'Clients', label: 'client detail', path: '/admin/clients', open: 'L11', region: '.aa-main.cl-main', resource: 'leads', detail: true, act: (p, w) => openRow(p, w, 'Lead Business 11', 'Open Lead Business 11') },

  { id: 'orders-list', screen: 'Print Orders', label: 'list', path: '/admin/orders', resource: 'orders' },
  { id: 'orders-detail', screen: 'Print Orders', label: 'order detail (panel or sheet)', path: '/admin/orders', open: 'O1', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'orders', detail: true, act: (p, w) => openRow(p, w, 'Person 0', /^Open order for Person 0/) },

  { id: 'concepts-grid', screen: 'Concepts', label: 'grid', path: '/admin/concepts', resource: 'packs' },
  { id: 'concepts-detail', screen: 'Concepts', label: 'pack detail (panel or sheet)', path: '/admin/concepts', open: 'K1', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'packs', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open Universal logo directions/ })) },

  { id: 'reviews-list', screen: 'Reviews', label: 'list', path: '/admin/reviews', resource: 'leads' },
  { id: 'reviews-sheet', screen: 'Reviews', label: 'review sheet', path: '/admin/reviews', open: 'L12', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open reviews for Lead Business 12/ })) },

  { id: 'submissions-list', screen: 'Submissions', label: 'list', path: '/admin/submissions', resource: 'submissions' },
  { id: 'submissions-detail', screen: 'Submissions', label: 'submission detail (panel or sheet)', path: '/admin/submissions', open: 'id5', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'submissions', detail: true, act: (p, w) => openRow(p, w, 'Business 5', /^Open submission from Business 5/) },

  ...['Profile', 'Notifications', 'Integrations', 'Data', 'Automation', 'Shortcuts', 'Danger zone'].map(t => ({
    id: `settings-${t.toLowerCase().replace(/ /g, '-')}`, screen: 'Settings', label: `${t} tab`, path: '/admin/settings', resource: 'settings', noEmpty: true,
    act: t === 'Profile' ? undefined : (p) => tab(p, t),
  })),

  { id: 'design', screen: 'Design system', label: 'design page', path: '/admin/design', resource: null, noEmpty: true, noError: true },

  { id: 'notifications', screen: 'Shell', label: 'notifications drawer', path: '/admin/leads', region: '.v-sheet', resource: 'leads', emptyAlso: ['settings'], act: (p) => click(p.locator('.sh-bell')) },
  { id: 'more', screen: 'Shell', label: 'More sheet', path: '/admin/leads', region: '.v-sheet', maxWidth: 767, resource: null, static: true, act: (p) => click(p.locator('.sh-tab--more')) },
];

/* Outermost blocks in a region: what a skeleton has to line up with. */
const BLOCKS = '.v-card, .lc, .v-lrow, .v-table-wrap, .v-section-head, .ld-col, .cal-strip, .cal-week, .cal-month, .cc-head, .v-tabs, .v-seg, .v-chip, .v-skel, .v-btn, .v-field, .v-empty, .v-error, .dt-profile, .cc-preview, .sh-side-label, .v-toggle, .ds-sec, .ds-hero';
const ENTRANCE = '.v-stagger, .v-reveal, [data-v-enter]';

async function measure(page, region) {
  return page.evaluate(([region, BLOCKS, VIEW_H]) => {
    const root = document.querySelector(region);
    if (!root) return null;
    const all = [...root.querySelectorAll(BLOCKS)].filter(el => !el.parentElement?.closest(BLOCKS) || !root.contains(el.parentElement.closest(BLOCKS)));
    const boxes = all.filter(el => !(el.classList.contains('v-skel') && el.getBoundingClientRect().height < 40)).map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0 && r.top < VIEW_H && r.bottom > 0)
      .map(r => ({ l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }))
      .sort((a, b) => (a.t - b.t) || (a.l - b.l));
    return boxes;
  }, [region, BLOCKS, VIEW_H]);
}
async function count(page, region, sel) {
  return page.evaluate(([region, sel]) => { const root = document.querySelector(region); return root ? root.querySelectorAll(sel).length : -1; }, [region, sel]);
}
const rowsOf = (boxes) => { const rows = []; for (const b of boxes) { const r = rows[rows.length - 1]; if (r && Math.abs(r.t - b.t) <= FIT_PX) r.items.push(b); else rows.push({ t: b.t, l: b.l, items: [b] }); } return rows; };
function fit(skel, loaded) {
  if (!skel?.length || !loaded?.length) return { ok: false, text: skel ? 'no blocks' : 'no region' };
  const a = rowsOf(skel); const b = rowsOf(loaded);
  const n = Math.min(a.length, b.length);
  let worst = 0; let at = -1;
  for (let i = 0; i < n; i++) {
    let d = Math.max(Math.abs(a[i].t - b[i].t), Math.abs(a[i].l - b[i].l));
    const wide = (r) => r.items.filter(x => x.w >= 200);
    const wa = wide(a[i]); const wb = wide(b[i]);
    for (let j = 0; j < Math.min(wa.length, wb.length); j++) d = Math.max(d, Math.abs(wa[j].w - wb[j].w));
    if (d > worst) { worst = d; at = i; }
  }
  const ok = worst <= FIT_PX;
  return { ok, text: ok ? `ok (${n} rows)` : `off ${worst}px at row ${at + 1} of ${n}` + (a.length !== b.length ? `, ${a.length} vs ${b.length} rows` : '') };
}
const url = (s, extra = '') => `${BASE}${s.path}${s.path.includes('?') ? '&' : '?'}${[s.open ? `open=${s.open}` : '', extra].filter(Boolean).join('&')}`.replace(/\?$/, '');

async function settle(page, region, ms = 900) {
  await page.waitForFunction((r) => { const el = document.querySelector(r); return !!el && !el.querySelector('.v-skel'); }, region, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function runState(ctx, s, width, theme, motion) {
  const region = typeof s.region === 'function' ? s.region(width) : (s.region || '.sh-content');
  const row = { id: s.id, screen: s.screen, state: s.label, width, theme, motion, skeleton: 'n/a', fit: 'n/a', entrance: 'n/a', empty: 'n/a', error: 'n/a', cls: 'n/a', gaps: [] };
  const page = await ctx.newPage();
  await page.addInitScript(([theme, motion]) => {
    try { localStorage.setItem('vz_theme', theme); if (motion === 'reduce') localStorage.setItem('vz_motion', 'reduce'); else localStorage.removeItem('vz_motion'); } catch {}
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  }, [theme, motion]);
  const goto = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

  /* Boot: what paints before the bundle answers. */
  if (s.boot) {
    await mockRoutes(page, { session: 'hang' });
    await page.addInitScript((hint) => { try { if (hint === 'authed') localStorage.setItem('vz_boot', '1'); else localStorage.removeItem('vz_boot'); } catch {} }, s.boot);
    await goto(url(s));
    await page.waitForTimeout(400);
    const frame = await page.evaluate(() => ({ frame: !!document.querySelector('.vz-boot, .sh-root'), skel: document.querySelectorAll('.v-skel, .vz-skel').length, blank: !document.querySelector('#root')?.children.length, login: !!document.querySelector('.vz-boot--login, .aa-login') }));
    row.skeleton = frame.frame && frame.skel ? `yes (${frame.skel} blocks)` : frame.blank ? 'BLANK GROUND' : 'no';
    row.entrance = s.boot === 'fresh' ? (frame.login ? 'login frame' : 'no login frame') : 'n/a';
    if (!(frame.frame && frame.skel)) row.gaps.push('skeleton');
    await page.close();
    return row;
  }

  /* Static screens: no forced loading, no resource. */
  if (!s.static) {
    // A. forced loading
    await mockRoutes(page, { delay: 0 });
    if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
    await goto(url(s, 'loading=1'));
    await page.waitForTimeout(700);
    if (s.act && !s.open) await s.act(page, width);
    if (s.act && !s.open) await page.waitForTimeout(500);
    const skelCount = await count(page, region, '.v-skel');
    row.skeleton = skelCount > 0 ? `yes (${skelCount})` : skelCount === -1 ? 'no region' : 'no';
    if (skelCount <= 0) row.gaps.push('skeleton');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }

  // B. real load with a 400ms server, measures CLS and entrance
  await mockRoutes(page, { delay: s.static ? 0 : 400, session: s.session === false ? false : true });
  if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
  await page.evaluate(() => { window.__cls = 0; });
  await goto(url(s));
  if (s.act) { await page.waitForTimeout(s.open ? 900 : 700); await s.act(page, width); }
  await settle(page, region);
  const entrance = await count(page, region, ENTRANCE);
  const cls = await page.evaluate(() => Math.round((window.__cls || 0) * 1000) / 1000);
  row.entrance = entrance > 0 ? `yes (${entrance})` : entrance === -1 ? 'no region' : 'no';
  if (entrance <= 0) row.gaps.push('entrance');
  row.cls = String(cls);
  if (cls > 0.1) row.gaps.push('cls');
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  if (!s.static && s.resource) {
    // C. empty resource
    if (!s.noEmpty && !s.detail) {
      await mockRoutes(page, { empty: [s.resource, ...(s.resource === 'leads' ? ['calendly', 'projects'] : []), ...(s.emptyAlso || [])] });
      if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
      await goto(url(s));
      if (s.act) { await page.waitForTimeout(700); await s.act(page, width); }
      await settle(page, region, 500);
      const n = await count(page, region, '.v-empty');
      row.empty = n > 0 ? 'yes' : n === -1 ? 'no region' : 'no';
      if (n <= 0) row.gaps.push('empty');
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
    // D. failing resource
    if (!s.noError && !s.detail) {
      await mockRoutes(page, { fail: [s.resource] });
      if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
      await goto(url(s));
      if (s.act) { await page.waitForTimeout(700); await s.act(page, width); }
      await settle(page, region, 500);
      const n = await count(page, region, '.v-error');
      row.error = n > 0 ? 'yes' : n === -1 ? 'no region' : 'no';
      if (n <= 0) row.gaps.push('error');
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  }
  await page.close();
  return row;
}

/* The fit check needs the skeleton boxes and the loaded boxes from two clean
 * loads, so it wraps runState with its own two passes. */
async function runStateWithFit(ctx, s, width, theme, motion) {
  const region = typeof s.region === 'function' ? s.region(width) : (s.region || '.sh-content');
  let skelBlocks = null;
  if (!s.static && !s.boot) {
    const page = await ctx.newPage();
    await page.addInitScript(([theme, motion]) => { try { localStorage.setItem('vz_theme', theme); if (motion === 'reduce') localStorage.setItem('vz_motion', 'reduce'); else localStorage.removeItem('vz_motion'); } catch {} }, [theme, motion]);
    await mockRoutes(page);
    const goto = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
    await goto(url(s, 'loading=1'));
    await page.waitForTimeout(700);
    if (s.act && !s.open) { await s.act(page, width); await page.waitForTimeout(500); }
    skelBlocks = (await count(page, region, '.v-skel')) > 0 ? await measure(page, region) : null;
    await page.close();
  }
  const row = await runState(ctx, s, width, theme, motion);
  if (!s.static && !s.boot) {
    const page = await ctx.newPage();
    await page.addInitScript(([theme, motion]) => { try { localStorage.setItem('vz_theme', theme); if (motion === 'reduce') localStorage.setItem('vz_motion', 'reduce'); else localStorage.removeItem('vz_motion'); } catch {} }, [theme, motion]);
    await mockRoutes(page);
    const goto = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
    await goto(url(s));
    if (s.act) { await page.waitForTimeout(s.open ? 900 : 700); await s.act(page, width); }
    await settle(page, region);
    const loaded = await measure(page, region);
    if (BOXES) { const fmt = (b) => (b || []).map(x => `${x.l},${x.t} ${x.w}x${x.h}`).join(' | '); console.log(`    boxes ${s.id}@${width} skeleton: ${fmt(skelBlocks)}\n    boxes ${s.id}@${width} loaded:   ${fmt(loaded)}`); }
    const f = fit(skelBlocks, loaded);
    row.fit = skelBlocks ? f.text : 'n/a';
    if (skelBlocks && !f.ok) row.gaps.push('fit');
    await page.close();
  }
  return row;
}

/* Boot timing on a throttled network: when does the shell frame first paint? */
async function bootTiming(browser) {
  const results = [];
  for (const hint of ['authed', 'fresh']) {
    for (const throttle of [true, false]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: VIEW_H }, hasTouch: true });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      if (throttle) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
      await page.addInitScript((hint) => {
        try { if (hint === 'authed') localStorage.setItem('vz_boot', '1'); else localStorage.removeItem('vz_boot'); } catch {}
        window.__frameAt = null; window.__shellAt = null;
        const mo = new MutationObserver(() => {
          if (window.__frameAt == null && document.querySelector('.vz-boot')) window.__frameAt = performance.now();
          if (window.__shellAt == null && document.querySelector('.sh-root, .aa-login')) window.__shellAt = performance.now();
        });
        mo.observe(document, { childList: true, subtree: true });
      }, hint);
      await mockRoutes(page, { delay: 300 });
      await page.goto(`${BASE}/admin`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const t = await page.evaluate(() => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
        const fp = performance.getEntriesByName('first-paint')[0]?.startTime;
        const nav = performance.getEntriesByType('navigation')[0];
        return { frameAt: window.__frameAt, shellAt: window.__shellAt, fcp, fp, domContentLoaded: nav?.domContentLoadedEventStart, load: nav?.loadEventStart };
      });
      const r = (v) => (v == null ? 'never' : `${Math.round(v)}ms`);
      results.push({ hint, throttle, ...t });
      console.log(`  boot ${hint.padEnd(6)} ${throttle ? 'throttled (1.6Mbps, 150ms)' : 'unthrottled            '}  frame ${r(t.frameAt)}  first paint ${r(t.fp)}  FCP ${r(t.fcp)}  React shell ${r(t.shellAt)}  DCL ${r(t.domContentLoaded)}  load ${r(t.load)}`);
      await ctx.close();
    }
  }
  return results;
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
if (BOOT) {
  console.log('Boot timing');
  const r = await bootTiming(browser);
  if (OUT) writeFileSync(OUT, JSON.stringify(r, null, 2));
  await browser.close();
  process.exit(0);
}

const rows = [];
for (const theme of THEMES) for (const motion of MOTIONS) for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: VIEW_H }, hasTouch: width < 500, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' });
  for (const s of SCREENS) {
    if (ONLY && !s.id.startsWith(ONLY)) continue;
    if (s.minWidth && width < s.minWidth) continue;
    if (s.maxWidth && width > s.maxWidth) continue;
    const row = await runStateWithFit(ctx, s, width, theme, motion);
    rows.push(row);
    const flag = row.gaps.length ? `GAP ${row.gaps.join(',')}` : 'ok ';
    console.log(`  ${flag.padEnd(22)} [${width}px ${theme} ${motion}] ${s.screen}: ${s.label}  skeleton=${row.skeleton} fit=${row.fit} entrance=${row.entrance} empty=${row.empty} error=${row.error} cls=${row.cls}`);
  }
  await ctx.close();
}
await browser.close();

/* One table per screen. */
const screens = [...new Set(rows.map(r => r.screen))];
let md = '';
for (const sc of screens) {
  md += `\n### ${sc}\n\n| State | Width | Theme | Motion | Skeleton | Fit | Entrance | Empty | Error | CLS |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows.filter(r => r.screen === sc)) md += `| ${r.state} | ${r.width} | ${r.theme} | ${r.motion} | ${r.skeleton} | ${r.fit} | ${r.entrance} | ${r.empty} | ${r.error} | ${r.cls} |\n`;
}
const gaps = rows.reduce((n, r) => n + r.gaps.length, 0);
const byKind = {};
for (const r of rows) for (const g of r.gaps) byKind[g] = (byKind[g] || 0) + 1;
md += `\nRows: ${rows.length}. Gaps: ${gaps}${gaps ? ` (${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}.\n`;
console.log(md);
if (OUT) writeFileSync(OUT, JSON.stringify({ rows, md }, null, 2));
process.exit(gaps ? 1 : 0);
