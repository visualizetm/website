import { useState } from 'react';
import { PageShell, ScrollArea, Section, Stack, Row, Card, Button, Chip, SegmentedControl, Sheet, EmptyState, NoResults, ErrorState, SkeletonBlock, Icon, useRetry, useToast, useDelayedLoading } from '../ui';
import { useTopBar, useShell } from '../shell/ShellContext';
import { useBillyDay, teamApi } from '../lib/useTeam';
import { DAY_RANGES, DAY_CHIPS, dayRows, chipCounts, rowWords, rowTime, rowChip, isBatch, batchLeads, rowLeadId, CALLER_NAME } from '../lib/team';

/* Billy's day (Settings > Team > Billy; Billy's Call Room, part 1): what the caller did, read only. Today, Yesterday or
 * the Week; chips All, Calls, Booked, Sorting; rows newest first, each with "by Billy" and the time. A row opens its
 * lead. A decline (sorted in Triage or Leads, or said on a call) opens its batch, where Undo puts one lead back to the
 * stage it had; that one write is the only thing this page changes. It reads GET /api/admin/team?view=day. */
const ICON = { calls: 'PhoneCall01', booked: 'CalendarCheck01', sorting: 'List', all: 'CheckCircle' };
const EMPTY = { today: 'Nothing from Billy yet today', yesterday: 'Nothing from Billy yesterday', week: 'Nothing from Billy this week' };
const STOOD = { triage: 'Triage', lead: 'Leads', nurture: 'Nurture' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function AdminTeamDay({ leads = [], onBack, onLeadsChanged, loading: forced = false }) {
  const shell = useShell();
  const toast = useToast();
  const [range, setRange] = useState('today');
  const [chip, setChip] = useState('all');
  const [batch, setBatch] = useState(null);
  const [undoing, setUndoing] = useState('');
  const [undone, setUndone] = useState({}); // rowId -> lead ids put back in this visit
  const day = useBillyDay(range);
  /* The audits' forced loading state: nothing has loaded yet. */
  const data = forced ? null : day.data; const { loading, error, reload } = day;
  const [retry, retrying] = useRetry(reload);
  const name = data?.billy?.name || CALLER_NAME;
  useTopBar({ title: `${name}'s day`, back: onBack });
  const busy = loading || forced;
  const showSkel = useDelayedLoading(busy && !data);

  const all = (data?.rows || []).map(r => ({ ...r, undone: [...new Set([...(r.undone || []), ...(undone[r.id] || [])])] }));
  const rows = dayRows(all, chip);
  const counts = chipCounts(all);
  const s = data?.stats || { calls: 0, talked: 0, booked: 0, callbacks: 0 };
  const open = (r) => {
    if (isBatch(r)) { setBatch(r.id); return; }
    const lead = leads.find(l => String(l._id) === rowLeadId(r));
    if (lead) shell?.openRecord?.(lead); else toast.info('That lead is not in the app any more.');
  };
  const undo = async (row, lead) => {
    setUndoing(lead.id);
    const r = await teamApi.undoDecline(row.id, lead.id);
    setUndoing('');
    if (!r.ok) { toast.error(r.status === 409 ? 'That lead is not declined any more.' : r.data?.error || 'That did not save. Try again in a moment.'); return; }
    setUndone(u => ({ ...u, [row.id]: [...(u[row.id] || []), lead.id] }));
    toast.success(`${lead.business} is back in ${STOOD[r.data?.stage] || STOOD[lead.stage] || 'Leads'}.`);
    onLeadsChanged?.();
  };
  const batchRow = batch ? all.find(r => r.id === batch) : null;
  const chipLabel = DAY_CHIPS.find(c => c.id === chip)?.label;

  return (
    <PageShell className="aa-main aa-main--wide td-shell">
      <ScrollArea className="td-page">
        <Stack gap={3}>
          <Section loading={busy && !data} description={data ? `${plural(s.calls, 'call')}, ${s.talked} talked, ${s.booked} booked, ${plural(s.callbacks, 'callback')}` : undefined} />
          <SegmentedControl full size="sm" label="Range" options={DAY_RANGES} value={range} onChange={(id) => { setRange(id); setChip('all'); }} className="td-range" />
          <div className="td-chips" role="group" aria-label="Show">
            {DAY_CHIPS.map(c => <Chip key={c.id} label={c.label} count={data ? counts[c.id] : undefined} selected={chip === c.id} onClick={() => setChip(c.id)} data-chip={c.id} />)}
          </div>
          <div className="lay-tabbody" key={`${range}-${showSkel ? 'skel' : 'rows'}`}>
            {error && !data ? <Card><ErrorState title={`${name}'s day did not load`} description="Nothing was changed. Try again." onRetry={retry} retrying={retrying} /></Card>
              : !data || (busy && data.range !== range) ? (showSkel || data ? (
                <Stack gap={2} aria-hidden="true">{[0, 1, 2].map(i => <Card key={i} padding={3} className="td-skel-row"><Row gap={3} align="center"><SkeletonBlock width={36} height={36} radius="var(--v-radius-md)" /><Stack gap={1} style={{ flex: 1, minWidth: 0 }}><SkeletonBlock width="55%" height={22} /><SkeletonBlock width="70%" height={18} /><SkeletonBlock width="35%" height={18} /></Stack></Row></Card>)}</Stack>
              ) : <div className="td-wait" />)
                : !all.length ? <EmptyState icon="ClockRewind" title={EMPTY[range]} description="His calls, bookings and sorting land here as he works, each with the time." action={range === 'week' ? (onBack ? { label: `Open ${name}'s access`, onClick: onBack } : undefined) : { label: 'See the week', onClick: () => { setRange('week'); setChip('all'); } }} />
                  : !rows.length ? <NoResults noun="entries" filters={[chipLabel]} onClear={() => setChip('all')} />
                    : (
                      <ul className="td-list td-enter" data-v-enter="" aria-label={`${name}'s day, newest first`}>
                        {rows.map(r => {
                          const w = rowWords(r);
                          const opens = isBatch(r) || !!rowLeadId(r);
                          const label = isBatch(r) ? `Open the batch: ${w.title}` : `Open the lead: ${w.title}`;
                          return (
                            <li key={r.id}>
                              <Card padding={3} className="td-row" data-row-id={r.id} data-kind={r.kind}>
                                {opens && <button type="button" className="v-stretch" onClick={() => open(r)} aria-label={label}>{label}</button>}
                                <Row gap={3} align="center">
                                  <span className={`td-ico td-ico--${rowChip(r)}`} aria-hidden="true"><Icon icon={ICON[rowChip(r)]} size="var(--v-icon-md)" /></span>
                                  <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                                    <p className="td-title">{w.title}</p>
                                    {w.detail && <p className="td-detail">{w.detail}</p>}
                                    <p className="td-meta">{rowTime(r.at, range)} · by {name}</p>
                                  </Stack>
                                  {opens && <span className="td-chev" aria-hidden="true"><Icon icon="ChevronRight" size="var(--v-icon-sm)" /></span>}
                                </Row>
                              </Card>
                            </li>
                          );
                        })}
                      </ul>
                    )}
          </div>
        </Stack>
      </ScrollArea>
      {batchRow && (
        <Sheet open onClose={() => setBatch(null)} title={rowWords(batchRow).title} description={[rowWords(batchRow).detail, `${rowTime(batchRow.at, range)} · by ${name}`].filter(Boolean).join(' · ')} label="Declined leads" className="td-batch">
          <ul className="td-batch-list" aria-label="Leads in this batch">
            {batchLeads(batchRow).map(l => (
              <li key={l.id} className="td-batch-row" data-lead-id={l.id}>
                <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                  <p className="td-title">{l.business}</p>
                  <p className="td-meta">{l.undone ? `Back in ${STOOD[l.stage] || 'Leads'}` : `Declined. It was in ${STOOD[l.stage] || 'Leads'}.`}</p>
                </Stack>
                {!l.undone && <Button variant="secondary" icon="ReverseLeft" loading={undoing === l.id} disabled={!!undoing && undoing !== l.id} onClick={() => undo(batchRow, l)} aria-label={`Undo the decline of ${l.business}`} className="td-undo">Undo</Button>}
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      <style>{teamDayStyles}</style>
    </PageShell>
  );
}

export const teamDayStyles = `
  .td-chips { display: flex; flex-wrap: wrap; gap: var(--v-space-2); min-width: 0; }
  /* One width with or without its count, so the chips wrap the same way before and after the day loads. */
  .td-chips .v-chip { min-width: 112px; justify-content: center; padding: 0 var(--v-space-2); }
  .td-skel-row { min-height: 92px; box-sizing: border-box; }
  .td-wait { min-height: var(--v-space-9); }
  .td-list, .td-batch-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--v-space-2); min-width: 0; }
  .td-list > li { min-width: 0; }
  /* A real list keeps ul > li, so its entrance is on the items themselves. */
  .td-enter > li { animation: v-enter var(--v-dur-enter) var(--v-ease-out) both; }
  .td-enter > li:nth-child(2) { animation-delay: calc(1 * var(--v-stagger)); }
  .td-enter > li:nth-child(3) { animation-delay: calc(2 * var(--v-stagger)); }
  .td-enter > li:nth-child(4) { animation-delay: calc(3 * var(--v-stagger)); }
  .td-enter > li:nth-child(n+5) { animation-delay: calc(4 * var(--v-stagger)); }
  @media (prefers-reduced-motion: reduce) { .td-enter > li { animation: none; } }
  [data-v-motion='reduce'] .td-enter > li { animation: none; }
  .td-row { position: relative; min-width: 0; }
  .td-row:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .td-row .v-stretch:focus-visible { outline: 0; }
  .td-ico { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text-2); flex-shrink: 0; }
  .td-ico--booked { background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .td-ico--calls { background: var(--v-status-progress-soft); color: var(--v-status-progress-text); }
  .td-title { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); overflow-wrap: anywhere; }
  .td-detail { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .td-meta { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .td-chev { display: inline-flex; color: var(--v-text-3); flex-shrink: 0; }
  .td-batch-row { display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap-lg); padding: var(--v-space-2) 0; border-top: 1px solid var(--v-border); min-width: 0; }
  .td-batch-row:first-child { border-top: 0; }
`;
