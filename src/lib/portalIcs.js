/* One calendar file for one meeting (client portal, prompt 3), beside src/lib/ics.js (the CRM's own meeting download): the text of
 * a .ics the portal hands the device as Add to calendar. Pure, so
 * scripts/portal-crm-test.mjs checks it in node. Times are UTC in the
 * file; the calendar app shows them in the device's zone. */
const pad = (n) => String(n).padStart(2, '0');
const stamp = (iso) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; };
const esc = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[;,]/g, (c) => `\\${c}`);
/** Lines of at most 75 bytes, folded with a leading space, as the format asks. */
const fold = (line) => { const out = []; let s = line; while (s.length > 75) { out.push(s.slice(0, 75)); s = ` ${s.slice(75)}`; } out.push(s); return out.join('\r\n'); };

/** { title, start, end, url, description, uid } to the file's text, or '' without a start. */
export function buildIcs({ title = 'Call with Rob', start, end = '', url = '', description = '', uid = '' } = {}, now = Date.now()) {
  const dtStart = stamp(start);
  if (!dtStart) return '';
  const dtEnd = stamp(end) || stamp(new Date(new Date(start).getTime() + 30 * 60e3).toISOString());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Visualize//Portal//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${esc(uid || `${dtStart}-${String(title).replace(/\W+/g, '')}@visualizestudio.org`)}`,
    `DTSTAMP:${stamp(new Date(now).toISOString())}`,
    `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
    `SUMMARY:${esc(title)}`,
    ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    ...(url ? [`URL:${esc(url)}`, `LOCATION:${esc(url)}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
export const icsDataUrl = (text) => `data:text/calendar;charset=utf-8,${encodeURIComponent(text)}`;
