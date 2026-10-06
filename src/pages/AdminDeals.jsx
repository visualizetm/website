import { useMemo, useState } from 'react';
import PhoneOutgoing01 from '@untitled-ui/icons-react/build/esm/PhoneOutgoing01';
import {
  PageShell, ScrollArea, Section, Stack, Card, IconButton, Pill, EmptyState, NoResults, ErrorState, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery, useRetry, useToast, CollapsiblePane,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar, useShell } from '../shell/ShellContext';
import ListSearch, { matchesList, matchLine } from '../components/ListSearch';
import { useSelection, useScreenOrigin, useRestore } from '../shell/nav-history';
import LeadDetail from '../components/LeadDetail';
import LeadCard from '../components/LeadCard';
import { effectiveStage } from '../lib/booked';
import { DEAL_COLUMNS, dealOf, columnOf, daysHere, isStalled, tickPatch, metPatch, checkpointOf } from '../lib/deal';
import { dealPackageLabel } from '../lib/dealConvert';
import { liveNextAction } from '../lib/nextAction';
import { nextActionKindOf } from '../shared/semantics';

/* Deals (CRM revamp, step 5): every booked and deal record on one board.
 * A desktop shows seven columns, Booked to Invoice sent; a card sits in
 * the column of its newest ticked checkpoint and moves when one ticks
 * (no drag). A phone shows one list grouped under the same labels, each
 * card with one button that does its next action. Opening a card shows
 * the record with the Checkpoints fold on top. */
const SEND_KINDS = { 'send-onboarding': 'onboardingSent', 'send-contract': 'contractSent', 'send-invoice': 'invoiceSent' };

/* A deal row (UI simplification, part B): LeadCard's shell, the days here or
 * Stalled as the one pill, the package on line two. The column says where
 * the deal is and the record shows the action; a phone keeps the one action
 * button as the row's trailing control. */
