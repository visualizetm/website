import { Pill, ProgressBar, SkeletonBlock } from '../ui';
import LeadCard from './LeadCard';
import { PROJECT_STAGES } from '../shared/semantics';
import { retainerOf } from '../shared/pricing';
import { money } from '../shared/format';
import { activeProject, paidTotal, scheduleTotal, paidPct, isFullyPaid, isOnRetainer, nextDateFor, localDate } from '../lib/projects';

/**
 * ClientCard (Prompt 10): LeadCard compact plus the client line: package pill
 * for the active project, project stage, paid over total, retainer, next date.
 * @param {object} props
 * @param {object} props.lead
 * @param {Array} props.projects every project (filtered here)
 * @param {Function} [props.onOpen]
 * @param {boolean} [props.selected]
 * @param {boolean} [props.compact] hide the client line (list panel beside the detail)
 */
const fmtDay = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };

export function clientLine(lead, projects) {
  const p = activeProject(projects, lead._id);
  const ret = isOnRetainer(lead) ? retainerOf(lead.retainer.planId) : null;
  const next = nextDateFor(lead, projects);
  return { project: p, retainer: ret, retainerAmount: lead.retainer?.amount, next, paid: p ? paidTotal(p) : 0, total: p ? scheduleTotal(p) : 0, pct: p ? paidPct(p) : 0 };
}

export default function ClientCard({ lead, projects = [], onOpen, selected = false, compact = false, className = '', ...rest }) {
  const c = clientLine(lead, projects);
  return (
    <div className={`clc${selected ? ' is-selected' : ''} ${className}`.trim()} {...rest}>
      <LeadCard lead={lead} compact onOpen={onOpen} selected={selected} />
      {!compact && (
        <div className="clc-line">
          <div className="clc-row">
            {c.project ? <><Pill tone="progress" label={c.project.name} size="sm" icon="Briefcase01" variant="outline" className="clc-pkg" /><Pill id={c.project.stage} list={PROJECT_STAGES} size="sm" /></> : <span className="clc-muted">No active project</span>}
            {c.retainer && <Pill tone="booked" label={`${c.retainer.label} ${money(c.retainerAmount)}/mo`} size="sm" icon="RefreshCw01" className="clc-ret" />}
          </div>
          {c.project && <div className="clc-row clc-pay"><ProgressBar value={c.pct} tone={isFullyPaid(c.project) ? 'booked' : 'progress'} size="sm" /><span className="clc-paid">{money(c.paid)} of {money(c.total)}</span></div>}
          {c.next && <span className="clc-next">{c.next.kind === 'bill' ? 'Next bill' : 'Next payment'} {fmtDay(c.next.dueAt)}, {money(c.next.amount)}</span>}
        </div>
      )}
    </div>
  );
}

ClientCard.Skeleton = function ClientCardSkeleton({ compact = false }) {
  return (
    <div className="clc" aria-busy="true">
      <LeadCard.Skeleton compact />
      {!compact && <div className="clc-line"><div className="clc-row"><SkeletonBlock width={110} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width={70} height={22} radius="var(--v-radius-pill)" /></div><SkeletonBlock height={4} radius="var(--v-radius-pill)" /><SkeletonBlock width={140} height={12} /></div>}
    </div>
  );
};
