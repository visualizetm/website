#!/usr/bin/env node
/* Date parsing checks for src/shared/dates.js (Prompt 12). Run in a US zone:
 *   TZ=America/New_York node scripts/dates-test.mjs
 * Date-only strings must render the day the user typed; ISO timestamps keep
 * their instant; DST boundaries must not shift a calendar day. */
import { createServer } from 'vite';
const s = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
const D = await s.ssrLoadModule('/src/shared/dates.js');
const P = await s.ssrLoadModule('/src/lib/projects.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const day = (v) => D.parseDate(v)?.getDate();
console.log(`TZ=${process.env.TZ || 'system'} offset ${new Date().getTimezoneOffset()} min`);
ok(day('2026-08-06') === 6 && D.fmtDate('2026-08-06').includes('6'), 'date-only Aug 6 renders the 6th');
ok(day('2026-01-01') === 1 && D.fmtDate('2026-01-01').startsWith('Jan 1'), 'date-only Jan 1 stays Jan 1');
ok(day('2026-12-31') === 31, 'date-only Dec 31 stays Dec 31');
ok(D.dayKey('2026-03-08') === '2026-03-08', 'DST start day (US, Mar 8 2026) round trips');
ok(D.dayKey('2026-11-01') === '2026-11-01', 'DST end day (US, Nov 1 2026) round trips');
ok(D.dayKey('2026-03-09') === '2026-03-09' && D.dayKey('2026-10-31') === '2026-10-31', 'days beside the DST switches round trip');
ok(P.addMonths('2026-01-31', 1) === '2026-02-28' && P.addMonths('2026-10-15', 1) === '2026-11-15', 'addMonths clamps and crosses DST without drift');
ok(D.parseDate('2026-08-22T17:10:34.820Z').toISOString() === '2026-08-22T17:10:34.820Z', 'ISO timestamp keeps its instant');
const iso = new Date(2026, 7, 6, 14, 22).toISOString();
ok(D.fmtDateTime(iso).startsWith('Aug 6') && D.fmtDateTime(iso).includes('2:22'), 'ISO afternoon renders local time');
ok(D.countdownLabel(D.dayKey(new Date())) === 'today', 'countdown of today (date-only) is today');
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
ok(D.countdownLabel(D.dayKey(tomorrow)) === 'tomorrow', 'countdown of tomorrow (date-only) is tomorrow');
ok(D.todayInput() === D.dayKey(new Date()), 'todayInput is the local day');
ok(D.parseDate('') === null && D.parseDate(null) === null && D.parseDate('not a date') === null, 'empty and junk parse to null');
ok(D.parseDate(1754000000000).getTime() === 1754000000000, 'epoch number passes through');
ok(P.scheduleStatus({ dueAt: D.dayKey(new Date()) }) === 'due', 'a schedule item due today reads due, not past due');
await s.close();
console.log(fails ? `\n${fails} failing` : '\nAll date cases pass.');
process.exit(fails ? 1 : 0);
