import { useMemo } from 'react';
import { PageShell, ScrollArea, StickyFooterBar, Stack, Row, Card, Button, ErrorState, Stagger, SkeletonBlock, useDelayedLoading, useRetry, useToast } from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';
import FilterPicker, { useFilterMatches } from '../components/FilterPicker';
import { listCount, onAnyOpenList } from '../lib/lists';
import { effectiveStage } from '../lib/booked';

/* Fill from filters (nothing computer only): the console's chip groups in
 * one column, a live count, a sticky Add. Opened from a list's menu and its
 * empty state; adding appends the matches up to the target, skipping leads
 * on any open list or without a phone, then returns to the list. */
export default function AdminListFill({ list = null, leads = [], lists = [], loading = false, error = false, onRetry, ops, onDone, onCancel }) {
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const showSkel = useDelayedLoading(loading);
  useTopBar({ title: list ? `Fill ${list.name}` : 'Fill from filters', back: () => onCancel?.() });
  const pool = useMemo(() => leads.filter(l => effectiveStage(l) === 'lead'), [leads]);
  const f = useFilterMatches(pool);
  const taken = useMemo(() => onAnyOpenList(lists), [lists]);
  const room = list ? Math.max(0, (Number(list.target) || 0) - listCount(list)) : 0;
  const fillable = useMemo(() => (list ? f.matches.filter(l => !taken.has(String(l._id)) && l.phone).slice(0, room) : []), [f.matches, taken, list, room]);
  const add = async () => {
    if (!list) return;
    const ids = fillable.map(l => l._id);
    if (!ids.length) { toast.info('Nothing new matches. Loosen a chip.'); return; }
    const r = await ops.addToList(ids, list._id);
    if (r) { toast.success(`Added ${ids.length} to ${list.name}, ${r.count} of ${list.target}.`); onDone?.(list); }
    else toast.error(COPY.error.save);
  };
  const skel = (
    <Stack gap={5} aria-busy="true" aria-hidden="true">
      {[1, 2, 3, 4].map(i => <Stack key={i} gap={2}><SkeletonBlock width={90} height={14} /><Row gap={2} wrap>{[1, 2, 3].map(j => <SkeletonBlock key={j} width={110} height={44} radius="var(--v-radius-pill)" />)}</Row></Stack>)}
    </Stack>
  );
  return (
    <PageShell className="aa-main aa-main--wide lf-shell">
      <ScrollArea>
        <div className="lf-inner">
          {showSkel ? skel
            : error && !leads.length ? <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
            : !list ? <p className="lf-line">That list is not here any more.</p>
            : (
              <Stagger className="lf-stack" cap={5}>
                <p className="lf-count" role="status">{f.matches.length} match, {fillable.length} fit under the target of {list.target}{f.matches.length > fillable.length && room ? `; ${Math.max(0, f.matches.length - fillable.length)} already on a list, without a phone or past the target` : ''}</p>
                <FilterPicker f={f} />
              </Stagger>
            )}
        </div>
      </ScrollArea>
      {!showSkel && list && (
        <StickyFooterBar className="lf-foot">
          <Row gap={2} className="lf-foot-row">
            <Button variant="ghost" onClick={() => onCancel?.()}>Cancel</Button>
            <Button icon="Plus" onClick={add} disabled={!fillable.length} className="lf-add">Add {fillable.length}</Button>
          </Row>
        </StickyFooterBar>
      )}
      <style>{lfStyles}</style>
    </PageShell>
  );
}

const lfStyles = `
  .lf-shell.aa-main { display: flex; flex-direction: column; }
  .lf-inner { width: 100%; max-width: 760px; margin: 0 auto; min-width: 0; }
  .lf-stack { display: flex; flex-direction: column; gap: var(--v-space-5); min-width: 0; }
  .lf-count { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .lf-line { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-2); }
  .lf-foot-row { width: 100%; max-width: 760px; }
  .lf-foot-row > .v-btn { flex: 1 1 140px; min-width: 0; }
`;
