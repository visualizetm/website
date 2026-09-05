/* Lighthouse (Prompt 15): mobile preset, simulated throttling, against the
 * fixture backed mock server (scripts/mock-server.mjs), for the Dashboard,
 * Leads, and the call room, in both themes. Fonts from Google are blocked so
 * the sandbox's dead font requests cannot skew timing (production serves them;
 * the report says so).
 *
 *   DIST=dist PORT=4350 node scripts/mock-server.mjs &
 *   LH_BASE=http://127.0.0.1:4350 node scripts/lighthouse.mjs
 *   LH_OUT=/tmp/lh node scripts/lighthouse.mjs      # also saves one HTML report per run
 *   LH_ONLY=dashboard LH_THEME=dark LH_BLOCK_FONTS=1 node scripts/lighthouse.mjs   # one screen, no font downloads (diagnostic)
 */
import puppeteer from 'puppeteer-core';
import { startFlow } from 'lighthouse';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SESSION } from './audit-screens.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.LH_BASE || 'http://127.0.0.1:4350';
const OUT = process.env.LH_OUT || '';
const THEMES = process.env.LH_THEME ? [process.env.LH_THEME] : ['dark', 'light'];
const ONLY = process.env.LH_ONLY || ''; // one target id (dashboard, leads, room)
const BLOCK_FONTS = !!process.env.LH_BLOCK_FONTS; // diagnostic: measure without the self hosted fonts
const TARGETS = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin' },
  { id: 'leads', label: 'Leads', path: '/admin/leads', ls: { vz_leads_view: JSON.stringify('list') } },
  { id: 'room', label: 'Call room', path: '/admin/calls', ls: { vz_call_session: JSON.stringify(SESSION('room')) } },
];
if (OUT) mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const results = [];
for (const theme of THEMES) for (const t of TARGETS.filter(t => !ONLY || t.id === ONLY)) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((theme, ls) => { try { localStorage.setItem('vz_theme', theme); localStorage.setItem('vz_boot', '1'); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch {} }, theme, t.ls || {});
  const flow = await startFlow(page, {
    name: `${t.label} ${theme}`,
    config: { extends: 'lighthouse:default', settings: { formFactor: 'mobile', onlyCategories: ['performance', 'accessibility', 'best-practices', 'pwa'], blockedUrlPatterns: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', ...(BLOCK_FONTS ? ['*/fonts/*'] : [])], skipAudits: ['uses-http2'] } },
  });
  await flow.navigate(`${BASE}${t.path}`);
  const result = await flow.createFlowResult();
  const step = result.steps[0].lhr;
  const score = (k) => Math.round((step.categories[k]?.score ?? 0) * 100);
  const audits = step.audits;
  const row = { target: t.label, theme, performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), pwa: score('pwa'),
    fcp: audits['first-contentful-paint']?.displayValue, lcp: audits['largest-contentful-paint']?.displayValue, tbt: audits['total-blocking-time']?.displayValue, cls: audits['cumulative-layout-shift']?.displayValue, si: audits['speed-index']?.displayValue,
    transfer: Math.round((audits['total-byte-weight']?.numericValue || 0) / 1024),
    failing: Object.values(audits).filter(a => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual').map(a => `${a.id} (${a.displayValue || Math.round((a.score || 0) * 100)})`) };
  results.push(row);
  console.log(`  ${t.label.padEnd(10)} ${theme.padEnd(5)} perf ${row.performance}  a11y ${row.accessibility}  best ${row.bestPractices}  pwa ${row.pwa}   FCP ${row.fcp}  LCP ${row.lcp}  TBT ${row.tbt}  CLS ${row.cls}  SI ${row.si}  transfer ${row.transfer}KB`);
  if (row.failing.length) console.log(`     below 90: ${row.failing.join(', ')}`);
  if (OUT) writeFileSync(`${OUT}/${t.id}-${theme}.html`, await flow.generateReport());
  await page.close();
}
await browser.close();
let md = `\n| Screen | Theme | Performance | Accessibility | Best Practices | PWA | FCP | LCP | TBT | CLS | Transfer |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.target} | ${r.theme} | ${r.performance} | ${r.accessibility} | ${r.bestPractices} | ${r.pwa} | ${r.fcp} | ${r.lcp} | ${r.tbt} | ${r.cls} | ${r.transfer} KB |\n`;
console.log(md);
if (OUT) writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
