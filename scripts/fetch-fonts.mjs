/* Self hosted fonts (Prompt 15). Downloads the latin subset of every weight
 * the app uses from Google Fonts into public/fonts and writes
 * src/fonts.css with the @font-face rules, so the admin serves its type from
 * the same origin (one fewer host for the CSP, offline through the service
 * worker, two preloads in index.html). Run again only to change the set.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const FAMILIES = [
  { family: 'Inter', weights: [400, 500, 600, 700, 800, 900], slug: 'inter' },
  { family: 'Barlow Condensed', weights: [500, 600, 700, 800], slug: 'barlow-condensed' },
];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
mkdirSync('public/fonts', { recursive: true });
let css = `/* Self hosted latin subsets from Google Fonts (scripts/fetch-fonts.mjs). Do not edit by hand. */\n`;
for (const f of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, '+')}:wght@${f.weights.join(';')}&display=swap`;
  const text = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  const blocks = text.split('@font-face').slice(1);
  for (const b of blocks) {
    if (!/\/\* latin \*\//.test(b)) continue;
    const weight = /font-weight:\s*(\d+)/.exec(b)?.[1];
    const src = /url\((https:[^)]+\.woff2)\)/.exec(b)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(b)?.[1];
    if (!weight || !src) continue;
    const file = `${f.slug}-${weight}.woff2`;
    const buf = Buffer.from(await (await fetch(src, { headers: { 'User-Agent': UA } })).arrayBuffer());
    writeFileSync(`public/fonts/${file}`, buf);
    css += `@font-face { font-family: '${f.family}'; font-style: normal; font-weight: ${weight}; font-display: ${f.family === 'Inter' ? 'optional' : 'swap'}; src: url('/fonts/${file}') format('woff2'); unicode-range: ${range}; }\n`;
    console.log(`  ${file}  ${(buf.length / 1024).toFixed(1)} KB`);
  }
}
writeFileSync('src/fonts.css', css);
console.log('wrote src/fonts.css');
