/* Self hosted fonts (Prompt 15, corrected by the faster landing prompt).
 * Downloads the latin subset of the fonts both hosts use from Google Fonts
 * into public/fonts and writes src/fonts.css with the @font-face rules, so
 * the sites serve their type from the same origin (one fewer host for the
 * CSP, offline through the service worker, the preloads in index.html).
 * Run again only to change the set; it needs the network.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';

/* Inter is fetched once as the variable font (one file, weights 400 to 800); Barlow Condensed, the admin's display face, as
 * its three static weights. Only the latin block of Google's CSS is kept: the subset comment sits BEFORE each @font-face in
 * that CSS, so it is matched together with the block it names (the first version of this script read the comment that
 * followed a block, which is the next block's, and wrote the latin-ext range onto every face). The Inter face is written
 * without a unicode-range so it covers every character it holds. */
const FAMILIES = [
  { family: 'Inter', axis: 'wght@400..800', slug: 'inter', file: 'inter.woff2', weight: '400 800', range: false },
  { family: 'Barlow Condensed', axis: 'wght@500;600;700', slug: 'barlow-condensed', range: true },
];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
mkdirSync('public/fonts', { recursive: true });
let css = `/* Self hosted fonts (scripts/fetch-fonts.mjs), font-display: swap. Do not edit by hand. */\n`;
for (const f of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, '+')}:${f.axis}&display=swap`;
  const text = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  for (const m of text.matchAll(/\/\* (\S+) \*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const [, subset, b] = m;
    if (subset !== 'latin') continue;
    const weight = f.weight || /font-weight:\s*([\d ]+)/.exec(b)?.[1]?.trim();
    const src = /url\((https:[^)]+\.woff2)\)/.exec(b)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(b)?.[1];
    if (!weight || !src) continue;
    const file = f.file || `${f.slug}-${weight}.woff2`;
    const buf = Buffer.from(await (await fetch(src, { headers: { 'User-Agent': UA } })).arrayBuffer());
    writeFileSync(`public/fonts/${file}`, buf);
    css += `@font-face { font-family: '${f.family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('/fonts/${file}') format('woff2');${f.range && range ? ` unicode-range: ${range};` : ''} }\n`;
    console.log(`  ${file}  ${(buf.length / 1024).toFixed(1)} KB`);
    if (f.file) break;
  }
}
writeFileSync('src/fonts.css', css);
console.log('wrote src/fonts.css');
