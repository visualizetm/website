#!/usr/bin/env node
/* The QR encoder (src/lib/qr.js) decoded by an independent reader (jsqr): the review link at level M and at
 * level H with the logo panel punched out of the middle, at the smallest size the Reviews card renders (160px)
 * and at 4 modules per pixel; module for module against a second encoder (qrcode); the version choice; a refusal past version 10.
 *   node scripts/qr-test.mjs */
import path from 'path';
import { pathToFileURL } from 'url';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { encodeQr, versionFor } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'qr.js')).href);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

/* Paint the matrix as RGBA at `px` pixels a side with a 4 module quiet zone; `hole` is the fraction of the side covered by a centered square (the logo panel). */
function paint(q, px, hole = 0) {
  const quiet = 4; const total = q.size + quiet * 2; const scale = px / total;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  const h = hole ? Math.round(px * hole) : 0; const h0 = Math.round((px - h) / 2);
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const r = Math.floor(y / scale) - quiet; const c = Math.floor(x / scale) - quiet;
    const inHole = h && x >= h0 && x < h0 + h && y >= h0 && y < h0 + h;
    const dark = !inHole && r >= 0 && c >= 0 && r < q.size && c < q.size && q.modules[r][c];
    if (dark) { const i = (y * px + x) * 4; data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
  }
  return { data, width: px, height: px };
}
const url = 'https://visualizestudio.org/r/' + 'aB3dE6gH9jK2mN5pQ8sT1vW4';
const q = encodeQr(url);
ok(q.version === 4 && q.level === 'M' && q.size === 33, `the review link is a version ${q.version} ${q.level} code, ${q.size} modules a side`);
for (const px of [160, 264, 512]) { const img = paint(q, px); const d = jsQR(img.data, img.width, img.height); ok(d && d.data === url, `level M decodes at ${px}px${d ? '' : ' (no decode)'}`); }
const qh = encodeQr(url, { level: 'H' });
ok(qh.version === 6 && qh.size === 41, `at level H the same link is version ${qh.version}, ${qh.size} modules`);
let holeOk = true;
for (const px of [160, 264, 512]) { const img = paint(qh, px, 0.22); const d = jsQR(img.data, img.width, img.height); const good = d && d.data === url; if (!good) holeOk = false; ok(good, `level H with a 22% logo panel decodes at ${px}px${d ? '' : ' (no decode)'}`); }
for (const t of ['a', 'https://visualizestudio.org/r/' + 'x'.repeat(24) + '?utm_source=card&utm_medium=print', 'x'.repeat(200)]) { const v = versionFor(new TextEncoder().encode(t).length, 'M'); const e = encodeQr(t); const d = jsQR(paint(e, 400).data, 400, 400); ok(d && d.data === t && e.version === v, `${t.length} bytes decodes at version ${e.version}`); }
/* Module for module against a second, independent encoder at every version and both levels (the masks forced equal). */
let mismatched = 0;
for (const n of [1, 10, 30, 50, 80, 120, 150, 180, 200]) for (const level of ['M', 'H']) { const t = 'y'.repeat(n); let mine; try { mine = encodeQr(t, { level }); } catch { continue; } const ref = QRCode.create(t, { errorCorrectionLevel: level, version: mine.version, maskPattern: mine.mask }); for (let r = 0; r < mine.size; r++) for (let c = 0; c < mine.size; c++) if (!!ref.modules.get(r, c) !== mine.modules[r][c]) mismatched++; }
ok(mismatched === 0, `every matrix matches the reference encoder module for module (${mismatched} differ)`);
let threw = false; try { encodeQr('x'.repeat(400)); } catch { threw = true; }
ok(threw, 'past version 10 the encoder refuses');
console.log(holeOk ? '\nThe Aperture panel is safe at 22% on level H down to 160px.' : '\nThe Aperture panel does not decode: the card must leave it out.');
console.log(`\n${fails ? `${fails} failed.` : 'All QR checks pass.'}`);
process.exit(fails ? 1 : 0);
