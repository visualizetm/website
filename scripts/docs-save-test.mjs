#!/usr/bin/env node
/* Autosave (src/lib/docSave.js) on a fake clock: the one second debounce, one request at a time, text typed during a request goes in the next,
 * a failure keeps the text and retries with a growing wait, flush stores everything now, a closed editor's unsaved text lives on and the next
 * open takes it over.   node scripts/docs-save-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { build } from 'esbuild';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(path.join(repoRoot, '.tmp-verify'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(repoRoot, '.tmp-verify', 'dsave-'));
const out = path.join(tmp, 'bundle.mjs');
await build({ entryPoints: [path.join(repoRoot, 'src/lib/docSave.js')], outfile: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const S = await import(pathToFileURL(out).href);
fs.rmSync(tmp, { recursive: true, force: true });

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
/* A fake clock: timers fire in order as time advances. */
function clock() {
  let now = 0; let id = 0; const q = [];
  return {
    timers: { set: (fn, ms) => { q.push({ id: ++id, at: now + ms, fn }); return id; }, clear: (i) => { const k = q.findIndex(t => t.id === i); if (k >= 0) q.splice(k, 1); } },
    async advance(ms) { const end = now + ms; for (;;) { q.sort((a, b) => a.at - b.at); const n = q[0]; if (!n || n.at > end) break; q.shift(); now = n.at; n.fn(); await new Promise(r => setImmediate(r)); } now = end; await new Promise(r => setImmediate(r)); },
    get pending() { return q.length; },
  };
}
const make = (opts = {}) => {
  const c = clock(); const calls = []; const states = [];
  let fail = false; let hold = null;
  const saver = S.createSaver({ delay: 1000, retry: [2000, 4000], timers: c.timers, onStatus: (s) => states.push(s), save: async (p) => { calls.push(p); if (hold) await hold.promise; return !fail; }, ...opts });
  return { c, calls, states, saver, setFail: (v) => { fail = v; }, hold: () => { let res; hold = { promise: new Promise(r => { res = r; }) }; return () => { hold = null; res(); }; } };
};

{
  const t = make();
  t.saver.dirty({ n: 1 }); t.saver.dirty({ n: 2 }); t.saver.dirty({ n: 3 });
  await t.c.advance(900);
  ok(t.calls.length === 0 && t.saver.status === 'dirty', 'nothing is sent inside the second');
  await t.c.advance(200);
  ok(t.calls.length === 1 && t.calls[0].n === 3 && t.saver.status === 'saved', 'a burst of typing is one request with the last text, after about a second');
}
{
  const t = make();
  const release = t.hold();
  t.saver.dirty({ n: 1 }); await t.c.advance(1100);
  ok(t.saver.status === 'saving' && t.calls.length === 1, 'the request is in flight and the status says Saving');
  t.saver.dirty({ n: 2 }); await t.c.advance(1100);
  ok(t.calls.length === 1, 'text typed during a request waits for it: one request at a time');
  release(); await t.c.advance(10);
  ok(t.calls.length === 2 && t.calls[1].n === 2 && t.saver.status === 'saved', 'then goes in the next request, in order');
}
{
  const t = make();
  t.setFail(true);
  t.saver.dirty({ n: 1 }); await t.c.advance(1100);
  ok(t.saver.status === 'failed' && t.saver.unsaved && t.saver.latest.n === 1, 'a failed save keeps the text in memory and says failed');
  await t.c.advance(2000);
  ok(t.calls.length === 2 && t.saver.status === 'failed', 'it retries after 2 seconds');
  await t.c.advance(4000);
  ok(t.calls.length === 3, 'then after 4 seconds (the wait grows)');
  t.setFail(false); await t.c.advance(4000);
  ok(t.saver.status === 'saved' && !t.saver.unsaved && t.calls.length === 4, 'and lands once the network is back; nothing was lost');
  ok(t.states[0] === 'dirty' && t.states.includes('failed') && t.states.at(-1) === 'saved' && t.states.every((x, k) => k === 0 || x !== t.states[k - 1]), 'the statuses ran dirty, saving, failed ... saved, each change reported once');
}
{
  const t = make();
  t.saver.dirty({ n: 1 });
  const done = await t.saver.flush();
  ok(done === true && t.calls.length === 1 && t.saver.status === 'saved', 'flush saves now, before the second is up');
  ok(await t.saver.flush() === true && t.calls.length === 1, 'flush with nothing unsaved sends nothing');
  t.setFail(true); t.saver.dirty({ n: 2 });
  ok(await t.saver.flush() === false && t.saver.unsaved, 'flush says false when the save failed, so Back can tell Rob');
  t.setFail(false); t.saver.retryNow(); await t.c.advance(5);
  ok(t.saver.status === 'saved', 'retryNow (the network is back) saves without waiting out the backoff');
}
{
  const t = make();
  t.setFail(true); t.saver.dirty({ title: 'kept', blocks: [1] }); await t.c.advance(1100);
  S.release('docA', t.saver);
  ok(S.pendingFor('docA')?.title === 'kept', 'an editor that closes with unsaved text leaves it behind');
  ok(S.pendingFor('docB') === null, 'another doc has none');
  const took = S.takeover('docA');
  ok(took?.title === 'kept' && S.pendingFor('docA') === null, 'the next open of the doc takes the text over and the old saver ends');
}
{
  const t = make();
  t.saver.dirty({ n: 1 }); await t.c.advance(1100);
  S.release('docC', t.saver);
  ok(S.pendingFor('docC') === null && S.takeover('docC') === null, 'an editor that closes with everything saved leaves nothing');
}
{
  const c = clock(); const calls = [];
  const saver = S.createSaver({ delay: 1000, timers: c.timers, save: async (p) => { calls.push(p); return p.bad ? 'rejected' : true; } });
  saver.dirty({ bad: true }); await c.advance(1100);
  ok(saver.status === 'rejected' && calls.length === 1 && saver.unsaved, 'a refusal retrying cannot fix reads rejected, keeps the text and is not retried');
  await c.advance(60000);
  ok(calls.length === 1, 'and nothing is sent again by itself');
  saver.dirty({ bad: false }); await c.advance(1100);
  ok(saver.status === 'saved' && calls.length === 2, 'the next edit sends again and lands');
}
console.log(fails ? `\n${fails} failing.` : '\nAll autosave checks pass.');
process.exit(fails ? 1 : 0);
