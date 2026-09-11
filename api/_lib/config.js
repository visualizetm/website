/* Admin auth configuration (auth rebuild, tightened in the security audit).
 * The repo is private and this file is the single source of truth for the
 * admin password: nothing else in api/ reads a password. An ADMIN_PASSWORD
 * environment variable, when set in Vercel, overrides the constant;
 * otherwise the constant is the password.
 *
 * SESSION_SECRET signs the session cookie, and on Vercel it is required:
 * a deployment without it refuses every sign in (500, "SESSION_SECRET is
 * not set") rather than signing with a string anyone with the repo can
 * read. The fallback below exists for local development and the node tests
 * only, where nothing is reachable from the internet. Rotating
 * SESSION_SECRET (and redeploying) signs every device out; see
 * docs/RUNBOOK.md, "Rotate SESSION_SECRET". */

export const ADMIN_PASSWORD = 'VISLIVE';
export const SESSION_DAYS = 30;
const DEV_ONLY_SESSION_SECRET = 'visualize-admin-local-dev-only';

export const adminPassword = () => process.env.ADMIN_PASSWORD || ADMIN_PASSWORD;
export const sessionSecret = () => {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // VERCEL=1 on every Vercel build and runtime, production and preview alike.
  if (process.env.VERCEL) throw new Error('SESSION_SECRET is not set');
  return DEV_ONLY_SESSION_SECRET;
};
