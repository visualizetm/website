import { useMemo } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import CheckDone01 from '@untitled-ui/icons-react/build/esm/CheckDone01';
import { Sheet, ListRow, IconTile, EmptyState, Button, useDelayedLoading } from '../ui';
import { relativeTime } from '../shared/dates';
import { GROUP_LABELS } from './notifications';

/** One notification: IconTile with tone, title, one line, relative time. */
export function NotificationItem({ item, read, onOpen }) {
  return (
    <ListRow className={`sh-notif${read ? ' is-read' : ''}`} leading={<IconTile icon={item.icon} tone={item.tone} size="sm" glow={!read} />}
      title={item.title} subtitle={item.detail} meta={relativeTime(item.at)} onClick={() => onOpen(item)} chevron={false} />
  );
}

/**
 * Notifications drawer: a tall Sheet with Today, Upcoming, New leads.
 * Read state is tracked in localStorage by id until Prompt 9.
 */
export default function NotificationsDrawer({ open, onClose, items, loading, readIds, onOpenItem, onMarkAllRead, onGoCalls }) {
  const showSkel = useDelayedLoading(loading);
  const groups = useMemo(() => ['today', 'upcoming', 'new'].map(g => ({ id: g, label: GROUP_LABELS[g], items: items.filter(i => i.group === g) })).filter(g => g.items.length), [items]);
  const unread = items.filter(i => !readIds.has(i.id)).length;
  return (
    <Sheet open={open} onClose={onClose} title="Notifications" tall
      description={items.length ? `${unread} unread` : undefined}
      footer={items.length ? <Button variant="ghost" icon={CheckDone01} onClick={onMarkAllRead} disabled={!unread}>Mark all read</Button> : undefined}>
      {showSkel && !items.length ? (
        <div className="sh-notif-list">{[1, 2, 3, 4].map(i => <ListRow.Skeleton key={i} trailing={false} />)}</div>
      ) : !items.length ? (
        <EmptyState icon={PhoneCall01} title="All caught up" description="Start a call session." action={{ label: 'Open Call Console', icon: PhoneCall01, onClick: () => { onClose(); onGoCalls(); } }} />
      ) : groups.map(g => (
        <div key={g.id} className="sh-notif-group">
          <p className="sh-side-label">{g.label}</p>
          <div className="sh-notif-list">{g.items.map(item => <NotificationItem key={item.id} item={item} read={readIds.has(item.id)} onOpen={onOpenItem} />)}</div>
        </div>
      ))}
    </Sheet>
  );
}

export const notificationsStyles = `
  .sh-notif-group { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .sh-notif-list { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .sh-notif.is-read { opacity: 0.62; }
  .sh-notif .v-lrow-sub { white-space: normal; }
`;
