#!/usr/bin/env node
/* Proof that each review links guard is what stops the bad request (review links job). For every guard: copy api/
 * to a temp tree, cut that one guard out of the real source, run the same checks (scripts/review-lib.mjs) and
 * require that the guard's own check FAILS. A cut that finds nothing to remove is itself a failure, so a renamed
 * guard cannot make this pass quietly.   node scripts/review-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { runReview, repoRoot } from './review-lib.mjs';

const CL = '_routes/call-leads.js';
const RP = '_routes/review-public.js';
const SC = 'showcase.js';
const RL = '_lib/reviewPublic.js';
const TR = '_lib/taskRules.js';
/* guard id (the check's `guard`) -> what to cut: [file, exact source, replacement] */
const CUTS = {
  mint: [[CL, "token: mint ? randomBytes(18).toString('base64url') : had.token,", "token: mint ? randomBytes(6).toString('base64url') : had.token,"]],
  'carry-forward': [
    [CL, "visualize: b.reviews.visualize && typeof b.reviews.visualize === 'object' ? { regenerate: b.reviews.visualize.regenerate === true, sentAt: str(b.reviews.visualize.sentAt, 40) } : undefined,", "visualize: b.reviews.visualize && typeof b.reviews.visualize === 'object' ? { ...b.reviews.visualize, regenerate: b.reviews.visualize.regenerate === true, sentAt: str(b.reviews.visualize.sentAt, 40) } : undefined,"],
    [CL, "views: Number(had?.views) || 0,", "views: Number(asked?.views ?? had?.views) || 0,"],
  ],
  regenerate: [[CL, "const mint = !!asked?.regenerate || !had?.token;", "const mint = !had?.token;"]],
  'token-dead': [[CL, "const mint = !!asked?.regenerate || !had?.token;", "const mint = !had?.token;"]],
  'token-required': [[RP, "  if (!token) return null;\n  return db.collection('call_leads').findOne({ 'reviews.visualize.token': token, deleted: { $ne: true } }, { projection: PROJECTION });", "  if (!token) return db.collection('call_leads').findOne({ 'reviews.visualize.token': { $exists: true }, deleted: { $ne: true } }, { projection: PROJECTION });\n  return db.collection('call_leads').findOne({ 'reviews.visualize.token': token, deleted: { $ne: true } }, { projection: PROJECTION });"]],
  'get-whitelist': [
    [RP, "const PROJECTION = { business: 1,", "const PROJECTION = { phone: 1, business: 1,"],
    [RP, "    googleReviewUrl: typeof profile?.googleReviewUrl === 'string' ? profile.googleReviewUrl : '',\n  };", "    googleReviewUrl: typeof profile?.googleReviewUrl === 'string' ? profile.googleReviewUrl : '',\n    phone: lead.phone || '',\n  };"],
  ],
  'view-count': [[RP, "'reviews.visualize.views': (Number(v.views) || 0) + 1,", "'reviews.visualize.views': Number(v.views) || 0,"]],
  'view-debounce': [[RP, "    if (!st.exceeded) {", "    if (true) { // cut"]],
  'rating-range': [[RP, "  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1 to 5' });\n", ""]],
  'text-min': [[RP, "  if (text.length < TEXT_MIN) return res.status(400).json({ error: `say a little more, ${TEXT_MIN} characters at least` });\n", ""]],
  'consent-bool': [[RP, "  if (typeof b.consent !== 'boolean') return res.status(400).json({ error: 'consent must be true or false' });\n", ""]],
  'name-required': [[RP, "  if (!name) return res.status(400).json({ error: 'name is required' });\n", ""]],
  honeypot: [[RP, "  if (String(b.company || '').trim()) return res.status(200).json({ ok: true });\n", ""]],
  'strip-html': [[RP, "const plain = (v, max) => String(v ?? '').replace(/<\\/?[a-z!][^>]*>/gi, '').replace(/\\s+/g, ' ').trim().slice(0, max);", "const plain = (v, max) => String(v ?? '').trim().slice(0, max);"]],
  task: [[RP, "  const lists = addTask(Array.isArray(lead.checklists) ? lead.checklists : [], (lead.checklists || []).find(l => l.name === 'Reviews')?.id || '', { text: `Review in from ${business}, approve or hide`, due: new Date(due).toISOString(), source: 'manual', listName: 'Reviews' });", "  const lists = Array.isArray(lead.checklists) ? lead.checklists : []; void addTask; void due;"]],
  'rate-10': [[RP, "  if (s10.exceeded || sDay.exceeded) {", "  if (sDay.exceeded) {"]],
  'rate-day': [[RP, "rateState(db, kDay, { max: 5, windowMs: DAY })", "rateState(db, kDay, { max: 50, windowMs: DAY })"]],
  'consent-gate': [[CL, "  const status = statusIn === 'approved' && !consent ? 'pending' : statusIn;", "  const status = statusIn;"]],
  'public-only': [[RL, "(hasStatus(t) ? (t.status === 'approved' && t.consent === true) : t.published === true)", "(hasStatus(t) ? t.status !== 'hidden' : t.published === true)"]],
  'featured-only': [[SC, "      if (!isFeaturedTestimonial(t)) continue;", "      if (!isPublicTestimonial(t)) continue;"]],
  'landing-unpublished': [[SC, "  const rows = await db.collection('call_leads').find({ deleted: { $ne: true } }).toArray();\n  return rows.filter(l => Array.isArray(l.reviews?.testimonials) && l.reviews.testimonials.length);", "  const rows = await db.collection('call_leads').find({ deleted: { $ne: true }, 'showcase.published': true }).toArray();\n  return rows.filter(l => Array.isArray(l.reviews?.testimonials) && l.reviews.testimonials.length);"]],
  'min-ratings': [[RL, "export const MIN_RATINGS_FOR_AVERAGE = 3;", "export const MIN_RATINGS_FOR_AVERAGE = 1;"]],
  'delivery-template': [[TR, "  { id: 'delivery', name: 'Delivery', tasks: [['Share the Drive folder', 0], ['Send the delivery email', 0], ['Send review link', 0], ['Retainer pitch', 3], ['Follow up', 6]] },\n", ""]],
};

