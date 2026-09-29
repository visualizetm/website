import { projectsOf, activeProject, isOnRetainer, clientStatusOf, nextDateFor, paidTotal, scheduleTotal, localDate } from './projects';
import { invoicesOf, invoicesPastDue } from './invoices';
import { projectStageOf } from '../shared/semantics';
import { money } from '../shared/format';

/* The one pill on a client row (UI simplification, part B). First match
 * wins: money past due, the next amount due, the retainer, delivered, the
 * active project's stage, or no project at all. It is the thing that
 * decides what Rob does next on the Clients screen. */
const fmtDayShort = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };

export function clientRowPill(lead, projects = [], now = Date.now()) {
  const mine = projectsOf(projects, lead._id);
  const past = mine.flatMap(p => invoicesPastDue(invoicesOf(p), now)).reduce((n, s) => n + (Number(s.amount) || 0), 0);
  if (past > 0) return { id: 'past-due', label: `${money(past)} past due`, tone: 'danger' };
  const next = nextDateFor(lead, projects, now);
  if (next) return { id: 'due', label: `${money(next.amount)} due ${fmtDayShort(next.dueAt)}`, tone: 'new' };
  if (isOnRetainer(lead)) return { id: 'retainer', label: 'Retainer', tone: 'booked' };
  if (clientStatusOf(lead, projects) === 'delivered') return { id: 'delivered', label: 'Delivered', tone: 'neutral' };
  const p = activeProject(projects, lead._id);
  if (p) return { id: 'stage', label: projectStageOf(p.stage).label, tone: 'progress' };
  return { id: 'none', label: 'No project', tone: 'neutral' };
}

/** Line two of a client row: the package and the money, or no project yet. */
export function clientRowLine(lead, projects = []) {
  const p = activeProject(projects, lead._id);
  return p ? `${p.name} · ${money(paidTotal(p))} of ${money(scheduleTotal(p))}` : 'No project yet';
}
