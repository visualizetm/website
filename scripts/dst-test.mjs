#!/usr/bin/env node
/* Daylight time ends in New York on Sunday November 1 and began on Sunday March 14, 2027. A fixed UTC hour is right for only half the
 * year: 13:00Z is 9:00 AM until November 1, then 8:00 AM. The planner's New idea task is due 9:00 AM New York through the zone
 * helpers, the day before the client's preferred date or two working days out, and the working days are New York days (an evening
 * after 8 PM there is already tomorrow in UTC). Run in New York, UTC and Los Angeles time: the process zone must change nothing.
 *   node scripts/dst-test.mjs */
import path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
if (!process.env.DST_ZONE_CHILD) {
  let bad = 0;
  for (const tz of ['America/New_York', 'UTC', 'America/Los_Angeles']) {
    const r = spawnSync(process.execPath, [process.argv[1]], { env: { ...process.env, TZ: tz, DST_ZONE_CHILD: '1' }, encoding: 'utf8' });
    process.stdout.write(`\n--- process zone ${tz}\n${r.stdout || ''}${r.stderr || ''}`);
    if (r.status !== 0) bad++;
  }
  console.log(bad ? `\n${bad} zone run(s) failed.` : '\nthe answers are the same in all three process zones.');
  process.exit(bad ? 1 : 0);
}

let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const Z = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'zone.js')).href);
const { suggestionDue } = await import(pathToFileURL(path.join(repoRoot, 'api', 'planner.js')).href);
const at = (day, h, m = 0) => Z.zoneDateAt(day, h, m);
const due = (preferred, now) => suggestionDue(preferred, now);

console.log('the zone helpers across the two changes');
ok(new Date(at('2026-11-01', 18, 0)).toISOString() === '2026-11-01T23:00:00.000Z', '6:00 PM New York on November 1 is 23:00Z (daylight time ended at 2 AM)');
ok(new Date(at('2026-10-31', 18, 0)).toISOString() === '2026-10-31T22:00:00.000Z', '6:00 PM on October 31 is 22:00Z');
ok(new Date(at('2027-03-14', 18, 0)).toISOString() === '2027-03-14T22:00:00.000Z', '6:00 PM on March 14, 2027 is 22:00Z (daylight time began at 2 AM)');
ok(new Date(at('2027-03-13', 18, 0)).toISOString() === '2027-03-13T23:00:00.000Z', '6:00 PM on March 13, 2027 is 23:00Z');

console.log('\nthe New idea task, the day before the preferred date, 9:00 AM New York');
const NOW = at('2026-10-20', 12, 0);
ok(due('2026-10-30', NOW) === '2026-10-29T13:00:00.000Z', 'preferred October 30: October 29 at 13:00Z (still daylight time)');
ok(due('2026-11-01', NOW) === '2026-10-31T13:00:00.000Z', 'preferred November 1: October 31 at 13:00Z (the day before the change)');
ok(due('2026-11-02', NOW) === '2026-11-01T14:00:00.000Z', 'preferred November 2: November 1 at 14:00Z (9:00 AM is now 14:00Z)');
ok(due('2026-11-03', NOW) === '2026-11-02T14:00:00.000Z', 'preferred November 3: November 2 at 14:00Z');
ok(due('2026-12-25', NOW) === '2026-12-24T14:00:00.000Z', 'preferred December 25: December 24 at 14:00Z');
const SPRING = at('2027-03-01', 12, 0);
ok(due('2027-03-14', SPRING) === '2027-03-13T14:00:00.000Z', 'preferred March 14, 2027: March 13 at 14:00Z (standard time)');
ok(due('2027-03-15', SPRING) === '2027-03-14T13:00:00.000Z', 'preferred March 15, 2027: March 14 at 13:00Z (daylight time began that morning)');
ok(due('2027-03-20', SPRING) === '2027-03-19T13:00:00.000Z', 'preferred March 20, 2027: March 19 at 13:00Z');

console.log('\na preferred date too close to use: two working days from now, 9:00 AM New York');
ok(due('2026-10-29', at('2026-10-29', 12, 0)) === '2026-11-02T14:00:00.000Z', 'Thursday October 29, preferred today: Monday November 2 at 14:00Z');
ok(due('', at('2026-10-30', 12, 0)) === '2026-11-03T14:00:00.000Z', 'Friday October 30, no date: Tuesday November 3 at 14:00Z (the old fixed hour said 13:00Z, 8:00 AM)');
ok(due('', at('2026-10-27', 12, 0)) === '2026-10-29T13:00:00.000Z', 'Tuesday October 27, no date: Thursday October 29 at 13:00Z');
ok(due('', at('2027-03-11', 11, 0)) === '2027-03-15T13:00:00.000Z', 'Thursday March 11, 2027, no date: Monday March 15 at 13:00Z');
ok(due('', at('2026-11-01', 22, 0)) === '2026-11-03T14:00:00.000Z', 'Sunday November 1 at 10 PM New York (Monday in UTC): the working days count from Sunday, Tuesday November 3 at 14:00Z');
ok(due('', at('2026-10-31', 21, 30)) === '2026-11-03T14:00:00.000Z', 'Saturday October 31 at 9:30 PM New York: Tuesday November 3');
ok(due('2026-10-21', NOW) === '2026-10-22T13:00:00.000Z', 'preferred tomorrow but it is already past noon: the day before is today at 9:00 AM, behind us, so two working days out');
ok(due('2026-10-20', at('2026-10-20', 9, 30)) === '2026-10-22T13:00:00.000Z', 'preferred today and 9:00 AM has passed: Thursday October 22 at 13:00Z');

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
