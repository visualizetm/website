import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Button, Pill, EmptyState, ErrorState,
  SkeletonText, useDelayedLoading, useToast,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';
import { postsOf, postsInReview } from '../lib/posts';
import SaveBar, { saveBarStyles } from '../components/SaveBar';

/* The Content Planner editor (planner prompt 2), one page per client at
 * /clients/:id/planner, built on the pattern AdminShowcase established: a
 * draft held here, an explicit save, and the shared save bar.
 *
 * Prompt 1's data layer is what this reads and writes:
 *   posts        the shell already loads /api/admin/posts, src/lib/posts.js
 *                is the pure logic over it
 *   lead.planner a FULL REPLACEMENT object, so every save spreads the stored
 *                one and overrides only what changed. token, tokenCreatedAt
 *                and lastViewedAt are carried forward by the server and are
 *                never sent from here.
 */

export default function AdminPlanner({ lead, posts = [], loading = false, error = false, onRetry, onPatch, onBack, readOnly = false }) {
  const toast = useToast();
  const showSkel = useDelayedLoading(loading);
  useTopBar(null);

  const planner = lead?.planner || {};
  const mine = useMemo(() => postsOf(posts, lead?._id), [posts, lead]);
  const waiting = postsInReview(mine);

  if (!lead) {
    return (
      <PageShell className="aa-main aa-main--wide">
        <ScrollArea wide>
          {loading
            ? <Section title="Planner" description=" " loading><Stack gap={3}>{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={3} /></Card>)}</Stack></Section>
            : <EmptyState icon="Calendar" title="Client not found" description="That client is not in the list any more." action={<Button onClick={onBack}>Back to clients</Button>} />}
        </ScrollArea>
      </PageShell>
    );
  }

  const name = lead.showcase?.displayName || lead.business || 'Client';

  return (
    <PageShell className="aa-main aa-main--wide pl-page sb-host">
      <ScrollArea wide className="pl-scroll">
        <div className="pl-topbar">
          <Row gap={2} align="center" justify="between" wrap>
            <Row gap={2} align="center" wrap style={{ minWidth: 0 }}>
              <Button variant="ghost" icon="ArrowLeft" onClick={onBack}>Back</Button>
              <h1 className="pl-page-title lay-truncate">{name}</h1>
              <Pill tone={!planner.enabled ? 'neutral' : waiting ? 'new' : 'booked'} size="sm" icon={false}
                variant={planner.enabled && !waiting ? 'solid' : 'soft'}
                label={!planner.enabled ? 'Off' : waiting ? `${waiting} in review` : 'On'} />
            </Row>
          </Row>
        </div>

        <div className="pl-page-body">
          {error && !mine.length
            ? <Card><ErrorState title={COPY.error.posts.title} description={COPY.error.posts.description} onRetry={onRetry} /></Card>
            : showSkel
              ? <Stack gap={3} aria-busy="true">{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={3} /></Card>)}</Stack>
              : <Section title="Planner" description="What this client sees when they open their link. Nothing here is live until you save." />}
        </div>
      </ScrollArea>
      <SaveBar open={false} onSave={() => {}} onDiscard={() => {}} />
      <style>{saveBarStyles + plStyles}</style>
    </PageShell>
  );
}

const plStyles = `
  .pl-scroll { --v-scroll-extra: var(--sb-scroll-extra); }
  .pl-topbar {
    position: sticky; top: 0; z-index: 5;
    padding: var(--v-space-3) 0;
    background: var(--v-surface-1);
    border-bottom: 1px solid var(--v-border-1);
  }
  .pl-page-title { font-size: var(--v-text-lg); font-weight: 700; color: var(--v-text-1); margin: 0; min-width: 0; }
  .pl-page-body { padding-top: var(--v-space-4); }
`;
