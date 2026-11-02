#!/usr/bin/env node
/* The Drafts rule's guards, each put back as the fault it stops (email safety, prompt 1 of 3): a copy of api/ and src/ with
 * one guard cut out, then scripts/email-safety-test.mjs on that copy (SAFETY_ROOT); the named check must fail.
 *   tasks-row-send-true   the Tasks row posts send: true to the log on one tap again
 *   rules-send-for-me     the old Send for me branch is back in rules.js (a send with a forged stamp)
 *   send-gate             sendComposed sends without the stamp
 *   queue-gate            the queue sends a queued row that was never approved
 *   stamp-elsewhere       a second stamp maker, in drafts.js */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CUTS = [
  { name: 'tasks-row-send-true', file: 'src/pages/AdminTasksHome.jsx', check: /no client file posts send: true/,
    from: "      shell?.openSendSheet?.({ _id: t.emailId }, { startEdit: what === 'editemail', onChanged: () => onRetry?.() });",
    to: "      fetch('/api/admin/email/log', { method: 'POST', body: JSON.stringify({ id: t.emailId, send: true }) }).then(() => onRetry?.());" },
  { name: 'rules-send-for-me', file: 'api/_lib/email/rules.js', check: /is stored as draft and the run drafts, sends nothing|imports no send door/,
    from: "        const r = await draftEmail(db, { ...target, auto: true, reason: rule.reason }, now);",
    to: "        const r = await sendComposed(db, { lead, project, invoice, settings }, target, { approval: { approvedAt: new Date(now).toISOString(), approvedBy: 'rob' } });",
    also: [["import { isMarketing } from './send.js';", "import { isMarketing, sendComposed } from './send.js';"]] },
  { name: 'send-gate', file: 'api/_lib/email/send.js', check: /without the stamp|is a draft|refused/,
    from: "  if (!testToSelf && !approval) {", to: "  if (false) {" },
  { name: 'queue-gate', file: 'api/_lib/email/send.js', check: /queue|never sends what Rob did not approve|Needs your tap/,
    from: "  if (!isApproved(log)) {", to: "  if (false) {" },
  { name: 'stamp-elsewhere', file: 'api/_lib/email/drafts.js', check: /approve\.js|stamp maker|makes the stamp|approvedBy/,
    from: "/* Drafts for Rob (the email system, milestones 6 and 8): an email written and", to: "export const approvalStamp = () => ({ approvedAt: new Date().toISOString(), approvedBy: 'rob' });\n/* Drafts for Rob (the email system, milestones 6 and 8): an email written and" },
];
const ONLY = process.env.GUARD_ONLY ? process.env.GUARD_ONLY.split(',') : null;
let bad = 0, proven = 0;
for (const cut of CUTS) {
  if (ONLY && !ONLY.includes(cut.name)) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'safety-cut-'));
  for (const d of ['api', 'src']) fs.cpSync(path.join(repoRoot, d), path.join(tmp, d), { recursive: true });
  const file = path.join(tmp, cut.file);
  let text = fs.readFileSync(file, 'utf8');
  let missing = false;
  for (const [from, to] of [[cut.from, cut.to], ...(cut.also || [])]) { if (!text.includes(from)) { missing = true; break; } text = text.replace(from, to); }
  if (missing) { console.log(`FAIL ${cut.name}: the guard's line is not in ${cut.file}`); bad++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  fs.writeFileSync(file, text);
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'email-safety-test.mjs')], { cwd: repoRoot, env: { ...process.env, SAFETY_ROOT: tmp }, encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const fails = out.split('\n').filter(l => /^FAIL/.test(l));
  const named = fails.filter(l => cut.check.test(l));
  if ((r.status !== 0 && named.length) || (r.status !== 0 && fails.length && !cut.check)) { proven++; console.log(`ok   ${cut.name}: without the guard, ${fails.length} check(s) fail (${(named[0] || fails[0]).slice(5, 110)})`); }
  else if (r.status !== 0) { proven++; console.log(`ok   ${cut.name}: without the guard the test fails (${(fails[0] || out.trim().split('\n').pop() || '').slice(0, 110)})`); }
  else { bad++; console.log(`FAIL ${cut.name}: every check still passes with the guard cut out`); }
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${proven} cut in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
