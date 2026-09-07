/* One wrapper for the dispatched api/ routes (Prompt 15, trimmed in the auth
 * rebuild).
 *
 *   route(handler, { methods: ['GET', 'PATCH'], admin: true, maxBody: 512 * 1024 })
 *
 * In order: the method allow list (405 with Allow), the body size cap (413,
 * from Content-Length; Vercel itself refuses anything over 4.5MB), the admin
 * guard (401, requireAdmin in auth.js: a valid signed cookie, nothing else),
 * then the handler inside one try/catch. A thrown error answers
 * { error: 'server error' } with the stack logged server side only.
 *
 * admin: false for the public routes (submissions, push-key) and for the
 * routes that verify their own secret (the Stripe webhook, both crons). The
 * three auth endpoints (api/admin/login.js, logout.js, session.js) are plain
 * handlers with their own method check and do not use this wrapper.
 */
import { requireAdmin } from './auth.js';

export function route(handler, { methods = ['GET'], admin = true, maxBody = 512 * 1024 } = {}) {
  const allow = methods.join(', ');
  return async function wrapped(req, res) {
    try {
      if (!methods.includes(req.method)) { res.setHeader('Allow', allow); return res.status(405).json({ error: 'method not allowed' }); }
      const len = Number(req.headers['content-length'] || 0);
      if (len > maxBody) return res.status(413).json({ error: 'request too large' });
      if (admin && !requireAdmin(req, res)) return undefined;
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
