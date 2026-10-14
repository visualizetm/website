#!/usr/bin/env node
/* Each guard the faster landing and Projects prompt added, cut out in turn: with the cut in place its own check in
 * scripts/landing-test.mjs must fail, then the file is put back. A guard whose check still passes without it is
 * reported as not proven and the run exits 1.
 *
 *   node scripts/landing-guard-proof.mjs
 *   LANDING_PROOF_QUICK=1 node scripts/landing-guard-proof.mjs   skip the perf write proof (it runs a throttled load)
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const CUTS = [
  { name: 'spotlight-limit', file: 'src/lib/spotlight.js', from: "const on = list.filter(c => c.featured?.spotlight).sort(byOrder).slice(0, SPOTLIGHT_MAX);", to: "const on = list.filter(c => c.featured?.spotlight).sort(byOrder);", check: /four on \(a stale record\)/ },
  { name: 'spotlight-fallback', file: 'src/lib/spotlight.js', from: "const fill = list.filter(c => c.featured?.work && !on.includes(c)).sort(byOrder);", to: "const fill = [];", check: /nothing switched on: the three lowest ordered work clients/ },
  { name: 'spotlight-replace', file: 'src/lib/spotlight.js', from: "return { ok: on.length < SPOTLIGHT_MAX, replace: on.length >= SPOTLIGHT_MAX ? on : [] };", to: "return { ok: true, replace: [] };", check: /a fourth is asked which of the three it replaces/ },
  { name: 'spotlight-published', file: 'src/lib/spotlight.js', from: ".filter(l => l && !l.deleted && l.showcase?.published && l.showcase?.featured?.spotlight)", to: ".filter(l => l && l.showcase?.featured?.spotlight)", check: /the CRM counts published, undeleted leads/ },
  { name: 'redirect-clients', file: 'vercel.json', json: (v) => ({ ...v, redirects: v.redirects.filter(r => r.source !== '/clients') }), check: /\/clients is a 301 to \/projects/ },
  { name: 'redirect-slug', file: 'vercel.json', json: (v) => ({ ...v, redirects: v.redirects.filter(r => r.source !== '/clients/:slug') }), check: /\/clients\/sharpless-detailing is a 301/ },
  { name: 'redirect-permanent', file: 'vercel.json', json: (v) => ({ ...v, redirects: v.redirects.map(r => (r.source === '/clients' ? { ...r, permanent: false } : r)) }), check: /\/clients is a 301 to \/projects/ },
  { name: 'tracks-real', file: 'src/lib/projectsPage.js', from: "const chips = picks.filter(c => has(c));", to: "const chips = picks;", check: /a track with no real project behind it does not render/ },
  { name: 'tracks-enabled', file: 'src/lib/projectsPage.js', from: "if (!s || s.enabled === false) return false;", to: "if (!s) return false;", check: /a section switched off is not a real project/ },
  { name: 'quote-approved', file: 'src/lib/projectsPage.js', from: "return list.find(t => t && t.quote) || null;", to: "return list[0] || null;", check: /a pending or hidden testimonial never becomes a pull quote/ },
  { name: 'perf-write', file: 'scripts/perf-landing.mjs', from: "  fs.writeFileSync(OUT, md);", to: "  void md;", check: /the perf script runs and writes the report/, slow: true },
];

const QUICK = !!process.env.LANDING_PROOF_QUICK;
let bad = 0; let proven = 0; let skipped = 0;
for (const cut of CUTS) {
  if (cut.slow && QUICK) { skipped++; console.log(`skip ${cut.name}: the perf write proof runs a throttled load (unset LANDING_PROOF_QUICK)`); continue; }
  if (!fs.existsSync(cut.file)) { console.log(`skip ${cut.name}: ${cut.file} does not exist yet`); skipped++; continue; }
  const original = fs.readFileSync(cut.file, 'utf8');
  let cutText;
  if (cut.json) cutText = JSON.stringify(cut.json(JSON.parse(original)), null, 2) + '\n';
  else { if (!original.includes(cut.from)) { console.log(`FAIL ${cut.name}: the guard's line is not in ${cut.file}`); bad++; continue; } cutText = original.replace(cut.from, cut.to); }
  fs.writeFileSync(cut.file, cutText);
  let out = '';
  try {
    const r = spawnSync('node', ['scripts/landing-test.mjs'], { encoding: 'utf8', env: { ...process.env, LANDING_QUICK: cut.slow ? '' : '1' }, timeout: 300000 });
    out = `${r.stdout || ''}${r.stderr || ''}`;
  } finally { fs.writeFileSync(cut.file, original); }
  const failed = out.split('\n').filter(l => /^FAIL /.test(l) && cut.check.test(l));
  if (failed.length) { proven++; console.log(`ok   ${cut.name}: without the guard, ${failed.length} check(s) fail (${failed[0].slice(5, 90)})`); }
  else { bad++; console.log(`FAIL ${cut.name}: every check still passes with the guard cut out`); }
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${proven} cut in turn, each one's check fails${skipped ? ` (${skipped} skipped)` : ''}.`);
process.exit(bad ? 1 : 0);
