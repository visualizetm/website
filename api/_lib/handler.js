/* One wrapper for every api/ function (Prompt 15).
 *
 *   export default route(handler, { methods: ['GET', 'PATCH'], admin: true, csrf: true, maxBody: 512 * 1024 });
 *
 * In order: the method allow list (405 with Allow), the body size cap (413,
 * from Content-Length; Vercel itself refuses anything over 4.5MB), the admin
 * guard (401) with the sliding cookie renewal, the CSRF header on every
 * non GET admin request (403: apiFetch sends X-Requested-With: visualize,
 * nothing else does), then the handler inside one try/catch. A thrown error
 * answers { error: 'server error' } with the stack logged server side only.
 *
 * admin: false for the public routes (submissions, push-key, session, login,
 * logout) and for the routes that verify their own secret (the Stripe
 * webhook, both crons). csrf defaults to admin; login and logout keep it on.
 */
import { requireAdmin, renewSession } from './auth.js';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'visualize';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function route(handler, { methods = ['GET'], admin = true, csrf = admin, maxBody = 512 * 1024 } = {}) {
  const allow = methods.join(', ');
  return async function wrapped(req, res) {
    try {
      if (!methods.includes(req.method)) { res.setHeader('Allow', allow); return res.status(405).json({ error: 'method not allowed' }); }
      const len = Number(req.headers['content-length'] || 0);
      if (len > maxBody) return res.status(413).json({ error: 'request too large' });
      if (admin) { if (!requireAdmin(req, res)) return undefined; renewSession(req, res); }
      if (csrf && !SAFE.has(req.method) && String(req.headers[CSRF_HEADER] || '').toLowerCase() !== CSRF_VALUE) return res.status(403).json({ error: 'missing request header' });
      return await handler(req, res);
    } catch (err) {
      console.error(`[api] ${req.method} ${req.url}`, err?.stack || err);
      if (!res.headersSent) return res.status(500).json({ error: 'server error' });
      return undefined;
    }
  };
}

/** Client IP behind Vercel: the first X-Forwarded-For entry, else the socket. */
export const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
