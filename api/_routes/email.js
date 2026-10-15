import { getDb } from '../_lib/mongo.js';
import { emailConnected, fromLine, SENDS_PER_HOUR, sendsThisHour } from '../_lib/email/transport.js';
import { readEmailSettings } from '../_lib/email/settings.js';

/* The email system's admin endpoints (milestone 1), one dispatched route:
 * vercel.json rewrites /api/admin/email/<action> to /api/admin/index?r=email&a=<action>,
 * so every action rides on the one admin function and keeps the admin
 * guard, the body cap and the try/catch of route().
 *
 *   GET  email/status    { connected, sender, from, sentLastHour, limit }
 *
 * Milestone 2 adds preview, send, log and settings. An action with the
 * wrong method answers 405 with Allow; an unknown action 404. */
const METHODS = { status: ['GET'] };
const actionOf = (req) => {
  const a = req.query?.a;
  if (typeof a === 'string' && a) return a;
  try { return new URL(req.url, 'http://localhost').searchParams.get('a') || ''; } catch { return ''; }
};

export async function handler(req, res) {
  const a = actionOf(req);
  const allow = METHODS[a];
  if (!allow) return res.status(404).json({ error: 'not found' });
  if (!allow.includes(req.method)) { res.setHeader('Allow', allow.join(', ')); return res.status(405).json({ error: 'method not allowed' }); }
  const db = await getDb();

  if (a === 'status') {
    const settings = await readEmailSettings(db);
    const sentLastHour = await sendsThisHour(db);
    /* Connected is whether the key exists, never its value; the sender is what settings say, defaults included. */
    return res.status(200).json({ connected: emailConnected(), sender: settings.sender, from: fromLine(settings.sender), sentLastHour, limit: SENDS_PER_HOUR });
  }
  return res.status(404).json({ error: 'not found' });
}
