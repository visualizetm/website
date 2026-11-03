/* The call console and the close (prompt 2 of 3): each guard put back as its fault in a copy of src, close-test must fail.
 *   1. The stepper's Lock it in sending the invite directly (send: true and a stamp on the post): section 9's scan.
 *   2. A quote line with a price pricing.js does not know accepted (validLine without the list price check): section 5's guard.
 *   3. The price step unlocked with two beliefs (askUnlocked on two): section 6.
 *   4. A callback set from the Room's no answer not carried (callOutcomeSet drops extra.callbackAt): section 2, and the push
 *      coverage (minute-reminders reads callbackAt whatever callStatus says) would have nothing to push.
 * Run: node scripts/close-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const CUTS = [
  { name: 'Lock it in sends the invite directly', file: 'components/calls/CallStepper.jsx', from: "override: inviteOverride(after, meeting), reason: 'Booked on the script' }", to: "override: inviteOverride(after, meeting), reason: 'Booked on the script', send: true, approvedAt: new Date().toISOString(), approvedBy: 'rob' }" },
  { name: 'a quote line off the price list is accepted', file: 'lib/quote.js', from: "  if (list === null || Number(l.listPrice) !== list) return false;", to: "  if (list === null) return false;" },
  { name: 'the ask unlocks on two beliefs', file: 'shared/callScript.js', from: "export const askUnlocked = (closer) => beliefsDone(closer?.beliefs);", to: "export const askUnlocked = (closer) => BELIEFS.filter(b => closer?.beliefs?.[b.id] === true).length >= 2;" },
  { name: 'a no answer from the Room drops its callback', file: 'lib/callOutcome.js', from: "  if (outcome === 'no-answer' && extra.callbackAt) set.callbackAt = extra.callbackAt;", to: "" },
];
for (const cut of CUTS) {
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'close-proof-'));
  const src = path.join(tmp, 'src');
  fs.cpSync(path.join(repoRoot, 'src'), src, { recursive: true });
  const f = path.join(src, cut.file);
  const text = fs.readFileSync(f, 'utf8');
  if (!text.includes(cut.from)) { ok(false, `${cut.name}: the guard line is not where the proof expects (${cut.file})`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  fs.writeFileSync(f, text.replace(cut.from, cut.to));
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'close-test.mjs')], { env: { ...process.env, CLOSE_SRC: src }, encoding: 'utf8' });
  const failed = r.status !== 0 && /FAIL /.test(r.stdout);
  ok(failed, `${cut.name}: close-test must fail with the guard cut (exit ${r.status})`);
  if (failed) console.log(`ok   ${cut.name}: ${(r.stdout.match(/FAIL [^\n]*/) || [''])[0].slice(0, 120)}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\nclose-guard-proof: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
