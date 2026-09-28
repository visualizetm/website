#!/usr/bin/env node
/* CRM revamp, step 5: every project's schedule[] becomes invoices[]
 * (api/_lib/invoices.js). Reports what it would change before it changes
 * anything; writes only with --apply; renames nothing and drops nothing
 * (schedule[] stays on the document, the app reads invoices[] first).
 *
 *   MONGODB_URI=... node scripts/migrate-invoices.mjs            report only
 *   MONGODB_URI=... node scripts/migrate-invoices.mjs --apply    write invoices[]
 *   node scripts/migrate-invoices.mjs --file dump.json [--apply]  the same on an export
 *        ({ projects: [...] }; --apply writes dump.invoices.json)
 *
 * The mapping, one line at a time (legacyToInvoice):
 *   - status paid, or a ledgerId, becomes paid (the ledgerId is kept)
 *   - everything else (upcoming, due, past-due) becomes sent with the old dueAt
 *   - label, amount, paidAt and extra carry over; sentAt and note start empty
 * A project that already carries invoices[] is left alone, so the script is
 * safe to run twice. */
import fs from 'node:fs';
import { legacyToInvoice } from '../api/_lib/invoices.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : '';

/** The plan: which projects get invoices[], and what. Pure, so the test can run it. */
export function plan(projects) {
  const out = []; const skipped = [];
  for (const p of projects || []) {
    if (Array.isArray(p.invoices)) { skipped.push({ id: String(p._id), name: p.name || '', why: 'already has invoices' }); continue; }
    if (!Array.isArray(p.schedule) || !p.schedule.length) { skipped.push({ id: String(p._id), name: p.name || '', why: 'no schedule' }); continue; }
    const invoices = p.schedule.map(legacyToInvoice);
    out.push({ id: String(p._id), name: p.name || '', invoices, paid: invoices.filter(i => i.status === 'paid').length, sent: invoices.filter(i => i.status === 'sent').length });
  }
  return { projects: out, skipped };
}

function report(p) {
  console.log(`${p.projects.length} project(s) to migrate, ${p.skipped.length} left alone.`);
  for (const x of p.projects) console.log(`  ${x.name || x.id}: ${x.invoices.length} line(s), ${x.paid} paid, ${x.sent} sent`);
  for (const x of p.skipped.slice(0, 20)) console.log(`  skip ${x.name || x.id}: ${x.why}`);
  if (p.skipped.length > 20) console.log(`  ... and ${p.skipped.length - 20} more left alone`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (fileArg) {
    const dump = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
    const p = plan(dump.projects || []);
    report(p);
    if (APPLY) { const out = fileArg.replace(/\.json$/i, '') + '.invoices.json'; fs.writeFileSync(out, JSON.stringify(p, null, 2)); console.log(`Wrote ${out}.`); }
  } else {
    if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI, or pass --file dump.json.'); process.exit(1); }
    const { MongoClient } = await import('mongodb');
    const client = await new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 }).connect();
    try {
      const db = client.db(client.options?.dbName || 'visualize');
      const col = db.collection('projects');
      const projects = await col.find({}).project({ name: 1, schedule: 1, invoices: 1 }).toArray();
      const p = plan(projects);
      report(p);
      if (APPLY) {
        const now = new Date();
        for (const x of p.projects) await col.updateOne({ _id: projects.find(q => String(q._id) === x.id)._id }, { $set: { invoices: x.invoices, updatedAt: now } });
        console.log(`Applied: ${p.projects.length} project(s) now carry invoices[].`);
      } else console.log('Report only. Run with --apply to write.');
    } finally { await client.close(); }
  }
}
