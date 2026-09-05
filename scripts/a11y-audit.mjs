/* Accessibility audit (Prompt 15): axe-core against every admin screen and
 * state the layout audit knows (scripts/audit-screens.mjs), loaded, in both
 * themes at 390 and 1280. Same Playwright setup and fixtures as the layout
 * and feel audits.
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/a11y-audit.mjs
 *   AUDIT_WIDTHS=390,1280 AUDIT_THEME=both node scripts/a11y-audit.mjs   # the release run
 *   AUDIT_ONLY=calls node scripts/a11y-audit.mjs                       # one screen group
 *   AUDIT_SKELETON=1 node scripts/a11y-audit.mjs                       # also the forced loading state
 *   AUDIT_OUT=/tmp/a11y.json node scripts/a11y-audit.mjs
 *
 * Rules: WCAG 2.0 and 2.1 A and AA plus axe best practices. Exits 1 when any
 * serious or critical violation remains, so it can gate a build.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { mockRoutes } from './audit-fixtures.mjs';
import { SCREENS } from './audit-screens.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [390, 1280];
const THEMES = process.env.AUDIT_THEME === 'both' ? ['dark', 'light'] : [process.env.AUDIT_THEME || 'dark'];
const ONLY = process.env.AUDIT_ONLY || '';
const OUT = process.env.AUDIT_OUT || '';
const SKELETON = !!process.env.AUDIT_SKELETON;
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

const url = (s, extra = '') => `${BASE}${s.path}${s.path.includes('?') ? '&' : '?'}${[s.open ? `open=${s.open}` : '', extra].filter(Boolean).join('&')}`.replace(/\?$/, '');

async function runAxe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.map(n => ({ target: n.target.join(' '), html: n.html.slice(0, 160), summary: n.failureSummary?.split('\n').slice(1, 3).join(' ') || '' })) }));
  }, TAGS);
}

async function state(ctx, s, width, theme, skeleton) {
  const page = await ctx.newPage();
  await page.addInitScript(([theme]) => { try { localStorage.setItem('vz_theme', theme); localStorage.setItem('vz_boot', '1'); localStorage.removeItem('vz_motion'); } catch {} }, [theme]);
  const goto = (u) => page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  if (s.boot) {
    await mockRoutes(page, { session: 'hang' });
    await page.addInitScript((hint) => { try { if (hint === 'authed') localStorage.setItem('vz_boot', '1'); else localStorage.removeItem('vz_boot'); } catch {} }, s.boot);
    await goto(url(s)); await page.waitForTimeout(400);
  } else {
    await mockRoutes(page, { session: s.session === false ? false : true });
    if (s.prep) { await goto(`${BASE}/admin`); await s.prep(page, width); }
    await goto(url(s, skeleton ? 'loading=1' : ''));
    if (s.act) { await page.waitForTimeout(s.open ? 900 : 700); if (!(skeleton && s.open)) await s.act(page, width); }
    if (!skeleton) await page.waitForFunction(() => !document.querySelector('.sh-content .v-skel, .v-sheet .v-skel, .po-panel .v-skel'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(skeleton ? 500 : 900);
  }
  const violations = await runAxe(page).catch((e) => [{ id: 'axe-failed', impact: 'serious', help: String(e), nodes: [] }]);
  await page.close();
  return { id: s.id, screen: s.screen, state: s.label + (skeleton ? ' (loading)' : ''), width, theme, violations };
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const rows = [];
for (const theme of THEMES) for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 500 });
  for (const s of SCREENS) {
    if (ONLY && !s.id.startsWith(ONLY)) continue;
    if (s.minWidth && width < s.minWidth) continue;
    if (s.maxWidth && width > s.maxWidth) continue;
    const passes = [false, ...(SKELETON && !s.static && !s.boot ? [true] : [])];
    for (const skel of passes) {
      const row = await state(ctx, s, width, theme, skel);
      rows.push(row);
      const n = row.violations.reduce((a, v) => a + v.nodes.length, 0);
      const worst = row.violations.map(v => v.impact).sort((a, b) => ORDER[a] - ORDER[b])[0];
      console.log(`  ${(n ? `${n} node${n === 1 ? '' : 's'} (${worst})` : 'clean').padEnd(20)} [${width}px ${theme}] ${row.screen}: ${row.state}${n ? '  ' + row.violations.map(v => `${v.id} x${v.nodes.length}`).join(', ') : ''}`);
    }
  }
  await ctx.close();
}
await browser.close();

/* Summary by rule: impact, node count, where. */
const byRule = new Map();
for (const r of rows) for (const v of r.violations) {
  const e = byRule.get(v.id) || { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: 0, rows: new Set(), examples: [] };
  e.nodes += v.nodes.length; e.rows.add(`${r.screen}: ${r.state} @${r.width} ${r.theme}`);
  for (const n of v.nodes) if (e.examples.length < 4 && !e.examples.some(x => x.target === n.target)) e.examples.push(n);
  byRule.set(v.id, e);
}
const rules = [...byRule.values()].sort((a, b) => ORDER[a.impact] - ORDER[b.impact] || b.nodes - a.nodes);
let md = `\n| Rule | Impact | Nodes | Rows | Example |\n|---|---|---|---|---|\n`;
for (const e of rules) md += `| ${e.id} | ${e.impact} | ${e.nodes} | ${e.rows.size} | ${e.examples[0]?.target.replace(/\|/g, '\\|') || ''} |\n`;
const totals = rules.reduce((t, e) => { t[e.impact] = (t[e.impact] || 0) + e.nodes; return t; }, {});
md += `\nRows: ${rows.length}. Violations by impact (nodes): ${['critical', 'serious', 'moderate', 'minor'].map(k => `${k} ${totals[k] || 0}`).join(', ')}.\n`;
console.log(md);
for (const e of rules) { console.log(`\n${e.impact.toUpperCase()} ${e.id}: ${e.help}`); for (const x of e.examples) console.log(`   ${x.target}\n     ${x.html}\n     ${x.summary}`); console.log(`   in: ${[...e.rows].slice(0, 6).join('; ')}${e.rows.size > 6 ? ` (+${e.rows.size - 6})` : ''}`); }
if (OUT) writeFileSync(OUT, JSON.stringify({ rows, rules: rules.map(e => ({ ...e, rows: [...e.rows] })), totals, md }, null, 2));
process.exit((totals.critical || 0) + (totals.serious || 0) ? 1 : 0);
