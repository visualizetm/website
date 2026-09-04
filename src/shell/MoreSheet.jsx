import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import { Sheet, Icon, Badge, Avatar, Button } from '../ui';
import { MORE_NAV, NAV_GROUPS } from './nav';
/** Mobile More sheet: every destination that is not a thumb tab, grouped, plus the account row. */
export default function MoreSheet({ open, onClose, activeId, counts, onGo, onLogout }) {
  const groups = NAV_GROUPS.map(g => ({ group: g, items: MORE_NAV.filter(n => n.group === g) })).filter(g => g.items.length);
  return (
    <Sheet open={open} onClose={onClose} title="More" label="More sections">
      <div className="sh-more">
        {groups.map(g => (
          <div key={g.group} className="sh-more-group">
            <p className="sh-side-label">{g.group}</p>
            <div className="sh-more-grid">
              {g.items.map(n => {
                const count = n.badge ? counts?.[n.badge] : 0;
                return (
                  <button key={n.id} type="button" className={`sh-more-btn${n.id === activeId ? ' is-active' : ''}${n.soon ? ' is-soon' : ''}`} disabled={n.soon}
                    onClick={() => { onClose(); onGo(n.id); }}>
                    <span className="sh-more-icon"><Icon icon={n.icon} size="var(--v-icon-lg)" />{count > 0 && <Badge count={count} />}</span>
                    <span className="sh-more-label">{n.label}</span>
                    {n.soon && <span className="sh-nav-soon">Soon</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="sh-more-user">
          <Avatar name="Rob" size="md" />
          <span className="sh-side-user-text"><strong>Rob</strong><span>Visualize Studio</span></span>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" icon={LogOut01} onClick={() => { onClose(); onLogout(); }}>Sign out</Button>
        </div>
      </div>
    </Sheet>
  );
}

export const moreSheetStyles = `
  .sh-more { display: flex; flex-direction: column; gap: var(--v-space-5); }
  .sh-more-group { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .sh-more-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--v-space-2); }
  .sh-more-btn {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--v-space-2);
    min-height: 84px; padding: var(--v-space-3) var(--v-space-2); border-radius: var(--v-radius-md); border: 1px solid var(--v-border);
    background: var(--v-surface-2); color: var(--v-text-2); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-xs); font-weight: var(--v-weight-bold);
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; text-align: center;
  }
  .sh-more-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .sh-more-btn.is-active { color: var(--v-red); background: var(--v-red-soft); border-color: var(--v-red); }
  .sh-more-btn.is-soon { opacity: 0.5; cursor: not-allowed; }
  .sh-more-icon { position: relative; display: inline-flex; }
  .sh-more-label { line-height: 1.2; }
  .sh-more-user { display: flex; align-items: center; gap: var(--v-space-3); padding-top: var(--v-space-4); border-top: 1px solid var(--v-border); }
`;
