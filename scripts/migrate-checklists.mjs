#!/usr/bin/env node
/* Stamp ids on every checklist and task written before the task system (docs/PLANNER-TASKS-DESIGN.md), on leads and
 * projects. Reports first; writes only with --apply. Idempotent: a record whose lists already carry ids is skipped.
 *   node scripts/migrate-checklists.mjs            report
 *   node scripts/migrate-checklists.mjs --apply    write */
import { MongoClient } from 'mongodb';
import { normalizeChecklists } from '../api/_lib/taskRules.js';

const APPLY = process.argv.includes('--apply');
const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI is not set.'); process.exit(1); }
const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);
const needs = (lists) => Array.isArray(lists) && lists.some(l => !l?.id || (l?.items || []).some(it => !it?.id));
let seen = 0; let changed = 0;
for (const coll of ['call_leads', 'projects']) {
  const rows = await db.collection(coll).find({ checklists: { $exists: true, $ne: [] } }).project({ checklists: 1, business: 1, name: 1 }).toArray();
  for (const r of rows) {
    seen++;
    if (!needs(r.checklists)) continue;
    changed++;
    const next = normalizeChecklists(r.checklists);
    console.log(`${APPLY ? 'stamp' : 'would stamp'} ${coll} ${r._id} (${r.business || r.name || ''}): ${next.reduce((n, l) => n + l.items.length, 0)} task(s) in ${next.length} list(s)`);
    if (APPLY) await db.collection(coll).updateOne({ _id: r._id }, { $set: { checklists: next, updatedAt: new Date() } });
  }
}
console.log(`${seen} record(s) with checklists, ${changed} ${APPLY ? 'stamped' : 'to stamp'}.${APPLY ? '' : ' Run with --apply to write.'}`);
await client.close();
