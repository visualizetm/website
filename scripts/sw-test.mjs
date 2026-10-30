#!/usr/bin/env node
/* The service worker (public/sw.js) run in a sandbox with the browser's pieces stubbed: a push always shows a notification (Apple
 * revokes permission for a silent one), the payload's title, body and url are used, a tap focuses an open window and sends it to the
 * url or opens one, and a replaced subscription is made again and sent to the server.
 *   node scripts/sw-test.mjs */
import fs from 'fs';
import path from 'path';
import vm from 'node:vm';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);
const src = fs.readFileSync(path.join(repoRoot, 'public', 'sw.js'), 'utf8');

/* A fresh worker per case, so what one case does never leaks into the next. */
function worker({ windows = [], fetchImpl, subscribeImpl } = {}) {
  const listeners = {}; const log = { shown: [], fetches: [], opened: [], navigated: [], focused: [], subscribed: [], closed: 0 };
  const self = {
    addEventListener: (t, f) => { listeners[t] = f; },
    location: { origin: 'https://admin.visualizeclients.com' },
    skipWaiting: () => Promise.resolve(),
    registration: {
      showNotification: (title, opts) => { log.shown.push({ title, opts }); return Promise.resolve(); },
      pushManager: { subscribe: async (opts) => { log.subscribed.push(opts); return subscribeImpl ? subscribeImpl(opts) : { toJSON: () => ({ endpoint: 'https://push.example/new', keys: { p256dh: 'a', auth: 'b' } }) }; } },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: async () => windows.map((w) => ({ ...w, focus: async () => { log.focused.push(w.url); return w; }, navigate: async (u) => { log.navigated.push(u); } })),
      openWindow: async (u) => { log.opened.push(u); return {}; },
    },
  };
  const ctx = vm.createContext({ self, caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }), keys: async () => [], match: async () => undefined, delete: async () => true }, fetch: async (url, init) => { log.fetches.push({ url: String(url), init }); if (fetchImpl) return fetchImpl(url, init); return { ok: true, json: async () => ({ key: 'SERVER-KEY' }), clone() { return this; } }; }, URL, Response, Promise, JSON, console, setTimeout });
  vm.runInContext(src, ctx);
  const fire = async (type, ev = {}) => { const pending = []; const event = { waitUntil: (p) => pending.push(p), notification: { close: () => { log.closed++; }, data: ev.notificationData }, ...ev }; listeners[type](event); await Promise.allSettled(pending); return pending.length; };
  return { fire, log, listeners };
}

section('1. a push always shows a notification');
{
  let w = worker();
  await w.fire('push', { data: { json: () => ({ title: 'Call back: Bella Rosy, 5:00 PM', body: '(302) 555-0100', url: 'https://admin.visualizeclients.com/leads?open=L1' }) } });
  ok(w.log.shown.length === 1 && w.log.shown[0].title === 'Call back: Bella Rosy, 5:00 PM' && w.log.shown[0].opts.body === '(302) 555-0100', 'the title and body from the payload are shown');
  ok(w.log.shown[0].opts.data.url === 'https://admin.visualizeclients.com/leads?open=L1' && w.log.shown[0].opts.icon === '/icon-192.png' && w.log.shown[0].opts.badge === '/badge-96.png', 'the url rides along, with the icon and the badge');
  w = worker();
  await w.fire('push', {});
  ok(w.log.shown.length === 1 && !!w.log.shown[0].title, 'a push with no data still shows something (a silent push would revoke the permission)', 'sw-always-show');
  w = worker();
  await w.fire('push', { data: { json: () => { throw new Error('not json'); } } });
  ok(w.log.shown.length === 1, 'a payload that is not JSON still shows something');
}

section('2. the tap');
{
  let w = worker({ windows: [{ url: 'https://admin.visualizeclients.com/' }] });
  await w.fire('notificationclick', { notificationData: { url: 'https://admin.visualizeclients.com/tasks?open=L1' } });
  ok(w.log.closed === 1 && w.log.navigated.join() === 'https://admin.visualizeclients.com/tasks?open=L1' && w.log.focused.length === 1 && w.log.opened.length === 0, 'with the app open: the notification closes, the window goes to the url and is focused');
  w = worker({ windows: [] });
  await w.fire('notificationclick', { notificationData: { url: 'https://admin.visualizeclients.com/leads?open=L2' } });
  ok(w.log.opened.join() === 'https://admin.visualizeclients.com/leads?open=L2', 'with no window: one is opened at the url');
  w = worker({ windows: [] });
  await w.fire('notificationclick', { notificationData: undefined });
  ok(w.log.opened.join() === '/', 'a notification with no url opens the home');
}

section('3. a replaced subscription is made again and sent to the server');
{
  const key = new Uint8Array([1, 2, 3]);
  let w = worker();
  await w.fire('pushsubscriptionchange', { oldSubscription: { options: { applicationServerKey: key } } });
  const post = w.log.fetches.find(f => f.url === '/api/admin/push-subscribe');
  ok(w.log.subscribed.length === 1 && w.log.subscribed[0].userVisibleOnly === true && w.log.subscribed[0].applicationServerKey === key, 'it subscribes again with the old subscription\'s key and userVisibleOnly', 'sw-resubscribe');
  ok(!!post && post.init.method === 'POST' && post.init.credentials === 'include' && JSON.parse(post.init.body).subscription.endpoint === 'https://push.example/new', 'and posts the new subscription with the cookie');
  w = worker();
  await w.fire('pushsubscriptionchange', { oldSubscription: null });
  ok(w.log.fetches[0].url === '/api/push-key' && w.log.subscribed[0].applicationServerKey === 'SERVER-KEY', 'with no old subscription it asks the server for the key');
  w = worker();
  await w.fire('pushsubscriptionchange', { newSubscription: { toJSON: () => ({ endpoint: 'https://push.example/given', keys: {} }) } });
  ok(w.log.subscribed.length === 0 && JSON.parse(w.log.fetches[0].init.body).subscription.endpoint === 'https://push.example/given', 'a browser that already made the new one gets it posted, not made twice');
  w = worker({ fetchImpl: async () => { throw new Error('offline'); } });
  const n = await w.fire('pushsubscriptionchange', { oldSubscription: { options: { applicationServerKey: key } } });
  ok(n === 1, 'a failure is swallowed: the app subscribes again on its next open');
}

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
