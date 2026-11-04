/* Where each Home number opens (prompt 3 of 3, milestone 1): one table, read by Analytics and by invoices-test, so a tap cannot land on a
 * screen that does not show the number. Income opens Invoices on Paid 30 days, Outstanding on Past due, MRR opens Clients filtered to
 * retainers; the Ask rate tile opens the last session's summary. */
export const KPI_PATHS = {
  income: '/invoices?chip=paid30',
  outstanding: '/invoices?chip=past-due',
  mrr: '/clients?filter=retainer',
  clients: '/clients',
  leads: '/calls?section=leads',
  askRate: '/calls/summary',
};
export const kpiPath = (id) => KPI_PATHS[id] || '/';
/** The last call session's numbers (prompt 2's Summary keeps them under this key), or null. */
import { LAST_SESSION_KEY } from './callSession.js';
export function lastSession() {
  try { const v = JSON.parse(localStorage.getItem(LAST_SESSION_KEY) || 'null'); return v && typeof v.askRate === 'number' ? v : null; } catch { return null; }
}
/** The path the Ask rate tile opens: the summary while the session is still held, else the Calls hub. */
export function askRatePath() {
  try { return localStorage.getItem('vz_call_session') ? KPI_PATHS.askRate : '/calls'; } catch { return '/calls'; }
}
