import { route } from '../_lib/handler.js';
import { handler as reminders } from '../_routes/cron-reminders.js';
import { handler as daily } from '../_routes/cron-daily.js';

/* Both Vercel crons in one function. A plain index.js plus one rewrite in
 * vercel.json (/api/cron/:job to /api/cron/index?job=:job): the URLs are
 * unchanged, /api/cron/reminders and /api/cron/daily, and req.query.job
 * carries which one matched. It is not a [job].js file on purpose: this
 * project's /(.*) catch-all to /index.html wins over a dynamic segment, so
 * that path answered with the SPA and the crons never ran.
 */
const JOBS = {
  reminders: route(reminders, { methods: ['GET', 'POST'], admin: false, csrf: false }),
  daily: route(daily, { methods: ['GET', 'POST'], admin: false, csrf: false }),
};

/* req.query.job is whatever sits after /api/cron/ in the URL, before any secret is checked, so only an own key of JOBS is a job: a plain
 * lookup would answer /api/cron/constructor with Object(req, res), which never ends the response. */
export default function dispatch(req, res) {
  const job = req.query.job;
  const fn = typeof job === 'string' && Object.hasOwn(JOBS, job) ? JOBS[job] : null;
  if (!fn) return res.status(404).json({ error: 'not found' });
  return fn(req, res);
}
