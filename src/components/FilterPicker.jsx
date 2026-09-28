import { useMemo, useState } from 'react';
import { Stack, Row, Section, ChipGroup, Chip } from '../ui';
import { PRIORITIES, CALL_STATUSES, industryKey } from '../shared/semantics';
import { industryFacets } from '../lib/leads';
import { currentWindow, matchesWindow, orderQueue } from '../lib/calls';

/* The Call Console builder's chips, on their own (CRM revamp, step 3), so a
 * list can be filled from the same filters. Nothing selected in a group
 * means all of them; the matches come back in priority order. */
const BOARD = CALL_STATUSES.filter(s => s.id !== 'booked');
const WINDOWS = [{ id: 'morning', label: 'Morning', icon: 'Sunrise' }, { id: 'midday', label: 'Midday', icon: 'Sun' }, { id: 'afternoon', label: 'Afternoon', icon: 'Sun' }, { id: 'evening', label: 'Evening', icon: 'Sunset' }];

export function useFilterMatches(pool) {
  const [selPrio, setSelPrio] = useState(() => new Set());
  const [selStatus, setSelStatus] = useState(() => new Set());
  const [selInd, setSelInd] = useState(() => new Set());
  const [selWin, setSelWin] = useState(() => new Set());
  const [rightNow, setRightNow] = useState(false);
  const win = currentWindow();
  const winSel = rightNow ? new Set([win]) : selWin;
  const pass = (l, except) => (
    (except === 'prio' || !selPrio.size || selPrio.has(l.priority || 'warm')) &&
    (except === 'status' || !selStatus.size || selStatus.has(l.callStatus || 'not-called')) &&
    (except === 'ind' || !selInd.size || selInd.has(industryKey(l.industry))) &&
    (except === 'win' || !winSel.size || [...winSel].some(w => matchesWindow(l, w)))
  );
  const count = (except, fn) => pool.filter(l => pass(l, except) && fn(l)).length;
  const facets = useMemo(() => industryFacets(pool.filter(l => pass(l, 'ind'))), [pool, selPrio, selStatus, winSel]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => orderQueue(pool.filter(l => pass(l)), 'priority'), [pool, selPrio, selStatus, selInd, winSel]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (setter) => (id) => setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return { selPrio, setSelPrio, selStatus, setSelStatus, selInd, setSelInd, winSel, rightNow, setRightNow, toggleWin: (id) => { setRightNow(false); toggle(setSelWin)(id); }, win, count, facets, matches };
}

export default function FilterPicker({ f }) {
  return (
    <Stack gap={4}>
      <Section title="Priority"><ChipGroup label="Priority" value={f.selPrio} onChange={f.setSelPrio} options={PRIORITIES.map(p => ({ id: p.id, label: p.label, icon: p.icon, count: f.count('prio', l => (l.priority || 'warm') === p.id) }))} /></Section>
      <Section title="Call status"><ChipGroup label="Call status" value={f.selStatus} onChange={f.setSelStatus} options={BOARD.map(s => ({ id: s.id, label: s.label, icon: s.icon, count: f.count('status', l => (l.callStatus || 'not-called') === s.id) }))} /></Section>
      {f.facets.length > 0 && <Section title="Industry"><ChipGroup label="Industry" value={f.selInd} onChange={f.setSelInd} allWhenEmpty={false} options={f.facets.slice(0, 8).map(x => ({ id: x.key, label: x.label, count: x.count }))} /></Section>}
      <Section title="Best window">
        <Row gap={2} wrap>
          <Chip label="Right now" icon="Clock" selected={f.rightNow} onClick={() => f.setRightNow(v => !v)} count={f.count('win', l => matchesWindow(l, f.win))} />
          {WINDOWS.map(w => <Chip key={w.id} label={w.label} icon={w.icon} selected={f.winSel.has(w.id)} onClick={() => f.toggleWin(w.id)} count={f.count('win', l => matchesWindow(l, w.id))} />)}
        </Row>
      </Section>
    </Stack>
  );
}
