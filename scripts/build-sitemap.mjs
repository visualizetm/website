/* Site Prompt 5, Part 3: sitemap.xml, generated at build from the static
 * routes plus every published client slug, fetched the same way and with
 * the same fail-soft rule as scripts/prerender-clients.mjs (a network
 * error, a non-200, or bad JSON leaves the sitemap with just the static
 * routes rather than failing the build). robots.txt (public/, a plain
 * static file, it never changes) points at this.
 *
 *   node scripts/build-sitemap.mjs                     # after vite build
 *   PRERENDER_SHOWCASE_URL=http://127.0.0.1:4350/api/showcase node scripts/build-sitemap.mjs
 */
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = process.env.PRERENDER_SHOWCASE_URL || 'https://visualizestudio.org/api/showcase';
const DIST = resolve('dist');
const SITE = 'https://visualizestudio.org';
const TIMEOUT_MS = 8000;

const STATIC_ROUTES = ['/', '/services', '/clients', '/contact', '/start', '/prints'];
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

async function fetchPublishedSlugs() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(SOURCE, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.clients) ? data.clients.map(c => c.slug).filter(s => s && SAFE_SLUG.test(s)) : [];
  } catch (err) {
    console.log(`[build-sitemap] fetch failed (${err.message}), sitemap will carry only the static routes`);
    return [];
  }
}

async function main() {
  if (!existsSync(DIST)) {
    console.log('[build-sitemap] dist/ not found, run vite build first, skipping');
    return;
  }
  const slugs = await fetchPublishedSlugs();
  const urls = [...STATIC_ROUTES, ...slugs.map(s => `/clients/${s}`)];
  const today = new Date().toISOString().slice(0, 10);
  const body = urls.map(u => `  <url>\n    <loc>${SITE}${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  writeFileSync(resolve(DIST, 'sitemap.xml'), xml);
  console.log(`[build-sitemap] sitemap.xml written, ${STATIC_ROUTES.length} static route(s) + ${slugs.length} client(s)`);
}

await main();
