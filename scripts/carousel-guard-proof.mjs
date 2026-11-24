#!/usr/bin/env node
/* Each carousel guard put back as its fault in a copy of api/, in turn: with the fault in place scripts/carousel-test.mjs must
 * exit 1 and fail the check named for it. A cut that no longer finds its text is a failed proof too. The repository is never
 * touched.
 *   node scripts/carousel-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });

const CUTS = [
  { name: '21-accepted', what: 'the route accepts more than 20 slides', file: '_routes/posts.js',
    edits: [["    if ('slides' in allowed && allowed.slides.length > SLIDES_MAX) return res.status(400).json({ error: TOO_MANY_SLIDES });\n", ''], ['      if (doc.slides.length > SLIDES_MAX) return res.status(400).json({ error: TOO_MANY_SLIDES });\n', '']], expect: ['max-21'] },
  { name: 'cover-mirror-cut', what: 'imageUrl no longer follows the first slide', file: '_routes/posts.js',
    edits: [['        else if (allowed.slides.length) allowed.imageUrl = allowed.slides[0].url;\n', ''], ['      else if (doc.slides.length) doc.imageUrl = doc.slides[0].url; // the cover is imageUrl, always\n', '']], expect: ['cover-mirror', 'reorder-mirror'] },
  { name: 'planner-read-no-slides', what: 'slides missing from the client\'s planner read', file: 'planner.js',
    edits: [['  slides: publicSlides(p),\n', '']], expect: ['planner-read'] },
  { name: 'unsafe-url-kept', what: 'a slide url kept without safeUrl', file: '_routes/posts.js',
    edits: [["const url = safeUrl(o.url, 600); return url ?", "const url = String(o.url ?? '').trim(); return url ?"]], expect: ['unsafe-url'] },
  { name: 'send-review-no-slide', what: 'send-review passes a post with no slide and no video', file: '_routes/posts.js',
    edits: [["(slidesOf(p).length >= 1 || String(p.video?.url || '').trim())", 'true']], expect: ['send-review'] },
  { name: 'ad-keeps-slides', what: 'an ad or a story carries slides', file: '_routes/posts.js',
    edits: [['      if (!carouselAllowed(doc)) delete doc.slides; // an ad, a story or a video carries no carousel\n      else if', '      if'], ['        if (!eligible) delete allowed.slides;\n        else if', '        if']], expect: ['eligible'] },
  { name: 'versions-drop-slides', what: 'a version keeps only the cover, not the slides', file: '_routes/posts.js',
    edits: [["imageUrl: cur.imageUrl || '', slides: cur.slides, caption:", "imageUrl: cur.imageUrl || '', caption:"]], expect: ['versions'] },
  { name: 'mirror-drift', what: 'the server copy of slidesOf drifts from src/shared', file: '_lib/slides.js',
    edits: [['export const SLIDES_MAX = 20;', 'export const SLIDES_MAX = 20; // drifted']], expect: ['mirror'] },
];

let unproven = 0;
for (const c of CUTS) {
  const dir = fs.mkdtempSync(path.join(tmpBase, 'carousel-cut-'));
  try {
    fs.cpSync(path.join(repoRoot, 'api'), path.join(dir, 'api'), { recursive: true });
    const p = path.join(dir, 'api', c.file);
    let src = fs.readFileSync(p, 'utf8');
    const missing = c.edits.find(([from]) => !src.includes(from));
    if (missing) { unproven++; console.log(`FAIL ${c.name}: the cut's text is not in api/${c.file} any more (${missing[0].slice(0, 60)})`); continue; }
    for (const [from, to] of c.edits) src = src.replace(from, to);
    fs.writeFileSync(p, src);
    const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'carousel-test.mjs')], { env: { ...process.env, API_SRC: path.join(dir, 'api') }, encoding: 'utf8', timeout: 300000 });
    const failLines = (r.stdout || '').split('\n').filter(l => l.startsWith('FAIL '));
    const named = c.expect.every(id => failLines.some(l => l.includes(`[${id}]`)));
    const good = r.status === 1 && named;
    if (!good) unproven++;
    console.log(`${good ? 'ok  ' : 'FAIL'} ${c.name}: ${good ? `${failLines.length} check(s) fail` : `exit ${r.status}, expected ${c.expect.join(' and ')} to fail`}  (${c.what})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
console.log(unproven ? `\n${unproven} cut(s) not proven.` : `\nall ${CUTS.length} cuts are caught.`);
process.exit(unproven ? 1 : 0);
