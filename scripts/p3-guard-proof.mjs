/* Prompt 3 of 3: each guard put back as its fault in a copy of src, the test that guards it must fail.
 *   1. An email task row posting send: true (a line in NextUpHome): tasks-test's no send scan (TASKS_SRC).
 *   2. Copy for Claude carrying a block id (docMarkdown writes the id): docs-read-test (DOCS_SRC).
 *   3. Mark paid writing a field the Stripe webhook does not (the ledger entry gains paidVia): invoices-test section 2 (INV_SRC).
 *   4. Home's Outstanding opening the Clients dashboard (homeKpis points it at /overview): invoices-test section 5 (INV_SRC).
 *   5. A send put into the link buttons (a fetch to email/send in LinkSend): links-test (LINKS_SRC, which reads src and api from the copy).
 * Run: node scripts/p3-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const CUTS = [
  { name: 'an email task row posts send: true', file: 'components/NextUpHome.jsx', from: 'export default function NextUpHome', to: "const __fault = () => fetch('/api/admin/email/log', { method: 'POST', body: JSON.stringify({ send: true }) });\nexport default function NextUpHome", test: 'tasks-test.mjs', env: 'TASKS_SRC' },
  { name: 'Copy for Claude carries a block id', file: 'shared/docBlocks.js', from: "    n = b.type === 'ol' ? n + 1 : 0;\n    const t = mdRuns(b.runs).trim();", to: "    n = b.type === 'ol' ? n + 1 : 0;\n    const t = `${mdRuns(b.runs).trim()} <!-- ${b.id} -->`;", test: 'docs-read-test.mjs', env: 'DOCS_SRC' },
  { name: 'Mark paid writes a field the webhook does not', file: 'lib/invoiceList.js', from: "source: 'hand', projectId: String(project._id) };", to: "source: 'hand', projectId: String(project._id), paidVia: 'hand' };", test: 'invoices-test.mjs', env: 'INV_SRC' },
  { name: 'Outstanding opens the Clients dashboard', file: 'lib/homeKpis.js', from: "  outstanding: '/invoices?chip=past-due',", to: "  outstanding: '/overview',", test: 'invoices-test.mjs', env: 'INV_SRC' },
];
for (const cut of CUTS) {
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'p3-proof-'));
  const src = path.join(tmp, 'src');
  fs.cpSync(path.join(repoRoot, 'src'), src, { recursive: true });
  const f = path.join(src, cut.file);
  const text = fs.readFileSync(f, 'utf8');
  if (!text.includes(cut.from)) { ok(false, `${cut.name}: the guard line is not where the proof expects (${cut.file})`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  fs.writeFileSync(f, text.replace(cut.from, cut.to));
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', cut.test)], { env: { ...process.env, [cut.env]: src }, encoding: 'utf8' });
  const failed = r.status !== 0 && /FAIL/.test(r.stdout);
  ok(failed, `${cut.name}: ${cut.test} must fail with the fault put back (exit ${r.status})`);
  if (failed) console.log(`ok   ${cut.name}: ${(r.stdout.match(/FAIL[^\n]*/) || [''])[0].slice(0, 130)}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}
/* The links fault needs the whole repository shape (src and api), so the copy is made of both. */
{
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'p3-proof-'));
  fs.cpSync(path.join(repoRoot, 'src'), path.join(tmp, 'src'), { recursive: true }); fs.cpSync(path.join(repoRoot, 'api'), path.join(tmp, 'api'), { recursive: true });
  const f = path.join(tmp, 'src', 'components', 'LinkSend.jsx');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("onSent?.('share');", "onSent?.('share'); fetch('/api/admin/email/send', { method: 'POST', body: JSON.stringify({ send: true }) });"));
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'links-test.mjs')], { env: { ...process.env, LINKS_SRC: tmp }, encoding: 'utf8' });
  const failed = r.status !== 0 && /FAIL/.test(r.stdout);
  ok(failed, `a send put into the link buttons: links-test must fail (exit ${r.status})`);
  if (failed) console.log(`ok   a send put into the link buttons: ${(r.stdout.match(/FAIL[^\n]*/) || [''])[0].slice(0, 130)}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\np3-guard-proof: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
