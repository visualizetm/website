#!/usr/bin/env node
/* The email system against the real handlers (milestone 1 onward): the transport in test mode and connected (the request
 * shape, one retry on a 5xx or a network error, never on a 4xx, the key never in an error), the rate guard (thirty an hour,
 * counted in test mode too), the log (indexes, caps, the duplicate window, the hour, the queue) and the status route.
 *   node scripts/email-test.mjs */
process.env.TZ = 'America/New_York';
import { runEmail } from './email-lib.mjs';

const results = await runEmail();
let fails = 0;
for (const r of results) { if (!r.ok) { fails++; console.log('FAIL ' + r.msg); } }
console.log(`\n${results.length - fails} of ${results.length} checks pass${fails ? `, ${fails} failed` : ''}.`);
console.log(fails ? 'Email tests FAILED.' : 'All email tests pass.');
process.exit(fails ? 1 : 0);
