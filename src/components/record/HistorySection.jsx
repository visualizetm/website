import LeadHistory from '../LeadHistory';
import LinkedSubmissions from '../LinkedSubmissions';
import { CALL_STATUSES, CONTACT_TYPES } from '../../shared/semantics';
import { fmtDate, toMs } from '../../shared/dates';
import { COPY } from '../../shared/copy';

/* History: the merged call and contact log, then their site submissions. */
export const historySummary = (rec) => {
  const { lead } = rec;
  const rows = [...(lead.callLog || []).map(e => ({ at: e.at, label: CALL_STATUSES.find(s => s.id === e.outcome)?.label || 'Call' })), ...(lead.contactLog || []).map(e => ({ at: e.at, label: `${CONTACT_TYPES.find(t => t.id === e.type)?.label || 'Contact'} logged` }))].sort((a, b) => toMs(b.at) - toMs(a.at));
  if (!rows.length) return 'No calls yet';
  return `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} · last: ${rows[0].label}, ${fmtDate(rows[0].at)}`;
};

export default function HistorySection({ rec }) {
  const { lead, submissions, onLinkSubmission, toast } = rec;
  return (
    <div className="rc-history">
      <LeadHistory lead={lead} />
      <div className="rc-group"><p className="rc-label">Their site submissions</p><LinkedSubmissions lead={lead} submissions={submissions} onLinkSubmission={onLinkSubmission ? async (...a) => { const ok = await onLinkSubmission(...a); if (ok === false) toast.error(COPY.error.save); return ok; } : undefined} /></div>
    </div>
  );
}
