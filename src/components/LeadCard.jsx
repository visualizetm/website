import Globe01 from '@untitled-ui/icons-react/build/esm/Globe01';
import Camera01 from '@untitled-ui/icons-react/build/esm/Camera01';
import ThumbsUp from '@untitled-ui/icons-react/build/esm/ThumbsUp';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import { Avatar, Pill, Menu, Tooltip, Checkbox, SkeletonBlock, SkeletonCircle } from '../ui';
import { CALL_STATUSES, PRIORITIES, displayIndustry } from '../shared/semantics';
import { formatPhone, telHref } from '../shared/phone';
import { relativeTime, fmtDate } from '../shared/dates';
import { isNewLead, lastCall, lastTouchAt, scanAgeDays } from '../lib/leads';
import { deleteBlockReason } from '../lib/booked';

/**
 * LeadCard: the shared compact lead card (kanban, mobile list, Call Console queue).
 * @param {object} props
 * @param {object} props.lead
 * @param {Function} [props.onOpen] tap anywhere opens the detail
 * @param {boolean} [props.selected] currently open in the detail column
 * @param {boolean} [props.selectable] show the checkbox (always on mobile select mode, hover on desktop)
 * @param {boolean} [props.checked]
 * @param {Function} [props.onCheck] (next: boolean)
 * @param {{ onPriority?: (id) => void, onStatus?: (id) => void, onDelete?: () => void, onOpenSocials?: () => void }} [props.actions] menu handlers; omit for no menu
 * @param {boolean} [props.dragging] visual lift while dragged
 * @param {boolean} [props.compact] hide row 4
 */
const SOCIALS = [
  ['website', Globe01, 'Website'], ['instagram', Camera01, 'Instagram'], ['facebook', ThumbsUp, 'Facebook'], ['google', MarkerPin01, 'Google Maps'],
];

export function leadMenuItems(lead, actions) {
  if (!actions) return [];
  const block = deleteBlockReason(lead);
  const items = [];
  if (lead.phone) items.push({ id: 'call', label: `Call ${formatPhone(lead.phone)}`, icon: 'Phone', onSelect: () => { window.location.href = telHref(lead.phone); } });
  if (actions.onPriority) items.push('divider', ...PRIORITIES.map(p => ({ id: `p:${p.id}`, label: `Priority: ${p.label}${lead.priority === p.id ? ' (current)' : ''}`, icon: p.icon, disabled: lead.priority === p.id, onSelect: () => actions.onPriority(p.id) })));
  if (actions.onStatus) items.push('divider', ...CALL_STATUSES.filter(s => s.id !== 'booked').map(s => ({ id: `s:${s.id}`, label: `Status: ${s.label}${(lead.callStatus || 'not-called') === s.id ? ' (current)' : ''}`, icon: s.icon, disabled: (lead.callStatus || 'not-called') === s.id, onSelect: () => actions.onStatus(s.id) })));
  const firstSocial = SOCIALS.map(([k]) => lead.socials?.[k]).find(Boolean);
  if (firstSocial) items.push('divider', { id: 'social', label: 'Open socials', icon: 'ArrowRight', onSelect: () => { window.open(firstSocial, '_blank', 'noopener'); actions.onOpenSocials?.(); } });
  if (actions.onDelete) items.push('divider', { id: 'del', label: block ? `Delete: ${block.split(/ [\u2014-] /)[0].toLowerCase()}` : 'Delete', icon: 'Trash01', danger: true, disabled: !!block, onSelect: () => actions.onDelete() });
  return items;
}

export default function LeadCard({ lead, onOpen, selected = false, selectable = false, checked = false, onCheck, actions, dragging = false, compact = false, className = '', ...rest }) {
  const lc = lastCall(lead);
  const touched = lastTouchAt(lead);
  const scan = scanAgeDays(lead);
  const items = leadMenuItems(lead, actions);
  return (
    <div className={`lc lay-card${selected ? ' is-selected' : ''}${selectable ? ' is-selectable' : ''}${checked ? ' is-checked' : ''}${dragging ? ' is-dragging' : ''} ${className}`.trim()}
      role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(lead) : undefined} onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(lead); } } : undefined}
      aria-label={onOpen ? `Open ${lead.business}` : undefined} {...rest}>
      {onCheck && <span className="lc-check" onClick={(e) => e.stopPropagation()}><Checkbox checked={checked} onChange={onCheck} aria-label={`Select ${lead.business}`} /></span>}
      <div className="lc-row lc-row1">
        <Avatar name={lead.business} size="sm" />
        <span className="lc-name lay-truncate">{lead.business}</span>
        {isNewLead(lead) && <Pill tone="new" label="New" size="sm" variant="solid" icon={false} className="lc-new" />}
        <Pill id={lead.priority || 'warm'} size="sm" />
      </div>
      <div className="lc-row lc-row2">
        {lead.industry && <Pill tone="neutral" label={displayIndustry(lead.industry)} icon={false} size="sm" variant="outline" />}
        <span className="lc-desc lay-truncate">{lead.descriptor || [lead.area].filter(Boolean).join('') || ''}</span>
      </div>
      <div className="lc-row lc-row3">
        {lead.phone
          ? <a className="lc-phone" href={telHref(lead.phone)} onClick={(e) => e.stopPropagation()} aria-label={`Call ${formatPhone(lead.phone)}`}>{formatPhone(lead.phone)}</a>
          : <span className="lc-phone lc-phone--none">No phone</span>}
        <span className="lc-socials" aria-label="Socials">
          {SOCIALS.map(([k, I, label]) => lead.socials?.[k]
            ? <a key={k} className="lc-social" href={lead.socials[k]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={label}><I width={13} height={13} /></a>
            : <span key={k} className="lc-social lc-social--off" aria-hidden="true"><I width={13} height={13} /></span>)}
        </span>
        <span style={{ flex: 1 }} />
        <Pill id={lead.callStatus || 'not-called'} list={CALL_STATUSES} size="sm" />
      </div>
      {!compact && (touched || lead.callStatus === 'callback' || scan != null) && (
        <div className="lc-row lc-row4">
          {touched > 0 && <span>Touched {relativeTime(touched)}</span>}
          {lead.callStatus === 'callback' && <span className="lc-next">Next: call back{lc?.note ? `, ${lc.note}` : ''}</span>}
          {scan != null && (
            <Tooltip label={`Scanned ${fmtDate(lead.enrichment.lastScanAt)}, ${lead.enrichment.scanCount || 1} scan${(lead.enrichment.scanCount || 1) === 1 ? '' : 's'}`}>
              <span className={`lc-scan${scan <= 7 ? ' is-fresh' : ' is-stale'}`} tabIndex={0} aria-label={`Scanned ${relativeTime(lead.enrichment.lastScanAt)}`} />
            </Tooltip>
          )}
        </div>
      )}
      {items.length > 0 && <span className="lc-menu" onClick={(e) => e.stopPropagation()}><Menu items={items} label={`Actions for ${lead.business}`} /></span>}
    </div>
  );
}