function DealCard({ lead, action, onOpen, onAct, phone, selected }) {
  const deal = dealOf(lead);
  const days = daysHere(lead);
  const pkg = dealPackageLabel(deal);
  const pill = isStalled(lead)
    ? <Pill tone="danger" label="Stalled" size="sm" variant="solid" icon={false} />
    : <Pill tone="neutral" label={days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`} size="sm" icon={false} />;
  /* The phone's one action: a 44px icon button named after the action, so the name and the pill keep their room. */
  const act = phone && action && !action.doneAt ? <IconButton icon={nextActionKindOf(action.kind).icon} label={action.label} variant="secondary" onClick={() => onAct(lead, action)} className="dl-act" /> : null;
  return <LeadCard lead={lead} onOpen={onOpen} selected={selected} pill={pill} line={pkg || 'No package yet'} trailing={act} className={`dl-card${isStalled(lead) ? ' is-stalled' : ''}`} />;
}

export default function AdminDeals({ leads, submissions = [], loading, error, onRetry, onPatch, onLinkSubmission, onGo }) {
  const shell = useShell();
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const desktop = useMediaQuery('(min-width: 1280px)');
  const board = useMediaQuery('(min-width: 1024px)');
  /* Back (done once): the open record rides on the history entry; a card tap pushes, Back pops. */
  const { selId, entry: openEntry, open: openSel, close } = useSelection('deals');
  const showSkel = useDelayedLoading(loading);
  const pending = loading && !showSkel;
  const ctx = useMemo(() => ({ projects: shell?.projects || [], sets: shell?.sets || [] }), [shell?.projects, shell?.sets]);
  const pool = useMemo(() => leads.filter(l => ['booked', 'deal'].includes(effectiveStage(l))).sort((a, b) => Number(isStalled(b)) - Number(isStalled(a)) || daysHere(b) - daysHere(a)), [leads]);
  const [q, setQ] = useState('');
  const shown = useMemo(() => (q.trim() ? pool.filter(l => matchesList(l, q)) : pool), [pool, q]);
  const groups = useMemo(() => DEAL_COLUMNS.map(c => ({ ...c, items: shown.filter(l => columnOf(dealOf(l)) === c.id) })), [shown]);
  const sel = selId ? leads.find(l => l._id === selId) : null;
  const pick = (id) => openSel(id);
  const back = () => close();
  useScreenOrigin(() => ({ selectedId: selId, filters: { q } }));
  useRestore((o) => { if (o.filters) setQ(o.filters.q || ''); });
  useTopBar(null);
  const E = COPY.empty['deals.none'];

  /* The one button on a phone card does the action: a manual send ticks the step, Log the call is Met them, building concepts opens the editor, everything else opens the record on its fold. */
  const act = async (lead, action) => {
    if (action.kind === 'build-concepts' && shell?.openConcepts) { shell.openConcepts(lead); return; }
    if (action.kind === 'log-outcome' && effectiveStage(lead) === 'deal') { const ok = await onPatch(lead._id, metPatch(lead)); if (ok) toast.success(`Met them. ${lead.business} moved.`); else toast.error(COPY.error.save); return; }
    const cp = SEND_KINDS[action.kind];
    if (cp) { const ok = await onPatch(lead._id, tickPatch(lead, cp)); if (ok) toast.success(`${checkpointOf(cp).label} ticked. Emails connect in the next step.`); else toast.error(COPY.error.save); return; }
    pick(lead._id);
  };
  const card = (l, phone) => <DealCard key={l._id} lead={l} action={liveNextAction(l, ctx)} onOpen={() => pick(l._id)} onAct={act} phone={phone} selected={sel?._id === l._id} />;

  const pendingOpen = !!selId && loading && !sel;
  if (pendingOpen || sel) {
    return (
      <>
        <CollapsiblePane id="deals" label="Deals" className={`dl-panel${desktop ? '' : ' dl-panel--rail'}`} rail={pool.map(l => ({ id: l._id, name: l.business, selected: sel?._id === l._id, onOpen: () => pick(l._id) }))}>
          <ScrollArea bare className="dl-panel-scroll"><Stack gap={2}>{pendingOpen && showSkel ? [1, 2, 3].map(i => <LeadCard.Skeleton key={i} menu={false} />) : <><p className="dl-muted">{pool.length} in play</p>{pool.map(l => <LeadCard key={l._id} lead={l} onOpen={() => pick(l._id)} selected={sel?._id === l._id} />)}</>}</Stack></ScrollArea>
        </CollapsiblePane>
        <div className="aa-main dl-main">
          {sel ? <LeadDetail lead={sel} submissions={submissions} onPatch={onPatch} onLinkSubmission={onLinkSubmission} onClose={back} intent={openEntry?.intent || null} /> : showSkel && <LeadDetail.Skeleton mode="deal" />}
        </div>
        <style>{dlStyles}</style>
      </>
    );
  }

  const skeleton = board
    ? <div className="dl-board" aria-busy="true">{DEAL_COLUMNS.map(c => <div key={c.id} className="dl-col"><div className="dl-col-head"><SkeletonBlock width={90} height={14} /></div><Stack gap={2}>{[1, 2].map(i => <LeadCard.Skeleton key={i} menu={false} />)}</Stack></div>)}</div>
    : <Stack gap={4} aria-busy="true">{[1, 2, 3].map(g => <Stack key={g} gap={2}><SkeletonBlock width={110} height={16} /><LeadCard.Skeleton menu={false} /></Stack>)}</Stack>;

  return (
    <PageShell className="aa-main aa-main--wide dl-shell">
      <ScrollArea wide className="dl-page">
        <Section title="Deals" loading={showSkel} description={showSkel ? undefined : q.trim() ? matchLine(pool.length, 'deals', shown.length) : `${pool.length} in play, ${pool.filter(isStalled).length} stalled`} />
        {!showSkel && !pending && pool.length > 0 && <ListSearch value={q} onChange={setQ} placeholder="Search deals" label="Search deals" className="dl-search" />}
        {showSkel && <Stack gap={4} aria-busy="true" aria-hidden="true"><SkeletonBlock height={44} radius="var(--v-radius-md)" className="lsr-skel" /></Stack>}
        {pending ? null : showSkel ? skeleton
          : error && !leads.length ? <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
          : !pool.length ? <Card><EmptyState icon="Zap" title={E.title} description={E.description} action={{ label: E.action, icon: PhoneOutgoing01, onClick: () => (shell ? shell.go('calls') : onGo?.('calls')) }} /></Card>
          : q.trim() && !shown.length ? <Card><NoResults noun="deals" query={q} onClear={() => setQ('')} /></Card>
          : board ? (
            <div className="dl-board">
              {groups.map(g => (
                <section key={g.id} className="dl-col" aria-label={`${g.label}, ${g.items.length}`}>
                  <div className="dl-col-head"><span className="dl-col-label">{g.label}</span><span className="dl-col-count">{g.items.length}</span></div>
                  {g.items.length ? <Stagger className="dl-col-stack" cap={4}>{g.items.map(l => card(l, false))}</Stagger> : <p className="dl-col-empty">{COPY.empty['deals.column'].title}</p>}
                </section>
              ))}
            </div>
          ) : (
            <Stack gap={4}>
              {groups.filter(g => g.items.length).map(g => (
                <section key={g.id} aria-label={`${g.label}, ${g.items.length}`}>
                  <p className="dl-muted">{g.label}, {g.items.length}</p>
                  <Stagger className="dl-list" cap={4}>{g.items.map(l => card(l, true))}</Stagger>
                </section>
              ))}
            </Stack>
          )}
      </ScrollArea>
      <style>{dlStyles}</style>
    </PageShell>
  );
}

const dlStyles = `
  .dl-shell.aa-main { display: flex; flex-direction: column; }
  /* Seven columns of one line rows: each at least 176px, the board scrolls sideways when the screen is narrower (as the Leads board does). */
  .dl-board { display: grid; grid-template-columns: repeat(7, minmax(176px, 1fr)); gap: var(--v-space-2); align-items: start; overflow-x: auto; padding: 2px; margin: -2px; scrollbar-width: thin; }
  .dl-col { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .dl-col-head { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); min-height: 28px; padding: 0 var(--v-space-1); }
  .dl-col-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .dl-col-count { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .dl-col-stack, .dl-list { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .dl-col-stack > .v-stagger-item, .dl-list > .v-stagger-item { display: contents; }
  .dl-col-empty { margin: 0; padding: var(--v-space-3); border: 1px dashed var(--v-border); border-radius: var(--v-radius-md); font-size: var(--v-text-xs); color: var(--v-text-3); text-align: center; }
  .dl-card.is-stalled { border-color: var(--v-status-danger-solid); }
  .dl-muted { margin: 0 0 var(--v-space-2); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .dl-panel { padding: var(--v-space-3); }
  .dl-panel-scroll { padding: 0; }
  @media (min-width: 1024px) and (max-width: 1279px) { .dl-panel--rail { width: 232px; } }
  .dl-main { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
  @media (max-width: 767px) { .aa-app.has-detail .aa-main.dl-main { display: flex; } }
`;
