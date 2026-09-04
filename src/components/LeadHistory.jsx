import { ListRow, IconTile, Pill, EmptyState } from '../ui';
import { CALL_STATUSES, CONTACT_TYPES } from '../shared/semantics';
import { fmtDateTime } from '../shared/dates';

/**
 * LeadHistory: callLog and contactLog merged, newest first, with outcome pills.
 * Reusable in the lead detail (Prompt 8).
 * @param {object} props
 * @param {object} props.lead
 * @param {number} [props.limit]
 */
export default function LeadHistory({ lead, limit }) {
  const rows = [
    ...(lead.callLog || []).map(e => ({ kind: 'call', at: e.at, outcome: e.outcome, note: [e.meeting && `Meeting: ${e.meeting}`, e.email && `Email: ${e.email}`, e.note].filter(Boolean).join('. ') })),
    ...(lead.contactLog || []).map(e => ({ kind: 'contact', at: e.at, type: e.type, note: e.note || '' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit || undefined);
  if (!rows.length) return <EmptyState size="sm" icon="Phone" title="No calls yet" description="The first outcome you log lands here." />;
  return (
    <div className="lh">
      {rows.map((r, i) => {
        const ct = r.kind === 'contact' ? CONTACT_TYPES.find(t => t.id === r.type) : null;
        return (
          <ListRow key={i} className="lh-row" chevron={false}
            leading={<IconTile icon={r.kind === 'call' ? (CALL_STATUSES.find(s => s.id === r.outcome)?.icon || 'Phone') : (ct?.icon || 'User01')} tone={r.kind === 'call' ? undefined : 'neutral'} size="sm" glow={false}
              style={r.kind === 'call' ? undefined : undefined} />}
            title={r.kind === 'call' ? <Pill id={r.outcome} list={CALL_STATUSES} size="sm" /> : `${ct?.label || 'Contact'} logged`}
            subtitle={r.note || undefined} meta={fmtDateTime(r.at)} />
        );
      })}
    </div>
  );
}
/* leadHistoryStyles lives in src/ui/lead.styles.js (uiStyles). */

