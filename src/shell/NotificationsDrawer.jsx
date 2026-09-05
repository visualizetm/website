import { useMemo } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import CheckDone01 from '@untitled-ui/icons-react/build/esm/CheckDone01';
import { Sheet, ListRow, IconTile, EmptyState, ErrorState, Button, Menu, Stagger, useDelayedLoading, useRetry } from '../ui';
import { COPY } from '../shared/copy';
import { relativeTime } from '../shared/dates';
import { GROUP_LABELS, GROUP_ORDER } from './notifications';

const SNOOZES = [['1h', 'In 1 hour'], ['tomorrow', 'Tomorrow 9am'], ['week', 'Next week']];

/** One notification: IconTile with tone, title, one line, relative time, actions Menu. */
export function NotificationItem({ item, read, onOpen, onSnooze, onDone }) {
  const canSnooze = item.kind === 'callback' || item.kind === 'meeting' || item.kind === 'calendly';
  const items = [
    { id: 'open', label: 'Open', icon: 'ArrowRight', onSelect: () => onOpen(item) },
    ...(canSnooze ? ['divider', ...SNOOZES.map(([id, label]) => ({ id: `s:${id}`, label: `Snooze: ${label}`, icon: 'Clock', onSelect: () => onSnooze(item, id) }))] : []),
    'divider',
    { id: 'done', label: 'Done', icon: 'Check', onSelect: () => onDone(item) },
  ];
  return (
    <ListRow className={`sh-notif${read ? ' is-read' : ''}`} leading={<IconTile icon={item.icon} tone={item.tone} size="sm" glow={!read} />}
      title={item.title} subtitle={item.detail} meta={relativeTime(item.at)} onClick={() => onOpen(item)} chevron={false}
      trailing={<Menu label="Notification actions" items={items} />} />
  );
}

/**
 * Notifications drawer: Overdue, Today, Upcoming, New leads, System.
 * Read state and snoozes live on the settings 'notifications' document.
 */
export default function NotificationsDrawer({ open, onClose, items, loading, error, onRetry, readIds, onOpenItem, onMarkAllRead, onSnooze, onDone, onGoCalls }) {
  const showSkel = useDelayedLoading(loading);
  const [retry, retrying] = useRetry(onRetry);
  const E = COPY.empty['notifications.none'];
  const groups = useMemo(() => GROUP_ORDER.map(g => ({ id: g, label: GROUP_LABELS[g], items: items.filter(i => i.group === g) })).filter(g => g.items.length), [items]);
  const unread = items.filter(i => !readIds.has(i.id)).length;
  return (
    <Sheet open={open} onClose={onClose} title="Notifications" tall
      description={items.length ? `${unread} unread` : undefined}
      footer={items.length ? <Button variant="ghost" icon={CheckDone01} onClick={onMarkAllRead} disabled={!unread} className="sh-markall">Mark all read</Button> : undefined}>
      {showSkel ? (
        <div className="sh-notif-group" aria-busy="true"><p className="sh-side-label"><span className="v-skel" style={{ width: 64, height: 12 }} /></p><div className="sh-notif-list">{[1, 2, 3, 4].map(i => <ListRow.Skeleton key={i} trailing={false} />)}</div></div>
      ) : error && !items.length ? (
        <ErrorState title={COPY.error.notifications.title} description={COPY.error.notifications.description} onRetry={retry} retrying={retrying} />
      ) : !items.length ? (
        <EmptyState icon={PhoneCall01} title={E.title} description={E.description} action={{ label: E.action, icon: PhoneCall01, onClick: () => { onClose(); onGoCalls(); } }} />
      ) : <Stagger className="sh-notif-groups" cap={5}>{groups.map(g => (
        <div key={g.id} className="sh-notif-group">
          <p className="sh-side-label">{g.label}</p>
          <div className="sh-notif-list">{g.items.map(item => <NotificationItem key={item.id} item={item} read={readIds.has(item.id)} onOpen={onOpenItem} onSnooze={onSnooze} onDone={onDone} />)}</div>
        </div>
      ))}</Stagger>}
    </Sheet>
  );
}

export const notificationsStyles = `
  .sh-notif-groups { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .sh-notif-group { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .sh-notif-list { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .sh-notif.is-read { opacity: 0.62; }
  .sh-notif .v-lrow-sub { white-space: normal; }
`;
