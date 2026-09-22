#!/usr/bin/env node
/* One-off: the old concept_packs and the leads' concepts[] items into
 * concept_sets (docs/CONCEPTS-AUDIT.md). Reports what it would create
 * before it creates anything; writes only with --apply; deletes nothing.
 *
 *   MONGODB_URI=... node scripts/migrate-concepts.mjs            report only
 *   MONGODB_URI=... node scripts/migrate-concepts.mjs --apply    insert the draft sets
 *   node scripts/migrate-concepts.mjs --file dump.json [--apply]  the same on an export
 *        (dump.json: { concept_packs: [...], call_leads: [...] }; --apply writes dump.sets.json)
 *
 * The rules:
 *   - every concept_pack with at least one image and a linked lead becomes
 *     one draft set for that lead: one direction named after the pack, its
 *     images as items in order (the image's label as the caption)
 *   - every lead concepts[] item with a link becomes an item in one draft
 *     set per lead, one direction per item named after the item
 *   - a set is never created for a lead that already has one from this
 *     script (the migrated: marker), so the script is safe to run twice
 *   - a pack without images, a pack without a lead, an item without a link
 *     are listed and left alone
 * The token is minted the same way api/_routes/concept-sets.js mints one. */
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : '';
const uid = () => Math.random().toString(36).slice(2, 10);
const mint = () => randomBytes(24).toString('base64url');
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const ok = (u) => /^https?:\/\/[^\s/?#]+[^\s]*$/i.test(String(u ?? '').trim());
const isImage = (u) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u) || /cloudinary|googleusercontent|imgur/i.test(u);

export function plan(packs, leads) {
  const byLead = new Map(leads.map(l => [String(l._id), l]));
  const sets = []; const skipped = [];
  const now = new Date().toISOString();
  const draft = (lead, title, directions, source) => ({
    leadId: String(lead._id), title: str(title, 120) || 'Brand directions', round: 1, intro: '', status: 'draft',
    directions, feedback: [], approvedDirectionId: '', approvedAt: '', projectId: '', archived: false,
    token: mint(), tokenCreatedAt: now, lastViewedAt: '', sentAt: '', migrated: source, createdAt: now, updatedAt: now,
  });
  for (const p of packs) {
    if (p.deleted || p.archived) continue;
    const images = (p.images || []).filter(i => ok(i?.link));
    const lead = p.leadId ? byLead.get(String(p.leadId)) : null;
    if (!images.length) { skipped.push(`pack ${p._id} "${p.title}": no images, left alone`); continue; }
    if (!lead) { skipped.push(`pack ${p._id} "${p.title}": ${images.length} image(s) but no linked lead, left alone`); continue; }
    sets.push({ business: lead.business, from: `pack ${p._id} "${p.title}"`, set: draft(lead, p.title, [{ id: uid(), name: str(p.title, 80), rationale: str(p.notes, 600), order: 0, items: images.slice(0, 12).map((i, k) => ({ id: uid(), kind: isImage(i.link) ? (p.kind === 'logo' ? 'logo' : p.kind === 'brand-board' ? 'board' : p.kind === 'social' ? 'social' : p.kind === 'website' ? 'web' : 'other') : 'other', image: str(i.link, 600), caption: str(i.label, 200), order: k })) }], `pack:${p._id}`) });
  }
  for (const l of leads) {
    if (l.deleted) continue;
    const items = (l.concepts || []).filter(c => ok(c?.link));
    const dropped = (l.concepts || []).length - items.length;
    if (dropped) skipped.push(`lead ${l._id} "${l.business}": ${dropped} concept item(s) without a link, left alone`);
    if (!items.length) continue;
    sets.push({ business: l.business, from: `${items.length} lead concepts[] item(s) with a link`, set: draft(l, 'Concepts', items.slice(0, 6).map((c, k) => ({ id: uid(), name: str(c.label, 80) || `Direction ${k + 1}`, rationale: '', order: k, items: [{ id: uid(), kind: 'other', image: str(c.link, 600), caption: str(c.label, 200), order: 0 }] })), `lead:${l._id}`) });
  }
  return { sets, skipped };
}

function report({ sets, skipped }, packs, leads, existing) {
  console.log(`read ${packs.length} concept_pack(s), ${leads.length} lead(s), ${leads.filter(l => (l.concepts || []).length).length} carrying concepts[] items (${leads.reduce((n, l) => n + (l.concepts || []).length, 0) } items), ${existing} concept_set(s) already migrated`);
  console.log(`\nwould create ${sets.length} draft set(s):`);
  for (const s of sets) console.log(`  ${s.business}: "${s.set.title}", ${s.set.directions.length} direction(s), ${s.set.directions.reduce((n, d) => n + d.items.length, 0)} item(s), from ${s.from}`);
  console.log(`\nleft alone (${skipped.length}):`);
  for (const s of skipped) console.log(`  ${s}`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (fileArg) {
    const dump = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
    const packs = dump.concept_packs || []; const leads = dump.call_leads || [];
    const p = plan(packs, leads);
    report(p, packs, leads, 0);
    if (APPLY) { const out = fileArg.replace(/\.json$/, '') + '.sets.json'; fs.writeFileSync(out, JSON.stringify(p.sets.map(s => s.set), null, 2)); console.log(`\nwrote ${out}`); }
    else console.log('\nnothing written (report only; add --apply)');
  } else {
    if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI, or pass --file dump.json'); process.exit(2); }
    const { MongoClient } = await import('mongodb');
    const client = await new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2 }).connect();
    try {
      const db = client.db(client.options?.dbName || 'visualize');
      const packs = await db.collection('concept_packs').find({}).toArray();
      const leads = await db.collection('call_leads').find({ deleted: { $ne: true } }).project({ business: 1, concepts: 1, deleted: 1 }).toArray();
      const done = new Set((await db.collection('concept_sets').find({ migrated: { $exists: true } }).project({ migrated: 1 }).toArray()).map(s => s.migrated));
      const p = plan(packs, leads);
      p.sets = p.sets.filter(s => !done.has(s.set.migrated));
      report(p, packs, leads, done.size);
      if (APPLY) { if (p.sets.length) await db.collection('concept_sets').insertMany(p.sets.map(s => ({ ...s.set, createdAt: new Date(), updatedAt: new Date() }))); console.log(`\ninserted ${p.sets.length} draft set(s); nothing deleted, concept_packs and concepts[] untouched`); }
      else console.log('\nnothing written (report only; add --apply)');
    } finally { await client.close(); }
  }
}
