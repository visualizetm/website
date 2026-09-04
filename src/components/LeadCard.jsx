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

/* Styles live in src/ui/leadCard.styles.js and ship in uiStyles. */
