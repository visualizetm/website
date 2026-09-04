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
