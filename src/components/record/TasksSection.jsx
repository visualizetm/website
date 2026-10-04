import { Stack, Row, Button, Checkbox, ProgressBar } from '../../ui';
import { COPY } from '../../shared/copy';
import { taskCounts, taskNextUp, openTasks } from '../../shared/taskRules';
import { completePatch, taskDueLabel, isOverdue } from '../../lib/taskWrite';
import EmptyLine from './EmptyLine';

/* Tasks (planner dashboard and task system, milestone 5): how far the
 * client's work is, the next three open tasks to tick off here, and the one
 * button into the Tasks screen. The row on a phone reads "Tasks, 6 of 14
 * done" with a thin bar (SectionRows draws `bar`). */
export const tasksSummary = (rec) => { const c = taskCounts(rec.lead); return c.total ? `${c.done} of ${c.total} done` : 'No tasks yet'; };
export const tasksBar = (rec) => { const c = taskCounts(rec.lead); return c.total ? c.pct : null; };

const byDue = (a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || String(a.due).localeCompare(String(b.due)) || a.listIndex - b.listIndex || a.index - b.index;

export default function TasksSection({ rec }) {
  const { lead, patch, readOnly, shell } = rec;
  const c = taskCounts(lead);
  const E = COPY.empty['tasks.first'];
  const openAll = () => shell?.openTasks?.(lead);
  if (!c.total) return <EmptyLine text={E.title} action={!readOnly && shell?.openTasks ? { label: E.action, icon: 'CheckDone01', onClick: openAll, className: 'rc-tasks-open' } : null} />;
  const ctx = { projects: shell?.projects || [], sets: shell?.sets || [] };
  const nextId = taskNextUp(lead)?.id;
  const open = openTasks(lead).sort(byDue).slice(0, 3);
  const now = Date.now();
  return (
    <Stack gap={2} className="rc-tasks">
      <ProgressBar value={c.pct} tone={c.done === c.total ? 'booked' : 'progress'} size="sm" label={`${c.done} of ${c.total} done`} className="rc-tasks-bar" />
      {open.length > 0 && (
        <Stack gap={0} className="rc-tasks-list">
          {open.map(t => (
            <Checkbox key={t.id} checked={false} disabled={readOnly} className={`rc-task${t.id === nextId ? ' is-next' : ''}${isOverdue(t, now) ? ' is-overdue' : ''}`}
              onChange={() => patch(completePatch(lead, t.id, true, ctx))}
              label={<span className="rc-task-text"><span>{t.text}</span>{taskDueLabel(t, now) && <span className="rc-task-due">{taskDueLabel(t, now)}</span>}</span>} />
          ))}
        </Stack>
      )}
      {shell?.openTasks && <Row gap={2}><Button variant="secondary" size="md" icon="CheckDone01" onClick={openAll} className="rc-tasks-open">Open tasks</Button></Row>}
    </Stack>
  );
}
