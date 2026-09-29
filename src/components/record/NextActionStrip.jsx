import { Button, Icon } from '../../ui';
import { nextActionKindOf } from '../../shared/semantics';
import { fmtDateTime } from '../../shared/dates';
import { isTask, fmtTaskDue } from '../../lib/tasks';

/* The next action strip: the only place the next action appears on the
 * record. One line: the kind's icon, the label, the due time, and one
 * button that does it. Hidden when there is nothing due. The button's
 * work is LeadDetail's `run`, keyed the way the checkpoints key theirs. */
const RUN = {
  call: ['Call', 'call'], callback: ['Call', 'call'],
  'build-concepts': ['Build', 'build'],
  'log-outcome': ['Met them', 'met'],
  'send-onboarding': ['Send', 'email:onboarding'],
  'chase-form': ['Open', 'tab:checkpoints'],
  'send-contract': ['Tick', 'tick:contractSent'],
  'chase-contract': ['Open', 'tab:checkpoints'],
  'send-invoice': ['Open', 'tab:money'],
  'chase-invoice': ['Open', 'tab:money'],
  kickoff: ['Open', 'tab:project'], revision: ['Open', 'tab:project'], deliver: ['Open', 'tab:project'],
  'retainer-pitch': ['Open', 'tab:retainer'],
  custom: ['Done', 'done'],
};

export default function NextActionStrip({ rec }) {
  const { next, readOnly, run, busy, has } = rec;
  if (!next || next.doneAt) return null;
  const kind = nextActionKindOf(next.kind);
  const [verb, what] = RUN[next.kind] || ['Open', null];
  const target = what && what.startsWith('tab:') ? what.slice(4) : null;
  const can = what && (!target || has(target)) && !(what === 'call' && !rec.lead.phone);
  const due = next.dueAt ? new Date(next.dueAt).getTime() : 0;
  const overdue = due > 0 && due < Date.now();
  return (
    <div className="rc-next" role="status">
      <Icon icon={kind.icon} size={18} className="rc-next-icon" />
      <span className="rc-next-text">
        <span className="rc-next-label">{next.label}</span>
        {next.dueAt && <span className="rc-next-due">{overdue ? 'Overdue, ' : ''}{isTask(next) ? fmtTaskDue(next.dueAt) : fmtDateTime(next.dueAt)}</span>}
      </span>
      {!readOnly && can && <Button size="md" onClick={() => run(what)} loading={busy === what} className="rc-next-btn">{verb}</Button>}
    </div>
  );
}
