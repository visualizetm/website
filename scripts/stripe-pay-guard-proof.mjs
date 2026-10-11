#!/usr/bin/env node
/* Proof that each guard of the per invoice Stripe link and the webhook's match is what makes its check pass: copy api/, cut
 * one guard, run scripts/stripe-pay-lib.mjs and require that guard's own check to FAIL.   node scripts/stripe-pay-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { runStripePay, repoRoot } from './stripe-pay-lib.mjs';

const ST = '_lib/stripe.js';
const SE = '_routes/send-email.js';
const CUTS = {
  'link-made': [[ST, "  if (!price.ok || !price.body?.id) return null;\n", ""], [ST, "  if (!link.ok || !link.body?.url) return null;\n  return { url: String(link.body.url).slice(0, 400), id: String(link.body.id || '').slice(0, 80) };", "  return { url: String(link.body?.url || 'https://buy.stripe.com/none').slice(0, 400), id: String(link.body?.id || '').slice(0, 80) };"]],
  'link-metadata': [[ST, "metadata: { invoiceId: String(invoiceId).slice(0, 40), leadId: String(leadId || '').slice(0, 40), projectId: String(projectId || '').slice(0, 40) }", "metadata: {}"]],
  'link-keep': [[ST, "  if (!invoice || invoice.payUrl) return invoice;", "  if (!invoice) return invoice;"]],
  'link-stored': [[SE, "      invoice = await attachPaymentLink(invoice, { leadId: String(lead._id), projectId: project ? String(project._id) : '' });\n", ""]],
  'link-match': [[ST, "  if (row.paymentLinkId) for (const p of mine) { const item = invoicesOf(p).find(s => open(s) && s.paymentLinkId === row.paymentLinkId); if (item) { pick = { p, item }; break; } }\n", ""]],
  'amount-match': [[ST, "  if (!pick) for (const p of mine) { const item = invoicesOf(p).find(s => open(s) && Math.abs(Number(s.amount) - row.amount) < 0.01 && String(s.dueAt) <= today); if (item) { pick = { p, item }; break; } }\n", ""]],
  'fallback-oldest': [[ST, "    if (sent[0]) pick = { ...sent[0], mismatch: `Paid $${row.amount} against $${Number(sent[0].item.amount) || 0} (${row.id})` };", "    if (sent[0] && false) pick = { ...sent[0], mismatch: `Paid $${row.amount} against $${Number(sent[0].item.amount) || 0} (${row.id})` };"]],
  'mismatch-note': [[ST, "...(mismatch ? { stripeMismatch: mismatch } : {})", "...({})"]],
};
const base = await runStripePay();
const baseFails = base.filter(r => !r.ok);
if (baseFails.length) { console.log('The real source must pass first:'); baseFails.forEach(r => console.log('  FAIL ' + r.msg)); process.exit(1); }
const guards = [...new Set(base.map(r => r.guard).filter(Boolean))];
const missing = guards.filter(g => !CUTS[g]);
if (missing.length) { console.log(`No cut defined for: ${missing.join(', ')}`); process.exit(1); }
let bad = 0;
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
for (const guard of guards) {
  const apiCopy = path.join(fs.mkdtempSync(path.join(tmpBase, 'stripe-cut-')), 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiCopy, { recursive: true });
  let cutOk = true;
  for (const [file, from, to] of CUTS[guard]) {
    const p = path.join(apiCopy, file); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) { console.log(`FAIL ${guard}: the cut found nothing to remove in ${file}`); cutOk = false; bad++; break; }
    fs.writeFileSync(p, src.replace(from, to));
  }
  if (!cutOk) continue;
  let res;
  try { res = await runStripePay(apiCopy); } catch (e) { console.log(`ok   ${guard}: the cut throws (${String(e?.message || e).slice(0, 60)}), the check cannot pass`); fs.rmSync(path.dirname(apiCopy), { recursive: true, force: true }); continue; }
  const own = res.filter(r => r.guard === guard);
  const failed = own.filter(r => !r.ok);
  if (failed.length) console.log(`ok   ${guard}: without the guard, ${failed.length} of ${own.length} check(s) fail (${failed[0].msg.slice(0, 70)})`);
  else { console.log(`FAIL ${guard}: every check still passes with the guard cut out`); bad++; }
  fs.rmSync(path.dirname(apiCopy), { recursive: true, force: true });
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${guards.length} cut in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
