import { route } from '../_lib/handler.js';
import { handler as backup } from '../_routes/backup.js';
import { handler as calendlyEvents } from '../_routes/calendly-events.js';
import { handler as callLeads } from '../_routes/call-leads.js';
import { handler as conceptPacks } from '../_routes/concept-packs.js';
import { handler as exportHandler } from '../_routes/export.js';
import { handler as leadsImport } from '../_routes/leads-import.js';
import { handler as log } from '../_routes/log.js';
import { handler as login } from '../_routes/login.js';
import { handler as logout } from '../_routes/logout.js';
import { handler as orders } from '../_routes/orders.js';
import { handler as projects } from '../_routes/projects.js';
import { handler as pushSubscribe } from '../_routes/push-subscribe.js';
import { handler as session } from '../_routes/session.js';
import { handler as settings } from '../_routes/settings.js';
import { handler as stripeEvents } from '../_routes/stripe-events.js';
import { handler as stripeReconcile } from '../_routes/stripe-reconcile.js';
import { handler as submissions } from '../_routes/submissions.js';

/* Every /api/admin/* endpoint in one Vercel function (Prompt: Hobby plan's 12
 * function cap). This file is the only thing Vercel deploys for the whole
 * admin API; the 17 routes below are files that would otherwise each be
 * their own function (api/_routes/, prefixed with an underscore, is never
 * deployed as a route by itself: https://vercel.com/docs/functions#exclude-files).
 *
 * The optional catch-all filename ([[...route]].js) matches /api/admin
 * itself (route = []) and every nested path (/api/admin/leads/import ->
 * route = ['leads', 'import']); req.query.route carries the matched
 * segments as an array (or is undefined at the bare path), and every other
 * query string parameter (?id=..., ?days=...) still lands on req.query
 * exactly as it did when each route was its own file, so nothing downstream
 * (src/shared/api.js, every fetch URL) needs to change.
 *
 * Each entry below is wrapped in route() exactly as it was in its own file
 * (same method allow list, admin guard, CSRF, body cap); adding a new admin
 * endpoint means a new file in api/_routes/ and one line here, not a new
 * Vercel function.
 */
const ROUTES = {
  'backup': route(backup, { methods: ['GET'] }),
  'calendly/events': route(calendlyEvents, { methods: ['GET'] }),
  'call-leads': route(callLeads, { methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxBody: 1024 * 1024 }),
  'concept-packs': route(conceptPacks, { methods: ['GET', 'POST', 'PATCH'] }),
  'export': route(exportHandler, { methods: ['GET'] }),
  'leads/import': route(leadsImport, { methods: ['POST'], maxBody: 2 * 1024 * 1024 }),
  'log': route(log, { methods: ['GET', 'POST', 'DELETE'], maxBody: 16 * 1024 }),
  'login': route(login, { methods: ['POST'], admin: false, csrf: true, maxBody: 4 * 1024 }),
  'logout': route(logout, { methods: ['POST'], admin: false, csrf: true, maxBody: 1024 }),
  'orders': route(orders, { methods: ['GET', 'POST', 'PATCH'] }),
  'projects': route(projects, { methods: ['GET', 'POST', 'PATCH'] }),
  'push-subscribe': route(pushSubscribe, { methods: ['POST'], maxBody: 8 * 1024 }),
  'session': route(session, { methods: ['GET'], admin: false }),
  'settings': route(settings, { methods: ['GET', 'POST', 'PATCH'], maxBody: 64 * 1024 }),
  'stripe/events': route(stripeEvents, { methods: ['GET'] }),
  'stripe/reconcile': route(stripeReconcile, { methods: ['POST'], maxBody: 4 * 1024 }),
  'submissions': route(submissions, { methods: ['GET', 'PATCH', 'DELETE'] }),
};

export default function dispatch(req, res) {
  const segs = req.query.route;
  const key = Array.isArray(segs) ? segs.join('/') : (segs || '');
  const fn = ROUTES[key];
  if (!fn) return res.status(404).json({ error: 'not found' });
  return fn(req, res);
}
