import { route } from '../_lib/handler.js';
import { handler as reminders } from '../_routes/cron-reminders.js';
import { handler as daily } from '../_routes/cron-daily.js';

/* Both Vercel crons in one function (Hobby plan's 12 function cap). The
 * dynamic segment keeps the URLs unchanged: /api/cron/reminders and
 * /api/cron/daily still work exactly as before (vercel.json's cron paths
 * are untouched); req.query.job carries which one matched.
 */
const JOBS = {
  reminders: route(reminders, { methods: ['GET', 'POST'], admin: false, csrf: false }),
  daily: route(daily, { methods: ['GET', 'POST'], admin: false, csrf: false }),
};

export default function dispatch(req, res) {
  const fn = JOBS[req.query.job];
  if (!fn) return res.status(404).json({ error: 'not found' });
  return fn(req, res);
}
