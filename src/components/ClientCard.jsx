import { Pill } from '../ui';
import LeadCard from './LeadCard';
import { clientRowPill, clientRowLine } from '../lib/clientRowPill';
import { activeProject, paidTotal, scheduleTotal, nextDateFor } from '../lib/projects';

/**
 * ClientCard (Prompt 10, rebuilt in UI simplification part B): LeadCard's
 * shell with the client pill (src/lib/clientRowPill.js) on line one and the
 * package and money on line two. No retainer pill, no planner pill, no
 * stage pill, no progress bar.
 * @param {object} props
 * @param {object} props.lead
 * @param {Array} props.projects every project (filtered here)
 * @param {Function} [props.onOpen]
 * @param {boolean} [props.selected]
 */
export function clientLine(lead, projects) {
  const p = activeProject(projects, lead._id);
  return { project: p, next: nextDateFor(lead, projects), paid: p ? paidTotal(p) : 0, total: p ? scheduleTotal(p) : 0 };
}

export default function ClientCard({ lead, projects = [], onOpen, selected = false, className = '', ...rest }) {
  const pill = clientRowPill(lead, projects);
  return <LeadCard lead={lead} onOpen={onOpen} selected={selected} pill={<Pill tone={pill.tone} label={pill.label} size="sm" icon={false} className={`clc-pill clc-pill--${pill.id}`} />} line={clientRowLine(lead, projects)} className={`clc ${className}`.trim()} {...rest} />;
}

ClientCard.Skeleton = function ClientCardSkeleton() {
  return <LeadCard.Skeleton menu={false} />;
};
