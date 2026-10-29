import { emptyDeal } from './deal';
import { dealFromOptions } from './dealConvert';
import { saidNoPatch } from './nurture';
import { fmtDate } from '../shared/dates';

/* What logging a call outcome writes to a lead, in one place: the Call Console and the home's Next up block both build the write
 * here, so a callback logged from either lands the same way. Pure; the caller does the patch, the lists rule and the Undo toast.
 *   outcome: booked, callback, no-answer, no, wrong-number
 *   extra:   { note, email, meeting, callbackAt } from the Log outcome sheet */
export function callOutcomeSet(lead, outcome, extra = {}, now = Date.now()) {
  const at = new Date(now).toISOString();
  const entry = { at, outcome, note: (extra.note || '').trim(), meeting: outcome === 'booked' && extra.meeting ? `${extra.meeting.date} ${extra.meeting.time}` : '', email: outcome === 'booked' ? (extra.email || '').trim() : '' };
  /* Where the lead stood, so an undo puts it back. */
  const prev = { _id: lead._id, callStatus: lead.callStatus || 'not-called', callLog: lead.callLog || [], stage: lead.stage, callbackAt: lead.callbackAt || '', phoneNote: lead.phoneNote || '', meeting: lead.meeting, afterCall: lead.afterCall, nurture: lead.nurture || null, listId: lead.listId || '' };
  const set = { callStatus: outcome, callLog: [...(lead.callLog || []), entry] };
  // CRM revamp, step 5: a booking starts the deal, the package from the recommended pricing option.
  if (outcome === 'booked') { set.stage = 'booked'; if (!lead.deal) set.deal = { ...emptyDeal(), ...dealFromOptions(lead.pricingOptions) }; if (extra.meeting) set.meeting = extra.meeting; if (entry.email || entry.meeting) set.afterCall = { ...(lead.afterCall || {}), meeting: entry.meeting || lead.afterCall?.meeting || '', email: entry.email || lead.afterCall?.email || '' }; }
  if (outcome === 'callback') set.callbackAt = extra.callbackAt || '';
  if (outcome === 'wrong-number') set.phoneNote = `Wrong number (${fmtDate(at)})`;
  // CRM revamp, step 4: a no parks the lead in nurture for 90 days instead of deleting it.
  if (outcome === 'no') Object.assign(set, saidNoPatch());
  return { set, entry, prev };
}

/** The write that puts a lead back to `prev` (from callOutcomeSet). */
export const outcomeUndoSet = (prev) => ({ callStatus: prev.callStatus, callLog: prev.callLog, stage: prev.stage, callbackAt: prev.callbackAt, phoneNote: prev.phoneNote, nurture: prev.nurture, listId: prev.listId, ...(prev.meeting ? { meeting: prev.meeting } : {}), ...(prev.afterCall ? { afterCall: prev.afterCall } : {}) });
