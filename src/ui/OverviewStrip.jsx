import { Icon } from './icons';

/**
 * OverviewStrip (the nav revamp): three chips, one line, each a button.
 * Meetings in the next 7 days with the next one's day and time ("Thu
 * 2:00"), tasks due today, overdue tasks (red only above zero). About 36px
 * tall to the eye inside 44px targets; `compact` drops the labels to icons
 * plus counts (a phone, or a narrow top bar).
 * @param {object} props
 * @param {{ count: number, next: string }} props.meetings
 * @param {number} props.dueToday
 * @param {number} props.overdue
 * @param {() => void} props.onMeetings
 * @param {() => void} props.onToday
 * @param {() => void} props.onOverdue
 * @param {boolean} [props.compact]
 * @param {boolean} [props.loading]
 */
export default function OverviewStrip({ meetings = { count: 0, next: '' }, dueToday = 0, overdue = 0, onMeetings, onToday, onOverdue, compact = false, loading = false, className = '' }) {
  const chips = [
    { id: 'meetings', icon: 'Calendar', n: meetings.count, label: meetings.count === 1 ? 'meeting' : 'meetings', extra: meetings.next, aria: `${meetings.count} meeting${meetings.count === 1 ? '' : 's'} in the next 7 days${meetings.next ? `, next ${meetings.next}` : ''}`, onClick: onMeetings, tone: '' },
    { id: 'today', icon: 'CheckCircle', n: dueToday, label: 'due today', aria: `${dueToday} task${dueToday === 1 ? '' : 's'} due today`, onClick: onToday, tone: '' },
    { id: 'overdue', icon: 'AlertTriangle', n: overdue, label: 'overdue', aria: `${overdue} overdue task${overdue === 1 ? '' : 's'}`, onClick: onOverdue, tone: overdue > 0 ? ' is-danger' : '' },
  ];
  return (
    <div className={`v-ov${compact ? ' v-ov--compact' : ''} ${className}`.trim()} role="group" aria-label="Overview" aria-busy={loading || undefined}>
      {chips.map(c => (
        <button key={c.id} type="button" className={`v-ov-chip${c.tone}`} onClick={c.onClick} aria-label={c.aria} data-ov={c.id}>
          <span className="v-ov-pill">
            <Icon icon={c.icon} size={14} />
            <span className="v-ov-n">{loading ? '' : c.n}</span>
            {!compact && <span className="v-ov-label">{c.label}</span>}
            {!compact && c.extra && <span className="v-ov-extra">{c.extra}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export const overviewStripStyles = `
  .v-ov { display: flex; align-items: center; gap: var(--v-space-1); min-width: 0; flex-wrap: nowrap; }
  .v-ov-chip { display: inline-flex; align-items: center; justify-content: center; min-height: var(--v-tap); min-width: var(--v-tap); padding: 0; border: 0; background: transparent; cursor: pointer; color: var(--v-text-2); font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); white-space: nowrap; }
  .v-ov-chip:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-pill); }
  .v-ov-pill { display: inline-flex; align-items: center; gap: var(--v-space-1); height: 36px; padding: 0 var(--v-space-3); border-radius: var(--v-radius-pill); border: 1px solid var(--v-border); background: var(--v-surface-2); transition: background var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out); }
  .v-ov-chip:hover .v-ov-pill { background: var(--v-surface-3); border-color: var(--v-border-2); }
  .v-ov-n { color: var(--v-text); font-variant-numeric: tabular-nums; min-width: 1ch; }
  .v-ov-label { color: var(--v-text-3); font-weight: var(--v-weight-medium); }
  .v-ov-extra { color: var(--v-text-2); padding-left: var(--v-space-1); border-left: 1px solid var(--v-border); margin-left: var(--v-space-1); }
  .v-ov-chip.is-danger .v-ov-pill { border-color: var(--v-status-danger-text); background: var(--v-status-danger-soft); }
  .v-ov-chip.is-danger .v-ov-n, .v-ov-chip.is-danger .v-ov-label { color: var(--v-status-danger-text); }
  .v-ov--compact .v-ov-pill { padding: 0 var(--v-space-2); }
`;
