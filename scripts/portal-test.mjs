#!/usr/bin/env node
/* The client portal against the real handlers (client portal, prompt 1): the token, the whitelist, the module
 * states, documents, the PIN and its limit, the sensitive gate, the 404s.   node scripts/portal-test.mjs */
import { runPortal } from './portal-lib.mjs';
const results = await runPortal();
let bad = 0;
for (const r of results) { console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.msg}`); if (!r.ok) bad++; }
console.log(bad ? `\n${bad} of ${results.length} checks failed.` : `\nAll ${results.length} checks pass.`);
process.exit(bad ? 1 : 0);
