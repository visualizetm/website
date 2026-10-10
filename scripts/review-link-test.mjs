#!/usr/bin/env node
/* Review links (the Visualize review link, its public door and the testimonials it brings back), against the real
 * handlers with the in-memory mongo: the token (mint, carry forward, regenerate, dead), the GET whitelist, the view
 * count, every POST validation, the honeypot, both rate limits, the task, the consent gate on approve, the showcase
 * block and the landing section (hidden when empty), the average rating at two and at three ratings, the mirror.
 *   node scripts/review-link-test.mjs */
import { runReview } from './review-lib.mjs';
const results = await runReview();
let fails = 0;
for (const r of results) { console.log(`${r.ok ? 'ok   ' : 'FAIL '}${r.msg}${r.guard ? `  [${r.guard}]` : ''}`); if (!r.ok) fails++; }
console.log(`\n${results.length - fails} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
