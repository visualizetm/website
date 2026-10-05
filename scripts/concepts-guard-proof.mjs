#!/usr/bin/env node
/* Proof that each Review each guard is what stops the bad request (docs/SECURITY-AUDIT.md, Concepts review).
 * For every guard: copy api/ to a temp tree, cut that one guard out of the real source, run the same checks
 * (scripts/concepts-review-lib.mjs) and require that the guard's own check FAILS (and that every check which
 * does not depend on it still passes). A cut that finds nothing to remove is itself a failure, so a renamed
 * guard cannot make this pass quietly.   node scripts/concepts-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { runReview, repoRoot } from './concepts-review-lib.mjs';

const PUB = '_routes/concepts-public.js';
const ADM = '_routes/concept-sets.js';
/* guard id (the check's `guard`) -> what to cut: [file, exact source, replacement] */
const CUTS = {
  belongs: [
    [PUB, "const at = dirs.findIndex(d => d?.id === directionId);\n      if (!directionId || at < 0) return notFound(res);", "const at = 0;"],
    [PUB, "[`directions.${at}.id`]: directionId, ", ""],
  ],
  'note-cap': [[PUB, "const note = plain(req.body?.note, 1000);", "const note = plain(req.body?.note, 100000);"]],
  'strip-html': [[PUB, "String(v ?? '').replace(/<\\/?[a-z!][^>]*>/gi, '').trim().slice(0, max)", "String(v ?? '').trim().slice(0, max)"]],
  reference: [
    [PUB, "if (!needsDecision(dirs[at])) return res.status(400).json({ error: 'That one is for reference, nothing to decide.' });", ""],
    [PUB, ", [`directions.${at}.needsDecision`]: { $ne: false } }", " }"],
  ],
  'pass-off': [
    [PUB, "if (status === 'pass' && set.allowPass !== true) return res.status(400).json({ error: 'That one is not on for this set.' });", ""],
    [PUB, "if (status === 'pass') filter.allowPass = true;", ""],
  ],
  'changes-note': [[PUB, "if (status === 'changes' && !note) return res.status(400).json({ error: 'Say what should change first.' });", ""]],
  mode: [
    [PUB, "if (modeOf(set) !== 'review') return res.status(409).json({ error: 'This set is a pick one.' });\n      if (set.submittedAt) return res.status(409).json({ error: 'Your answers are already sent.' });\n      const status", "const status"],
    [PUB, "status: { $in: OPEN }, approvalMode: 'review', ...UNLOCKED, [`directions", "status: { $in: OPEN }, ...UNLOCKED, [`directions"],
    [PUB, "if (modeOf(set) === 'review') return res.status(409).json({ error: 'This set is answered one by one.' });", ""],
    [PUB, "approvalMode: { $ne: 'review' }, 'directions.id': directionId", "'directions.id': directionId"],
  ],
  complete: [[PUB, "if (open.length) return res.status(400).json({ error: 'Answer every one first.', remaining: open.map(d => String(d.id)) });", ""]],
  locked: [
    [PUB, "if (set.submittedAt) return res.status(409).json({ error: 'Your answers are already sent.' });\n      if (!OPEN.includes(set.status)) return res.status(409).json({ error: 'This set is already decided.' });\n      const need", "if (!OPEN.includes(set.status)) return res.status(409).json({ error: 'This set is already decided.' });\n      const need"],
    [PUB, "status: { $in: OPEN }, approvalMode: 'review', ...UNLOCKED },\n        { $set: { submittedAt", "status: { $in: OPEN }, approvalMode: 'review' },\n        { $set: { submittedAt"],
  ],
  'locked-decide': [
    [PUB, "if (set.submittedAt) return res.status(409).json({ error: 'Your answers are already sent.' });\n      const status = String", "const status = String"],
    [PUB, "approvalMode: 'review', ...UNLOCKED, [`directions", "approvalMode: 'review', [`directions"],
  ],
  'send-zero': [[ADM, "if (allowed.status === 'sent' && modeAfter === 'review' && !needCount(allowed.directions || before.directions)) return res.status(400).json({ error: 'Mark at least one item as Needs a decision first.' });", ""]],
  'admin-lock': [[ADM, "if (before.submittedAt && !reopen && lockedChange(before, set)) return res.status(409).json({ error: 'Reopen for review first. The client has sent their answers.' });", ""]],
  'keep-decision': [[ADM, "return old?.decision && d.needsDecision !== false ? { ...d, decision: old.decision } : d;", "return d;"]],
};

const base = await runReview();
let bad = 0;
if (base.some(r => !r.pass)) { console.log('FAIL the unmodified api does not pass its own checks:', base.filter(r => !r.pass).map(r => r.id).join(', ')); process.exit(1); }
const guards = [...new Set(base.map(r => r.guard).filter(Boolean))];
for (const g of guards) if (!CUTS[g]) { console.log(`FAIL guard "${g}" has no cut defined`); bad++; }
for (const [g, cuts] of Object.entries(CUTS)) {
  if (!guards.includes(g)) { console.log(`FAIL cut "${g}" has no check`); bad++; continue; }
  const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'proof-'));
  const apiCopy = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  let cutOk = true;
  for (const [file, from, to] of cuts) {
    const f = path.join(apiCopy, file); const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(from)) { console.log(`FAIL ${g}: the guard source was not found in ${file}`); cutOk = false; bad++; break; }
    fs.writeFileSync(f, src.replace(from, to));
  }
  if (!cutOk) { fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  const res = await runReview(apiCopy);
  const mine = res.filter(r => r.guard === g);
  const failed = mine.filter(r => !r.pass);
  const collateral = res.filter(r => !r.pass && r.guard !== g);
  const good = failed.length === mine.length && mine.length > 0;
  console.log(`${good ? 'ok   ' : 'FAIL '}${g.padEnd(14)} cut ${cuts.length} line${cuts.length > 1 ? 's' : ''}: check "${mine[0]?.desc}" ${good ? 'fails with the guard removed' : 'STILL PASSES without the guard'}${collateral.length ? ` (also failing: ${collateral.map(r => r.id).join(', ')})` : ''}`);
  if (!good) bad++;
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(bad ? `\n${bad} guard proof(s) failed.` : `\nEvery guard check fails when its guard is cut out (${Object.keys(CUTS).length} guards).`);
process.exit(bad ? 1 : 0);
