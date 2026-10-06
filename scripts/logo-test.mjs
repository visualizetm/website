#!/usr/bin/env node
/* The logo rollout's pure checks: the geometry (ratio, minimums), the file names every variant and tone
 * resolve to, that each one exists in public/brand/svg, and the spinner's one turn per 1.1 s.
 * The brand rules on the pack SVGs are scripts/brand-check.mjs; the rendered checks are in the audits. */
import { existsSync } from 'node:fs';
import { logoSize, logoSrc, LOGO_VARIANTS } from '../src/ui/logo.data.js';
import { LOGO_SPIN_MS } from '../src/ui/logoSpinner.styles.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

for (const variant of Object.keys(LOGO_VARIANTS)) for (const tone of ['reversed', 'primary']) {
  const src = logoSrc(variant, tone);
  ok(existsSync(`public${src}`), `${variant} ${tone} resolves to ${src}`);
}
ok(logoSrc('lockup', 'primary') === '/brand/svg/visualize-lockup-horizontal-primary.svg', 'lockup is the horizontal lockup');
for (const [variant, v] of Object.entries(LOGO_VARIANTS)) {
  const s = logoSize(variant, { width: 400 });
  ok(Math.abs(s.width / s.height - v.ratio) / v.ratio < 0.01, `${variant} keeps its ratio at 400 px wide`);
  const h = logoSize(variant, { height: 50 });
  ok(Math.abs(h.width / h.height - v.ratio) / v.ratio < 0.01, `${variant} keeps its ratio from a height`);
  const tiny = logoSize(variant, { width: 10 });
  ok(tiny.width === v.min.width, `${variant} never renders under ${v.min.width} px wide`);
}
ok(logoSize('icon', { width: 56 }).height === 56, 'the icon is square');
ok(LOGO_SPIN_MS === 1100, 'one turn every 1.1 seconds');
console.log(fails ? `\n${fails} FAILED` : '\nlogo-test: all passed');
process.exit(fails ? 1 : 0);
