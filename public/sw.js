/* Visualize service worker (Prompt 15): web push, notification deep links,
 * and an offline shell for the admin.
 *
 * Caches (all versioned; anything not in VERSION is deleted on activate):
 *   shell-v*   the navigation shell (index.html), the hashed /assets, /fonts,
 *              the icons and the manifest: cache first, filled as they load
 *              (the precache is tiny on purpose; the worker registers after
 *              first paint and never competes with the app's own requests)
 *   api-v*     the last successful GET of call-leads, projects, orders,
 *              concept-packs, and settings: network first, cache when the
 *              network fails, so the admin opens and reads offline
 * Writes are never cached or replayed (the app refuses them offline).
 */
const VERSION = 'v3.0.0';
const SHELL = `shell-${VERSION}`;
const API = `api-${VERSION}`;
const PRECACHE = ['/', '/manifest.webmanifest', '/logo.svg', '/icons/icon-192.png', '/icons/badge-96.png']; // the rest of the shell, the fonts, and the chunks fill in as the app requests them
const API_CACHED = ['/api/admin/call-leads', '/api/admin/projects', '/api/admin/orders', '/api/admin/concept-packs', '/api/admin/settings'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== API).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isShellAsset = (url) => url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/') || url.pathname === '/logo.svg' || url.pathname === '/manifest.webmanifest';
const isCachedApi = (url) => API_CACHED.some((p) => url.pathname === p) && !url.searchParams.has('deleted');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first for the document; the cached shell when offline.
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put('/', copy)); return res; }).catch(() => caches.match('/')));
    return;
  }
  if (isShellAsset(url)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  if (isCachedApi(url)) {
    event.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(API).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then((hit) => hit || new Response(JSON.stringify({ error: 'offline', items: [] }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* non JSON push */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'New submission', {
      body: data.body || 'Open the admin panel to view it.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
