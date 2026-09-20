#!/usr/bin/env node
/* Repair malformed lead records (the lead crash fix).
 *
 * The screens assume strings where they print text, arrays where they map,
 * objects where they read keys. A batch written straight into call_leads
 * (a scraper, the enricher, a one-off script) can hold a JSON string where
 * an array should be, an array or object where a string should be, a null,
 * an unknown priority or callStatus, or a stage that is not a stage. This
 * applies the same rules as normalizeLead() in src/lib/leads.js to the
 * stored records, and it reports before it changes anything.
 *
 *   MONGODB_URI=... node scripts/repair-leads.mjs            report only (default)
 *   MONGODB_URI=... node scripts/repair-leads.mjs --apply    write the repairs
 *   node scripts/repair-leads.mjs --file dump.json           report against a JSON dump (array of records)
 *   node scripts/repair-leads.mjs --file dump.json --apply   write the repaired dump to dump.repaired.json
 *
 * Every write is $set of the coerced field only; nothing is renamed or
 * dropped, and a record that is already well formed is not touched.
 */
import fs from 'node:fs';
import { clientEvidence } from '../api/_lib/pipeline.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : '';

const parseJson = (v) => { try { return JSON.parse(v); } catch { return undefined; } };
const asString = (v, max = 4000) => {
  if (v == null) return '';
  if (typeof v === 'string') return v.slice(0, max);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(x => asString(x, max)).filter(Boolean).join(' ').slice(0, max);
  if (typeof v === 'object') return asString(v.name ?? v.label ?? v.value ?? v.text ?? '', max);
  return '';
};
const asArray = (v) => { if (Array.isArray(v)) return v; if (typeof v === 'string' && v.trim().startsWith('[')) { const p = parseJson(v); if (Array.isArray(p)) return p; } return []; };
const asObject = (v) => { if (v && typeof v === 'object' && !Array.isArray(v)) return v; if (typeof v === 'string' && v.trim().startsWith('{')) { const p = parseJson(v); if (p && typeof p === 'object' && !Array.isArray(p)) return p; } return {}; };
const STRING_FIELDS = ['business', 'industry', 'descriptor', 'phone', 'phoneNote', 'email', 'area', 'askFor', 'bestWindow', 'angle', 'notes', 'prepNotes', 'address', 'serviceInterest', 'callbackAt', 'clientSince', 'sourceId', 'mergedInto', 'calendlyEventUri'];
const ARRAY_FIELDS = ['beforeYouDial', 'objections', 'callLog', 'contactLog', 'concepts', 'purchases', 'checklists', 'gamePlan', 'servicesPlanned', 'pricingOptions'];
const OBJECT_FIELDS = ['script', 'close', 'afterCall', 'intel', 'socials', 'meeting', 'brand', 'links', 'reviews', 'showcase', 'planner', 'retainer', 'enrichment', 'conceptsTracker', 'bookedOutcome'];
const STAGES = ['lead', 'booked', 'won', 'client', 'lost'];
const PRIORITIES = ['hot', 'warm', 'cold'];
const CALL_STATUSES = ['not-called', 'callback', 'no-answer', 'booked', 'no', 'wrong-number'];
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** The $set this record needs, with a reason per field, or null when it is fine. */
export function repairsFor(doc) {
  const set = {}; const why = [];
  const note = (k, reason, from, to) => { set[k] = to; why.push({ field: k, reason, from: JSON.stringify(from)?.slice(0, 60), to: JSON.stringify(to)?.slice(0, 60) }); };
  for (const k of STRING_FIELDS) if (k in doc && typeof doc[k] !== 'string') note(k, `${kindOf(doc[k])} where a string is expected`, doc[k], asString(doc[k]));
  for (const k of ARRAY_FIELDS) if (k in doc && !Array.isArray(doc[k])) note(k, `${kindOf(doc[k])} where an array is expected`, doc[k], asArray(doc[k]));
  for (const k of OBJECT_FIELDS) if (k in doc && doc[k] != null && (typeof doc[k] !== 'object' || Array.isArray(doc[k]))) note(k, `${kindOf(doc[k])} where an object is expected`, doc[k], asObject(doc[k]));
  if ('intel' in doc) {
    const intel = asObject(set.intel ?? doc.intel);
    if (doc.intel === null || ['accomplishments', 'gaps', 'dropLines'].some(k => !Array.isArray(intel[k]))) note('intel', doc.intel === null ? 'null intel' : 'intel lists are not arrays', doc.intel, { ...intel, accomplishments: asArray(intel.accomplishments), gaps: asArray(intel.gaps), dropLines: asArray(intel.dropLines) });
  }
  if ('stage' in doc && doc.stage !== undefined && !STAGES.includes(doc.stage)) {
    /* A record that was a client (clientSince set, or the outcome was won) whose stage was wiped reads as a client again. Anything else unknown reads as '' (lead). */
    const rules = clientEvidence(doc, 0); // projects live in another collection; the daily cron's heal reads those too
    note('stage', rules.length ? `stage ${JSON.stringify(doc.stage)} on a record with client evidence (${rules.join(', ')})` : `stage ${JSON.stringify(doc.stage)} is not a stage`, doc.stage, rules.length ? 'client' : '');
  }
  if (!('stage' in doc) && doc.callStatus === 'booked') note('stage', 'no stage on a booked call (legacy record)', undefined, 'booked');
  if ('priority' in doc && !PRIORITIES.includes(doc.priority)) note('priority', 'unknown priority', doc.priority, 'warm');
  if ('callStatus' in doc && !CALL_STATUSES.includes(doc.callStatus)) note('callStatus', 'unknown callStatus', doc.callStatus, 'not-called');
  if (typeof (set.business ?? doc.business) === 'string' && (set.business ?? doc.business).trim().length <= 2) why.push({ field: 'business', reason: 'business name is two characters or fewer (a wrong column?), left for a human', from: JSON.stringify(doc.business), to: '(unchanged)' });
  return why.length ? { set, why } : null;
}

