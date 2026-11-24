#!/usr/bin/env node
/* Each wall of the client app's code door put back as its fault in a copy of api/, in turn: with the fault in place
 * scripts/client-app-test.mjs must exit 1 and fail the check named for it. A fault the test lets through is reported as
 * not proven and the run exits 1. A cut that no longer finds its text is a failed proof too. The repository is never touched.
 *   node scripts/client-app-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });

const CUTS = [
  { name: 'weak-code-accepted', what: 'the server accepts a weak code (isWeakCode in api/_lib/clientCode.js answers no)', file: '_lib/clientCode.js',
    from: 'export function isWeakCode(v) {\n  const c = codeShape(v);', to: 'export function isWeakCode(v) {\n  const c = codeShape(v); if (c) return false;', expect: ['set-weak'] },
  { name: 'code-in-response', what: 'the sign in answer carries portal.code', file: '_routes/app-public.js',
    from: "return res.status(200).json({ ok: true, home: homeOf(lead), portal: hasPortal(lead), planner: hasPlanner(lead) });", to: "return res.status(200).json({ ok: true, home: homeOf(lead), portal: hasPortal(lead), planner: hasPlanner(lead), code: lead.portal?.code });", expect: ['never-send'] },
  { name: 'no-lock-at-5', what: 'five wrong in a row do not lock the code', file: '_lib/clientSession.js',
    from: 'export const SOFT_LOCK_AT = 5;', to: 'export const SOFT_LOCK_AT = 500;', expect: ['soft-lock'] },
  { name: 'no-hard-lock-at-10', what: 'ten wrong in a row do not lock the code until Rob resets it', file: '_lib/clientSession.js',
    from: 'export const HARD_LOCK_AT = 10;', to: 'export const HARD_LOCK_AT = 1000;', expect: ['hard-lock'] },
  { name: 'reset-keeps-devices', what: 'Reset code only unlocks: the code and its version stay, so signed in devices stay in', file: '_routes/client-app.js',
    from: "await col.updateOne({ _id: lead._id }, { $set: { 'portal.code': code, updatedAt: new Date() } });", to: "await col.updateOne({ _id: lead._id }, { $set: { 'portal.code.fails': 0, 'portal.code.locked': false, updatedAt: new Date() } });", expect: ['reset-signout'] },
  { name: 'unknown-phone-differs', what: 'an unknown phone answers 404 instead of the one 401', file: '_routes/app-public.js',
    from: "    if (!lead || !code?.hash) return noMatch(res);", to: "    if (!lead) return notFound(res);\n    if (!code?.hash) return noMatch(res);", expect: ['same-401'] },
  { name: 'cookie-without-version', what: 'the cookie is signed over the lead and the expiry only, not the version', file: '_lib/clientSession.js',
    from: 'const payload = (leadId, version, expiresAt) => `client:${leadId}:${version}:${expiresAt}`;', to: 'const payload = (leadId, version, expiresAt) => `client:${leadId}:${expiresAt}`;', expect: ['cookie-version'] },
  { name: 'token-reads-data', what: 'a setup link alone reads the client (their first name and business)', file: '_routes/app-public.js',
    from: "return res.status(200).json({ step: code?.hash ? 'signin' : 'set', lock: lock ? { hard: lock.hard, minutes: lock.minutes } : null });", to: "return res.status(200).json({ step: code?.hash ? 'signin' : 'set', lock: lock ? { hard: lock.hard, minutes: lock.minutes } : null, firstName: firstNameOf(lead), business: lead.business });", expect: ['token-data'] },
  { name: 'no-ip-limit', what: 'the per IP limiter on the sign in door removed', file: '_routes/app-public.js',
    from: "    if (await limited(db, req, res, 'appsign')) return undefined;\n", to: '\n', expect: ['ip-limit'] },
  { name: 'no-dummy-scrypt', what: 'no lead means no scrypt, so a miss answers faster than a wrong code', file: '_lib/clientSession.js',
    from: "export function codeMatches(stored, given) {\n", to: "export function codeMatches(stored, given) {\n  if (!stored?.hash) return false;\n", expect: ['same-work'] },
  { name: 'right-code-keeps-fails', what: 'a right code does not clear the count of wrong ones', file: '_routes/app-public.js',
    from: "{ $set: { 'portal.code.fails': 0, 'portal.code.lockedUntil': ''", to: "{ $set: { 'portal.code.lockedUntil': ''", expect: ['fails-clear'] },
  { name: 'crm-reads-hash', what: 'the CRM list read returns portal.code whole, hash and salt', file: '_lib/clientSession.js',
    from: "export function withoutCode(lead) {\n", to: "export function withoutCode(lead) {\n  return lead;\n", expect: ['crm-read', 'backup'] },
  { name: 'crm-drops-code', what: 'a portal save from the CRM drops the code (the carry forward removed)', file: '_routes/call-leads.js',
    from: "        ...(had.code && typeof had.code === 'object' ? { code: had.code } : {}),", to: '', expect: ['crm-carry'] },
];

let unproven = 0;
for (const c of CUTS) {
  const dir = fs.mkdtempSync(path.join(tmpBase, 'clientapp-cut-'));
  try {
    fs.cpSync(path.join(repoRoot, 'api'), path.join(dir, 'api'), { recursive: true });
    const p = path.join(dir, 'api', c.file);
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(c.from)) { unproven++; console.log(`FAIL ${c.name}: the cut's text is not in api/${c.file} any more`); continue; }
    fs.writeFileSync(p, src.replace(c.from, c.to));
    const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'client-app-test.mjs')], { env: { ...process.env, API_SRC: path.join(dir, 'api') }, encoding: 'utf8', timeout: 300000 });
    const out = r.stdout || '';
    const failLines = out.split('\n').filter(l => l.startsWith('FAIL '));
    const named = c.expect.every(id => failLines.some(l => l.includes(`[${id}]`)));
    const good = r.status === 1 && named;
    if (!good) unproven++;
    console.log(`${good ? 'ok  ' : 'FAIL'} ${c.name}: ${good ? `${failLines.length} check(s) fail` : `exit ${r.status}, expected ${c.expect.join(' and ')} to fail`}  (${c.what})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
console.log(unproven ? `\n${unproven} cut(s) not proven.` : `\nall ${CUTS.length} cuts are caught.`);
process.exit(unproven ? 1 : 0);
