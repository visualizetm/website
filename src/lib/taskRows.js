import { homeRowAction, NEXT_TONE } from './nextAction.js';
import { emailTaskOf } from './compose.js';
import { nextActionKindOf } from '../shared/semantics.js';

/* One task row's view, for every screen (prompt 3 of 3, milestone 2). Home's Next up, the Tasks page and the client and project task
 * lists all draw a row from this one answer, so the same item reads the same way everywhere: the title, the business, the time line
 * with its late word, the kind pill, what the check does (src/lib/nextAction.js homeRowAction is the one rule) and the right action.
 * An email task's action is Preview: it opens the send sheet on the draft, where Rob reads it and taps Send now. There is no action on
 * a row that sends (rowView never produces one; tasks-test scans the screens for a send or a stamp). */
export const kindLabelOf = (a) => (a?.taskId ? 'Task' : nextActionKindOf(a?.kind).label);

export function rowView(item, now = Date.now()) {
  const a = item?.action || {};
  const plan = homeRowAction(item, now);
  const biz = item?.lead?.business || 'Unnamed';
  const email = a.taskId ? emailTaskOf(item.record, a.taskId) : null;
  const overdue = item?.bucket === 'overdue';
  return {
    key: item?.id || `${item?.lead?._id}:${a.kind}:${a.taskId || ''}`,
    title: plan.title, biz,
    when: plan.late && overdue ? plan.late : plan.time, whenTone: plan.late && overdue ? 'late' : plan.late ? 'late' : '',
    kind: { tone: NEXT_TONE[a.kind] || 'neutral', label: kindLabelOf(a) },
    check: plan.check, // task | outcome | manual | open
    checkLabel: plan.check === 'outcome' ? `Log the outcome: ${plan.title}, ${biz}` : plan.check === 'open' ? `Open at this step: ${plan.title}, ${biz}` : `Mark done: ${plan.title}, ${biz}`,
    tomorrow: plan.tomorrow, call: plan.call, open: plan.open,
    email: email ? { emailId: email.emailId } : null,
    primary: email ? { id: 'preview', icon: 'Mail01', label: `Preview the email for ${biz}`, text: 'Preview' } : plan.call ? { id: 'call', icon: 'Phone', label: `Call ${biz}`, text: 'Call' } : null,
    pinned: a.auto === false && !!a.taskId,
    overdue,
  };
}

/* The Tasks page's chips: what an item is. Calls (a call, a callback, the outcome to log), Emails (a task written for an email and the
 * send steps), Money (invoices, the deposit), Tasks (a task made by hand or from a template). Everything else shows under All only. */
export const TASK_CHIPS = [{ id: 'all', label: 'All' }, { id: 'calls', label: 'Calls' }, { id: 'emails', label: 'Emails' }, { id: 'money', label: 'Money' }, { id: 'tasks', label: 'Tasks' }];
export function chipOf(item) {
  const a = item?.action || {}; const k = a.kind;
  if (a.taskId && emailTaskOf(item.record, a.taskId)) return 'emails';
  if (k === 'call' || k === 'callback' || k === 'log-outcome') return 'calls';
  if (k === 'send-onboarding' || k === 'send-contract' || k === 'chase-contract') return 'emails';
  if (k === 'send-invoice' || k === 'chase-invoice') return 'money';
  if (a.taskId || k === 'custom') return 'tasks';
  return 'other';
}
/** The items a chip and a client search keep (the search is the business name, case blind). */
export function filterItems(items = [], chip = 'all', query = '') {
  const q = String(query || '').trim().toLowerCase();
  return items.filter(it => (chip === 'all' || chipOf(it) === chip) && (!q || String(it.lead?.business || '').toLowerCase().includes(q)));
}