LeadCard.Skeleton = function LeadCardSkeleton({ compact = false }) {
  return (
    <div className="lc lay-card" aria-busy="true">
      <div className="lc-row"><SkeletonCircle size={32} /><SkeletonBlock width="55%" height={14} /><span style={{ flex: 1 }} /><SkeletonBlock width={44} height={22} radius="var(--v-radius-pill)" /></div>
      <div className="lc-row"><SkeletonBlock width={70} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width="50%" height={12} /></div>
      <div className="lc-row"><SkeletonBlock width={110} height={14} /><span style={{ flex: 1 }} /><SkeletonBlock width={74} height={22} radius="var(--v-radius-pill)" /></div>
      {!compact && <div className="lc-row"><SkeletonBlock width={90} height={11} /></div>}
    </div>
  );
};

export const leadCardStyles = `
  .lc { position: relative; display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); padding-right: calc(var(--v-space-3) + var(--v-tap)); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); color: var(--v-text); cursor: pointer; transition: border-color var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-out), box-shadow var(--v-dur-fast) var(--v-ease-out); }
  .lc:hover { border-color: var(--v-border-strong); }
  .lc:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .lc.is-selected { border-color: var(--v-red); background: var(--v-surface-2); }
  .lc.is-checked { border-color: var(--v-red); box-shadow: 0 0 0 1px var(--v-red); }
  .lc.is-dragging { transform: scale(1.02) rotate(0.5deg); box-shadow: var(--v-shadow-3); opacity: 0.9; z-index: 2; }
  .lc-row { display: flex; align-items: center; gap: var(--v-space-2); min-width: 0; }
  .lc-row3 { flex-wrap: wrap; row-gap: var(--v-space-1); }
  .lc-name { flex: 1; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); }
  .lc-new { height: 20px; padding: 0 var(--v-space-2); }
  .lc-desc { flex: 1; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .lc-phone { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); text-decoration: none; font-variant-numeric: tabular-nums; min-height: 28px; display: inline-flex; align-items: center; white-space: nowrap; }
  .lc-phone:hover { color: var(--v-red-highlight); }
  .lc-phone--none { color: var(--v-text-3); font-weight: var(--v-weight-regular); }
  .lc-socials { display: inline-flex; gap: 2px; }
  .lc-social { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: var(--v-radius-sm); color: var(--v-text-2); }
  .lc-social:hover { background: var(--v-surface-3); color: var(--v-text); }
  .lc-social--off { color: var(--v-text-3); opacity: 0.35; }
  .lc-row4 { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); flex-wrap: wrap; }
  .lc-next { color: var(--v-status-callback-text); }
  .lc-scan { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: auto; }
  .lc-scan.is-fresh { background: var(--v-status-booked-solid); box-shadow: 0 0 0 3px var(--v-status-booked-soft); }
  .lc-scan.is-stale { background: var(--v-status-new-solid); box-shadow: 0 0 0 3px var(--v-status-new-soft); }
  .lc-menu { position: absolute; top: var(--v-space-1); right: var(--v-space-1); }
  .lc-check { position: absolute; top: var(--v-space-2); left: var(--v-space-2); z-index: 1; opacity: 0; transition: opacity var(--v-dur-fast) var(--v-ease-out); }
  .lc.is-selectable .lc-check, .lc.is-checked .lc-check, .lc:hover .lc-check, .lc:focus-within .lc-check { opacity: 1; }
  .lc.is-selectable .lc-row1, .lc.is-checked .lc-row1 { padding-left: 30px; }
  @media (hover: hover) { .lc:hover .lc-row1, .lc:focus-within .lc-row1 { padding-left: 30px; } }
`;
