#!/usr/bin/env node
/* Proof that each client docs guard is what stops the bad request (docs/SECURITY-AUDIT.md, Client docs).
 * For every guard: copy api/ to a temp tree, cut that one guard out of the real source, run the same checks
 * (scripts/docs-lib.mjs) and require that the guard's own check FAILS. A cut that finds nothing to remove is
 * itself a failure, so a renamed guard cannot make this pass quietly.   node scripts/docs-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { runDocs, repoRoot } from './docs-lib.mjs';

const IDX = 'admin/index.js';
const RT = '_routes/docs.js';
const BL = '_lib/docBlocks.js';
/* guard id (the check's `guard`) -> what to cut: [file, exact source, replacement] */
const CUTS = {
  'admin-only': [[IDX, "'docs': route(docs, { methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxBody: 512 * 1024 }),", "'docs': route(docs, { methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxBody: 512 * 1024, admin: false }),"]],
  'list-meta': [[RT, "const META = { blocks: 0 };", "const META = {};"]],
  'lead-exists': [[RT, "if (!lead) return res.status(400).json({ error: 'client not found' });", "if (!lead) { /* cut */ }"], [RT, "leadId = String(lead._id);", "leadId = String(b.leadId);"]],
  'type-whitelist': [[RT, "type: b.type !== undefined ? (DOC_TYPE_IDS.includes(b.type) ? b.type : 'general') : undefined,", "type: b.type !== undefined ? b.type : undefined,"]],
  'block-type': [[BL, "if (!b || typeof b !== 'object' || !BLOCK_TYPES.includes(b.type)) return null;", "if (!b || typeof b !== 'object') return null;"]],
  'text-cap': [[BL, "const t = str(r?.t, left);", "const t = str(r?.t, 1e9);"]],
  'block-cap': [[BL, "for (const raw of list.slice(0, LIMITS.blocks)) {", "for (const raw of list) {"]],
  'link-url': [[BL, "if (!s || /[\\x00-\\x20\\x7f]/.test(s)) return '';\n  return /^https?:\\/\\/[^\\s/?#]+[^\\s]*$/i.test(s) ? s : '';", "return s;"]],
  'image-host': [[BL, "try { return new URL(s).hostname.toLowerCase() === IMAGE_HOST ? s : ''; } catch { return ''; }", "return s;"]],
  'ref-same-client': [[RT, "return fresh.every(r => own.has(`${r.kind}:${r.id}`)) ? null : 'a reference must point at this client\\'s own record';", "return null;"]],
  whitelist: [[RT, "pinned: b.pinned !== undefined ? !!b.pinned : undefined,", "pinned: b.pinned !== undefined ? !!b.pinned : undefined, leadId: b.leadId !== undefined ? str(b.leadId) : undefined, deleted: b.deleted !== undefined ? !!b.deleted : undefined, template: b.template !== undefined ? !!b.template : undefined,"]],
  'project-same-client': [
    [RT, "if (!p) return res.status(400).json({ error: 'project is not this client\\'s' });", ""],
    [RT, "if (!p) return res.status(400).json({ error: 'project is not this client\\'s' });", ""],
  ],
  'deleted-readonly': [
    [RT, "const cur = await col.findOne({ _id, deleted: { $ne: true } });", "const cur = await col.findOne({ _id });"],
    [RT, "await col.updateOne({ _id, deleted: { $ne: true } }, { $set: allowed });", "await col.updateOne({ _id }, { $set: allowed });"],
  ],
  'purge-needs-deleted': [
    [RT, "if (!cur.deleted) return res.status(400).json({ error: 'move it to Recently Deleted first' });", ""],
    [RT, "await col.deleteOne({ _id, deleted: true });", "await col.deleteOne({ _id });"],
  ],
  'doc-cap': [[RT, "if (await col.countDocuments({ leadId, deleted: { $ne: true } }) >= MAX_PER_CLIENT) return res.status(400).json({ error: 'too many docs for this client' });", ""]],
};

const base = await runDocs();
let bad = 0;
if (base.some(r => !r.pass)) { console.log('FAIL the unmodified api does not pass its own checks:', base.filter(r => !r.pass).map(r => r.id).join(', ')); process.exit(1); }
const guards = [...new Set(base.map(r => r.guard).filter(Boolean))];
for (const g of guards) if (!CUTS[g]) { console.log(`FAIL guard "${g}" has no cut defined`); bad++; }
for (const [g, cuts] of Object.entries(CUTS)) {
  if (!guards.includes(g)) { console.log(`FAIL cut "${g}" has no check`); bad++; continue; }
  const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'docsproof-'));
  const apiCopy = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  let cutOk = true;
  for (const [file, from, to] of cuts) {
    const f = path.join(apiCopy, file); const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(from)) { console.log(`FAIL ${g}: the guard source was not found in ${file}`); cutOk = false; bad++; break; }
    fs.writeFileSync(f, src.replace(from, to));
  }
  if (!cutOk) { fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  const res = await runDocs(apiCopy);
  const mine = res.filter(r => r.guard === g);
  const failed = mine.filter(r => !r.pass);
  const collateral = res.filter(r => !r.pass && r.guard !== g && r.id !== 'mirror');
  const good = failed.length === mine.length && mine.length > 0;
  console.log(`${good ? 'ok   ' : 'FAIL '}${g.padEnd(20)} cut ${cuts.length} line${cuts.length > 1 ? 's' : ''}: ${mine.length} check${mine.length > 1 ? 's' : ''}, "${mine[0]?.desc.slice(0, 70)}" ${good ? 'fails with the guard removed' : `STILL PASSES without the guard (${mine.length - failed.length} of ${mine.length})`}${collateral.length ? ` (also failing: ${collateral.map(r => r.id).join(', ')})` : ''}`);
  if (!good) bad++;
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(bad ? `\n${bad} guard proof(s) failed.` : `\nEvery guard check fails when its guard is cut out (${Object.keys(CUTS).length} guards).`);
process.exit(bad ? 1 : 0);
