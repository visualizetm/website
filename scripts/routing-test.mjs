#!/usr/bin/env node
/* Routing test: every URL the platform or the app requests reaches a function, never the single page app.
 *
 * This project has no framework preset and ends its vercel.json rewrites with { "/(.*)" -> "/index.html" }. A dynamic file
 * such as api/cron/[job].js loses to that catch-all, so /api/cron/reminders answered with index.html (status 200) and the
 * crons never ran from the day the file was added until the route was renamed. So a function here is a plain file name plus
 * an explicit rewrite above the catch-all, and this test keeps it that way, offline, by reading vercel.json and the api/
 * tree the way the platform does: a real file first, then the rewrites in order, then the catch-all.
 *
 * Checks: no [param] file or folder under api/; the catch-all is the last rewrite and no /api/ rewrite sits after it;
 * every /api/ rewrite lands on a function file and, for a dispatcher, on a route that dispatcher registers; every route a
 * dispatcher registers has a rewrite; every crons[].path resolves to a function through a rewrite (never the catch-all) and
 * to a registered job; every function is reachable; the function count stays inside the plan's twelve; every /api/ URL the
 * client code requests resolves to a function; and the three hosts (the site, the admin, the client app): each has its own
 * header block with the pinned script hash and frame-ancestors 'none' (the admin and the app no-store), every /api/ URL the
 * app requests reaches its function on every host (no host condition hides a rewrite), no redirect catches an app path on
 * the app host, and the app host's manifest is a standalone Home Screen app the pre-paint script points at.
 *
 *   node scripts/routing-test.mjs                      the repository
 *   ROUTING_ROOT=/some/copy node scripts/routing-test.mjs   a copy with vercel.json, api/ and src/ (the fault proofs use this) */
import fs from 'fs';
import path from 'path';

const here = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ROOT = process.env.ROUTING_ROOT ? path.resolve(process.env.ROUTING_ROOT) : here;
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const read = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), 'utf8') : '');
const walk = (dir, rel = '') => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? [rel + e.name, ...walk(path.join(dir, e.name), `${rel}${e.name}/`)] : [rel + e.name])) : []);

const vj = JSON.parse(read('vercel.json') || '{}');
const rewrites = vj.rewrites || [];
const crons = vj.crons || [];
const apiNames = walk(path.join(ROOT, 'api'));
/* A function is a .js file under api/ with no path segment starting with an underscore (those are never deployed). */
const funcs = apiNames.filter(n => n.endsWith('.js') && !n.split('/').some(seg => seg.startsWith('_'))).map(n => `api/${n}`);

