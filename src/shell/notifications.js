/* Notification sources that need no new endpoints. All derived from the
 * call_leads list the shell already loads.
 *
 *  1. Callbacks due: callStatus === 'callback'. The console stores no due
 *     date for a callback (only the log entry's note and timestamp), so
 *     every open callback is due: today if asked today, overdue otherwise.
 *  2. Meetings in the next 24 hours: stage booked with meeting.date/time
 *     (meetingDate() in src/lib/booked.js) between now and now + 24h.
 *  3. New leads in the last 48 hours: createdAt >= now - 48h, stage lead.
 */
import { normalizeStage } from '../shared/semantics';
import { meetingDate } from '../lib/booked';

const H = 3600e3;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function buildNotifications(leads, now = Date.now()) {
  const nowD = new Date(now);
  const items = [];
  for (const lead of leads) {
    const stage = normalizeStage(lead);
    if (lead.callStatus === 'callback' && stage !== 'lost') {
      const entries = (lead.callLog || []).filter(e => e.outcome === 'callback');
      const last = entries[entries.length - 1];
      // With a callbackAt (Prompt 7) the due time is real: overdue when it has passed,
      // today when it is today, upcoming otherwise. Without it, the old rule applies:
      // due today if asked today, overdue if asked on a previous day.
      const due = lead.callbackAt ? new Date(lead.callbackAt).getTime() : null;
      const at = due || (last?.at ? new Date(last.at).getTime() : new Date(lead.updatedAt || lead.createdAt || now).getTime());
      const overdue = due ? due < now : !sameDay(new Date(at), nowD);
      const group = due && !overdue && !sameDay(new Date(due), nowD) ? 'upcoming' : 'today';
      items.push({
        id: `cb:${lead._id}:${lead.callbackAt || last?.at || ''}`, kind: 'callback', group, tone: overdue ? 'danger' : 'callback', icon: 'PhoneIncoming01',
        title: `${overdue ? 'Overdue callback' : group === 'upcoming' ? 'Callback' : 'Callback due'}: ${lead.business}`,
        detail: due ? `${new Date(due).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${last?.note ? `, ${last.note}` : ''}` : (last?.note || (lead.bestWindow ? `Best window ${lead.bestWindow}` : 'They asked you to call back.')),
        at, lead,
      });
    }
    if (stage === 'booked') {
      const d = meetingDate(lead);
      if (d && d.getTime() >= now - H && d.getTime() <= now + 24 * H) {
        items.push({
          id: `mt:${lead._id}:${lead.meeting?.date}:${lead.meeting?.time || ''}`, kind: 'meeting', group: sameDay(d, nowD) ? 'today' : 'upcoming', tone: 'booked', icon: 'CalendarCheck01',
          title: `Meeting: ${lead.business}`,
          detail: `${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${lead.meeting?.type ? ` by ${lead.meeting.type === 'in-person' ? 'in person' : lead.meeting.type}` : ''}${lead.askFor ? `, ask for ${lead.askFor.replace(/^Ask for /i, '')}` : ''}`,
          at: d.getTime(), lead,
        });
      }
    }
    if (stage === 'lead' && lead.createdAt) {
      const c = new Date(lead.createdAt).getTime();
      if (c >= now - 48 * H && c <= now + H) {
        items.push({
          id: `new:${lead._id}`, kind: 'new', group: 'new', tone: 'new', icon: 'Users01',
          title: `New lead: ${lead.business}`,
          detail: [lead.industry, lead.area].filter(Boolean).join(', ') || 'Added to the pipeline.',
          at: c, lead,
        });
      }
    }
  }
  const order = { today: 0, upcoming: 1, new: 2 };
  items.sort((a, b) => order[a.group] - order[b.group] || (a.group === 'new' ? b.at - a.at : a.at - b.at));
  return items;
}

export const GROUP_LABELS = { today: 'Today', upcoming: 'Upcoming', new: 'New leads' };
