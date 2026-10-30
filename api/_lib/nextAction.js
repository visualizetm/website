/* Server mirror of src/lib/nextAction.js (CRM revamp, step 2): the same
 * rules, self contained because a serverless function cannot import from
 * src/. The daily cron recomputes every live lead and project with this so
 * a record that drifted (a write that skipped the shared helper) is put
 * right overnight. Keep the two files' rules identical. */
import { NEXT_ACTION_KIND_IDS, normalizeStage } from '../_semantics.js';
import { invoicesOf, invoiceStatus, invoicesPastDue } from './invoices.js';
import { dealOf } from './deal.js';
import { zoneDayKey, zoneDayMs, zoneDateAt, zoneMeetingMs, keyAddDays } from './zone.js';
import { taskNextUp, taskAsAction } from './taskRules.js';

const DAY = 864e5;
const HOUR = 3600e3;
const ASK_AFTER_DAYS = 3;
const PITCH_AFTER_DAYS = 3;
const ROUND_DAYS = 7;
const RUSH_EXTRA_DAYS = 3;
const LABELS = { call: 'Call', callback: 'Call back', 'build-concepts': 'Build concepts', 'log-outcome': 'Log the outcome', 'send-onboarding': 'Send onboarding', 'chase-form': 'Chase the form', 'send-contract': 'Send the contract', 'chase-contract': 'Chase the contract', 'send-invoice': 'Send the invoice', 'chase-invoice': 'Chase the invoice', kickoff: 'Kick off', revision: 'Revision round', deliver: 'Deliver', 'retainer-pitch': 'Pitch the retainer', 'review-ask': 'Ask for a review', custom: 'Custom' };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' && DATE_ONLY.test(v)) { const t = zoneDayMs(v); return Number.isNaN(t) ? null : new Date(t); }
  const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d;
}
const meetingDate = (lead) => { const m = lead?.meeting; if (!m?.date) return null; const t = zoneMeetingMs(m.date, m.time || '09:00'); return Number.isNaN(t) ? null : new Date(t); };
const iso = (t) => new Date(t).toISOString();
const act = (kind, dueAt, label) => ({ kind, label: label || LABELS[kind] || kind, dueAt: dueAt ? iso(dueAt) : '', auto: true, doneAt: '' });
export const isProject = (r) => !!r && typeof r === 'object' && 'leadId' in r && !('business' in r);
const ctxOf = (ctx) => (Array.isArray(ctx) ? { projects: ctx } : (ctx || {}));
export function dayBeforeAt9(meetingIso) { const m = parseDate(meetingIso); if (!m) return null; return zoneDateAt(keyAddDays(zoneDayKey(m.getTime()), -1), 9, 0); }

/* The callback a lead is waiting on, in ms (0 for none). The Next up row (leadAction) and the reminders cron (callbackDue) read this
 * and nothing else. It is a callbackAt on an open record (triage or lead) that nothing has answered; callStatus is not required to
 * be 'callback', because the record's own picker wrote callbackAt alone while the Call Console, the calendar and the swipe write
 * both. A call outcome that closes the call (booked, no, wrong number) is not a callback, and a call logged at or after the time
 * has answered it. */
const CALL_CLOSED = ['booked', 'no', 'wrong-number'];
export function callbackAtOf(lead) {
  if (!lead || typeof lead !== 'object' || lead.deleted) return 0;
  const stage = normalizeStage(lead);
  if (stage !== 'lead' && stage !== 'triage') return 0;
  if (CALL_CLOSED.includes(lead.callStatus)) return 0;
  const at = parseDate(lead.callbackAt)?.getTime() || 0;
  if (!at) return 0;
  if (lead.callStatus === 'callback') return at;
  const last = Math.max(0, ...(Array.isArray(lead.callLog) ? lead.callLog : []).map(e => parseDate(e?.at)?.getTime() || 0));
  return last >= at ? 0 : at;
}

