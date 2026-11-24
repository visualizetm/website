// Host-aware admin paths.
//
// The admin panel is served from its own subdomain (admin.visualizeclients.com)
// at clean root paths. On localhost/dev the /admin/* paths still work so the
// panel can be developed without DNS. On the public marketing domain the admin
// is not served at all (App.jsx redirects, and vercel.json blocks at the edge).
const host = typeof window !== 'undefined' ? window.location.hostname : '';

export const IS_ADMIN_HOST = host === 'admin.visualizeclients.com' || host.startsWith('admin.');
export const IS_DEV_HOST = host === 'localhost' || host === '127.0.0.1';

export const ADMIN_HOME   = IS_ADMIN_HOST ? '/'       : '/admin';
export const ADMIN_CALLS  = IS_ADMIN_HOST ? '/calls'  : '/admin/calls';

/* Billy's Call Room: /room on the admin host (/admin/room on localhost). Its own app and its own session; nothing under it is the admin. */
export const ROOM_BASE = IS_ADMIN_HOST ? '/room' : '/admin/room';
export const isRoomPath = (pathname) => { const p = String(pathname || ''); return p === ROOM_BASE || p.startsWith(`${ROOM_BASE}/`); };

/* The client app (client app job): app.visualizeclients.com serves only the client's panel, the portal and the planner behind
 * one sign in, at root paths. On localhost it lives under /app (the dev switch, the way the admin lives under /admin), so
 * every path the app builds goes through appPath(). */
export const IS_APP_HOST = host === 'app.visualizeclients.com' || host.startsWith('app.');
export const APP_BASE = IS_APP_HOST ? '' : '/app';
export const appPath = (p = '/') => `${APP_BASE}${p === '/' && APP_BASE ? '' : p}` || '/';
export const isAppPath = (pathname) => { const p = String(pathname || ''); return IS_APP_HOST || (IS_DEV_HOST && (p === '/app' || p.startsWith('/app/'))); };
