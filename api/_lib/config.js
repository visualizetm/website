/* Admin auth configuration (auth rebuild). The repo is private and this file
 * is the single source of truth for the admin password: nothing else in api/
 * reads a password. An ADMIN_PASSWORD environment variable, when set in
 * Vercel, overrides the constant; otherwise the constant is the password.
 *
 * SESSION_SECRET signs the session cookie. The environment variable wins when
 * set; the fallback exists so sign in can never fail on a missing secret.
 * Rotating either value (and redeploying) signs every device out. */

export const ADMIN_PASSWORD = 'VISLIVE';
export const SESSION_DAYS = 30;
export const SESSION_SECRET_FALLBACK = 'visualize-admin-session-fallback-2026';

export const adminPassword = () => process.env.ADMIN_PASSWORD || ADMIN_PASSWORD;
export const sessionSecret = () => process.env.SESSION_SECRET || SESSION_SECRET_FALLBACK;
