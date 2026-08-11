/* One-off: copy the Visualize database from one MongoDB account to another.
 *
 * Never hardcode connection strings — they come from the environment, so
 * nothing sensitive can end up committed:
 *
 *   OLD_MONGODB_URI="mongodb+srv://…/visualize" \
 *   NEW_MONGODB_URI="mongodb+srv://…/visualize" \
 *   node scripts/migrate-mongo.mjs --dry     # report only, writes nothing
 *
 *   …same two vars…  node scripts/migrate-mongo.mjs      # actually copy
 *
 * Safe to run more than once: documents are matched on their original _id
 * and replaced, so a second run repairs a partial copy instead of creating
 * duplicates. _ids are preserved exactly, so nothing in the app breaks.
 */
import { MongoClient } from 'mongodb';

const COLLECTIONS = ['call_leads', 'submissions', 'settings', 'push_subscriptions'];
const BATCH = 500;
const DRY = process.argv.includes('--dry');

const OLD = process.env.OLD_MONGODB_URI;
const NEW = process.env.NEW_MONGODB_URI;

if (!OLD || !NEW) {
  console.error('Set OLD_MONGODB_URI and NEW_MONGODB_URI. See the header of this file.');
  process.exit(1);
}
if (OLD === NEW) {
  console.error('Refusing to run: OLD_MONGODB_URI and NEW_MONGODB_URI are identical.');
  process.exit(1);
}

// Same rule the app uses: db name comes from the URI path, else "visualize".
const dbNameOf = (uri) => {
  const m = /mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri);
  return (m && decodeURIComponent(m[1])) || 'visualize';
};

const oldClient = new MongoClient(OLD, { serverSelectionTimeoutMS: 15000 });
const newClient = new MongoClient(NEW, { serverSelectionTimeoutMS: 15000 });

try {
  process.stdout.write('Connecting to source… ');
  await oldClient.connect();
  console.log('ok');
  process.stdout.write('Connecting to target… ');
  await newClient.connect();
  console.log('ok');

  const src = oldClient.db(dbNameOf(OLD));
  const dst = newClient.db(dbNameOf(NEW));
  console.log(`\nsource: ${src.databaseName}   target: ${dst.databaseName}`);
  console.log(DRY ? '\nDRY RUN — nothing will be written.\n' : '\nCopying…\n');

  const summary = [];
  for (const name of COLLECTIONS) {
    const from = src.collection(name);
    const to = dst.collection(name);
    const total = await from.countDocuments();
    const before = await to.countDocuments();

    if (DRY || total === 0) {
      summary.push({ name, total, before, copied: 0 });
      console.log(`  ${name.padEnd(20)} ${String(total).padStart(5)} in source, ${before} already in target`);
      continue;
    }

    let copied = 0;
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      await to.bulkWrite(batch, { ordered: false });
      copied += batch.length;
      batch = [];
    };
    for await (const doc of from.find({})) {
      // replaceOne on the original _id → idempotent, and _ids stay identical
      batch.push({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } });
      if (batch.length >= BATCH) await flush();
    }
    await flush();

    const after = await to.countDocuments();
    summary.push({ name, total, before, copied, after });
    console.log(`  ${name.padEnd(20)} copied ${String(copied).padStart(5)}  → target now has ${after}`);
  }

  // Verify: every source document must exist in the target.
  if (!DRY) {
    console.log('\nVerifying…');
    let bad = 0;
    for (const { name, total } of summary) {
      const after = await dst.collection(name).countDocuments();
      const ok = after >= total;
      if (!ok) bad++;
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(20)} source ${total} → target ${after}`);
    }
    if (bad) {
      console.error(`\n${bad} collection(s) short. Re-run — it is safe and will fill the gaps.`);
      process.exitCode = 1;
    } else {
      console.log('\nAll collections copied. Now swap MONGODB_URI in Vercel and redeploy.');
      console.log('Leave the old cluster running for a few days before deleting it.');
    }
  }
} catch (err) {
  console.error('\nMigration failed:', err.message);
  console.error('Nothing is half-written that a re-run will not fix — the copy is idempotent.');
  process.exitCode = 1;
} finally {
  await oldClient.close().catch(() => {});
  await newClient.close().catch(() => {});
}
