import { useState } from 'react';
import { Card, Stack, Row, Button, Pill, SkeletonBlock, useRetry } from '../ui';
import { useShell } from '../shell/ShellContext';
import { useBillyDay, knowsBilly } from '../lib/useTeam';
import { CALLER_NAME } from '../lib/team';

/* Billy today (Billy's Call Room, part 1): the home's card on what the caller did today: Calls, Talked, Callbacks, an
 * "N booked" pill and Open Billy's day. It reads GET /api/admin/team?view=day. The card keeps one height in every state
 * (loading, loaded, failed), so it never moves what is under it; a studio with no caller draws nothing once that is known
 * (the answer is remembered on the device). */
export default function BillyToday() {
  const shell = useShell();
  const { data, loading, error, reload } = useBillyDay('today');
  const [retry, retrying] = useRetry(reload);
  const [known] = useState(knowsBilly);
  const open = () => shell?.goPath?.('/settings/team/day');
  if (data && !data.billy?.exists) return null;
  if (!data && known === false) return null;
  const name = data?.billy?.name || CALLER_NAME;
  const s = data?.stats || { calls: 0, talked: 0, booked: 0, callbacks: 0 };
  const quiet = !!data && !(s.calls || s.booked || (data.rows || []).length);
  return (
    <Card padding={4} className="bt-card" data-card="billy" role="region" aria-label={`${name} today`} aria-busy={loading || undefined}>
      {!data && error ? (
        <Row gap={3} align="center" justify="between" wrap className="bt-state" role="alert">
          <p className="bt-quiet">{name}'s day did not load.</p>
          <Button variant="secondary" loading={retrying} onClick={retry} className="bt-retry">Try again</Button>
        </Row>
      ) : !data ? (
        <Stack gap={3} className="bt-state" aria-hidden="true">
          <Row gap={2} align="center" justify="between"><SkeletonBlock width={120} height={20} /><SkeletonBlock width={72} height={22} radius="var(--v-radius-pill)" /></Row>
          <Row gap={5}><SkeletonBlock width={56} height={40} /><SkeletonBlock width={56} height={40} /><SkeletonBlock width={56} height={40} /></Row>
        </Stack>
      ) : (
        <Stack gap={3} className="bt-state bt-in">
          <Row gap={2} align="center" justify="between" wrap>
            <h3 className="bt-title">{name} today</h3>
            <Pill label={`${s.booked || 0} booked`} tone={s.booked ? 'booked' : 'neutral'} icon={false} size="sm" className="bt-booked" />
          </Row>
          <div className="bt-row">
            {quiet ? <p className="bt-quiet">Nothing from {name} yet today.</p> : (
              <dl className="bt-stats">
                <div><dd>{s.calls || 0}</dd><dt>Calls</dt></div>
                <div><dd>{s.talked || 0}</dd><dt>Talked</dt></div>
                <div><dd>{s.callbacks || 0}</dd><dt>Callbacks</dt></div>
              </dl>
            )}
            <Button variant="ghost" iconEnd="ArrowRight" onClick={open} className="bt-open">Open {name}'s day</Button>
          </div>
        </Stack>
      )}
      <style>{billyTodayStyles}</style>
    </Card>
  );
}
export const billyTodayStyles = `
  .bt-card { min-width: 0; }
  /* One height in every state at a given width: stacked on a phone, one line on a computer. */
  .bt-state { min-height: 148px; justify-content: center; }
  .bt-row { display: flex; flex-direction: column; align-items: flex-start; gap: var(--v-space-2); min-width: 0; }
  @media (min-width: 768px) {
    .bt-state { min-height: 100px; }
    .bt-row { flex-direction: row; align-items: flex-end; justify-content: space-between; gap: var(--v-space-4); }
  }
  .bt-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .bt-stats { margin: 0; display: flex; gap: var(--v-space-5); min-width: 0; }
  .bt-stats > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .bt-stats dd { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .bt-stats dt { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .bt-quiet { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .bt-in { animation: lay-view-in var(--v-dur-base) var(--v-ease-out) both; }
  @media (prefers-reduced-motion: reduce) { .bt-in { animation: none; } }
  [data-v-motion='reduce'] .bt-in { animation: none; }
`;
