/* The decline write (CRM revamp, step 1), pure so the pipeline test can read
 * it: stage declined, the reason, the callback cleared, the next action
 * cleared, the dial list membership cleared, explicit for the guard. */
export function declinePatch(lead, reason, note) {
  const set = { stage: 'declined', declined: { reason, note: String(note || '').trim().slice(0, 300), at: new Date().toISOString() }, callbackAt: '', nextAction: null, listId: '', explicit: true };
  if (lead?.afterCall && typeof lead.afterCall === 'object' && lead.afterCall.nextAction) set.afterCall = { ...lead.afterCall, nextAction: '' };
  return set;
}
export function undoDeclinePatch(lead) {
  return { stage: lead?.stage && lead.stage !== 'declined' ? lead.stage : 'lead', declined: null, callbackAt: lead?.callbackAt || '', nextAction: lead?.nextAction || null, listId: lead?.listId || '', explicit: true, ...(lead?.afterCall && typeof lead.afterCall === 'object' ? { afterCall: lead.afterCall } : {}) };
}