/** The callback the reminders cron owes a push for, as { at, stamp } (stamp is the stored string, the dedupe key's tail), or null.
 * The same answer Next up shows: a manual next action of kind callback (a snoozed callback row, auto false) wins, else callbackAtOf. */
export function callbackDue(lead) {
  if (!lead || typeof lead !== 'object' || lead.deleted) return null;
  const a = lead.nextAction;
  if (a && typeof a === 'object' && a.kind === 'callback' && a.auto === false && !a.doneAt) {
    const t = parseDate(a.dueAt)?.getTime() || 0;
    if (t) return { at: t, stamp: String(a.dueAt) };
  }
  const t = callbackAtOf(lead);
  return t ? { at: t, stamp: String(lead.callbackAt) } : null;
}

function leadAction(lead, ctx, now) {
  const stage = normalizeStage(lead);
  if (stage === 'declined' || stage === 'nurture') return null;
  const cb = callbackAtOf(lead); if (cb) return act('callback', cb);
  if (stage === 'booked' || stage === 'deal') {
    /* The deal (CRM revamp, step 5): the checkpoints say what comes next. */
    const d = dealOf(lead);
    const cp = (id) => d.checkpoints[id];
    const at = (id) => (cp(id)?.at ? parseDate(cp(id).at)?.getTime() || 0 : 0);
    const md = meetingDate(lead);
    if (!cp('callDone') && at('introSent') && at('introSent') + 2 * DAY <= now && !lead.calendlyEventUri) return act('custom', now, 'Confirm the call');
    if (stage === 'deal') {
      const late = invoicesPastDue(d.invoices || [], now);
      if (!cp('callDone')) return act('log-outcome', md ? Math.max(md.getTime() + HOUR, Math.min(now, md.getTime() + HOUR)) : now, 'Log the call');
      if (!cp('onboardingSent')) return act('send-onboarding', at('callDone'));
      if (!cp('formReceived') && at('onboardingSent') + 3 * DAY <= now) return act('chase-form', at('onboardingSent') + 3 * DAY);
      if (cp('formReceived') && !cp('contractSent')) return act('send-contract', at('formReceived') + DAY);
      if (cp('contractSent') && !cp('contractAgreed') && at('contractSent') + 3 * DAY <= now) return act('chase-contract', at('contractSent') + 3 * DAY);
      if (cp('contractAgreed') && !cp('invoiceSent')) return act('send-invoice', at('contractAgreed'));
      if (late.length) return act('chase-invoice', now);
      return null;
    }
  }
  if (stage === 'booked') {
    const md = meetingDate(lead);
    if (md) {
      if (md.getTime() + DAY <= now && !lead.bookedOutcome?.at) return act('log-outcome', now);
      const sets = (ctx.sets || []).filter(s => !s.deleted && !s.archived && String(s.leadId) === String(lead._id));
      if (!sets.length) return act('build-concepts', dayBeforeAt9(`${lead.meeting.date}T${lead.meeting.time || '09:00'}`) || now);
    }
  }
  if (stage === 'client') {
    const mine = (ctx.projects || []).filter(p => String(p.leadId) === String(lead._id) && !p.archived && p.releasedAt);
    const released = mine.sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))[0];
    const asks = Array.isArray(lead.reviews?.asks) ? lead.reviews.asks : [];
    if (released && asks.length === 0) { const due = new Date(released.releasedAt).getTime() + ASK_AFTER_DAYS * DAY; if (due <= now) return act('review-ask', due); }
  }
  return null;
}
function projectAction(p, ctx, now) {
  if (p.archived) return null;
  // Invoices (CRM revamp, step 5): a sent line past its day is late; a draft is not.
  const lines = invoicesOf(p);
  const late = lines.filter(s => invoiceStatus(s, now) === 'past-due');
  if (late.length) return act('chase-invoice', now);
  /* The client side (CRM revamp, step 7): deliver once everything is paid, send the round back a week after it was logged (three more days on a rush job), pitch the retainer three days after delivery. */
  const allPaid = lines.length > 0 && lines.every(s => invoiceStatus(s, now) === 'paid');
  if (p.stage === 'delivery' && allPaid && !p.releasedAt) return act('deliver', now, 'Share the Drive folder and send the delivery email');
  if (p.stage === 'delivered' && p.delivery && p.delivery.pitchSent === false) {
    const base = parseDate(p.deliveredAt) || parseDate(p.releasedAt) || parseDate(p.updatedAt) || new Date(now);
    return act('retainer-pitch', base.getTime() + PITCH_AFTER_DAYS * DAY);
  }
  const log = Array.isArray(p.revisions?.log) ? p.revisions.log : [];
  if (log.length && p.stage !== 'delivered') {
    const last = log[log.length - 1];
    const at = parseDate(last?.at); if (at) return act('revision', at.getTime() + (ROUND_DAYS + ((p.addonIds || []).includes('rush') ? RUSH_EXTRA_DAYS : 0)) * DAY, `Send round ${log.length}`);
  }
  return null;
}
export function nextActionFor(record, ctx = {}, now = Date.now()) {
  if (!record || typeof record !== 'object') return null;
  const c = ctxOf(ctx);
  /* Tasks (the task system): on a client and on a project, the task due soonest is the Next up; the pipeline rules only speak when no task is open. A lead keeps the pipeline rules. */
  const stage = isProject(record) ? 'client' : normalizeStage(record);
  if ((stage === 'client' || stage === 'won') && !record.archived) { const t = taskNextUp(record, now); if (t) return taskAsAction(t, true); }
  /* The email system (milestone 8): a lead's drafted or failed email (a task carrying emailId, written by a rule or a failed send) is its next
     step until it is sent or ticked; the pipeline rule speaks again after. The same Next up rule, over the email tasks alone. */
  if (!isProject(record) && stage !== 'client' && stage !== 'won') { const t = taskNextUp({ checklists: (record.checklists || []).map(l => ({ ...l, items: (l?.items || []).filter(it => it && it.emailId) })) }, now); if (t) return taskAsAction(t, true); }
  return isProject(record) ? projectAction(record, c, now) : leadAction(record, c, now);
}
const sameDue = (a, b) => Math.abs((parseDate(a)?.getTime() || 0) - (parseDate(b)?.getTime() || 0)) < 60e3;
export const sameAction = (a, b) => (!a && !b) || (!!a && !!b && a.kind === b.kind && sameDue(a.dueAt, b.dueAt) && !!a.doneAt === !!b.doneAt && a.label === b.label && !!a.auto === !!b.auto && (a.taskId || '') === (b.taskId || ''));
export function resolveNextAction(record, computed) {
  const cur = record?.nextAction && typeof record.nextAction === 'object' && record.nextAction.kind ? record.nextAction : null;
  if (cur && cur.auto === false && !cur.doneAt) return cur;
  if (!computed) return null;
  if (cur && cur.doneAt && cur.kind === computed.kind && sameDue(cur.dueAt, computed.dueAt)) return cur;
  return computed;
}
/** What sanitize accepts for the field: the whitelist both routes share. */
export function sanitizeNextAction(v, str) {
  if (v === null) return null;
  if (!v || typeof v !== 'object') return undefined;
  // remindAt and notifiedAt (tasks with a due date): the reminder instant and the stamp the cron leaves once its push went out.
  return { kind: NEXT_ACTION_KIND_IDS.includes(v.kind) ? v.kind : 'custom', label: str(v.label, 120), dueAt: str(v.dueAt, 40), auto: v.auto !== false, doneAt: str(v.doneAt, 40), remindAt: str(v.remindAt, 40), notifiedAt: str(v.notifiedAt, 40), taskId: str(v.taskId, 24) };
}
