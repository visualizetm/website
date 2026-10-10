#!/usr/bin/env node
/* Proof that each portal guard is what stops the bad request (client portal, prompt 1). For every guard: copy api/
 * to a temp tree, cut that one guard out of the real source, run the same checks (scripts/portal-lib.mjs) and
 * require that the guard's own check FAILS. A cut that finds nothing to remove is itself a failure.
 *   node scripts/portal-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { runPortal, repoRoot } from './portal-lib.mjs';

const CL = '_routes/call-leads.js';
const PP = '_routes/portal-public.js';
const PM = '_lib/portalModules.js';
const ST = '_routes/settings.js';
const CUTS = {
  mint: [[CL, "token: !mint ? had.token : randomBytes(18).toString('base64url'),", "token: !mint ? had.token : randomBytes(6).toString('base64url'),"]],
  'carry-forward': [
    [CL, "    portal: b.portal && typeof b.portal === 'object' ? {\n      regenerate: b.portal.regenerate === true,", "    portal: b.portal && typeof b.portal === 'object' ? {\n      ...b.portal,\n      regenerate: b.portal.regenerate === true,"],
    [CL, "        views: Number(had.views) || 0,", "        views: Number(asked.views ?? had.views) || 0,"],
  ],
  regenerate: [[CL, "      const mint = asked.regenerate || !had.token;", "      const mint = !had.token;"]],
  'token-dead': [[CL, "      const mint = asked.regenerate || !had.token;", "      const mint = !had.token;"]],
  'token-required': [[PP, "  if (!token) return null;\n  return db.collection('call_leads').findOne({ 'portal.token': token, deleted: { $ne: true } }, { projection: PROJECTION });", "  if (!token) return db.collection('call_leads').findOne({ 'portal.token': { $exists: true }, deleted: { $ne: true } }, { projection: PROJECTION });\n  return db.collection('call_leads').findOne({ 'portal.token': token, deleted: { $ne: true } }, { projection: PROJECTION });"]],
  'deleted-404': [[PP, "findOne({ 'portal.token': token, deleted: { $ne: true } }, { projection: PROJECTION })", "findOne({ 'portal.token': token }, { projection: PROJECTION })"]],
  'get-whitelist': [[PP, "return res.status(200).json({ client: portalClient(lead), cards:", "return res.status(200).json({ client: { ...portalClient(lead), phone: lead.phone || '' }, lead, cards:"], [PP, "const PROJECTION = { business: 1,", "const PROJECTION = { phone: 1, business: 1,"]],
  'card-fields': [[PM, "export const cardOf = (m, data) => { const out = { id: m.id, title: m.title, sensitive: !!m.sensitive }; for (const k of m.fields) if (data && data[k] !== undefined) out[k] = data[k]; return out; };", "export const cardOf = (m, data) => ({ id: m.id, title: m.title, sensitive: !!m.sensitive, ...data });"]],
  'view-count': [[PP, "'portal.views': (Number(lead.portal?.views) || 0) + 1,", "'portal.views': Number(lead.portal?.views) || 0,"]],
  'view-debounce': [[PP, "    if (!st.exceeded) {", "    if (true) { // cut"]],
  'auto-empty': [[PM, "    if (!data) continue;", "    if (!data) data = {};"]],
  'home-status': [[PM, "      return { status: p ? `${str(p.name, 80) || 'Your project'}: ${STAGE_LABELS[p.stage] || 'In progress'}` : 'All set' };", "      return { status: 'All set' };"]],
  'state-off': [[PM, "    if (portalStateOf(client, m.id, m) === 'off') continue;", "    if (portalStateOf(client, m.id, m) === 'never') continue;"]],
  'state-on-empty': [[PM, "    if (!data) continue;", "    if (!data && portalStateOf(client, m.id, m) !== 'on') continue; data = data || {};"]],
  'modules-merge': [[CL, "        modules: { ...(had.modules && typeof had.modules === 'object' ? had.modules : {}), ...(asked.modules || {}) },", "        modules: { ...(asked.modules || {}) },"]],
  'modules-whitelist': [[CL, "Object.entries(b.portal.modules).filter(([k, v]) => PORTAL_MODULE_IDS.includes(k) && k !== 'home' && PORTAL_STATE_IDS.includes(v))", "Object.entries(b.portal.modules)"]],
  template: [[CL, "      if (asked.template && PORTAL_TEMPLATES[asked.template]) allowed.portal.modules = { ...PORTAL_TEMPLATES[asked.template], ...(asked.modules || {}) };\n", ""]],
  documents: [[CL, "      documents: asked.documents !== undefined ? asked.documents : (Array.isArray(had.documents) ? had.documents : []),", "      documents: Array.isArray(had.documents) ? had.documents : [],"]],
  'documents-safe': [[CL, "url: link(d?.url, 600), kind: DOCUMENT_KIND_IDS.includes(d?.kind) ? d.kind : 'link'", "url: str(d?.url, 600), kind: str(d?.kind, 20) || 'link'"]],
  'documents-cap': [[CL, "b.portal.documents.slice(0, 50)", "b.portal.documents.slice(0, 500)"]],
  'pin-hash': [[CL, "(asked.pin ? hashPin(asked.pin) : '')", "(asked.pin ? asked.pin : '')"], [PP, "const a = Buffer.from(/^\\d{4}$/.test(pin) ? hashPin(pin) : 'x');", "const a = Buffer.from(/^\\d{4}$/.test(pin) ? pin : 'x');"]],
  'pin-shape': [[CL, "pin: b.portal.pin !== undefined ? (/^\\d{4}$/.test(String(b.portal.pin)) ? String(b.portal.pin) : '') : undefined,", "pin: b.portal.pin !== undefined ? String(b.portal.pin) : undefined,"]],
  'pin-check': [[PP, "  if (a.length !== want.length || !timingSafeEqual(a, want)) { await rateHit(db, key, st.hits); return res.status(401).json({ error: 'That PIN is not it.' }); }\n", ""]],
  'pin-limit': [[PP, "  if (st.exceeded) { res.setHeader('Retry-After', String(st.retryAfter)); return res.status(429).json({ error: 'That is a few tries. Give it fifteen minutes.' }); }\n", ""]],
  'pin-gate': [[PM, "    if (m.sensitive && !unlocked) { cards.push({ id: m.id, title: m.title, sensitive: true, locked: true }); continue; }\n", ""]],
  'unlock-verify': [[PP, "const unlockOk = (token, v) => { const [exp, sig] = String(v || '').split('.'); if (!exp || !sig || !(Number(exp) > Date.now())) return false; const a = Buffer.from(sig); const b = Buffer.from(hmac(`${token}:${exp}`)); return a.length === b.length && timingSafeEqual(a, b); };", "const unlockOk = (token, v) => { const [exp, sig] = String(v || '').split('.'); return !!(exp && sig && Number(exp) > Date.now()); };"]],
  'unlock-days': [[PP, "const UNLOCK_DAYS = 30;", "const UNLOCK_DAYS = 3;"]],
  'profile-shape': [[ST, "  calendlyLink: safeUrl(d.calendlyLink, 400),", "  calendlyLink: String(d.calendlyLink || ''),"]],
};

const base = await runPortal();
const baseFails = base.filter(r => !r.ok);
if (baseFails.length) { console.log('The real source must pass first:'); baseFails.forEach(r => console.log('  FAIL ' + r.msg)); process.exit(1); }
const guards = [...new Set(base.map(r => r.guard).filter(Boolean))];
const missing = guards.filter(g => !CUTS[g]);
if (missing.length) { console.log(`No cut defined for: ${missing.join(', ')}`); process.exit(1); }

let bad = 0;
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
for (const guard of guards) {
  const apiCopy = path.join(fs.mkdtempSync(path.join(tmpBase, 'portal-cut-')), 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  let cutOk = true;
  for (const [file, from, to] of CUTS[guard]) {
    const p = path.join(apiCopy, file); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) { console.log(`FAIL ${guard}: the cut found nothing to remove in ${file}`); cutOk = false; bad++; break; }
    fs.writeFileSync(p, src.replace(from, to));
  }
  if (!cutOk) continue;
  let res;
  try { res = await runPortal(apiCopy); } catch (e) { console.log(`ok   ${guard}: the cut throws (${String(e?.message || e).slice(0, 60)}), the check cannot pass`); fs.rmSync(path.dirname(apiCopy), { recursive: true, force: true }); continue; }
  const own = res.filter(r => r.guard === guard);
  const failed = own.filter(r => !r.ok);
  if (failed.length) console.log(`ok   ${guard}: without the guard, ${failed.length} of ${own.length} check(s) fail (${failed[0].msg.slice(0, 70)})`);
  else { console.log(`FAIL ${guard}: every check still passes with the guard cut out`); bad++; }
  fs.rmSync(path.dirname(apiCopy), { recursive: true, force: true });
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${guards.length} cut in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
