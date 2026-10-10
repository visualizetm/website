/* A QR code encoder (review links job): byte mode, versions 1 to 10, error
 * correction M or H, mask chosen by the standard's penalty rules. Plain
 * data in, a matrix of booleans out; src/ui/QrCode.jsx paints it. Written
 * here so the review link's QR needs no library and no network, and
 * scripts/qr-test.mjs decodes what this makes with an independent reader.
 * ISO/IEC 18004: Reed Solomon over GF(256) with the 0x11d polynomial, the
 * alignment pattern rows of Table E.1, the EC tables of Table 9 for M and H. */

const EC = {
  // version -> [ecCodewordsPerBlock, blocks group 1, data codewords group 1, blocks group 2, data codewords group 2]
  M: [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]],
  H: [null, [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0], [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16]],
};
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

/* GF(256) tables */
const EXP = new Uint8Array(512); const LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function generator(n) { let g = [1]; for (let i = 0; i < n; i++) { const next = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); } g = next; } return g; }
function ecOf(data, n) {
  const g = generator(n); const out = new Array(n).fill(0);
  for (const d of data) { const f = d ^ out[0]; out.shift(); out.push(0); if (f) for (let j = 0; j < n; j++) out[j] ^= mul(g[j + 1], f); }
  return out;
}

const capacity = (v, level) => { const t = EC[level][v]; return t[1] * t[2] + t[3] * t[4]; };
/** The smallest version that holds the bytes at this level, or 0. */
export function versionFor(byteLen, level = 'M') {
  for (let v = 1; v <= 10; v++) { const headerBits = 4 + (v <= 9 ? 8 : 16); if (Math.ceil((headerBits + byteLen * 8) / 8) <= capacity(v, level)) return v; }
  return 0;
}

