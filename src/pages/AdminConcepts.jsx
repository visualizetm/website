import { useMemo, useState } from 'react';
import { PageShell, ScrollArea, Section, Stack, Row, Card, Chip, Pill, EmptyState, ErrorState, Stagger, SkeletonText, useDelayedLoading, useRetry, Icon } from '../ui';
import { COPY } from '../shared/copy';
import { CONCEPT_SET_STATUSES, conceptSetStatusOf } from '../shared/semantics';
import { relativeTime } from '../shared/dates';
import { safeHref } from '../lib/safeUrl';
import { sortSets, statusOf, directionsOf, firstImage, viewedUnanswered } from '../lib/concepts';
import { useShell, useTopBar } from '../shell/ShellContext';

/* Studio > Concepts (Concepts rebuild, Part 3): every concept set across
 * every lead, in the order they need Rob: changes requested, then viewed
 * and unanswered, then sent, then drafts, then approved. The prompt library
 * that lived here is gone (docs/CONCEPTS-AUDIT.md). A row opens the
 * editor at /leads/:id/concepts on that set. */
export default function AdminConcepts({ sets = [], leads = [], loading = false, error = false, onRetry }) {
  const shell = useShell();
  useTopBar(null);
  const showSkel = useDelayedLoading(loading);
  const [retry, retrying] = useRetry(onRetry);
  const [filter, setFilter] = useState('all');
  const leadOf = useMemo(() => new Map((leads || []).map(l => [String(l._id), l])), [leads]);
  const rows = useMemo(() => sortSets(sets).map(s => ({ set: s, lead: leadOf.get(String(s.leadId)) || null })), [sets, leadOf]);
  const counts = useMemo(() => rows.reduce((m, r) => { const k = statusOf(r.set); m[k] = (m[k] || 0) + 1; return m; }, {}), [rows]);
  const shown = filter === 'all' ? rows.filter(r => statusOf(r.set) !== 'archived') : rows.filter(r => statusOf(r.set) === filter);
  const E = COPY.empty['concepts.none'];
  const F = COPY.empty['concepts.filter'];

  return (
    <PageShell className="aa-main aa-main--wide">
      <ScrollArea wide>
        <Section title="Concepts" description={rows.length ? `${rows.filter(r => statusOf(r.set) !== 'archived').length} out with clients` : ' '} loading={showSkel}>
          {error && !rows.length ? (
            <Card><ErrorState title={COPY.error.sets.title} description={COPY.error.sets.description} onRetry={retry} retrying={retrying} /></Card>
          ) : showSkel ? (
            <Stack gap={2} aria-busy="true">{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={2} /></Card>)}</Stack>
          ) : !rows.length ? (
            <Card><EmptyState icon="LayersThree01" title={E.title} description={E.description} /></Card>
          ) : (
            <Stack gap={3}>
              <Row gap={2} wrap role="group" aria-label="Filter by status" className="cl-chips">
                <Chip label="All" count={rows.filter(r => statusOf(r.set) !== 'archived').length} selected={filter === 'all'} onClick={() => setFilter('all')} />
                {CONCEPT_SET_STATUSES.map(s => <Chip key={s.id} label={s.label} count={counts[s.id] || 0} selected={filter === s.id} onClick={() => setFilter(s.id)} />)}
              </Row>
              {!shown.length ? (
                <Card><EmptyState icon="LayersThree01" title={F.title} description={F.description} action={{ label: F.action, onClick: () => setFilter('all') }} /></Card>
              ) : (
                <Stagger className="v-stack" style={{ gap: 'var(--v-space-2)' }}>
                  {shown.map(({ set, lead }) => {
                    const st = conceptSetStatusOf(statusOf(set));
                    const client = lead?.showcase?.displayName || lead?.business || 'Client';
                    const thumb = safeHref(firstImage(set));
                    const n = directionsOf(set).length;
                    const stale = viewedUnanswered(set);
                    return (
                      <Card key={set._id} as="div" padding={3} interactive className="cl-row">
                        <button type="button" className="v-stretch" disabled={!lead} onClick={() => lead && shell?.openConcepts?.(lead, set._id)} aria-label={`Open ${client}, ${set.title || 'Concepts'} round ${set.round || 1}`}>Open</button>
                        <Row gap={3} align="center" wrap={false} style={{ minWidth: 0 }}>
                          <span className="img-fit cl-thumb">{thumb ? <img src={thumb} alt="" width={96} height={96} loading="lazy" decoding="async" /> : <span className="cl-thumb-empty" aria-hidden="true"><Icon icon="Image01" size="var(--v-icon-md)" /></span>}</span>
                          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                            <Row gap={2} align="center" wrap>
                              <span className="cl-client lay-truncate">{client}</span>
                              <Pill tone={st.tone} label={st.label} size="sm" icon={false} variant={st.id === 'changes' || st.id === 'approved' ? 'solid' : 'soft'} />
                              {stale && <Pill tone="new" label="Unanswered 2 days" size="sm" icon={false} variant="outline" />}
                            </Row>
                            <span className="cl-title lay-truncate">{set.title || 'Concepts'}, round {set.round || 1}</span>
                            <span className="dt-muted">{n} direction{n === 1 ? '' : 's'}. {set.lastViewedAt ? `Last opened ${relativeTime(set.lastViewedAt)}.` : set.status === 'draft' ? 'Not sent yet.' : 'Not opened yet.'}</span>
                          </Stack>
                        </Row>
                      </Card>
                    );
                  })}
                </Stagger>
              )}
            </Stack>
          )}
        </Section>
        <style>{clStyles}</style>
      </ScrollArea>
    </PageShell>
  );
}

const clStyles = `
  .cl-row { gap: 0; text-align: left; align-items: stretch; }
  .cl-row:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .cl-row .v-stretch:focus-visible { outline: 0; }
  .cl-thumb { width: 56px; flex: 0 0 56px; aspect-ratio: 1 / 1; border: 1px solid var(--v-border); background: var(--v-surface-3); }
  .cl-thumb img { object-fit: contain; }
  .cl-thumb-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--v-text-3); }
  .cl-client { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .cl-title { font-size: var(--v-text-sm); color: var(--v-text-2); }
`;
