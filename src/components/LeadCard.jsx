/* LeadCard: the one row for a lead (UI simplification, part B). Laws for
 * every card and row on every screen at both widths:
 *   1. Two lines. Line one: name, then one pill on the right. Line two: one context line in text-3, 13px.
 *   2. One pill per row, and it is the thing that decides what you do next on that screen.
 *   3. No avatar, no social glyphs, no scan dot, no "Touched 3d ago", no progress bar on a row.
 *   4. The row menu keeps every action it has today, so nothing is lost.
 *   5. Checkbox only in select mode; drag handle only inside a list; both sit outside the two lines.
 * The shell takes a `pill`, a `line` and a `trailing` control so ClientCard
 * and the Deals cards are the same row with their own pill and context. */
import Globe01 from '@untitled-ui/icons-react/build/esm/Globe01';
import Camera01 from '@untitled-ui/icons-react/build/esm/Camera01';
import ThumbsUp from '@untitled-ui/icons-react/build/esm/ThumbsUp';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import DotsGrid from '@untitled-ui/icons-react/build/esm/DotsGrid';
import { memo } from 'react';
import { Pill, Menu, Checkbox, SkeletonBlock } from '../ui';
import { CALL_STATUSES, PRIORITIES, displayIndustry, normalizeStage } from '../shared/semantics';
import { formatPhone, telHref } from '../shared/phone';
import { normalizeLead } from '../lib/leads';
import { deleteBlockReason } from '../lib/booked';

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {Function} [props.onOpen] the stretched button opens the record
 * @param {boolean} [props.selected] open in the detail column: a red border
 * @param {boolean} [props.checked]
 * @param {Function} [props.onCheck] (next: boolean); the checkbox renders only in select mode (`selectable`)
 * @param {boolean} [props.selectable] select mode is on
 * @param {{ onPriority?, onStatus?, onStatusStep?, onDelete?, onOpenSocials?, onAddToList?, onRemoveFromList?, onDecline? }} [props.actions] menu handlers; omit for no menu.
 *   onStatusStep moves the lead one column left or right (Shift+ArrowLeft, Shift+ArrowRight on the focused card): the keyboard path for the kanban.
 * @param {import('react').ReactNode} [props.pill] the one pill (default: the call status)
 * @param {import('react').ReactNode} [props.line] line two (default: industry and area, or the descriptor, and the phone as a tel link)
 * @param {import('react').ReactNode} [props.trailing] one control at the end of the row (a phone list's action button)
 * @param {boolean} [props.handle] the drag handle, inside a list only
 * @param {boolean} [props.dragging] visual lift while dragged
 */
export const SOCIALS = [
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
  if (actions.onAddToList && normalizeStage(lead) === 'lead') items.push('divider', { id: 'list', label: lead.listId ? 'Move to another list' : 'Add to list', icon: 'Rows01', onSelect: () => actions.onAddToList() });
  if (actions.onRemoveFromList) items.push({ id: 'unlist', label: 'Remove from this list', icon: 'XClose', onSelect: () => actions.onRemoveFromList() });
  if (actions.onDecline && !['declined', 'client', 'won'].includes(lead.stage)) items.push('divider', { id: 'decline', label: 'Decline', icon: 'SlashCircle01', danger: true, onSelect: () => actions.onDecline() });
  if (actions.onDelete) items.push('divider', { id: 'del', label: block ? `Delete: ${block.split(', ')[0].toLowerCase()}` : 'Delete', icon: 'Trash01', danger: true, disabled: !!block, onSelect: () => actions.onDelete() });
  return items;
}

/** Line two of a lead: industry and area, or the descriptor when there is no area. */
export const leadContext = (lead) => [lead.industry ? displayIndustry(lead.industry) : '', lead.area || lead.descriptor || ''].filter(Boolean).join(' · ');

function LeadCardInner({ lead: rawLead, onOpen, selected = false, selectable = false, checked = false, onCheck, actions, dragging = false, pill, line, trailing = null, handle = false, className = '', ...rest }) {
  // The shape guard, again, so a record that skipped the loader (a fixture, a fresh insert) cannot take the list down.
  const lead = normalizeLead(rawLead);
  const items = leadMenuItems(lead, actions);
  const showCheck = !!onCheck && (selectable || checked);
  return (
    <div className={`lc lay-card${selected ? ' is-selected' : ''}${checked ? ' is-checked' : ''}${dragging ? ' is-dragging' : ''}${onOpen ? ' lc--open' : ''}${items.length ? '' : ' lc--nomenu'} ${className}`.trim()} {...rest}>
      {/* One real control opens the card (Prompt 15): stretched over the surface, so the menu, checkbox, and phone link never nest inside a button. */}
      {onOpen && <button type="button" className="v-stretch lc-open" onClick={() => onOpen(lead)} aria-label={`Open ${lead.business}`}
        onKeyDown={actions?.onStatusStep ? (e) => { if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); actions.onStatusStep(e.key === 'ArrowRight' ? 1 : -1); } } : undefined}>{`Open ${lead.business}`}</button>}
      {handle && <span className="lc-handle" aria-hidden="true"><DotsGrid width={16} height={16} /></span>}
      {showCheck && <span className="lc-check v-above"><Checkbox checked={checked} onChange={onCheck} aria-label={`Select ${lead.business}`} /></span>}
      <div className="lc-main">
        <div className="lc-l1">
          <span className="lc-name lay-truncate">{lead.business}</span>
          <span className="lc-pill">{pill === undefined ? <Pill id={lead.callStatus || 'not-called'} list={CALL_STATUSES} size="sm" /> : pill}</span>
        </div>
        <div className="lc-l2">
          {line === undefined ? (
            <>
              <span className="lc-ctx lay-truncate">{leadContext(lead)}</span>
              {lead.phone ? <a className="lc-phone v-above" href={telHref(lead.phone)} aria-label={`Call ${formatPhone(lead.phone)}`}>{formatPhone(lead.phone)}</a> : <span className="lc-phone lc-phone--none">No phone</span>}
            </>
          ) : <span className="lc-ctx lay-truncate">{line}</span>}
        </div>
      </div>
      {trailing && <span className="lc-trail v-above">{trailing}</span>}
      {items.length > 0 && <span className="lc-menu v-above"><Menu items={items} label={`Actions for ${lead.business}`} /></span>}
    </div>
  );
}

