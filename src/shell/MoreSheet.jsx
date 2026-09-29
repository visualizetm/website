import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import { Sheet, Icon, Badge, Avatar, Button, Stagger } from '../ui';
import Monitor01 from '@untitled-ui/icons-react/build/esm/Monitor01';
import { MORE_NAV, COMPUTER_ONLY } from './nav';
/** Mobile More sheet (CRM revamp, step 7): Triage, Leads, Clients, Projects, Orders, Reviews, Concepts, Declined, Settings in one grid, the greyed computer-only row, and the account row. */
export default function MoreSheet({ open, onClose, activeId, counts, onGo, onLogout }) {
  const groups = [{ group: 'Everything else', items: MORE_NAV }];
  return (
    <Sheet open={open} onClose={onClose} title="More" label="More sections">
      <Stagger className="sh-more" cap={4}>
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
                    <span className="sh-more-label">{n.moreLabel || n.label}</span>
                    {n.soon && <span className="sh-nav-soon">Soon</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="sh-more-computer" role="note" aria-label={`Open on your computer: ${COMPUTER_ONLY.join(', ')}`}>
          <Monitor01 width={18} height={18} aria-hidden="true" />
          <span><strong>Open on your computer:</strong> {COMPUTER_ONLY.join(', ')}</span>
        </div>
        <div className="sh-more-user">
          <Avatar name="Rob" size="md" />
          <span className="sh-side-user-text"><strong>Rob</strong><span>Visualize Studio</span></span>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" icon={LogOut01} onClick={() => { onClose(); onLogout(); }}>Sign out</Button>
        </div>
      </Stagger>
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
  /* The active row reads in the text tone (4.5:1 on the soft red in both themes), the border carries the red. */
  .sh-more-btn.is-active { color: var(--v-status-won-text); background: var(--v-red-soft); border-color: var(--v-red); }
  .sh-more-btn.is-soon { opacity: 0.5; cursor: not-allowed; }
  .sh-more-icon { position: relative; display: inline-flex; }
  .sh-more-label { line-height: 1.2; }
  .sh-more-computer { display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); padding: var(--v-space-2) var(--v-space-3); border: 1px dashed var(--v-border); border-radius: var(--v-radius-md); color: var(--v-text-3); font-size: var(--v-text-xs); }
  .sh-more-computer strong { color: var(--v-text-2); font-weight: var(--v-weight-semibold); }
  .sh-more-user { display: flex; align-items: center; gap: var(--v-space-3); padding-top: var(--v-space-4); border-top: 1px solid var(--v-border); }
  .sh-more-user .sh-side-user-text strong { color: var(--v-text); }
  .sh-more-user .sh-side-user-text span { color: var(--v-text-3); }
`;
