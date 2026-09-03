#!/usr/bin/env node
/* Counts raw hex color literals in src/ and api/ so every rebuild prompt can
 * prove the number is going down. Baseline (Prompt 1 audit): 629.
 *   node scripts/hex-count.js          → total + per-file table
 *   node scripts/hex-count.js --unique → also lists unique values
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'api'];
const EXT = new Set(['.js', '.jsx', '.css', '.mjs']);
const RX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

const files = [];
const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); const st = statSync(p); if (st.isDirectory()) walk(p); else if (EXT.has(extname(p))) files.push(p); } };
ROOTS.forEach(r => { try { walk(r); } catch { /* missing root */ } });

let total = 0; const perFile = []; const uniq = new Map();
for (const f of files) {
  const m = readFileSync(f, 'utf8').match(RX) || [];
  if (m.length) perFile.push([f, m.length]);
  total += m.length;
  for (const h of m) uniq.set(h.toLowerCase(), (uniq.get(h.toLowerCase()) || 0) + 1);
}
perFile.sort((a, b) => b[1] - a[1]);
console.log(`Raw hex literals in ${ROOTS.join(' + ')}: ${total}  (unique: ${uniq.size})`);
for (const [f, n] of perFile) console.log(`  ${String(n).padStart(4)}  ${f}`);
if (process.argv.includes('--unique')) {
  console.log('\nUnique values by frequency:');
  for (const [h, n] of [...uniq.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${h}`);
}
