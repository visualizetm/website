import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import Bell01 from '@untitled-ui/icons-react/build/esm/Bell01';
import { IconButton, Badge, Avatar, Menu, SkeletonBlock } from '../ui';
import QuickAdd from './QuickAdd';
/**
 * Top bar: title (and back on detail screens), the command bar on desktop,
 * quick add, notifications, avatar. Compact on mobile.
 */
export default function TopBar({ title, onBack, commandBar, onOpenCommand, notifCount, notifLoading, onOpenNotifications, quickAdd, menuItems }) {
  return (
    <header className="sh-top">
      <div className="sh-top-left">
        {onBack && <IconButton icon={ArrowLeft} label="Back" onClick={onBack} tooltip={false} className="sh-top-back" />}
        <h1 className="sh-top-title lay-truncate">{title}</h1>
      </div>
      <div className="sh-top-center">{commandBar}</div>
      <div className="sh-top-right">
        <IconButton icon={SearchMd} label="Search" onClick={onOpenCommand} className="sh-top-searchbtn" tooltip={false} />
        <QuickAdd items={quickAdd} />
        <span className="sh-top-bell">
          <IconButton icon={Bell01} label="Notifications" onClick={onOpenNotifications} tooltip={false} className="sh-bell" />
          {notifLoading ? <SkeletonBlock width={16} height={16} radius="var(--v-radius-pill)" className="sh-bell-skel" /> : <Badge count={notifCount} className="sh-bell-badge" />}
        </span>
        <span className="sh-top-avatar">
          <Menu label="Account" align="end" items={menuItems} trigger={<button type="button" className="sh-top-avatarbtn" aria-label="Account menu"><Avatar name="Rob" size="sm" /></button>} />
        </span>
      </div>
    </header>
  );
}

export const topBarStyles = `
  .sh-top {
    position: sticky; top: 0; z-index: var(--v-z-sticky); flex-shrink: 0;
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--v-space-3);
    min-height: calc(var(--v-control-h) + var(--v-space-4));
    padding: var(--v-space-2) var(--v-gutter-r) var(--v-space-2) var(--v-gutter-l);
    padding-top: calc(var(--v-space-2) + var(--v-inset-top));
    background: var(--v-surface-1); border-bottom: 1px solid var(--v-border);
  }
  @media (min-width: 768px) { .sh-top { grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr) auto; padding-top: var(--v-space-2); } }
  .sh-top-left { display: flex; align-items: center; gap: var(--v-space-1); min-width: 0; }
  .sh-top-back { margin-left: calc(-1 * var(--v-space-2)); }
  .sh-top-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); min-width: 0; }
  .sh-top-center { display: none; min-width: 0; justify-content: center; }
  @media (min-width: 768px) { .sh-top-center { display: flex; } .sh-top-searchbtn { display: none; } }
  .sh-top-right { display: flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; }
  .sh-top-bell { position: relative; display: inline-flex; }
  .sh-bell-badge { top: 4px; right: 4px; pointer-events: none; }
  .sh-bell-skel { position: absolute; top: 6px; right: 6px; }
  .sh-top-avatar { display: none; }
  @media (min-width: 768px) { .sh-top-avatar { display: inline-flex; margin-left: var(--v-space-1); } }
  .sh-top-avatarbtn { display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); border: 0; border-radius: var(--v-radius-pill); background: transparent; cursor: pointer; }
  .sh-top-avatarbtn:hover { background: var(--v-surface-2); }
  .sh-top-avatarbtn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
`;
