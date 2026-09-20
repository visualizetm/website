/* The daily cron's stage heals as drawer items (import-free so
 * scripts/pipeline-test.mjs can load it directly). A record the cron had to
 * put back to client (api/_routes/cron-daily.js step 1b, listed in
 * health.crons.daily.healedRecords) is named here so a wiped stage is
 * visible rather than silent. More than two heals on the same record means
 * something upstream is still wiping it. Seven days shown. */
const DAY = 864e5;
const ordinal = (n) => { const x = Number(n) || 0; const m = x % 100; return `${x}${m >= 11 && m <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][x % 10] || 'th'}`; };

/**
 * @param {Array} records health.crons.daily.healedRecords ({ id, business, at, count, rules })
 * @param {Array} leads the live records, to attach the lead for the drawer's open action
 * @param {object} snoozed notifications.snoozedUntil
 * @param {number} now
 */
export function healItems(records, leads = [], snoozed = {}, now = Date.now()) {
  const items = [];
  for (const r of Array.isArray(records) ? records : []) {
    const at = new Date(r?.at || 0).getTime();
    if (!r?.id || !at || now - at > 7 * DAY) continue;
    const id = `heal:${r.id}:${r.at}`;
    const sn = snoozed[id]; if (sn && new Date(sn).getTime() > now) continue;
    const repeat = Number(r.count) > 2;
    const lead = leads.find(l => String(l._id) === String(r.id));
    items.push({
      id, kind: 'heal', group: 'system', tone: repeat ? 'danger' : 'booked', icon: repeat ? 'AlertTriangle' : 'RefreshCw01', lead, at,
      title: `${r.business || lead?.business || 'A client'} was restored to Clients`,
      detail: repeat
        ? `The daily check found the stage wiped for the ${ordinal(r.count)} time and put it back. Something upstream is still wiping it: check the nightly enricher.`
        : 'The daily check found the stage wiped and put it back.',
    });
  }
  return items;
}
