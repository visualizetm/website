/* Fixture backed HTTP server (Prompt 15). Serves a built dist/ directory with
 * the SPA fallback and answers every admin API from scripts/audit-fixtures.mjs,
 * signed in, so tools that cannot use Playwright route mocks (Lighthouse) see
 * the same screens the audits see. Never touches a database.
 *
 *   DIST=dist PORT=4350 node scripts/mock-server.mjs
 *   MOCK_DELAY=300 node scripts/mock-server.mjs        # slow every admin GET
 *   MOCK_HOST=admin node scripts/mock-server.mjs       # also send the admin host headers (CSP) from vercel.json
 */
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { PAYLOADS, leads, orders, packs, projects } from './audit-fixtures.mjs';

const DIST = resolve(process.env.DIST || 'dist');
const PORT = Number(process.env.PORT || 4350);
const DELAY = Number(process.env.MOCK_DELAY || 0);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };

/* Production (Vercel) compresses text and serves /assets immutable; the server does the same so
 * Lighthouse measures the app, not the lack of a CDN. Admin host headers from vercel.json apply too. */
const VERCEL = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
const adminHeaders = (VERCEL.headers || []).filter(h => (h.has || []).some(c => c.type === 'host')).flatMap(h => h.headers).reduce((o, h) => ({ ...o, [h.key]: h.value }), {});
const commonHeaders = (VERCEL.headers || []).filter(h => !(h.has || []).length && !(h.missing || []).length).flatMap(h => h.headers).reduce((o, h) => ({ ...o, [h.key]: h.value }), {});
let currentReq = null;
const send = (res, status, body, type = 'application/json; charset=utf-8', extra = {}) => {
  const text = /^(text\/|application\/(json|javascript|manifest))/.test(type);
  const gzip = text && /gzip/.test(currentReq?.headers['accept-encoding'] || '');
  const out = gzip ? gzipSync(Buffer.from(body)) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': type.startsWith('application/json') ? 'no-store' : 'public, max-age=3600', ...(gzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}), ...commonHeaders, ...(process.env.MOCK_HOST === 'admin' ? adminHeaders : {}), ...extra });
  res.end(out);
};
const json = (res, data, status = 200) => send(res, status, JSON.stringify(data));

function api(req, res, url) {
  const p = url.pathname; const m = req.method;
  const get = (name) => setTimeout(() => json(res, PAYLOADS[name]()), m === 'GET' ? DELAY : 0);
  if (p === '/api/admin/session') return json(res, { authed: true });
  if (p === '/api/admin/login' || p === '/api/admin/logout') return json(res, { ok: true });
  if (p === '/api/admin/log') return json(res, { ok: true, items: [] });
  if (p === '/api/push-key') return json(res, { key: null });
  if (p.startsWith('/api/admin/submissions')) return m === 'GET' ? (url.searchParams.get('deleted') === '1' ? json(res, { items: [] }) : get('submissions')) : json(res, { ok: true });
  if (p.startsWith('/api/admin/settings')) return m === 'GET' ? get('settings') : json(res, { ok: true });
  if (p.startsWith('/api/admin/stripe')) return get('stripe');
  if (p.startsWith('/api/admin/calendly')) return get('calendly');
  if (p.startsWith('/api/admin/call-leads')) return m === 'GET' ? (url.searchParams.get('deleted') === '1' ? json(res, { items: [] }) : get('leads')) : json(res, { ok: true, item: { ...leads[0], _id: 'LNEW' } });
  if (p.startsWith('/api/admin/orders')) return m === 'GET' ? get('orders') : json(res, { ok: true, created: 2, item: { ...orders[0], _id: 'ONEW' } });
  if (p.startsWith('/api/admin/concept-packs')) return m === 'GET' ? get('packs') : json(res, { ok: true, item: { ...packs[0], _id: 'KNEW' } });
  if (p.startsWith('/api/admin/projects')) return m === 'GET' ? get('projects') : json(res, { ok: true, item: { ...projects[0], _id: 'PNEW' } });
  if (p === '/api/submissions') return json(res, { ok: true, id: 'subMock' });
  return json(res, { error: 'not mocked' }, 404);
}

const server = http.createServer((req, res) => {
  currentReq = req;
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => api(req, res, url));
    return;
  }
  let file = join(DIST, decodeURIComponent(url.pathname));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  const ext = extname(file);
  const type = TYPES[ext] || 'application/octet-stream';
  const headers = ext === '.html' ? { 'Cache-Control': 'no-cache' } : url.pathname.startsWith('/assets/') ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {};
  if (url.pathname === '/sw.js') headers['Service-Worker-Allowed'] = '/';
  try { send(res, 200, readFileSync(file), type, headers); } catch { send(res, 404, 'not found', 'text/plain'); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`mock server: ${DIST} on http://127.0.0.1:${PORT}`));
