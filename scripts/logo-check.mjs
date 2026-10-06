#!/usr/bin/env node
/* Every icon, image and logo path the repo points at must resolve to a file in public/ (or dist/ for the built
 * output). Reads index.html and every HTML entry, both manifests, the service worker, the vite splash, the logo
 * component's file names, the docs' hosted email URLs, and (when dist/ exists) the built head tags: the favicon set
 * at the root, every prerendered page's tags, and og-image.png at 1200 x 630.
 *   node scripts/logo-check.mjs
 *   LOGO_CHECK_INDEX=path/to/index.html node scripts/logo-check.mjs     (the failure proof points one tag at a missing file)
 * No dependency; exits 1 on a missing file. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LOGO_VARIANTS, logoSrc } from '../src/ui/logo.data.js';

const SITE = /^https:\/\/visualizestudio\.org/;
const PNG_OR_ICON = /\.(png|svg|ico|webmanifest|jpg|jpeg|webp)(\?.*)?$/i;
let fails = 0, checked = 0;
const bad = (m) => { fails++; console.log('MISSING', m); };

const on = (root, p) => existsSync(join(root, p.replace(/^\//, '').split('?')[0]));
const check = (from, ref, roots) => {
  const p = String(ref).replace(SITE, '');
  if (/^(https?:|data:|mailto:|#|blob:)/i.test(p) || !p.startsWith('/') || !PNG_OR_ICON.test(p)) return;
  checked++;
  if (!roots.some(r => on(r, p))) bad(`${from} -> ${p}`);
};
const attrs = (html) => [...html.matchAll(/\b(?:href|src|content)="([^"]+)"/g)].map(m => m[1]);

const PUB = [resolve('public')];
const BUILT = existsSync('dist') ? [resolve('dist'), resolve('public')] : null;

// 1. HTML entries (index.html is the only one; the admin host is served it too).
const htmlFiles = [process.env.LOGO_CHECK_INDEX || 'index.html'];
for (const f of htmlFiles) for (const a of attrs(readFileSync(f, 'utf8'))) check(f, a, PUB);
const ld = [...readFileSync(htmlFiles[0], 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
for (const m of ld) for (const v of Object.values(JSON.parse(m[1]))) if (typeof v === 'string') check('JSON-LD', v, PUB);
// the manifest the pre-paint script swaps the admin host to
for (const m of readFileSync(htmlFiles[0], 'utf8').matchAll(/setAttribute\('href', '([^']+)'\)/g)) check('index.html script', m[1], PUB);

// 2. Both manifests.
for (const f of ['public/site.webmanifest', 'public/manifest.webmanifest']) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  for (const i of j.icons || []) check(f, i.src, PUB);
}

// 3. The service worker: precache list, the shell asset test's files, the push icon and badge.
const sw = readFileSync('public/sw.js', 'utf8');
for (const m of sw.matchAll(/'(\/[^']+)'/g)) check('public/sw.js', m[1], PUB);

// 4. The logo component's own file names, every variant and tone.
for (const v of Object.keys(LOGO_VARIANTS)) for (const t of ['reversed', 'primary']) check('Logo', logoSrc(v, t), PUB);

// 5. Literal brand paths in src, the vite splash and the docs' hosted email URLs.
const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
for (const f of [...walk('src'), 'vite.config.js', 'docs/LOGO-ROLLOUT.md']) {
  if (!/\.(jsx?|mjs|css|md)$/.test(f)) continue;
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:https:\/\/visualizestudio\.org)?(\/brand\/(?:svg|png)\/[A-Za-z0-9._-]+\.(?:svg|png))/g)) check(f, m[1], PUB);
}

// 6. The built output.
if (BUILT) {
  for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'badge-96.png', 'site.webmanifest', 'manifest.webmanifest', 'og-image.png']) {
    checked++; if (!existsSync(join('dist', f))) bad(`dist/${f}`);
  }
  const pages = ['dist/index.html', ...(existsSync('dist/clients') ? readdirSync('dist/clients').filter(s => existsSync(`dist/clients/${s}/index.html`)).map(s => `dist/clients/${s}/index.html`) : [])];
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    for (const a of attrs(html)) check(f, a, BUILT);
    for (const tag of ['rel="icon"', 'rel="apple-touch-icon"', 'rel="manifest"', 'name="theme-color"', 'property="og:image"', 'name="twitter:image"', 'name="twitter:card" content="summary_large_image"', 'property="og:image:alt"']) {
      checked++; if (!html.includes(tag)) bad(`${f} lacks ${tag}`);
    }
  }
  const png = readFileSync('dist/og-image.png');
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  checked++; if (w !== 1200 || h !== 630) bad(`dist/og-image.png is ${w} x ${h}, not 1200 x 630`);
}
console.log(fails ? `\nlogo-check: ${fails} missing of ${checked} checked` : `logo-check: all ${checked} references resolve${BUILT ? ' (source and dist)' : ' (source)'}`);
process.exit(fails ? 1 : 0);
