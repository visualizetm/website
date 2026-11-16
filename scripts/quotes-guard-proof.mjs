#!/usr/bin/env node
/* The Quotes page guards, each put back as its fault in a copy of api/ and src/: scripts/quotes-test.mjs must fail on the copy.
 * A cut that leaves the test passing means the check does not watch the fault it exists for. The line rules are one file in two
 * places (src/shared/quoteLines.js and api/_lib/quoteLines.js), so a cut to them is made in both; cutting one alone is its own cut.
 *   node scripts/quotes-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, '..');
const BOTH = ['src/shared/quoteLines.js', 'api/_lib/quoteLines.js'];
const CUTS = [
  { name: 'the route keeps a line whose list price is not the price list\'s', files: BOTH, from: "  if (!e || Number(l.listUnit) !== e.price) return null;", to: "  if (!e) return null;" },
  { name: 'a second copy of a line is kept', files: BOTH, from: "    if (!l || seen.has(lineKey(l))) { refused += 1; continue; }", to: "    if (!l) { refused += 1; continue; }" },
  { name: 'a supplier link skips safeUrl', files: BOTH, from: "    const url = typeof safeUrl === 'function' ? safeUrl(l.supplierUrl, 400) : '';\n    if (url) out.supplierUrl = url;\n    const note", to: "    const url = String(l.supplierUrl || '');\n    if (url) out.supplierUrl = url;\n    const note" },
  { name: 'the mirror drifts (a rule changed in src only)', files: ['src/shared/quoteLines.js'], from: "export const VALID_DAYS = 30;", to: "export const VALID_DAYS = 31;" },
  { name: 'a refused line saves the rest of the quote', files: ['api/_routes/quotes.js'], from: "    const { set, refused } = sanitize(body);\n    if (refused) return res.status(400).json({ error: REFUSED });", to: "    const { set } = sanitize(body);" },
  { name: 'the number is writable', files: ['api/_routes/quotes.js'], from: "      emailLogId: b.emailLogId !== undefined ? hex(b.emailLogId) : undefined,", to: "      emailLogId: b.emailLogId !== undefined ? hex(b.emailLogId) : undefined,\n      number: b.number !== undefined ? str(b.number, 20) : undefined," },
  { name: 'a test send makes a quote sent', files: ['api/_routes/quotes.js'], from: "status: 'sent' }).project({ status: 1, sentAt: 1 })", to: "status: { $in: ['sent', 'test'] } }).project({ status: 1, sentAt: 1 })" },
  { name: 'the lead filter takes an operator', files: ['api/_routes/quotes.js'], from: "filter.leadId = hex(req.query.leadId) || 'none';", to: "filter.leadId = req.query.leadId;" },
  { name: 'deal.quote drops a line\'s kind and quantity', files: ['api/_routes/call-leads.js'], from: "          ...(QUOTE_LINE_KINDS.includes(l?.kind) ? { kind: l.kind } : {}),\n          ...(l?.qty !== undefined && Number.isFinite(Number(l.qty)) ? { qty: Math.max(1, Math.min(10000, Math.round(Number(l.qty)))) } : {}),\n", to: "" },
  { name: 'deal.quote keeps a javascript: supplier link', files: ['api/_routes/call-leads.js'], from: "...(l?.kind === 'custom' && link(l.supplierUrl) ? { supplierUrl: link(l.supplierUrl) } : {}),", to: "...(l?.kind === 'custom' && l.supplierUrl ? { supplierUrl: String(l.supplierUrl) } : {})," },
  { name: 'what a client reads carries the cost', files: ['src/lib/quote.js'], from: "  return `${qty > 1 ? `${l.label} x ${qty}` : l.label}: ${l.free ? 'on me' : fmtMoney(lineTotal(l), hasCents)}`;", to: "  return `${qty > 1 ? `${l.label} x ${qty}` : l.label}: ${l.free ? 'on me' : fmtMoney(lineTotal(l), hasCents)}${l.cost !== undefined ? ` (${l.cost})` : ''}`;" },
  { name: 'the email carries the private note', files: ['src/lib/quote.js'], from: "      ...(note ? [{ type: 'text', text: note }] : []),\n      ...(q?.retainerPitch !== false && retainerLine(s.packageId) ? [{ type: 'text', text: retainerLine(s.packageId) }] : []),\n      { type: 'text', text: 'Reply here", to: "      ...(note ? [{ type: 'text', text: note }] : []),\n      { type: 'text', text: String(q?.privateNote || '') },\n      ...(q?.retainerPitch !== false && retainerLine(s.packageId) ? [{ type: 'text', text: retainerLine(s.packageId) }] : []),\n      { type: 'text', text: 'Reply here" },
  { name: 'the invoice names the supplier', files: ['src/lib/quote.js'], from: "label: qtyOf(l) > 1 ? `${l.label} x ${qtyOf(l)}` : l.label, price: lineTotal(l), free: l.free === true }))", to: "label: `${l.label}${l.supplierUrl ? ` ${l.supplierUrl}` : ''}`, price: lineTotal(l), free: l.free === true }))" },
  { name: 'the deposit is not rounded up', files: BOTH, from: "  const deposit = Math.ceil((Math.round(total * 100) * DEPOSIT_PCT) / 10000);", to: "  const deposit = Math.round((Math.round(total * 100) * DEPOSIT_PCT) / 10000);" },
  { name: 'the package check speaks with a package in the quote', files: ['src/lib/quote.js'], from: "  if (ls.some(l => l.kind === 'package')) return null;\n  const pkg = suggestPackageFor(", to: "  const pkg = suggestPackageFor(" },
];

const tmpBase = path.join(repoRoot, '.tmp-verify');
fs.mkdirSync(tmpBase, { recursive: true });
let fails = 0;
for (const cut of CUTS) {
  const root = fs.mkdtempSync(path.join(tmpBase, 'quotes-proof-'));
  for (const d of ['api', 'src']) fs.cpSync(path.join(repoRoot, d), path.join(root, d), { recursive: true });
  let applied = true;
  for (const f of cut.files) {
    const p = path.join(root, f); const text = fs.readFileSync(p, 'utf8');
    if (!text.includes(cut.from)) { applied = false; break; }
    fs.writeFileSync(p, text.replace(cut.from, cut.to));
  }
  let line;
  if (!applied) { fails++; line = `FAIL ${cut.name}: the guard's own line is not in the source any more, so nothing was cut`; }
  else {
    const r = spawnSync(process.execPath, [path.join(here, 'quotes-test.mjs')], { env: { ...process.env, QUOTES_ROOT: root }, encoding: 'utf8' });
    const failed = (r.stdout || '').split('\n').filter(l => l.startsWith('FAIL '));
    if (r.status === 0 || !failed.length) { fails++; line = `FAIL ${cut.name}: quotes-test still passes with the guard cut${r.status !== 0 ? ' (it stopped without a failing check)' : ''}`; }
    else line = `ok   ${cut.name}: ${failed[0].slice(0, 150)}${failed.length > 1 ? ` (+${failed.length - 1})` : ''}`;
  }
  console.log(line);
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(`\nquotes-guard-proof: ${CUTS.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