function bitsOf(bytes, v, level) {
  const cap = capacity(v, level); const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4); push(bytes.length, v <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  for (let i = 0; i < 4 && bits.length < cap * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const out = []; for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let i = 0; out.length < cap; i++) out.push(i % 2 ? 0x11 : 0xec);
  return out;
}
function interleave(data, v, level) {
  const [ecn, b1, d1, b2, d2] = EC[level][v];
  const blocks = []; let at = 0;
  for (let i = 0; i < b1; i++) { blocks.push(data.slice(at, at + d1)); at += d1; }
  for (let i = 0; i < b2; i++) { blocks.push(data.slice(at, at + d2)); at += d2; }
  const ecs = blocks.map(b => ecOf(b, ecn));
  const out = []; const maxD = Math.max(d1, d2);
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecn; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

function makeMatrix(v) { const n = v * 4 + 17; return { n, m: Array.from({ length: n }, () => new Array(n).fill(null)), fn: Array.from({ length: n }, () => new Array(n).fill(false)) }; }
function placeFunction(M, v) {
  const { n, m, fn } = M;
  const set = (r, c, val) => { if (r >= 0 && r < n && c >= 0 && c < n) { m[r][c] = val; fn[r][c] = true; } };
  const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)); set(r0 + r, c0 + c, on); } };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  /* Alignment patterns before the timing lines: the ones centred on row or column 6 (version 7 up) sit on the timing line and agree with it. Only the three that would land on a finder are left out. */
  const al = ALIGN[v];
  const onFinder = (r, c) => (r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8);
  for (const r of al) for (const c of al) {
    if (onFinder(r, c)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  for (let i = 8; i < n - 8; i++) { if (!fn[6][i]) set(6, i, i % 2 === 0); if (!fn[i][6]) set(i, 6, i % 2 === 0); }
  for (let i = 0; i < 8; i++) { set(8, i < 6 ? i : i + 1, false); set(i < 6 ? i : i + 1, 8, false); set(8, n - 1 - i, false); set(n - 1 - i, 8, false); }
  set(8, 8, false); set(n - 8, 8, true);
  // Version 7 and up carry the version information in two 6 by 3 blocks; reserved here, written after masking.
  if (v >= 7) for (let i = 0; i < 18; i++) { set(Math.floor(i / 3), n - 11 + (i % 3), false); set(n - 11 + (i % 3), Math.floor(i / 3), false); }
}
function versionBits(v) { let r = v << 12; for (let i = 17; i >= 12; i--) if ((r >> i) & 1) r ^= 0x1f25 << (i - 12); return (v << 12) | r; }
function writeVersion(M, v) {
  if (v < 7) return;
  const { n, m } = M; const bits = versionBits(v);
  for (let i = 0; i < 18; i++) { const b = !!((bits >> i) & 1); m[Math.floor(i / 3)][n - 11 + (i % 3)] = b; m[n - 11 + (i % 3)][Math.floor(i / 3)] = b; }
}
function placeData(M, codewords) {
  const { n, m, fn } = M; let bit = 0; const total = codewords.length * 8;
  const bitAt = (i) => (i < total ? (codewords[i >> 3] >> (7 - (i & 7))) & 1 : 0);
  let up = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let k = 0; k < n; k++) { const r = up ? n - 1 - k : k; for (const cc of [c, c - 1]) if (!fn[r][cc]) { m[r][cc] = !!bitAt(bit++); } }
    up = !up;
  }
}
const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
function formatBits(level, mask) {
  let d = (LEVEL_BITS[level] << 3) | mask; let r = d << 10;
  for (let i = 14; i >= 10; i--) if ((r >> i) & 1) r ^= 0x537 << (i - 10);
  return ((d << 10) | r) ^ 0x5412;
}
function writeFormat(M, bits) {
  const { n, m } = M; const b = (i) => !!((bits >> i) & 1);
  for (let i = 0; i < 6; i++) m[8][i] = b(14 - i); m[8][7] = b(8); m[8][8] = b(7); m[7][8] = b(6);
  for (let i = 0; i < 6; i++) m[i][8] = b(i);
  for (let i = 0; i < 8; i++) m[n - 1 - i][8] = b(14 - i);
  for (let i = 0; i < 8; i++) m[8][n - 8 + i] = b(7 - i);
  m[n - 8][8] = true;
}
function penalty(M) {
  const { n, m } = M; let p = 0;
  const runs = (get) => { for (let i = 0; i < n; i++) { let run = 1; for (let j = 1; j < n; j++) { if (get(i, j) === get(i, j - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } } };
  runs((i, j) => m[i][j]); runs((i, j) => m[j][i]);
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
  const pat = [true, false, true, true, true, false, true, false, false, false, false]; const pat2 = [...pat].reverse();
  const scan = (get) => { for (let i = 0; i < n; i++) for (let j = 0; j <= n - 11; j++) { let a = true; let b = true; for (let k = 0; k < 11; k++) { const v = get(i, j + k); if (v !== pat[k]) a = false; if (v !== pat2[k]) b = false; } if (a || b) p += 40; } };
  scan((i, j) => m[i][j]); scan((i, j) => m[j][i]);
  let dark = 0; for (const row of m) for (const v of row) if (v) dark++;
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

/**
 * Encode text as a QR code.
 * @param {string} text
 * @param {{ level?: 'M'|'H' }} [opts]
 * @returns {{ size: number, modules: boolean[][], version: number, level: string, mask: number }}
 */
export function encodeQr(text, { level = 'M' } = {}) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const v = versionFor(bytes.length, level);
  if (!v) throw new Error('too long for a QR up to version 10');
  const codewords = interleave(bitsOf(bytes, v, level), v, level);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const M = makeMatrix(v); placeFunction(M, v); placeData(M, codewords);
    for (let r = 0; r < M.n; r++) for (let c = 0; c < M.n; c++) if (!M.fn[r][c] && MASKS[mask](r, c)) M.m[r][c] = !M.m[r][c];
    writeFormat(M, formatBits(level, mask)); writeVersion(M, v);
    const p = penalty(M);
    if (!best || p < best.p) best = { p, mask, M };
  }
  return { size: best.M.n, modules: best.M.m.map(row => row.map(Boolean)), version: v, level, mask: best.mask };
}
