/* localStorage with guards. Keys the shell owns. */
export const KEYS = {
  collapsed: 'vz_shell_collapsed',
  recent: 'vz_cmd_recent',
  notifRead: 'vz_notif_read',
};
export function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or full */ }
}
