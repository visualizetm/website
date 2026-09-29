import { useMemo } from 'react';
import { PageShell, ScrollArea, StickyFooterBar, Section, Stack, Row, Card, Button, EmptyState, ErrorState, Stagger, SkeletonBlock, useDelayedLoading, useRetry, useToast } from '../ui';
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
  /* The picker's four sections with chips at the widths the real ones take, so they wrap the same way at every width. */
  const chips = (ws, all) => <div className="v-chipgroup">{ws.map((w, i) => <SkeletonBlock key={i} width={w} height={44} radius="var(--v-radius-md)" />)}{all && <span className="v-chipgroup-all"><SkeletonBlock width={24} height={16} /></span>}</div>;
  const skel = (
    <div className="lf-stack" aria-busy="true" aria-hidden="true">
      <Stack gap={0}><SkeletonBlock width="90%" height={22} /><span className="lf-skel-line2"><SkeletonBlock width="40%" height={22} /></span></Stack>
      <Stack gap={4}>
        <Section title="Priority">{chips([104, 120, 112], true)}</Section>
        <Section title="Call status">{chips([146, 136, 150, 130, 176], true)}</Section>
        <Section title="Industry">{chips([154], false)}</Section>
        <Section title="Best window">{chips([146, 136, 128, 148, 134], false)}</Section>
      </Stack>
    </div>
  );
  return (
    <PageShell className="aa-main aa-main--wide lf-shell">
      <ScrollArea>
        <div className="lf-inner">
          {showSkel ? skel
            : error && !list ? <Card><ErrorState title={COPY.error.lists.title} description={COPY.error.lists.description} onRetry={retry} retrying={retrying} /></Card>
            : !list ? <Card><EmptyState size="sm" icon="Rows01" title="That list is gone" description="It was finished or deleted. Pick another on Lists." action={{ label: 'Back to Lists', icon: 'Rows01', onClick: () => onCancel?.() }} /></Card>
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
  .lf-skel-line2 { display: none; }
  @media (max-width: 767px) { .lf-skel-line2 { display: block; } }
  .lf-foot-row { width: 100%; max-width: 760px; }
  .lf-foot-row > .v-btn { flex: 1 1 140px; min-width: 0; }
`;
