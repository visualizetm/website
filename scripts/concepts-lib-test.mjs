#!/usr/bin/env node
/* The pure logic behind Review each on the CRM side (src/lib/concepts.js, src/lib/workspace.js): the tally, the one line the Concepts card
 * and the list say, what Log as a round pre-fills, the send block, the next round, the editor's draft. The sources import each other without
 * extensions, so they are bundled with esbuild (a Vite dependency) into a temp file first.   node scripts/concepts-lib-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'clib-'));
const entry = path.join(tmp, 'entry.js');
fs.writeFileSync(entry, `export * from ${JSON.stringify(path.join(repoRoot, 'src/lib/concepts.js'))}; export { conceptsStatus } from ${JSON.stringify(path.join(repoRoot, 'src/lib/workspace.js'))};`);
const out = path.join(tmp, 'bundle.mjs');
await build({ entryPoints: [entry], outfile: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent', loader: { '.js': 'jsx' } });
const L = await import(pathToFileURL(out).href);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const dir = (id, name, over = {}) => ({ id, name, rationale: '', order: 0, needsDecision: true, items: [{ id: id + 'i', image: 'https://x/y.png', order: 0 }], ...over });
const dec = (status, note = '') => ({ status, note, decidedAt: '2026-10-01T10:00:00Z' });
const review = (over = {}) => ({ _id: 's1', leadId: 'L1', round: 1, status: 'sent', approvalMode: 'review', directions: [dir('a', 'Logo'), dir('b', 'Card'), dir('c', 'Site'), dir('d', 'Board', { needsDecision: false })].map((d, i) => ({ ...d, order: i })), ...over });

ok(L.approvalModeOf({}) === 'pick' && L.approvalModeOf({ approvalMode: 'review' }) === 'review' && L.approvalModeOf({ approvalMode: 'nope' }) === 'pick', 'a set with no or an unknown mode is Pick one');
ok(L.needsDecision({}) === true && L.needsDecision({ needsDecision: false }) === false, 'a direction needs a decision unless marked For reference');
ok(L.decisionItems(review()).length === 3, 'decisionItems leaves out the For reference direction');
ok(L.reviewLine({ status: 'sent' }) === undefined, 'a Pick one set has no review line (today\'s wording stays)');
ok(L.reviewLine(review({ status: 'draft' })) === undefined, 'a draft review set has none either');
ok(L.reviewLine(review()) === 'Waiting on client, 0 of 3', 'nothing answered reads "Waiting on client, 0 of 3"');
const part = review(); part.directions[0].decision = dec('approved'); part.directions[1].decision = dec('changes', 'Bolder');
ok(L.reviewLine(part) === 'Waiting on client, 2 of 3', 'partly answered reads "Waiting on client, 2 of 3"');
const done = review({ status: 'changes', submittedAt: '2026-10-01T11:00:00Z' }); done.directions[0].decision = dec('approved'); done.directions[1].decision = dec('changes', 'Bolder'); done.directions[2].decision = dec('approved');
ok(L.reviewLine(done) === '2 approved, 1 needs changes', 'sent reads "2 approved, 1 needs changes"');
const many = review({ submittedAt: 'x' }); many.directions[0].decision = dec('changes', 'a'); many.directions[1].decision = dec('changes', 'b'); many.directions[2].decision = dec('pass');
ok(L.reviewLine(many) === '2 need changes, 1 passed', 'plural wording: "2 need changes, 1 passed"');
ok(L.isLocked(done) && !L.isLocked(part) && !L.isLocked({ submittedAt: 'x' }), 'locked is a review set with submittedAt');
ok(L.roundNote(done) === 'Direction B, Card: Bolder', `Log as a round pre-fills one line per change request (${JSON.stringify(L.roundNote(done))})`);
ok(L.roundNote(part) === 'Direction B, Card: Bolder' && L.roundNote(review()) === '', 'no change notes, no pre-fill');
ok(L.sendBlockReason(review({ directions: review().directions.map(d => ({ ...d, needsDecision: false })) })) === 'Mark at least one item as Needs a decision first.', 'a review set with nothing to decide cannot be sent');
ok(L.sendBlockReason(review()) === null, 'a review set with items to decide can be sent');
const next = L.nextRoundOf(done);
ok(next.approvalMode === 'review' && next.round === 2 && next.directions.length === 4 && next.directions.every(d => !('decision' in d)) && next.directions[3].needsDecision === false, 'the next round keeps the mode and which items need an answer, and none of the answers');
const dr = L.draftOf(part);
ok(dr.approvalMode === 'review' && dr.allowPass === false && dr.directions.every(d => typeof d.needsDecision === 'boolean') && !JSON.stringify(dr).includes('decision":{'), 'the editor draft carries the mode and needsDecision, never an answer');
ok(L.submissionsOf({ submissions: [{ at: '2026-01-01' }, { at: '2026-03-01' }] })[0].at === '2026-03-01', 'submissions read newest first');
const cs = L.conceptsStatus([part], 'L1');
ok(cs.review === 'Waiting on client, 2 of 3' && cs.label === 'waiting on client, 2 of 3', 'the Concepts card reads the review line');
const ps = L.conceptsStatus([{ _id: 'p', leadId: 'L1', round: 1, status: 'viewed', directions: [dir('a', 'A')] }], 'L1');
ok(ps.review === undefined && ps.label === 'viewed', 'a Pick one set keeps today\'s wording');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failing.` : '\nAll concepts lib checks pass.');
process.exit(fails ? 1 : 0);