const base = await runReview();
const baseFails = base.filter(r => !r.ok);
if (baseFails.length) { console.log('The real source must pass first:'); baseFails.forEach(r => console.log('  FAIL ' + r.msg)); process.exit(1); }
const guards = [...new Set(base.map(r => r.guard).filter(Boolean))];
const missing = guards.filter(g => !CUTS[g]);
if (missing.length) { console.log(`No cut defined for: ${missing.join(', ')}`); process.exit(1); }

let bad = 0;
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
for (const guard of guards) {
  const apiCopy = path.join(fs.mkdtempSync(path.join(tmpBase, 'review-cut-')), 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  let cutOk = true;
  for (const [file, from, to] of CUTS[guard]) {
    const p = path.join(apiCopy, file); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) { console.log(`FAIL ${guard}: the cut found nothing to remove in ${file}`); cutOk = false; bad++; break; }
    fs.writeFileSync(p, src.replace(from, to));
  }
  if (!cutOk) continue;
  let res;
  try { res = await runReview(apiCopy); } catch (e) { console.log(`ok   ${guard}: the cut throws (${String(e?.message || e).slice(0, 60)}), the check cannot pass`); fs.rmSync(path.dirname(apiCopy), { recursive: true, force: true }); continue; }
  const own = res.filter(r => r.guard === guard);
  const failed = own.filter(r => !r.ok);
  if (failed.length) console.log(`ok   ${guard}: without the guard, ${failed.length} of ${own.length} check(s) fail (${failed[0].msg.slice(0, 70)})`);
  else { console.log(`FAIL ${guard}: every check still passes with the guard cut out`); bad++; }
  fs.rmSync(path.dirname(apiCopy), { recursive: true, force: true });
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${guards.length} cut in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
