#!/usr/bin/env node
/* CRM revamp, step 4: the one time move into triage, and the first score.
 * Reports what it would change before it changes anything; writes only
 * with --apply; deletes nothing.
 *
 *   MONGODB_URI=... node scripts/backfill-triage.mjs            report only
 *   MONGODB_URI=... node scripts/backfill-triage.mjs --apply    write the stage and the score
 *   node scripts/backfill-triage.mjs --file dump.json [--apply]  the same on an export
 *        ({ call_leads: [...], submissions: [...] }; --apply writes dump.triage.json)
 *
 * The rules:
 *   - a live record at stage lead (or with no stage at all) that was never
 *     called (callStatus not-called, no callLog) moves to triage; anything
 *     that has been dialed, booked, won, parked or declined is left alone
 *   - every live record gets its score from api/_lib/score.js (the same
 *     rules the cron and the app use), written only when it differs */
import fs from 'node:fs';
import { scoreFor, topClientIndustries, briefedLeadIds } from '../api/_lib/score.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : '';

const untouched = (l) => (l.callStatus || 'not-called') === 'not-called' && !(Array.isArray(l.callLog) && l.callLog.length);
/** The plan: which records move to triage, which get a new score. Pure, so the test can run it. */
export function plan(leads, submissions) {
  const live = (leads || []).filter(l => !l.deleted);
  const moves = live.filter(l => (l.stage === 'lead' || !l.stage) && untouched(l)).map(l => ({ id: String(l._id), business: l.business || '', from: l.stage || '(none)' }));
  const ctx = { topIndustries: topClientIndustries(live), briefed: briefedLeadIds(submissions || []) };
  const scores = live.map(l => ({ id: String(l._id), business: l.business || '', score: scoreFor(l, ctx), was: l.score })).filter(s => s.score !== Number(s.was));
  return { moves, scores, topIndustries: [...ctx.topIndustries] };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const now = new Date();
  if (fileArg) {
    const dump = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
    const p = plan(dump.call_leads || [], dump.submissions || []);
    report(p);
    if (APPLY) {
      const out = fileArg.replace(/\.json$/i, '') + '.triage.json';
      fs.writeFileSync(out, JSON.stringify(p, null, 2));
      console.log(`Wrote ${out}.`);
    }
  } else {
    if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI, or pass --file dump.json.'); process.exit(1); }
    const { MongoClient } = await import('mongodb');
    const client = await new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 }).connect();
    try {
      const db = client.db(client.options?.dbName || 'visualize');
      const leads = await db.collection('call_leads').find({ deleted: { $ne: true } }).project({ business: 1, stage: 1, callStatus: 1, callLog: 1, phone: 1, socials: 1, intel: 1, industry: 1, score: 1 }).toArray();
      const subs = await db.collection('submissions').find({ deleted: { $ne: true }, type: { $in: ['start', 'contact'] }, linkedLeadId: { $exists: true, $ne: '' } }).project({ type: 1, linkedLeadId: 1 }).toArray();
      const p = plan(leads, subs);
      report(p);
      if (APPLY) {
        const col = db.collection('call_leads');
        for (const m of p.moves) await col.updateOne({ _id: leads.find(l => String(l._id) === m.id)._id }, { $set: { stage: 'triage', updatedAt: now } });
        for (const s of p.scores) await col.updateOne({ _id: leads.find(l => String(l._id) === s.id)._id }, { $set: { score: s.score, updatedAt: now } });
        console.log(`Applied: ${p.moves.length} moved to triage, ${p.scores.length} scored.`);
      } else console.log('Report only. Run with --apply to write.');
    } finally { await client.close(); }
  }
}
function report(p) {
  console.log(`Top client industries: ${p.topIndustries.join(', ') || '(none)'}`);
  console.log(`\n${p.moves.length} to move to triage:`);
  for (const m of p.moves) console.log(`  ${m.business || m.id}  (from ${m.from})`);
  console.log(`\n${p.scores.length} to score:`);
  for (const s of p.scores.slice(0, 40)) console.log(`  ${s.business || s.id}  ${s.was ?? '-'} -> ${s.score}`);
  if (p.scores.length > 40) console.log(`  ... and ${p.scores.length - 40} more`);
}
