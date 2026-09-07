/* Site Prompt 5, Part 3: a post-build step, not a new Vercel function. The
 * marketing host otherwise serves the same static dist/index.html for
 * every route (vercel.json's catch-all rewrite), so a crawler or a link
 * preview fetch on /clients/:slug never sees that client's real title,
 * description, or cover, only the site-wide default (see index.html and
 * src/marketing/useHead.js) since those only land after the SPA's JS runs.
 *
 * This writes one dist/clients/<slug>/index.html per published client:
 * dist/index.html's own template with that client's title/description/
 * og:image swapped in, keeping every script and stylesheet tag untouched
 * so the exact same app bundle boots from it. Vercel serves a real file in
 * the output directory before it ever consults the rewrites array (its
 * documented routing order: filesystem match, then rewrites), so
 * /clients/<slug> resolves to this file with no rewrite rule needed for it
 * specifically; a slug with no prerendered file still falls through to the
 * existing catch-all -> index.html -> the SPA fetches it live. Once
 * client-side JS takes over, useHead() (CaseStudy.jsx) immediately
 * re-fetches and re-applies the live values, so a stale prerendered
 * snapshot self-corrects for anyone who lands and stays.
 *
 * Fails soft: any network error, non-200, or bad JSON from the production
 * endpoint fetch leaves zero prerendered client pages rather than failing
 * the build. Override the source with PRERENDER_SHOWCASE_URL (used by this
 * script's own local runs, where the sandbox cannot reach production).
 *
 *   node scripts/prerender-clients.mjs                     # after vite build
 *   PRERENDER_SHOWCASE_URL=http://127.0.0.1:4350/api/showcase node scripts/prerender-clients.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = process.env.PRERENDER_SHOWCASE_URL || 'https://visualizestudio.org/api/showcase';
const DIST = resolve('dist');
const SITE = 'https://visualizestudio.org';
const TIMEOUT_MS = 8000;

async function fetchPublishedClients() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(SOURCE, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.clients) ? data.clients : [];
  } catch (err) {
    console.log(`[prerender-clients] fetch failed (${err.message}), skipping: 0 client pages prerendered`);
    return [];
  }
}

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

function pageFor(template, client) {
  const title = `${client.displayName} | Visualize.`;
  const description = (client.blurb || '').replace(/"/g, '&quot;');
  const image = client.cover ? (client.cover.startsWith('http') ? client.cover : `${SITE}${client.cover}`) : `${SITE}/og-default.png`;

  let html = template;
  html = html.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
  html = html.replace(/<meta name="description" content=".*?" \/>/s, `<meta name="description" content="${description}" />`);
  html = html.replace(/<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${title}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/s, `<meta property="og:description" content="${description}" />`);
  html = html.replace(/<meta property="og:image" content=".*?" \/>/s, `<meta property="og:image" content="${image}" />`);
  return html;
}

async function main() {
  const indexPath = resolve(DIST, 'index.html');
  if (!existsSync(indexPath)) {
    console.log('[prerender-clients] dist/index.html not found, run vite build first, skipping');
    return;
  }
  const template = readFileSync(indexPath, 'utf8');
  const clients = await fetchPublishedClients();

  let written = 0;
  for (const client of clients) {
    if (!client.slug || !SAFE_SLUG.test(client.slug)) continue;
    const dir = resolve(DIST, 'clients', client.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), pageFor(template, client));
    written++;
  }
  console.log(`[prerender-clients] ${written} client page(s) prerendered from ${clients.length} published`);
}

await main();
