#!/usr/bin/env node
/* CSS orphan check (Prompt 13). Pulls every class selector out of the
 * CSS-in-JSX style strings and src/index.css, then reports the ones no JSX
 * file renders (as a literal class name, a template piece, or a BEM
 * modifier built from a prefix). Marketing pages and the maintenance screen
 * (.uc-) are excluded because their markup lives in index.css by design.
 *
 *   node scripts/css-orphans.mjs           list orphans, exit 1 when any
 *   node scripts/css-orphans.mjs --all     include marketing files too
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const ALL = process.argv.includes('--all');
const MARKETING = new Set(['Home.jsx', 'Services.jsx', 'Work.jsx', 'CaseStudy.jsx', 'Contact.jsx', 'Start.jsx', 'LeadPartner.jsx', 'Prints.jsx', 'Hero.jsx', 'Services.jsx', 'Process.jsx', 'Trust.jsx', 'Testimonials.jsx', 'CTA.jsx', 'ShowcasePreview.jsx', 'Navbar.jsx', 'Footer.jsx', 'ThemeToggle.jsx', 'Wordmark.jsx', 'App.jsx', 'main.jsx']);
const EXCLUDE_PREFIX = ['uc-', 'reveal', 'stagger', 'is-visible', 'page-', 'section', 'wrap', 'btn', 'display', 'glass-panel', 'grid-texture', 'text-secondary', 'theme-toggle', 'wordmark', 'animate-in', 'app-loader'];

const files = [];
const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); const st = statSync(p); if (st.isDirectory()) walk(p); else if (['.js', '.jsx', '.css'].includes(extname(p))) files.push(p); } };
walk('src');

const isMarketing = (f) => MARKETING.has(basename(f));
const styleSources = files.filter(f => ALL || !isMarketing(f));
const jsxSources = files.filter(f => f.endsWith('.jsx') || f.endsWith('.js'));

// 1. Class selectors from template strings that look like CSS and from index.css.
const selectorRx = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
const defined = new Map(); // class -> Set(files)
for (const f of styleSources) {
  const src = readFileSync(f, 'utf8');
  let css = '';
  if (f.endsWith('.css')) css = src;
  else {
    // Style strings are `const xStyles = \`...\`;` or an inline <style>{`...`}</style>.
    for (const m of src.matchAll(/=\s*`([\s\S]*?)`;/g)) { const block = m[1]; if (/\n\s*[.@:][a-zA-Z][^\n]*\{/.test(block) && /;\s*\}/.test(block)) css += '\n' + block; }
    for (const m of src.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)) css += '\n' + m[1];
  }
  // strip comments, url(), property values that contain dots (numbers, var names)
  css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '').replace(/\{[^{}]*\}/g, (m) => m.replace(/\.[0-9]/g, ' '));
  for (const m of css.matchAll(selectorRx)) {
    const cls = m[1];
    if (/^\d/.test(cls)) continue;
    if (!ALL && EXCLUDE_PREFIX.some(p => cls === p || cls.startsWith(p))) continue;
    if (!defined.has(cls)) defined.set(cls, new Set());
    defined.get(cls).add(f);
  }
}

// 2. Everything JSX could render: literal words in className strings, template pieces, and any word in the file.
const rendered = new Set();
const prefixes = new Set();
for (const f of jsxSources) {
  // The style strings themselves do not count as rendering a class.
  const src = readFileSync(f, 'utf8').replace(/=\s*`([\s\S]*?)`;/g, (m, block) => (/\n\s*[.@:][a-zA-Z][^\n]*\{/.test(block) && /;\s*\}/.test(block) ? '= ``;' : m)).replace(/<style>\{`([\s\S]*?)`\}<\/style>/g, '');
  for (const m of src.matchAll(/[a-zA-Z_][a-zA-Z0-9_-]*/g)) rendered.add(m[0]);
  // template pieces like `cw-step${...}` or `po-card--${x}`: record the literal prefix
  for (const m of src.matchAll(/([a-zA-Z][a-zA-Z0-9_-]*?)(?:--|-)?\$\{/g)) prefixes.add(m[1]);
}
const seen = (cls) => {
  if (rendered.has(cls)) return true;
  // modifiers and states generated from a prefix: is-*, has-*, --x
  for (const p of prefixes) if (cls.startsWith(p)) return true;
  if (/^(is|has)-/.test(cls)) return rendered.has(cls) || [...rendered].some(w => w.includes(cls));
  return false;
};

const orphans = [...defined.entries()].filter(([cls]) => !seen(cls)).sort();
if (orphans.length) {
  console.log(`${orphans.length} orphan class selector(s):`);
  for (const [cls, fs] of orphans) console.log(`  .${cls}  (${[...fs].map(x => x.replace(/^src\//, '')).join(', ')})`);
  process.exit(1);
}
console.log(`No orphan class selectors across ${defined.size} classes in ${styleSources.length} files.`);
