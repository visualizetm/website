#!/usr/bin/env node
/* The Review each handler checks (docs/CONCEPTS-AUDIT.md): every check in scripts/concepts-review-lib.mjs
 * against the real api/. The guard proof (scripts/concepts-guard-proof.mjs) runs the same checks with one
 * guard cut out at a time.   node scripts/concepts-review-test.mjs */
import { runReview } from './concepts-review-lib.mjs';

const results = await runReview();
let fails = 0;
for (const r of results) { console.log((r.pass ? 'ok   ' : 'FAIL ') + r.desc); if (!r.pass) fails++; }
console.log(fails ? `\n${fails} failing of ${results.length}.` : `\nAll ${results.length} concepts review checks pass.`);
process.exit(fails ? 1 : 0);
