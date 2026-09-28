/* Nurture (CRM revamp, step 4): a record parked until a day, with why. */
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const addDaysKey = (days, now = Date.now()) => dayKey(new Date(now + days * 864e5));
/** Said no in the call room: 90 days out. */
export const saidNoPatch = (now = Date.now()) => ({ stage: 'nurture', nurture: { until: addDaysKey(90, now), reason: 'Said no' }, nextAction: null, listId: '' });
export const nurtureUntil = (lead) => (/^\d{4}-\d{2}-\d{2}$/.test(String(lead?.nurture?.until || '')) ? lead.nurture.until : '');
