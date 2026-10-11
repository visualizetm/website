#!/usr/bin/env node
/* The per invoice Stripe link and the webhook's match (client portal, prompt 2 fix).   node scripts/stripe-pay-test.mjs */
import { runStripePay } from './stripe-pay-lib.mjs';
const results = await runStripePay();
let bad = 0;
for (const r of results) { console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.msg}`); if (!r.ok) bad++; }
console.log(bad ? `\n${bad} of ${results.length} checks failed.` : `\nAll ${results.length} checks pass.`);
process.exit(bad ? 1 : 0);
