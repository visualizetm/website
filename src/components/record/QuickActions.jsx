import { Chip } from '../../ui';

/* Quick actions (client page workspace redesign): the things that used to
 * sit in the three dot menu, as one chip row under the workspace cards.
 * On a phone the row scrolls sideways; every chip is a 44px target. */
export default function QuickActions({ items = [] }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="rc-quick" role="group" aria-label="Quick actions">
      {list.map(it => <Chip key={it.id} label={it.label} icon={it.icon} onClick={it.onClick} disabled={it.disabled} className={`rc-quick-chip rc-quick-chip--${it.id}`} />)}
    </div>
  );
}
