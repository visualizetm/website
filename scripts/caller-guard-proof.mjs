#!/usr/bin/env node
/* Proof that each caller wall is what stops the bad request (Billy's Call Room; docs/SECURITY-AUDIT.md, "The caller").
 * For every wall: copy api/ and public/sw.js to a temp tree, cut that one wall out of the real source (or put its fault
 * back), run the same checks (scripts/caller-lib.mjs) and require that the wall's own checks FAIL. A cut that finds
 * nothing to replace is itself a failure, so a renamed guard cannot make this pass quietly.
 *   node scripts/caller-guard-proof.mjs            every wall
 *   GUARD_ONLY=whitelist,role node scripts/caller-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { runCaller, repoRoot } from './caller-lib.mjs';

const RT = '_routes/caller.js';
const AUTH = '_lib/auth.js';
const TEAM = '_lib/team.js';
const VIEW = '_lib/callerView.js';
const LISTS = '_lib/lists.js';
const SW = 'sw.js';
/* wall id (the check's `guard`) -> what to cut: [file, exact source, replacement] */
const CUTS = {
  'passcode-hash': [[TEAM, "return { passHash: scrypt(passcode, salt), passSalt: salt };", "return { passHash: normPasscode(passcode) + '.'.repeat(80), passSalt: salt };"]],
  'no-store': [[RT, "res.setHeader('Cache-Control', 'no-store');", ""]],
  'login-body': [[RT, "const body = req.body && typeof req.body === 'object' ? req.body : {};", "const body = { ...(req.query || {}), ...(req.body && typeof req.body === 'object' ? req.body : {}) };"]],
  'login-limiter': [[RT, "if (limit.exceeded) { res.setHeader('Retry-After', String(limit.retryAfter)); return res.status(429).json({ error: 'Too many tries. Wait a few minutes, or text Rob.' }); }", ""]],
  'cookie-payload': [[AUTH, "const callerPayload = (version, expiresAt) => `caller:${version}:${expiresAt}`;", "const callerPayload = (version, expiresAt) => String(expiresAt);"]],
  role: [['admin/index.js', "'caller': route(caller, { role: 'caller', methods: ['GET', 'POST'], maxBody: 64 * 1024 }),", "'caller': route(caller, { role: 'public', methods: ['GET', 'POST'], maxBody: 64 * 1024 }),"]],
  'admin-refuses-caller': [
    ['_lib/handler.js', "import { requireAdmin, requireCaller } from './auth.js';", "import { requireAdmin, requireCaller, verifyCaller } from './auth.js';"],
    ['_lib/handler.js', "else if (role !== 'public' && !requireAdmin(req, res)) return undefined;", "else if (role !== 'public' && !verifyCaller(req) && !requireAdmin(req, res)) return undefined;"],
  ],
  'version-kill': [[AUTH, "if (doc && doc.canSignIn !== false && versionOf(doc.version) === version) {", "if (doc && doc.canSignIn !== false) {"]],
  'can-sign-in': [
    [AUTH, "if (doc && doc.canSignIn !== false && versionOf(doc.version) === version) {", "if (doc && versionOf(doc.version) === version) {"],
    [RT, "const ok = !!doc && doc.canSignIn !== false && !!email", "const ok = !!doc && !!email"],
  ],
  'team-secrets': [[TEAM, "  return {\n    id: BILLY,\n    exists: !!doc,", "  return {\n    ...d,\n    id: BILLY,\n    exists: !!doc,"]],
  'backup-out': [['_routes/backup.js', "'settings', 'stripe_events'];", "'settings', 'stripe_events', 'team', 'team_activity'];"]],
  'read-line': [[RT, ".toArray()).filter(callerMay);", ".toArray());"]],
  whitelist: [[VIEW, "    id: String(l._id),\n    business: str(l.business, 200),", "    ...l,\n    id: String(l._id),\n    business: str(l.business, 200),"]],
  'log-notes': [[VIEW, "...(whoOf(e) === 'billy' ? { note: str(e?.note, 1000) } : {}) }))", "note: str(e?.note, 1000) }))"]],
  'booked-word': [[VIEW, "export const callerBooked = (lead) => ({ business:", "export const callerBooked = (lead) => ({ ...lead, business:"]],
  'write-line': [[RT, "return callerMay(lead) ? lead : null;", "return lead || null;"]],
  'write-whitelist': [[RT, "    const set = {};\n    if (typeof b.phone === 'string') set.phone = str(b.phone, 40);", "    const set = { ...b };\n    delete set.leadId;\n    if (typeof b.phone === 'string') set.phone = str(b.phone, 40);"]],
  stamp: [[RT, "const one = { ...set, callerStamp: stamp, updatedAt: new Date(now) };", "const one = { ...set, updatedAt: new Date(now) };"]],
  'stamp-log': [[RT, "meeting: '', email: '', by: BILLY };", "meeting: '', email: '' };"]],
  activity: [[TEAM, "  await col.insertOne(row);", ""]],
  'outcome-parity': [[RT, "if (outcome === 'wrong-number') set.phoneNote = `Wrong number (${fmtDate(at)})`;", ""]],
  'callback-past': [[RT, "if (!Number.isFinite(picked) || picked <= now) return res.status(400)", "if (!Number.isFinite(picked)) return res.status(400)"]],
  'outcome-rob-list': [[RT, "if (lead.listId) { const on = await openHandList(db, lead.listId); if (on && callerIdOf(on) === 'rob') return res.status(403).json({ error: 'That one is on a list Rob calls. Move it to one of yours first.' }); }", ""]],
  'rob-list-confirm': [[RT, "if (req.body?.confirm !== true) return {", "if (false) return {"]],
  'rob-list-switch': [[RT, "if (req.caller.moveOffRobLists === false) return {", "if (false) return {"]],
  'lists-together': [[LISTS, "  await takeOffLists(db, landed, list._id);", ""]],
  'system-list': [[LISTS, "return list && list.status === 'open' && !list.system ? list : null;", "return list && list.status === 'open' ? list : null;"]],
  'rename-own': [[RT, "if (list.createdBy !== BILLY) return res.status(403).json({ error: 'Rob made that list. Ask him to rename it.' });", ""]],
  'no-destructive': [[RT, "return res.status(200).json({ ok: true, declined: ids.length });", "await db.collection('call_leads').deleteMany({ _id: { $in: leads.map(l => l._id) } }); return res.status(200).json({ ok: true, declined: ids.length });"]],
  'no-send': [[RT, "import { sendPush } from '../_lib/notify.js';", "import { sendPush, sendEmail } from '../_lib/notify.js';"]],
  'sw-no-cache': [[SW, "  if (url.pathname.startsWith('/api/caller/')) return;\n", ""]],
};

