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
const CA = '_lib/calendly.js';
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
  'pin-gate': [[PM, "card: m.sensitive && !unlocked ? { id: m.id, title: m.title, sensitive: true, locked: true } : cardOf(m, data)", "card: cardOf(m, data)"]],
  'unlock-verify': [[PP, "const unlockOk = (token, v) => { const [exp, sig] = String(v || '').split('.'); if (!exp || !sig || !(Number(exp) > Date.now())) return false; const a = Buffer.from(sig); const b = Buffer.from(hmac(`${token}:${exp}`)); return a.length === b.length && timingSafeEqual(a, b); };", "const unlockOk = (token, v) => { const [exp, sig] = String(v || '').split('.'); return !!(exp && sig && Number(exp) > Date.now()); };"]],
  'unlock-days': [[PP, "const UNLOCK_DAYS = 30;", "const UNLOCK_DAYS = 3;"]],
  'pay-hide': [[PM, "      const hit = oldestOpenInvoice(client, projects);\n      if (!hit) return null;", "      const hit = oldestOpenInvoice(client, projects) || { line: { label: 'Invoice', amount: 0 }, project: {} };"]],
  'pay-methods': [[PM, "  if (cashtag(pm.cashapp)) out.push(", "  if (true) out.push("], [PM, "  if (str(pm.zelle, 120)) out.push(", "  if (true) out.push("]],
  'pay-link-invoice': [[PM, "  if (/^https:\\/\\//i.test(String(payUrl || ''))) out.push(", "  if (false) out.push("]],
  'pay-links': [[PM, "const amt = Math.round(Number(amount) * 100) / 100;", "const amt = 0;"]],
  'pay-oldest': [[PM, "  found.sort((a, b) => (dateOf(a.line.dueAt) || '9999').localeCompare(dateOf(b.line.dueAt) || '9999') || String(a.line.sentAt).localeCompare(String(b.line.sentAt)));\n", ""]],
  'pay-sent-only': [[PM, "    for (const l of openLines(p, now)) if (l.sentAt) found.push({ line: l, project: p });", "    for (const l of openLines(p, now)) found.push({ line: l, project: p });"]],
  'pay-no-retainer': [[PM, "    if (p.kind === 'retainer') continue;\n    for (const l of openLines(p, now))", "    for (const l of openLines(p, now))"]],
  'pay-schedule': [[PM, "      if (project.plan?.months) { const next = planLines(project).find(l => !isPaid(l)); if (next) line = next; }\n", ""]],
  'plan-next': [[PM, "const paid = lines.filter(l => isPaid(l)).length; const next = lines.find(l => !isPaid(l)); if (!next) continue;", "const paid = lines.filter(l => isPaid(l)).length; const next = lines.find(l => !isPaid(l)) || lines[0];"]],
  'retainer-offer': [[PM, "  return retainerOf(web && brand ? 'growth' : web ? 'site-care' : 'content-kit');", "  return retainerOf('site-care');"]],
  'retainer-link-empty': [[PM, "      if (!/^https:\\/\\//i.test(url)) return null;\n", ""]],
  'retainer-active': [[PM, "export const activeRetainer = (client) => { const r = client?.retainer; if (!r || r.status !== 'active') return null;", "export const activeRetainer = (client) => { const r = client?.retainer; if (!r) return null;"]],
  'paid-once': [[PM, "  return latest && latest > since ? latest : '';", "  return latest;"]],
  'progress-line': [[PM, "    case 'design': return \"I'm building your first concepts\";\n", ""], [PM, "    case 'revisions': return `Round ${revisionsUsed(p)} of ${revisionsMax(p)}`;\n", ""]],
  'revisions-stage': [[PM, "      if (!p || p.stage !== 'revisions') return null;", "      if (!p) return null;"]],
  'revisions-last': [[PM, "const last = max > 0 && used === max - 1;", "const last = max > 0 && used === max;"]],
  'client-field': [['_lib/taskRules.js', "      client: !!it?.client, url:", "      client: false, url:"]],
  'needs-client': [[PM, "forEach(it => { if (it && it.client && !it.done) out.push(", "forEach(it => { if (it && !it.done) out.push("]],
  'needs-open': [[PM, "forEach(it => { if (it && it.client && !it.done) out.push(", "forEach(it => { if (it && it.client) out.push("]],
  'needs-order': [[PM, "    id: 'needs_you', title: 'Needs you', order: 10,", "    id: 'needs_you', title: 'Needs you', order: 65,"]],
  'files-gate': [[PM, "        row.items.push(unlocked ? { label: str(d.label, 120), url: /^https?:\\/\\//i.test(String(d.link || '')) ? str(d.link, 400) : '' } : { label: str(d.label, 120) });", "        row.items.push({ label: str(d.label, 120), url: /^https?:\\/\\//i.test(String(d.link || '')) ? str(d.link, 400) : '' });"], [PM, "      const drive = unlocked && /^https?:\\/\\//i.test(String(p.links?.drive || '')) ? str(p.links.drive, 400) : '';", "      const drive = /^https?:\\/\\//i.test(String(p.links?.drive || '')) ? str(p.links.drive, 400) : '';"], [PM, "export const paidInFull = (p, now = Date.now()) => { const lines = invoicesOf(p); if (lines.some(l => !isPaid(l, now))) return false; return lines.length > 0 || !!p?.deliveredAt; };", "export const paidInFull = (p, now = Date.now()) => { const lines = invoicesOf(p); if (lines.some(l => !isPaid(l, now))) return false; return true; };"]],
  'files-unlock': [[PM, "export const paidInFull = (p, now = Date.now()) => { const lines = invoicesOf(p); if (lines.some(l => !isPaid(l, now))) return false; return lines.length > 0 || !!p?.deliveredAt; };", "export const paidInFull = () => false;"]],
  'kit-delivered': [[PM, "      if (!deliveredBrandProject(client, projects)) return null;\n", ""]],
  'kit-colors': [[PM, "      if (!colors.length) return null;\n", ""]],
  'planner-gate': [[PM, "export const plannerLink = (client) => (client?.planner?.enabled && client?.planner?.token ?", "export const plannerLink = (client) => (client?.planner?.token ?"]],
  'planner-counts': [[PM, "  const week = wk ? mine.filter(p => String(p.date || '').slice(0, 10) >= wk.start && String(p.date || '').slice(0, 10) <= wk.end) : [];", "  const week = mine;"]],
  'concepts-newest': [[PM, "  .filter(s => s && String(s.leadId) === String(client?._id) && !s.deleted && !s.archived && s.token && s.status && s.status !== 'draft')", "  .filter(s => s && String(s.leadId) === String(client?._id) && !s.deleted && s.token)"]],
  'concepts-state': [[PM, "export const conceptState = (set) => (set?.approvedDirectionId || set?.status === 'approved' ? 'approved' : set?.status === 'changes' ? 'changes' : 'waiting');", "export const conceptState = () => 'waiting';"]],
  'concepts-order': [[PM, "    const order = Number.isFinite(Number(data._order)) ? Number(data._order) : m.order;", "    const order = m.order;"]],
  'token-isolation': [
    [PP, "db.collection('concept_sets').find({ leadId: String(lead._id), deleted: { $ne: true } })", "db.collection('concept_sets').find({ deleted: { $ne: true } })"],
    [PM, "  .filter(s => s && String(s.leadId) === String(client?._id) && !s.deleted && !s.archived && s.token && s.status && s.status !== 'draft')", "  .filter(s => s && !s.deleted && !s.archived && s.token && s.status && s.status !== 'draft')"],
  ],
  'review-gate': [[PM, "      if (!p || !p.deliveredAt) return null;\n      const url = reviewLink(client);\n      if (!url || hasTestimonial(client)) return null;", "      const url = reviewLink(client) || '/r/none';\n      if (hasTestimonial(client)) return null;"]],
  'review-submitted': [[PM, "      if (!url || hasTestimonial(client)) return null;", "      if (!url) return null;"]],
  'reviews-diff': [[PM, "  return `${latest} review${latest === 1 ? '' : 's'}${diff > 0 ? `, up ${diff} since we started` : ''}`;", "  return `${latest} review${latest === 1 ? '' : 's'}`;"]],
  'reviews-gate': [[PM, "      if (!r.nfcCard && !googleLink) return null;\n", ""]],
  'cal-token': [[CA, "  if (!calendlyToken()) return null;\n  const key = rateKey('pcal', String(leadId));", "  const key = rateKey('pcal', String(leadId));"], [CA, "  if (!token || !mail) return null;", "  if (!mail) return null;"]],
  'cal-match': [[CA, "      if (invitees.some(inv => String(inv?.email || '').trim().toLowerCase() === mail)) return shape(ev);", "      if (invitees.length) return shape(ev);"]],
  'cal-cache': [[CA, "  if (doc && Number.isFinite(Number(doc.at)) && Date.now() - Number(doc.at) < MEETING_CACHE_MS) return doc.data || null;\n", ""]],
  'cal-ttl': [[CA, "export const MEETING_CACHE_MS = 15 * 60e3;", "export const MEETING_CACHE_MS = 15 * 60e9;"]],
  'cal-soonest': [[CA, "    const sorted = [...collection].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));", "    const sorted = [...collection];"]],
  'cal-past': [[PM, "      if (!m || !m.at || Date.parse(m.at) < Date.now() - 60 * 60e3) return null;", "      if (!m || !m.at) return null;"]],
  'approvals-pending': [[PM, "    resolve(client) { const items = approvalsOf(client); return items.some(a => a.status === 'pending') ? { items } : null; },", "    resolve(client) { const items = approvalsOf(client); return items.length ? { items } : null; },"]],
  'approvals-shape': [[CL, "status: ['pending', 'approved', 'changes'].includes(a?.status) ? a.status : 'pending', note: str(a?.note, 400),", "status: str(a?.status, 20) || 'pending', note: str(a?.note, 400),"]],
  'approvals-days': [[PM, "export const APPROVAL_DAYS = 7;", "export const APPROVAL_DAYS = 7000;"]],
  'approve-write': [[PP, "  const next = { ...item, status: decision, note: decision === 'changes' ? note : '', respondedAt: now };", "  const next = { ...item, status: decision, note: decision === 'changes' ? String(b.note || '') : '', respondedAt: now };"]],
  'approve-task': [[PP, "  const lists = addTask(Array.isArray(lead.checklists) ? lead.checklists : [], (lead.checklists || []).find(l => l.name === 'Portal')?.id || '', { text, due: new Date(due).toISOString(), source: 'manual', listName: 'Portal' });", "  const lists = Array.isArray(lead.checklists) ? lead.checklists : []; void addTask; void text; void due;"]],
  'approve-pending': [[PP, "  if (item.status !== 'pending') return res.status(409).json({ error: 'already answered' });\n", ""]],
  'approve-note': [[PP, "  if (decision === 'changes' && !note) return res.status(400).json({ error: 'say what to change' });\n", ""]],
  'approve-own': [[PP, "const findApproval = (lead, id) => (Array.isArray(lead.portal?.approvals) ? lead.portal.approvals : []).find(a => a && a.id === id) || null;", "const findApproval = (lead, id) => ({ id, label: 'Their hero', status: 'pending' });"]],
  'approve-limit': [[PP, "const APPROVE_MAX = 20;", "const APPROVE_MAX = 200;"]],
  'back-no-token': [[PM, "export const plannerLink = (client) => (client?.planner?.enabled && client?.planner?.token ? `/planner/${client.planner.token}${fromPortal()}` : '');", "export const plannerLink = (client) => (client?.planner?.enabled && client?.planner?.token ? `/planner/${client.planner.token}?from=portal&c=${client.portal?.token || ''}` : '');"]],
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
