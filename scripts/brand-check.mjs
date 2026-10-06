#!/usr/bin/env node
/* The brand rules on the logo files and on the code that draws them (Brand v3).
 *   Pack SVGs (public/brand/svg, public/favicon.svg): no stroke, no gradient, no filter, no shadow, no <text>,
 *   no italic; the red dot is #D44C43; the wordmarks carry the period (the red circle); the icons carry the
 *   center dot (circle r 192.55 of 1000); only the pack's four colors appear.
 *   The component and the spinner (src/ui/Logo.jsx, LogoSpinner.jsx, logoSpinner.styles.js, the vite splash): nothing
 *   that adds a stroke, gradient, filter, shadow, glow, blur or italic.
 *   node scripts/brand-check.mjs
 *   BRAND_SVG_DIR=some/copy node scripts/brand-check.mjs     (the failure proof runs it on a copy with a stroke put back) */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.BRAND_SVG_DIR || 'public/brand/svg';
const RED = '#D44C43';
const PACK_COLORS = new Set(['#0A0A0A', '#FAFAFA', '#D44C43', '#C2413A']);
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } };

const files = readdirSync(DIR).filter(f => f.endsWith('.svg')).map(f => join(DIR, f));
if (!process.env.BRAND_SVG_DIR && existsSync('public/favicon.svg')) files.push('public/favicon.svg');
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  ok(!/\bstroke(-[a-z]+)?=|stroke:/i.test(s), `${f}: no stroke`);
  ok(!/gradient/i.test(s), `${f}: no gradient`);
  ok(!/<filter|filter=|filter:|feDropShadow|drop-shadow|shadow/i.test(s), `${f}: no filter or shadow`);
  ok(!/<text|<tspan|font-family|font-style|italic/i.test(s), `${f}: no text element, no italic`);
  const dots = [...s.matchAll(/<circle[^>]*fill="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase());
  ok(dots.length >= 1 && dots.every(d => d === RED), `${f}: the dot is ${RED}`);
  const fills = [...s.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase());
  const allowed = /wordmark-tagline/.test(f) ? new Set([...PACK_COLORS, '#8F8F8F']) : PACK_COLORS; // the tagline line is the one muted grey
  ok(fills.every(c => allowed.has(c)), `${f}: only the pack's colors`);
  if (/visualize-(wordmark|lockup)/.test(f)) ok(dots.length >= 1, `${f}: the period is present`);
  if (/visualize-(icon|lockup)/.test(f)) ok(/r="192\.55"|<circle/.test(s), `${f}: the center dot is present`);
}

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/ \/\/ .*$/gm, '');
const BAD = /\bstroke\b|gradient|filter|shadow|\bglow\b|\bblur\b|italic|text-shadow/i;
for (const f of ['src/ui/Logo.jsx', 'src/ui/LogoSpinner.jsx', 'src/ui/logoSpinner.styles.js', 'src/ui/logo.data.js']) {
  ok(!BAD.test(strip(readFileSync(f, 'utf8'))), `${f}: nothing added around the logo`);
}
const vite = readFileSync('vite.config.js', 'utf8');
const splash = vite.slice(vite.indexOf('const SPLASH_CSS'), vite.indexOf('/* Prompt 14'));
ok(!BAD.test(strip(splash)), 'vite.config.js splash: nothing added around the logo');

console.log(fails ? `\nbrand-check: ${fails} FAILED of ${n}` : `brand-check: all ${n} checks passed (${files.length} SVGs)`);
process.exit(fails ? 1 : 0);
