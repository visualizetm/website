/* Mobile measurement (CRM mobile revamp, milestone 1): every admin screen and
 * state in scripts/audit-screens.mjs, loaded at a phone viewport with a touch
 * profile, measured against docs/MOBILE-UI-GUIDE.md. One row per state:
 *
 *   fold        text blocks and controls inside the first viewport
 *   actions     distinct visible control names inside the content region
 *   tabbar      the bottom tab bar is visible
 *   top         the visible top bar controls (their labels)
 *   cards       the deepest card nesting
 *   hscroll     elements that scroll sideways, and two dimensional grids (2+ columns of 2+ rows)
 *   tap         the smallest visible control, in px (the smaller side)
 *   text        the smallest visible text, in px (tab bar labels and badges counted separately)
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/mobile-measure.mjs
 *   MEASURE_WIDTH=320 MEASURE_OUT=/tmp/m.json node scripts/mobile-measure.mjs
 *   MEASURE_ONLY=leads node scripts/mobile-measure.mjs     # ids that start with this
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { mockRoutes } from './audit-fixtures.mjs';
import { SCREENS } from './audit-screens.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTH = Number(process.env.MEASURE_WIDTH || 390);
const HEIGHT = Number(process.env.MEASURE_HEIGHT || 844);
const ONLY = process.env.MEASURE_ONLY || '';
const OUT = process.env.MEASURE_OUT || '';
const SHOTS = process.env.MEASURE_SHOTS || '';

const url = (s) => `${BASE}${s.path}${s.open ? `${s.path.includes('?') ? '&' : '?'}open=${s.open}` : ''}`;

const measure = () => {
  const vh = innerHeight;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 ? r : null; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 28);
  const top = document.querySelector('.sh-top');
  const tabbar = document.querySelector('.sh-tabs');
  const dlg = document.querySelector('[role=dialog]');
  const region = dlg || document.querySelector('.sh-content') || document.body;
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link],[role=menuitem],[role=switch]';
  const inter = (root) => [...root.querySelectorAll(sel)].filter(e => !e.closest('[aria-hidden=true]') && !e.closest('.v-skel') && vis(e));
  let minT = { v: 999, el: '' }; let controlsFold = 0;
  const names = new Set();
  for (const e of [...inter(region), ...(top ? inter(top) : []), ...(tabbar ? inter(tabbar) : [])]) {
    const r = vis(e); if (!r) continue;
    const m = Math.min(r.width, r.height);
    if (m < minT.v) minT = { v: Math.round(m), el: `${e.tagName.toLowerCase()} "${name(e)}"` };
  }
  for (const e of inter(region)) { const r = vis(e); if (r && r.top < vh && r.bottom > 0) { controlsFold++; names.add(name(e)); } }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let textFold = 0; let minF = { v: 99, el: '' }; let minTab = 99; let minBadge = 99; let n;
  while ((n = tw.nextNode())) {
    if (!n.textContent.trim()) continue;
    const p = n.parentElement;
    if (!p || p.closest('script,style,[aria-hidden=true],.v-stretch,.v-sr,.sr-only,.v-visually-hidden')) continue;
    const r = vis(p); if (!r) continue;
    const f = parseFloat(getComputedStyle(p).fontSize);
    if (r.top < vh && r.bottom > 0 && !p.closest('.sh-tabs,.sh-top')) textFold++;
    if (p.closest('.sh-tabs')) { minTab = Math.min(minTab, f); continue; }
    if (p.closest('.v-badge')) { minBadge = Math.min(minBadge, f); continue; }
    if (f < minF.v) minF = { v: f, el: `${p.tagName.toLowerCase()}.${String(p.className).split(' ')[0]} "${n.textContent.trim().slice(0, 18)}"` };
  }
  /* Card nesting: count ancestors that look like a card (a bordered, filled, rounded box), deepest chain. */
  let depth = 0;
  const looksCard = (e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (r.width < 60 || r.height < 30) return false; const bg = cs.backgroundColor; const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'; const border = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none'; return parseFloat(cs.borderTopLeftRadius) >= 8 && (hasBg || border) && !/^(BUTTON|INPUT|SELECT|TEXTAREA|A|SPAN|LABEL)$/.test(e.tagName) && !/v-pill|v-chip|v-badge|v-field|v-seg|v-btn|v-ibtn/.test(String(e.className)); };
  const cards = [...region.querySelectorAll('*')].filter(e => !e.closest('.sh-tabs,.sh-top') && vis(e) && looksCard(e));
  const set = new Set(cards);
  for (const c of cards) { let d = 0; let p = c; while (p && p !== region.parentElement) { if (set.has(p)) d++; p = p.parentElement; } if (d > depth) depth = d; }
  /* Sideways scrollers and two dimensional grids. */
  const hs = [];
  for (const e of region.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 2 && vis(e)) hs.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`);
  }
  const grids = [];
  for (const e of region.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.display !== 'grid' || !vis(e)) continue;
    const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
    const kids = [...e.children].filter(vis).length;
    if (cols >= 2 && kids >= 4) grids.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${cols}x${Math.ceil(kids / cols)}`);
  }
  return {
    fold: { text: textFold, controls: controlsFold }, actions: names.size,
    tabbar: !!(tabbar && vis(tabbar)), top: top ? inter(top).map(name) : [],
    cards: depth, hscroll: [...new Set(hs)].slice(0, 4), grids: [...new Set(grids)].slice(0, 4),
    tap: minT, text: minF, tabLabel: minTab === 99 ? null : minTab, badge: minBadge === 99 ? null : minBadge,
    sheet: !!dlg, pageH: document.documentElement.scrollWidth - innerWidth,
  };
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, hasTouch: true, serviceWorkers: 'block' });
const rows = [];
for (const s of SCREENS) {
  if (s.marketing || s.boot || s.session === false) continue;
  if (ONLY && !s.id.startsWith(ONLY)) continue;
  if (s.minWidth && WIDTH < s.minWidth) continue;
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.removeItem('vz_motion'); } catch {} });
  await mockRoutes(page, { session: true });
  const goto = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  try {
    if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, WIDTH); }
    await goto(url(s));
    if (s.act) { await page.waitForTimeout(s.open ? 900 : 700); await s.act(page, WIDTH); }
    await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel, .v-sheet .v-skel'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    const m = await page.evaluate(measure);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${WIDTH}-${s.id}.png` }).catch(() => {});
    rows.push({ id: s.id, screen: s.screen, state: s.label, ...m });
  } catch (e) { rows.push({ id: s.id, screen: s.screen, state: s.label, error: String(e).slice(0, 120) }); }
  await page.close();
}
await browser.close();
const f = (r) => r.error ? `ERROR ${r.error}` : `fold ${r.fold.text}t ${r.fold.controls}c | actions ${r.actions} | tab ${r.tabbar ? 'Y' : 'n'} | top [${r.top.join(', ')}] | cards ${r.cards} | hs ${r.hscroll.length}${r.grids.length ? ' grid ' + r.grids.join(';') : ''} | tap ${r.tap.v} (${r.tap.el}) | text ${r.text.v} | tabLabel ${r.tabLabel} | pageH ${r.pageH}`;
for (const r of rows) console.log(`${r.id.padEnd(28)} ${f(r)}`);
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
