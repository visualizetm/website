#!/usr/bin/env node
/* The Home Screen icon badge (src/lib/appBadge.js): the count is set, cleared at zero, clamped, and no browser quirk can throw or
 * leave a rejected promise. The count itself is nextUpBadge (overdue plus today), asserted here on a small set against nextUpItems.
 *   node scripts/app-badge-test.mjs */
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const unhandled = []; process.on('unhandledRejection', (e) => unhandled.push(e));
const { setAppBadge } = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'appBadge.js')).href);
const NA = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'nextAction.js')).href);
const fake = (extra = {}) => { const calls = []; return { calls, setAppBadge: (n) => { calls.push(['set', n]); return Promise.resolve(); }, clearAppBadge: () => { calls.push(['clear']); return Promise.resolve(); }, ...extra }; };

console.log('the badge');
let nav = fake();
ok(setAppBadge(3, nav) === 'set' && nav.calls[0].join() === 'set,3', 'a count is set');
nav = fake();
ok(setAppBadge(0, nav) === 'cleared' && nav.calls[0][0] === 'clear', 'zero clears it');
nav = fake({ clearAppBadge: undefined });
ok(setAppBadge(0, nav) === 'cleared' && nav.calls[0].join() === 'set,0', 'with no clear function, zero is set(0), which clears it');
nav = fake();
setAppBadge(-4, nav); setAppBadge(NaN, nav); setAppBadge('x', nav); setAppBadge(undefined, nav);
ok(nav.calls.every(c => c[0] === 'clear'), 'a negative, missing or non-numeric count clears');
nav = fake();
setAppBadge(2.9, nav); setAppBadge(1e9, nav);
ok(nav.calls[0].join() === 'set,2' && nav.calls[1].join() === 'set,99999', 'a count is whole and bounded');
ok(setAppBadge(3, {}) === 'unsupported' && setAppBadge(0, {}) === 'unsupported' && setAppBadge(3, null) === 'unsupported', 'a browser without the Badging API is left alone');
nav = fake({ setAppBadge: () => { throw new Error('refused'); } });
let threw = false; try { setAppBadge(3, nav); } catch { threw = true; }
ok(!threw, 'a browser that throws is swallowed');
nav = fake({ setAppBadge: () => Promise.reject(new Error('not allowed')), clearAppBadge: () => Promise.reject(new Error('not allowed')) });
setAppBadge(3, nav); setAppBadge(0, nav);
await new Promise(r => setTimeout(r, 20));
ok(unhandled.length === 0, 'and one that rejects leaves no unhandled rejection');

console.log('\nthe count is what the Tasks tab shows');
const NOW = Date.parse('2026-10-02T15:00:00-04:00');
const iso = (t) => new Date(t).toISOString();
const leads = [
  { _id: 'a', business: 'A', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW - 2 * 864e5), callLog: [{ at: iso(NOW - 3 * 864e5) }] },
  { _id: 'b', business: 'B', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + 3600e3), callLog: [{ at: iso(NOW - 3 * 864e5) }] },
  { _id: 'c', business: 'C', stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + 3 * 864e5), callLog: [{ at: iso(NOW - 3 * 864e5) }] },
];
const q = NA.nextUpItems(leads, [], [], NOW);
ok(NA.nextUpBadge(leads, [], [], NOW) === q.overdue.length + q.today.length && NA.nextUpBadge(leads, [], [], NOW) === 2, `overdue plus today (${NA.nextUpBadge(leads, [], [], NOW)}), not the callback three days out`);

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
