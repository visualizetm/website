#!/usr/bin/env node
/* Renders the two derived brand files the logo pack did not ship, from the pack SVGs
 * (no dependency: the Chromium the audits already use, a transparent page).
 *   public/badge-96.png                         96 x 96, the Aperture icon as a pure white silhouette, 80 x 80 inside
 *   public/brand/png/visualize-wordmark-{primary,reversed}-480.png   480 px wide, transparent
 * Run: node scripts/brand-render.mjs */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const svg = (n) => readFileSync(`public/brand/svg/${n}.svg`, 'utf8');
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const shot = async (html, w, h, path) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${html}`);
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
};

// The badge: every fill white, 80 x 80 centered in 96 x 96.
const icon = svg('visualize-icon-reversed').replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"').replace(/width="1000" height="1000"/, 'width="80" height="80"').replace(/<title>.*?<\/title>/, '');
await shot(`<div style="width:96px;height:96px;display:flex;align-items:center;justify-content:center">${icon}</div>`, 96, 96, 'public/badge-96.png');

// The 480 wordmarks: the 1200 x 208.97 SVG at 480 wide, 83.59 tall (84 rows, the last one partly covered).
for (const tone of ['primary', 'reversed']) {
  const s = svg(`visualize-wordmark-${tone}`).replace(/width="1200" height="208.97"/, 'width="480" height="83.588"').replace(/<title>.*?<\/title>/, '');
  await shot(s, 480, 84, `public/brand/png/visualize-wordmark-${tone}-480.png`);
}
await browser.close();