/* The function file a URL path names, the way the platform finds a plain function: api/x.js, or api/x/index.js. */
const fileFor = (urlPath) => { const p = String(urlPath).replace(/^\//, '').replace(/\/$/, ''); return funcs.find(f => f === `${p}.js` || f === `${p}/index.js`) || null; };
const reFor = (src) => new RegExp(`^${src.split('/').map(seg => (seg.startsWith(':') ? '([^/]+)' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`);
const namesOf = (src) => src.split('/').filter(seg => seg.startsWith(':')).map(seg => seg.slice(1));
/* A rewrite's destination with its :name parts filled from the request path that matched the source. */
const fill = (dest, src, match) => { let out = dest; namesOf(src).forEach((n, i) => { out = out.split(`:${n}`).join(match[i + 1]); }); return out; };
const CATCH_ALL = '/(.*)';
/* The three hosts this one project serves, and whether a rule's has / missing host conditions let it fire on one. */
const HOSTS = ['visualizestudio.org', 'admin.visualizeclients.com', 'app.visualizeclients.com'];
const hostConds = (rule, kind) => (Array.isArray(rule?.[kind]) ? rule[kind] : []).filter(c => c?.type === 'host');
const onHost = (rule, host) => !host || (hostConds(rule, 'has').every(c => c.value === host) && !hostConds(rule, 'missing').some(c => c.value === host));
/* Resolve a request path: a real function file, then the rewrites in order (those that fire on the host), then the catch-all. */
function resolve(urlPath, host = '') {
  const direct = fileFor(urlPath);
  if (direct) return { via: 'file', file: direct };
  for (let i = 0; i < rewrites.length; i++) {
    const r = rewrites[i];
    if (!onHost(r, host)) continue;
    if (r.source === CATCH_ALL) return { via: 'spa', index: i };
    const m = reFor(r.source).exec(urlPath);
    if (m) {
      const [destPath, query = ''] = fill(r.destination, r.source, m).split('?');
      const file = fileFor(destPath);
      return file ? { via: 'rewrite', file, index: i, query: new URLSearchParams(query) } : { via: 'broken', index: i, dest: r.destination };
    }
  }
  return { via: 'none' };
}

/* What each dispatcher registers, read from its source. */
const keysOf = (rel, re) => [...read(rel).matchAll(re)].map(m => m[1]);
const adminRoutes = keysOf('api/admin/index.js', /^\s*'([a-z0-9-]+)': route\(/gm);
const showcaseRoutes = keysOf('api/showcase.js', /req\.query\?\.r === '([a-z0-9-]+)'/g);
const cronJobs = keysOf('api/cron/index.js', /^\s*'?([a-z0-9-]+)'?: route\(/gm);
const dispatchers = [
  { file: 'api/admin/index.js', param: 'r', keys: adminRoutes, name: 'the admin dispatcher' },
  { file: 'api/showcase.js', param: 'r', keys: showcaseRoutes, name: 'the public showcase door' },
  { file: 'api/cron/index.js', param: 'job', keys: cronJobs, name: 'the cron dispatcher' },
];

console.log(`\nrouting: ${rewrites.length} rewrites, ${crons.length} crons, ${funcs.length} functions in ${ROOT === here ? 'the repository' : ROOT}`);

console.log('\n1. the shape of the table');
{
  const dynamic = apiNames.filter(n => /[[\]]/.test(n));
  ok(dynamic.length === 0, `no file or folder under api/ has a [param] name, the /(.*) catch-all would swallow it (${dynamic.join(', ') || 'none'})`);
  const last = rewrites.length - 1;
  ok(last >= 0 && rewrites[last].source === CATCH_ALL && rewrites[last].destination === '/index.html', 'the catch-all to /index.html is the last rewrite');
  ok(!rewrites.slice(0, Math.max(last, 0)).some(r => r.source === CATCH_ALL), 'there is one catch-all, not an earlier one that hides the rest');
  const after = rewrites.filter((r, i) => i > rewrites.findIndex(x => x.source === CATCH_ALL) && /^\/api\//.test(r.source));
  ok(rewrites.some(r => r.source === CATCH_ALL) && after.length === 0, `no /api/ rewrite sits after the catch-all (${after.map(r => r.source).join(', ') || 'none'})`);
  ok(funcs.length > 0 && funcs.length <= 12, `${funcs.length} serverless functions, inside the plan's twelve`);
}

console.log('\n2. every /api/ rewrite lands on a function');
{
  const api = rewrites.filter(r => /^\/api\//.test(r.source));
  ok(api.length > 0, `${api.length} /api/ rewrites to check`);
  for (const r of api) {
    const [destPath, query = ''] = r.destination.split('?');
    const file = fileFor(destPath);
    const d = dispatchers.find(x => x.file === file);
    const val = d ? new URLSearchParams(query).get(d.param) : null;
    const open = !!val && val.startsWith(':'); // a :name destination hands any path segment to the dispatcher, which must answer an unknown one 404
    const landed = !!file && (!d || open || (val && d.keys.includes(val)));
    ok(landed, `${r.source} reaches ${file || 'NO FUNCTION'}${d ? `, ${d.param}=${val || '?'} (${open ? 'any value, the dispatcher answers an unknown one 404' : val && d.keys.includes(val) ? 'registered' : 'not registered in ' + d.file})` : ''}`);
  }
}

console.log('\n3. every route a dispatcher registers can be requested');
for (const d of dispatchers) {
  ok(d.keys.length > 0, `${d.name} (${d.file}) registers ${d.keys.length} route${d.keys.length === 1 ? '' : 's'}`);
  for (const key of d.keys) {
    const hit = rewrites.some(r => { if (r.source === CATCH_ALL || fileFor(r.destination.split('?')[0]) !== d.file) return false; const v = new URLSearchParams(r.destination.split('?')[1] || '').get(d.param); return v === key || (!!v && v.startsWith(':')); });
    ok(hit, `${d.file} ${d.param}=${key} has a rewrite`);
  }
}

console.log('\n4. every cron reaches its job');
{
  ok(crons.length > 0, `${crons.length} crons registered in vercel.json`);
  for (const c of crons) {
    const res = resolve(c.path);
    const job = res.query?.get('job');
    ok(res.via === 'rewrite' || res.via === 'file', `${c.path} resolves to a function (${res.via === 'spa' ? 'the single page app: the cron would never run' : res.via === 'broken' ? `a rewrite to ${res.dest} with no function` : res.via === 'none' ? 'nothing' : `${res.via} ${res.file}`})`);
    if (res.via === 'rewrite') ok(res.index < rewrites.findIndex(r => r.source === CATCH_ALL), `${c.path} matches a rewrite above the catch-all (rewrite ${res.index + 1} of ${rewrites.length})`);
    if (res.file === 'api/cron/index.js') ok(!!job && cronJobs.includes(job), `${c.path} carries job=${job || '?'}, registered in api/cron/index.js (${cronJobs.join(', ')})`);
  }
}

console.log('\n5. every function is reachable');
{
  for (const f of funcs) {
    const own = f.replace(/\.js$/, '').replace(/\/index$/, '');
    const viaRewrite = rewrites.some(r => r.source !== CATCH_ALL && fileFor(r.destination.split('?')[0]) === f);
    const plainOwnPath = !/\/index\.js$/.test(f) && !!fileFor(`/${own}`);
    ok(viaRewrite || plainOwnPath, `${f} is reachable (${viaRewrite ? 'a rewrite points at it' : `its own path /${own}`})`);
  }
}

console.log('\n6. every /api/ URL the app requests resolves to a function');
const found = new Map();
{
  const srcFiles = walk(path.join(ROOT, 'src')).filter(n => /\.(js|jsx)$/.test(n));
  for (const n of srcFiles) {
    const text = read(`src/${n}`);
    for (const m of text.matchAll(/(['"`])(\/api\/[A-Za-z0-9_\-/.${}]*)/g)) {
      let p = m[2];
      const cut = p.indexOf('${'); if (cut >= 0) p = `${p.slice(0, cut)}${p.slice(0, cut).endsWith('/') ? 'x' : ''}`;
      p = p.replace(/\/$/, '');
      if (p === '/api' || !p) continue;
      if (!found.has(p)) found.set(p, `src/${n}`);
    }
  }
  ok(found.size > 0, `${found.size} distinct /api/ URLs found in src/`);
  for (const [p, where] of [...found].sort()) {
    const r = resolve(p);
    ok(r.via === 'rewrite' || r.via === 'file', `${p} (${where}) resolves to ${r.file || r.via}`);
  }
}

console.log('\n7. the three hosts');
{
  const headers = vj.headers || [];
  const redirects = vj.redirects || [];
  const blockFor = (host) => headers.find(h => hostConds(h, 'has').some(c => c.value === host));
  const value = (block, key) => (block?.headers || []).find(x => String(x.key).toLowerCase() === key.toLowerCase())?.value || '';
  for (const host of HOSTS) {
    const b = blockFor(host);
    const csp = value(b, 'Content-Security-Policy');
    ok(!!b && /script-src 'self' 'sha256-[A-Za-z0-9+/=_]+'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp), `${host} has its own header block, its CSP pins the inline script and says frame-ancestors 'none'`);
    if (host !== 'visualizestudio.org') ok(value(b, 'Cache-Control') === 'no-store', `${host} serves its pages no-store`);
    const hidden = rewrites.filter(r => /^\/api\//.test(r.source) && !onHost(r, host)).map(r => r.source);
    ok(hidden.length === 0, `no /api/ rewrite is kept off ${host} by a host condition (${hidden.join(', ') || 'none'})`);
    const missed = [...found.keys()].filter(p => { const r = resolve(p, host); return !(r.via === 'rewrite' || r.via === 'file'); });
    ok(found.size > 0 && missed.length === 0, `every /api/ URL the app requests reaches its function on ${host} (${missed.join(', ') || `all ${found.size}`})`);
  }
  const appPaths = ['/', '/c/abcdefghijklmnopqrst', '/planner/abcdefghijklmnopqrst', '/planner', '/app.webmanifest', '/api/portal', '/api/planner', '/sw.js'];
  const caught = appPaths.filter(p => redirects.some(r => onHost(r, 'app.visualizeclients.com') && (r.source === p || reFor(r.source.replace(/:path\*$/, ':path')).test(p))));
  ok(caught.length === 0, `no redirect catches a client app path on app.visualizeclients.com (${caught.join(', ') || 'none'})`);
  /* The old links (client app job): a portal or planner link on the public site lands on the same path on the app host. */
  for (const host of ['visualizestudio.org', 'www.visualizestudio.org']) {
    for (const p of ['/c/abcdefghijklmnopqrst', '/planner/abcdefghijklmnopqrst']) {
      const r = redirects.find(x => onHost(x, host) && reFor(x.source).test(p));
      const dest = r ? r.destination.replace(/:token/, p.split('/').pop()) : '';
      ok(dest === `https://app.visualizeclients.com${p}` && r.permanent === false, `${host}${p} redirects to the same path on the app host, not permanent (${dest || 'no redirect'})`);
    }
  }
  let mf = {}; try { mf = JSON.parse(read('public/app.webmanifest') || '{}'); } catch { mf = {}; }
  ok(mf.display === 'standalone' && mf.start_url === '/' && mf.scope === '/' && Array.isArray(mf.icons) && mf.icons.length > 0, `public/app.webmanifest is a standalone app that opens / (display ${mf.display || 'missing'}, start_url ${mf.start_url || 'missing'})`);
  const html = read('index.html');
  ok(/\^app\\\./.test(html) && html.includes("'/app.webmanifest'"), 'index.html points the app host at /app.webmanifest');
}

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
