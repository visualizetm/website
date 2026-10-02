import { useState } from 'react';
import { SwipeRow, useToast } from '../ui';
import { COPY } from '../shared/copy';
import { CALL_STATUSES, PRIORITIES, displayIndustry } from '../shared/semantics';
import { formatPhone, telHref } from '../shared/phone';
import { leadMenuItems } from './LeadCard';
import RowSheet from './RowSheet';

/* A lead row with its quick actions (CRM mobile revamp, milestone 5): drag right to call, drag left to set a callback for tomorrow at
   nine (with an undo), long press for the essentials and every action the row's menu has. The menu is unchanged; this is the shortcut.
   `lead` is the record; `actions` is what the row's menu takes; `patch(id, set)` is the screen's own optimistic write. */
export function tomorrowNine() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; }

export default function LeadSwipe({ lead, actions, onOpen, patch, enabled = true, extraItems = [], children }) {
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const callback = async () => {
    const prev = { callStatus: lead.callStatus || 'not-called', callbackAt: lead.callbackAt || '' };
    const ok = await patch(lead._id, { callStatus: 'callback', callbackAt: tomorrowNine().toISOString() });
    if (ok) toast.undo(`${lead.business}: call back tomorrow at 9:00 AM.`, () => patch(lead._id, prev), { seconds: 6 });
    else toast.error(COPY.error.save);
  };
  const status = CALL_STATUSES.find(s => s.id === (lead.callStatus || 'not-called'));
  const prio = PRIORITIES.find(p => p.id === (lead.priority || 'warm'));
  const facts = [
    { label: 'Phone', value: lead.phone ? formatPhone(lead.phone) : '' },
    { label: 'Status', value: status?.label },
    { label: 'Priority', value: prio?.label },
    { label: 'Industry', value: lead.industry ? displayIndustry(lead.industry) : '' },
    { label: 'Area', value: lead.area },
    { label: 'Next', value: lead.nextAction?.label },
  ];
  const items = [
    { id: 'open', label: 'Open the record', icon: 'ArrowRight', onSelect: onOpen },
    { id: 'callback', label: 'Call back tomorrow at 9', icon: 'Clock', onSelect: callback },
    ...extraItems,
    'divider',
    ...leadMenuItems(lead, actions),
  ];
  return (
    <>
      <SwipeRow enabled={enabled}
        right={lead.phone ? { label: 'Call', icon: 'Phone', tone: 'primary', onCommit: () => { window.location.href = telHref(lead.phone); } } : undefined}
        left={{ label: 'Callback', icon: 'Clock', tone: 'callback', onCommit: callback }}
        onHold={() => setSheet(true)}>
        {children}
      </SwipeRow>
      {sheet && <RowSheet title={lead.business} subtitle={[lead.industry ? displayIndustry(lead.industry) : '', lead.area].filter(Boolean).join(' · ')} facts={facts} items={items} onClose={() => setSheet(false)} />}
    </>
  );
}