function report(records) {
  const rows = [];
  const byField = {};
  for (const d of records) {
    const r = repairsFor(d);
    if (!r) continue;
    rows.push({ _id: String(d._id), business: asString(d.business).slice(0, 40), ...r });
    for (const w of r.why) byField[w.field] = (byField[w.field] || 0) + 1;
  }
  console.log(`${records.length} records read, ${rows.length} need repair.`);
  if (rows.length) {
    console.log('By field:');
    for (const [f, n] of Object.entries(byField).sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(16)} ${n}`);
    console.log('Records:');
    for (const r of rows.slice(0, 60)) {
      console.log(`  ${r._id}  ${r.business || '(no name)'}`);
      for (const w of r.why) console.log(`      ${w.field}: ${w.reason}  ${w.from} -> ${w.to}`);
    }
    if (rows.length > 60) console.log(`  ... and ${rows.length - 60} more`);
  }
  return rows;
}

if (fileArg) {
  const records = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
  const rows = report(records);
  if (APPLY) {
    const byId = new Map(rows.map(r => [r._id, r.set]));
    const out = records.map(d => (byId.has(String(d._id)) ? { ...d, ...byId.get(String(d._id)) } : d));
    const dest = fileArg.replace(/\.json$/, '') + '.repaired.json';
    fs.writeFileSync(dest, JSON.stringify(out, null, 2));
    console.log(`Applied to ${rows.length} record(s); written to ${dest}.`);
  } else console.log(rows.length ? 'Report only. Add --apply to write the repaired dump.' : 'Nothing to do.');
} else {
  if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI, or pass --file dump.json'); process.exit(2); }
  const { MongoClient } = await import('mongodb');
  const client = await new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 }).connect();
  try {
    const col = client.db(client.options?.dbName || 'visualize').collection('call_leads');
    const records = await col.find({}).toArray();
    const rows = report(records);
    if (APPLY) {
      let n = 0;
      for (const r of rows) { if (Object.keys(r.set).length) { await col.updateOne({ _id: records.find(d => String(d._id) === r._id)._id }, { $set: { ...r.set, updatedAt: new Date() } }); n++; } }
      console.log(`Applied ${n} repair(s).`);
    } else console.log(rows.length ? 'Report only. Add --apply to write the repairs.' : 'Nothing to do.');
  } finally { await client.close(); }
}