/* A cut copy is expected to throw in places; its stack traces are noise here. */
console.error = () => {};
const only = (process.env.GUARD_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const base = await runCaller();
let bad = 0;
if (base.some(r => !r.pass)) { console.log('FAIL the unmodified code does not pass its own checks:', base.filter(r => !r.pass).map(r => r.id).join(', ')); process.exit(1); }
const guards = [...new Set(base.map(r => r.guard).filter(Boolean))];
for (const g of guards) if (!CUTS[g]) { console.log(`FAIL wall "${g}" has no cut defined`); bad++; }
let proven = 0;
for (const [g, cuts] of Object.entries(CUTS)) {
  if (only.length && !only.includes(g)) continue;
  if (!guards.includes(g)) { console.log(`FAIL cut "${g}" has no check`); bad++; continue; }
  const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'callerproof-'));
  const apiCopy = path.join(tmp, 'api'); const swCopy = path.join(tmp, SW);
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'public', 'sw.js'), swCopy);
  let cutOk = true;
  for (const [file, from, to] of cuts) {
    const f = file === SW ? swCopy : path.join(apiCopy, file); const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(from)) { console.log(`FAIL ${g}: the wall's source was not found in ${file}`); cutOk = false; bad++; break; }
    fs.writeFileSync(f, src.replace(from, to));
  }
  if (!cutOk) { fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  let res = [];
  try { res = await runCaller({ api: apiCopy, sw: swCopy }); } catch (e) { res = base.map(r => ({ ...r, pass: false, desc: `${r.desc} (the cut copy threw: ${String(e?.message || e).slice(0, 80)})` })); }
  const mine = res.filter(r => r.guard === g);
  const failed = mine.filter(r => !r.pass);
  const collateral = res.filter(r => !r.pass && r.guard !== g);
  const good = failed.length === mine.length && mine.length > 0;
  console.log(`${good ? 'ok   ' : 'FAIL '}${g.padEnd(22)} ${mine.length} check${mine.length > 1 ? 's' : ''}, "${mine[0]?.desc.slice(0, 64)}" ${good ? 'fails with the wall cut' : `STILL PASSES without the wall (${mine.length - failed.length} of ${mine.length})`}${collateral.length ? ` (also failing: ${collateral.length})` : ''}`);
  if (good) proven++; else bad++;
  fs.rmSync(tmp, { recursive: true, force: true });
}
const total = only.length ? only.length : Object.keys(CUTS).length;
console.log(bad ? `\n${bad} wall proof(s) failed (${proven} of ${total} proven).` : `\nEvery wall's check fails when the wall is cut (${proven} of ${total}).`);
process.exit(bad ? 1 : 0);
