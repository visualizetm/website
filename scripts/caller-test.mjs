#!/usr/bin/env node
/* The caller walls (Billy's Call Room; docs/SECURITY-AUDIT.md, "The caller"): every check in scripts/caller-lib.mjs
 * against the real api/ and public/sw.js. The guard proof (scripts/caller-guard-proof.mjs) runs the same checks with
 * one wall cut out at a time.   node scripts/caller-test.mjs */
import { runCaller } from './caller-lib.mjs';

const results = await runCaller();
let fails = 0;
for (const r of results) { console.log((r.pass ? 'ok   ' : 'FAIL ') + r.desc); if (!r.pass) fails++; }
console.log(fails ? `\n${fails} failing of ${results.length}.` : `\nAll ${results.length} caller checks pass.`);
process.exit(fails ? 1 : 0);