/* Memoized (Prompt 15): the kanban re-renders a column's cards only when their own lead or flags change.
 * Callers pass stable-ish handlers; the shallow compare on `lead` (a new object only when it was patched)
 * is what skips the other 399 cards when one moves. A card given its own pill, line or trailing control
 * re-renders with its parent, which is what those callers expect. */
const LeadCard = memo(LeadCardInner, (a, b) => a.lead === b.lead && a.selected === b.selected && a.selectable === b.selectable && a.checked === b.checked && a.dragging === b.dragging && a.className === b.className && a.style === b.style && a.draggable === b.draggable && a.pill === b.pill && a.line === b.line && a.trailing === b.trailing && a.handle === b.handle);
export default LeadCard;
LeadCard.Skeleton = function LeadCardSkeleton({ menu = true }) {
  return (
    <div className={`lc lay-card${menu ? '' : ' lc--nomenu'}`} aria-busy="true" aria-hidden="true">
      <div className="lc-main">
        <div className="lc-l1"><SkeletonBlock width="55%" height={16} style={{ margin: '3px 0' }} /><span style={{ flex: 1 }} /><SkeletonBlock width={64} height={22} radius="var(--v-radius-pill)" /></div>
        <div className="lc-l2"><SkeletonBlock width="45%" height={12} style={{ margin: '3px 0' }} /><span style={{ flex: 1 }} /><SkeletonBlock width={90} height={12} style={{ margin: '3px 0' }} /></div>
      </div>
    </div>
  );
};

/* Styles live in src/ui/leadCard.styles.js and ship in uiStyles. */
