#!/usr/bin/env node
/* The client docs handler checks (docs/SECURITY-AUDIT.md, Client docs): every check in scripts/docs-lib.mjs against
 * the real api/. The guard proof (scripts/docs-guard-proof.mjs) runs the same checks with one guard cut out at a time.
 *   node scripts/docs-test.mjs */
import { runDocs } from './docs-lib.mjs';

const results = await runDocs();
let fails = 0;
for (const r of results) { console.log((r.pass ? 'ok   ' : 'FAIL ') + r.desc); if (!r.pass) fails++; }
console.log(fails ? `\n${fails} failing of ${results.length}.` : `\nAll ${results.length} docs checks pass.`);
process.exit(fails ? 1 : 0);
