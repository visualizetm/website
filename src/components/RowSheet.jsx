import { Sheet, Icon } from '../ui';

/* The long press sheet (CRM mobile revamp, milestone 5): what a row stands for and what can be done to it, without opening it.
 * The record's essentials as label and value lines, then the quick actions (the same items the row's menu carries, plus Open).
 * A tap on the row still opens the record; this is the preview. items: [{ id, label, icon, onSelect, danger, disabled } | 'divider']. */
export default function RowSheet({ title, subtitle, facts = [], items = [], onClose }) {
  const rows = facts.filter(f => f && f.value);
  return (
    <Sheet open onClose={onClose} title={title} description={subtitle} label={`${title}, quick actions`}>
      {rows.length > 0 && (
        <dl className="rs-facts">
          {rows.map(f => <div key={f.label} className="rs-fact"><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
        </dl>
      )}
      <div className="rs-actions" role="group" aria-label="Quick actions">
        {items.map((it, i) => (it === 'divider'
          ? <hr key={`d${i}`} className="rs-div" />
          : (
            <button key={it.id} type="button" className={`rs-act${it.danger ? ' is-danger' : ''}`} disabled={it.disabled} onClick={() => { onClose(); it.onSelect?.(); }}>
              {it.icon && <Icon icon={it.icon} size="var(--v-icon-md)" />}<span>{it.label}</span>
            </button>
          )))}
      </div>
      <style>{rowSheetStyles}</style>
    </Sheet>
  );
}

const rowSheetStyles = `
  .rs-facts { margin: 0; display: flex; flex-direction: column; }
  .rs-fact { display: flex; justify-content: space-between; gap: var(--v-space-4); padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); }
  .rs-fact dt { color: var(--v-text-3); font-size: var(--v-text-sm); flex-shrink: 0; }
  .rs-fact dd { margin: 0; text-align: right; color: var(--v-text); font-size: var(--v-text-md); min-width: 0; overflow-wrap: anywhere; }
  .rs-actions { display: flex; flex-direction: column; gap: var(--v-space-1); }
  .rs-div { border: 0; border-top: 1px solid var(--v-border); width: 100%; margin: var(--v-space-1) 0; }
  .rs-act { display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap-lg); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text); font: inherit; font-size: var(--v-text-md); text-align: left; cursor: pointer; }
  .rs-act:hover, .rs-act:focus-visible { background: var(--v-surface-2); outline: none; }
  .rs-act:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .rs-act.is-danger { color: var(--v-status-danger-text); }
  .rs-act:disabled { opacity: 0.5; cursor: not-allowed; }
`;
