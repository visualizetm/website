import { Sheet, Card, Stack } from '../ui';
import { SHORTCUT_GROUPS } from './shortcuts';

/* Every keyboard shortcut, as a sheet off the account menu (UX audit,
 * item 11). It used to be a Settings tab, which is a place people go to
 * change something; this is a reference card, so it lives one tap from
 * wherever Rob is. The Call Console overlay renders the same groups. */
export const shortcutsSheetStyles = `
  .st-keys { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--v-space-2); }
  .st-key { display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .st-kbd { display: inline-flex; align-items: center; min-height: 26px; padding: 0 var(--v-space-2); border-radius: var(--v-radius-sm); background: var(--v-surface-3); border: 1px solid var(--v-border-strong); font-family: var(--v-font-mono, monospace); font-size: var(--v-text-xs); color: var(--v-text); white-space: nowrap; flex-shrink: 0; }
`;

export default function ShortcutsSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Keyboard shortcuts" description="Everywhere, the command bar, the Call Console, the Calendar, and lists." width={520}>
      <Stack gap={3}>
        {SHORTCUT_GROUPS.map(g => (
          <Card key={g.id} level={2} padding={3}>
            <p className="pb-card-h">{g.label}</p>
            <div className="st-keys">{g.keys.map(([k, what]) => <div key={k + what} className="st-key"><kbd className="st-kbd">{k}</kbd><span>{what}</span></div>)}</div>
          </Card>
        ))}
      </Stack>
    </Sheet>
  );
}
