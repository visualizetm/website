/* Every /api/admin/* endpoint except login, logout, and session in one Vercel
 * function (Hobby plan's 12 function cap). No dynamic path segment: the route
 * name arrives as ?r=<name>, put there by one vercel.json rewrite per URL
 * (/api/admin/call-leads -> /api/admin/index?r=call-leads), so every URL the
 * client already calls keeps working and the rest of the query string
 * (?id=..., ?days=...) still lands on req.query.
 *
 * Each entry is wrapped in route() (method allow list, admin guard via the
 * new requireAdmin, body cap, one try/catch) exactly as when each route was
 * its own file; the logic lives in api/_routes/<name>.js. Adding an endpoint
 * is a new file there, one line here, and one rewrite in vercel.json. */
import { route } from '../_lib/handler.js';
import { handler as backup } from '../_routes/backup.js';
import { handler as calendlyEvents } from '../_routes/calendly-events.js';
import { handler as callLeads } from '../_routes/call-leads.js';
import { handler as conceptPacks } from '../_routes/concept-packs.js';
import { handler as exportHandler } from '../_routes/export.js';
import { handler as leadsImport } from '../_routes/leads-import.js';
import { handler as log } from '../_routes/log.js';
import { handler as orders } from '../_routes/orders.js';
import { handler as posts } from '../_routes/posts.js';
import { handler as projects } from '../_routes/projects.js';
import { handler as pushSubscribe } from '../_routes/push-subscribe.js';
import { handler as settings } from '../_routes/settings.js';
import { handler as stripeEvents } from '../_routes/stripe-events.js';
import { handler as stripeReconcile } from '../_routes/stripe-reconcile.js';
import { handler as submissions } from '../_routes/submissions.js';

const ROUTES = {
  'backup': route(backup, { methods: ['GET'] }),
  'calendly-events': route(calendlyEvents, { methods: ['GET'] }),
  'call-leads': route(callLeads, { methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxBody: 1024 * 1024 }),
  'concept-packs': route(conceptPacks, { methods: ['GET', 'POST', 'PATCH'] }),
  'export': route(exportHandler, { methods: ['GET'] }),
  'leads-import': route(leadsImport, { methods: ['POST'], maxBody: 2 * 1024 * 1024 }),
  'log': route(log, { methods: ['GET', 'POST', 'DELETE'], maxBody: 16 * 1024 }),
  'orders': route(orders, { methods: ['GET', 'POST', 'PATCH'] }),
  'posts': route(posts, { methods: ['GET', 'POST', 'PATCH', 'DELETE'], maxBody: 256 * 1024 }),
  'projects': route(projects, { methods: ['GET', 'POST', 'PATCH'] }),
  'push-subscribe': route(pushSubscribe, { methods: ['POST'], maxBody: 8 * 1024 }),
  'settings': route(settings, { methods: ['GET', 'POST', 'PATCH'], maxBody: 64 * 1024 }),
  'stripe-events': route(stripeEvents, { methods: ['GET'] }),
  'stripe-reconcile': route(stripeReconcile, { methods: ['POST'], maxBody: 4 * 1024 }),
  'submissions': route(submissions, { methods: ['GET', 'PATCH', 'DELETE'] }),
};

function routeName(req) {
  const q = req.query?.r;
  if (typeof q === 'string' && q) return q;
  if (Array.isArray(q) && q[0]) return q[0];
  try { return new URL(req.url, 'http://localhost').searchParams.get('r') || ''; } catch { return ''; }
}

export default function handler(req, res) {
  const fn = ROUTES[routeName(req)];
  if (!fn) return res.status(404).json({ error: 'not found' });
  return fn(req, res);
}
