#!/usr/bin/env node
/* Doc templates (src/lib/docTemplates.js): the client fields fill as plain text, an unknown field stays a visible [placeholder], the contract
 * states the house rules from src/shared/pricing.js (so a price changed there changes here), every template is valid under the block schema,
 * none carries an em dash, hidden and ordered templates, a saved template fills the same tokens.   node scripts/docs-templates-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(path.join(repoRoot, '.tmp-verify'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'dtpl-'));
const entry = path.join(tmp, 'entry.js');
fs.writeFileSync(entry, `export * from ${JSON.stringify(path.join(repoRoot, 'src/lib/docTemplates.js'))}; export * as pricing from ${JSON.stringify(path.join(repoRoot, 'src/shared/pricing.js'))}; export { sanitizeBlocks, docPlainText } from ${JSON.stringify(path.join(repoRoot, 'src/shared/docBlocks.js'))};`);
const out = path.join(tmp, 'bundle.mjs');
await build({ entryPoints: [entry], outfile: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' } });
const L = await import(pathToFileURL(out).href);
fs.rmSync(tmp, { recursive: true, force: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const NOW = Date.parse('2026-10-05T15:42:00');
const lead = { _id: 'L1', business: 'Kims Cafe', askFor: 'Damian', links: { website: 'https://kims.example' }, socials: { instagram: 'https://instagram.com/kims' }, deal: { packageId: 'brand-starter', addonIds: [] } };
const proj = { _id: 'P1', leadId: 'L1', name: 'Brand Starter', packageId: 'brand-starter', total: 350, plan: null, revisions: { max: 2, used: 0 }, invoices: [{ id: 'a', label: 'Full payment', amount: 350, dueAt: '2026-10-12', status: 'sent' }] };
const plain = (t, ctx) => { const d = L.buildDoc(L.builtinOf(t), ctx); return { ...d, text: L.docPlainText(d) }; };

ok(L.BUILTIN_TEMPLATES.map(t => t.id).join() === 'blank,brief,call-notes,contract,delivery,brand-notes', 'six built in templates: Blank, Project brief, Call notes, Contract, Delivery notes, Brand notes');
const f = L.clientFields(lead, [proj], NOW);
ok(f['client name'] === 'Kims Cafe' && f['contact person'] === 'Damian' && f['my name'] === 'Rob', 'client name, contact person and Rob\'s name fill');
ok(f.package === 'Brand Starter' && f.price === '$350' && f.deposit === '$175' && f['deposit percent'] === '50 percent', 'package, price and the 50 percent deposit come from the project and pricing.js');
ok(f['project start date'] === 'Oct 12, 2026' && f['revision rounds'] === '2', `project start date and revision rounds fill (${f['project start date']})`);
ok(f.website === 'https://kims.example' && f.instagram.includes('instagram.com/kims'), 'website and Instagram fill from the lead');
const noProj = L.clientFields({ _id: 'L2', business: 'New Co' }, [], NOW);
ok(noProj['client name'] === 'New Co' && !('package' in noProj) && !('price' in noProj) && !('contact person' in noProj), 'a client with no deal and no project answers only what it knows');

const contract = plain('contract', { lead, projects: [proj], now: NOW });
ok(contract.title === 'Agreement, Kims Cafe' && contract.type === 'contract' && contract.projectId === 'P1', 'the contract is titled for the client, typed Contract and tied to their only project');
const ex = L.pricing;
ok(contract.text.includes(`${ex.REVISION_ROUNDS} revision rounds`) && contract.text.includes(`${ex.money(ex.EXTRA_ROUND.design)} for design`) && contract.text.includes(`${ex.money(ex.EXTRA_ROUND.web)} for web`) && contract.text.includes(`${ex.DEPOSIT_PCT} percent deposit of $175`) && (contract.text.match(/Files are released only at full payment\./g) || []).length >= 2,
  'the contract states 2 revision rounds, extra rounds at $50 and $75, the 50 percent deposit and files only at full payment, from pricing.js');
ok(['Scope', 'Price and payment plan', 'Revisions', 'Timeline', 'Files and ownership', 'Agreement'].every(h => contract.blocks.some(b => b.type === 'h2' && b.runs[0].t === h)), 'the contract has its six headings');
const bare = plain('contract', { lead: { _id: 'L2', business: 'New Co' }, projects: [], now: NOW });
ok(['[deposit date]', '[price]', '[payment plan]', '[delivery date]', '[ownership and usage terms]'].every(x => bare.text.includes(x)) && bare.text.includes('2 revision rounds') && bare.text.includes('$50') && bare.text.includes('$75'), 'what a new client cannot answer stays as a visible [placeholder], the house rules still fill');
ok(L.placeholdersIn(bare.blocks).includes('[deposit date]') && !L.placeholdersIn(contract.blocks).includes('[price]'), 'placeholdersIn lists what still needs typing');

const calls = plain('call-notes', { lead, projects: [proj], now: NOW });
ok(calls.text.includes('Date and time: ') && calls.text.includes('On the call: Rob and Damian') && calls.text.includes('[what they need]') && calls.text.includes('[budget]') && calls.text.includes('[next step]') && calls.text.includes('Follow up on [follow up date]'), 'call notes: date and time, who was on, what they need, budget, next step, follow up date');
ok(calls.blocks.find(b => b.runs?.[0]?.t.startsWith('Follow up on'))?.type === 'check', 'the follow up line is a checklist item (the editor puts Make a task on it)');
ok(plain('delivery', { lead, projects: [proj], now: NOW }).text.includes('Balance owed: $350.'), 'delivery notes carry the balance owed');
ok(plain('brand-notes', { lead, projects: [], now: NOW }).text.includes('Website: https://kims.example'), 'brand notes carry the links');
ok(L.buildDoc(L.builtinOf('blank'), { lead }).blocks.length === 0 && L.buildDoc(L.builtinOf('blank'), { lead }).type === 'general', 'Blank is empty and General');

for (const t of L.BUILTIN_TEMPLATES) {
  const d = L.buildDoc(t, { lead: { _id: 'L2', business: 'New Co' }, projects: [], now: NOW });
  const clean = L.sanitizeBlocks(d.blocks);
  ok(JSON.stringify(clean) === JSON.stringify(d.blocks), `${t.label}: every block is valid under the block schema`);
  ok(!/—/.test(JSON.stringify(t.build()) + t.title + t.blurb), `${t.label}: no em dash`);
}
ok(!/\bwe\b|\bour\b/i.test(L.BUILTIN_TEMPLATES.map(t => L.docPlainText({ blocks: t.build() })).join(' ')), 'the wording is first person singular, never "we"');

const saved = [{ _id: 's1', title: 'My intake', type: 'brief', blocks: [{ id: 'a', type: 'p', runs: [{ t: 'Hello [client name], I will send the [deposit date] invoice.' }] }] }];
const sd = L.buildDoc(saved[0], { lead, projects: [proj], now: NOW });
ok(sd.blocks[0].runs[0].t === 'Hello Kims Cafe, I will send the [deposit date] invoice.' && sd.title === 'My intake', 'a saved template fills the known tokens and leaves its own');

ok(L.offered(saved, {}).map(t => t.key).join() === 'blank,brief,call-notes,contract,delivery,brand-notes,s1', 'the sheet offers the built in ones and the saved, in order');
ok(!L.offered(saved, { hidden: ['contract', 'blank'] }).some(t => t.key === 'contract') && L.offered(saved, { hidden: ['blank'] })[0].key === 'blank', 'a hidden built in one is out of the sheet; Blank cannot be hidden');
ok(L.offered(saved, { order: ['s1', 'contract'] }).map(t => t.key).slice(0, 3).join() === 's1,contract,blank', 'order puts the named ones first');
ok(L.managed(saved, { hidden: ['brief'] }).find(t => t.key === 'brief').hidden === true && !L.managed(saved, {}).some(t => t.key === 'blank'), 'Settings lists the hidden ones too, marked, and never Blank');

console.log(fails ? `\n${fails} failing.` : '\nAll template checks pass.');
process.exit(fails ? 1 : 0);
