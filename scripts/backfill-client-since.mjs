#!/usr/bin/env node
/* One-off: stamp clientSince on every live record whose stage is client or
 * won and whose clientSince is empty, with the earliest of its first
 * purchase, first project, or updatedAt (api/_lib/pipeline.js
 * earliestClientSince, the same rule the daily cron applies from now on).
 * Reports what it would change before it changes anything.
 *
 *   MONGODB_URI=... node scripts/backfill-client-since.mjs            report only
 *   MONGODB_URI=... node scripts/backfill-client-since.mjs --apply    write the stamps
 *   node scripts/backfill-client-since.mjs --file dump.json [--projects projects.json] [--apply]
 *                                                                   the same on an export (writes dump.repaired.json)
 *
 * It also prints, for every live record whose stage is not a stage, which
 * client evidence rules would heal it, so the broadened heal can be read
 * before the cron runs it. */
import fs from 'node:fs';
import { STAGE_IDS, CLIENT_EVIDENCE, clientEvidence, earliestClientSince } from '../api/_lib/pipeline.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : '');
const fileArg = arg('--file'); const projectsArg = arg('--projects');
const empty = (v) => !(typeof v === 'string' && v.trim());

export function planFor(leads, projects) {
  const byLead = new Map();
  for (const p of projects) { const k = String(p.leadId); byLead.set(k, [...(byLead.get(k) || []), p]); }
  const live = leads.filter(l => l.deleted !== true);
  const stamps = live.filter(l => (l.stage === 'client' || l.stage === 'won') && empty(l.clientSince))
    .map(l => ({ id: String(l._id), business: l.business, since: earliestClientSince(l, byLead.get(String(l._id)) || []) || new Date().toISOString(),
      from: l.purchases?.length ? 'first purchase' : (byLead.get(String(l._id)) || []).length ? 'first project' : 'updatedAt' }));
  const heals = live.filter(l => !STAGE_IDS.includes(l.stage))
    .map(l => ({ id: String(l._id), business: l.business, stage: l.stage, rules: clientEvidence(l, (byLead.get(String(l._id)) || []).length) }));
  return { stamps, heals };
}

function report({ stamps, heals }, total) {
  console.log(`read ${total} live records`);
  console.log(`\nclientSince backfill: ${stamps.length} client or won record${stamps.length === 1 ? '' : 's'} without clientSince`);
  for (const s of stamps) console.log(`  ${s.id} ${s.business}  clientSince -> ${s.since}  (${s.from})`);
  const wouldHeal = heals.filter(h => h.rules.length);
  console.log(`\nstage heal: ${heals.length} live record${heals.length === 1 ? '' : 's'} whose stage is not a stage, ${wouldHeal.length} with client evidence`);
  for (const r of CLIENT_EVIDENCE) {
    const hit = wouldHeal.filter(h => h.rules.includes(r.id));
    console.log(`  ${r.id.padEnd(12)} ${r.label.padEnd(26)} catches ${hit.length}${hit.length ? ': ' + hit.map(h => h.business).join(', ') : ''}`);
  }
  for (const h of heals.filter(h => !h.rules.length)) console.log(`  left alone: ${h.id} ${h.business} stage ${JSON.stringify(h.stage)}, no client evidence`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (fileArg) {
    const leads = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
    const projects = projectsArg ? JSON.parse(fs.readFileSync(projectsArg, 'utf8')) : [];
    const plan = planFor(leads, projects);
    report(plan, leads.filter(l => l.deleted !== true).length);
    if (APPLY) {
      const since = new Map(plan.stamps.map(s => [s.id, s.since]));
      const out = leads.map(l => (since.has(String(l._id)) ? { ...l, clientSince: since.get(String(l._id)) } : l));
      const outPath = fileArg.replace(/\.json$/, '') + '.repaired.json';
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
      console.log(`\nwrote ${outPath}`);
    } else console.log('\nnothing written (report only; add --apply)');
  } else {
    if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI, or pass --file dump.json'); process.exit(2); }
    const { MongoClient } = await import('mongodb');
    const client = await new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 }).connect();
    try {
      const db = client.db();
      const leads = await db.collection('call_leads').find({ deleted: { $ne: true } }).project({ business: 1, stage: 1, clientSince: 1, bookedOutcome: 1, showcase: 1, purchases: 1, planner: 1, reviews: 1, updatedAt: 1, deleted: 1 }).toArray();
      const projects = await db.collection('projects').find({}).project({ leadId: 1, createdAt: 1 }).toArray();
      const plan = planFor(leads, projects);
      report(plan, leads.length);
      if (APPLY) {
        let n = 0;
        for (const s of plan.stamps) { const { ObjectId } = await import('mongodb'); await db.collection('call_leads').updateOne({ _id: new ObjectId(s.id) }, { $set: { clientSince: s.since, updatedAt: new Date() } }); n++; }
        console.log(`\nstamped ${n} record${n === 1 ? '' : 's'} (the stage heals run in the daily cron; nothing else written)`);
      } else console.log('\nnothing written (report only; add --apply)');
    } finally { await client.close(); }
  }
}
