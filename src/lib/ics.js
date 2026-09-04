/* Client-side .ics builder for a booked meeting (Prompt 8). */
import { meetingDate } from './booked';
import { formatPhone } from '../shared/phone';

const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');

export function meetingIcs(lead, minutes = 30) {
  const start = meetingDate(lead);
  if (!start) return null;
  const end = new Date(start.getTime() + minutes * 60e3);
  const desc = [lead.askFor && `Ask for ${lead.askFor.replace(/^Ask for /i, '')}`, lead.phone && `Phone: ${formatPhone(lead.phone)}`, lead.meeting?.location && `Where: ${lead.meeting.location}`, lead.descriptor].filter(Boolean).join('\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Visualize//CRM//EN', 'BEGIN:VEVENT',
    `UID:${lead._id}-${stamp(start)}@visualizestudio`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Meeting: ${lead.business}`)}`, `DESCRIPTION:${esc(desc)}`, lead.meeting?.location ? `LOCATION:${esc(lead.meeting.location)}` : null,
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}

export function downloadIcs(lead) {
  const ics = meetingIcs(lead); if (!ics) return false;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${String(lead.business || 'meeting').replace(/[^\w]+/g, '-').toLowerCase()}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
