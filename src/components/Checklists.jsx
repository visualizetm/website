import { useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import { useConfirm } from '../ui';

/* Named task lists for a lead/booked/client record.
 *
 * Optional by design: with no lists the whole UI is one "Add checklist"
 * button. Every mutation patches the additive `checklists` field through
 * the caller's optimistic onPatch. Shared by Leads, Booked, and Clients.
 */
export default function Checklists({ lead, onPatch }) {
  const [confirm, confirmDialog] = useConfirm();
  const lists = lead.checklists || [];
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState({}); // per-list new-item text

  const save = (next) => onPatch(lead._id, { checklists: next });

  const addList = () => {
    const n = name.trim();
    if (!n) return;
    save([...lists, { name: n, items: [] }]);
    setName('');
    setNaming(false);
  };
  const removeList = async (li) => {
    const l = lists[li];
    const count = l.items?.length || 0;
    if (count && !(await confirm({ title: `Delete "${l.name}"?`, body: `Its ${count} task${count === 1 ? '' : 's'} go with it.`, danger: true, confirmLabel: 'Delete' }))) return;
    save(lists.filter((_, j) => j !== li));
  };
  const addItem = (li) => {
    const text = (drafts[li] || '').trim();
    if (!text) return;
    save(lists.map((l, j) => j === li ? { ...l, items: [...(l.items || []), { text, done: false }] } : l));
    setDrafts(d => ({ ...d, [li]: '' }));
  };
  const toggleItem = (li, ii) => save(lists.map((l, j) => j === li
    ? { ...l, items: l.items.map((it, k) => k === ii ? { ...it, done: !it.done } : it) }
    : l));
  const removeItem = (li, ii) => save(lists.map((l, j) => j === li
    ? { ...l, items: l.items.filter((_, k) => k !== ii) }
    : l));

  return (
    <div className="ck-wrap">
      {confirmDialog}
      {lists.map((l, li) => {
        const done = (l.items || []).filter(i => i.done).length;
        return (
          <div key={li} className="ck-list">
            <div className="ck-list-head">
              <span className="ck-list-name">{l.name}</span>
              {l.items?.length > 0 && <span className="ck-list-n">{done}/{l.items.length}</span>}
              <button type="button" className="ck-list-del" onClick={() => removeList(li)} aria-label={`Delete ${l.name}`}>
                <Trash01 width={14} height={14} />
              </button>
            </div>
            {(l.items || []).map((it, ii) => (
              <div key={ii} className="ck-item">
                <button type="button" className={`ck-check${it.done ? ' is-done' : ''}`} onClick={() => toggleItem(li, ii)} aria-pressed={it.done}>
                  {it.done && <Check width={13} height={13} />}
                </button>
                <span className={`ck-item-text${it.done ? ' is-done' : ''}`}>{it.text}</span>
                <button type="button" className="ck-item-del" onClick={() => removeItem(li, ii)} aria-label="Remove task">
                  <XClose width={13} height={13} />
                </button>
              </div>
            ))}
            <form className="ck-add" onSubmit={(e) => { e.preventDefault(); addItem(li); }}>
              <input
                className="aa-input"
                value={drafts[li] || ''}
                onChange={e => setDrafts(d => ({ ...d, [li]: e.target.value }))}
                placeholder="Add a task…"
              />
              <button type="submit" className="aa-iconbtn" disabled={!(drafts[li] || '').trim()} aria-label="Add task">
                <Plus width={15} height={15} />
              </button>
            </form>
          </div>
        );
      })}

      {naming ? (
        <form className="ck-add" onSubmit={(e) => { e.preventDefault(); addList(); }}>
          <input
            className="aa-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Checklist name — e.g. Onboarding, Launch day…"
            autoFocus
          />
          <button type="submit" className="aa-iconbtn" disabled={!name.trim()} aria-label="Create checklist"><Check width={15} height={15} /></button>
          <button type="button" className="aa-iconbtn" onClick={() => { setNaming(false); setName(''); }} aria-label="Cancel"><XClose width={15} height={15} /></button>
        </form>
      ) : (
        <button type="button" className="aa-btn" onClick={() => setNaming(true)}>
          <Plus width={14} height={14} /> Add checklist
        </button>
      )}

      <style>{ckStyles}</style>
    </div>
  );
}

const ckStyles = `
  .ck-wrap { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .ck-list {
    display: flex; flex-direction: column; gap: 8px; min-width: 0;
    background: var(--a-raised, #1a1a1a); border: 1px solid var(--a-border, rgba(255,255,255,0.08));
    border-radius: 12px; padding: 12px 14px;
  }
  .ck-list-head { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .ck-list-name { font-size: 0.86rem; font-weight: 800; color: #fafafa; min-width: 0; overflow-wrap: anywhere; }
  .ck-list-n {
    font-size: 0.66rem; font-weight: 800; color: var(--a-muted, #8a8a8a);
    background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
  }
  .ck-list-del {
    margin-left: auto; flex-shrink: 0; display: flex; padding: 6px; border-radius: 8px;
    background: none; border: none; cursor: pointer; color: transparent; transition: color 0.15s;
  }
  .ck-list:hover .ck-list-del, .ck-list-del:focus-visible { color: var(--a-muted, #8a8a8a); }
  .ck-list-del:hover { color: #f87171 !important; }
  .ck-item { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .ck-check {
    width: 24px; height: 24px; border-radius: 7px; cursor: pointer; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.16); color: #fff;
    transition: background 0.15s, border-color 0.15s;
    touch-action: manipulation;
  }
  .ck-check.is-done { background: #22c55e; border-color: #22c55e; color: #08130a; }
  .ck-item-text { flex: 1; min-width: 0; font-size: 0.88rem; line-height: 1.45; overflow-wrap: anywhere; }
  .ck-item-text.is-done { color: var(--a-muted, #8a8a8a); text-decoration: line-through; }
  .ck-item-del {
    background: none; border: none; cursor: pointer; color: transparent;
    display: flex; padding: 5px; flex-shrink: 0; transition: color 0.15s;
  }
  .ck-item:hover .ck-item-del, .ck-item-del:focus-visible { color: var(--a-muted, #8a8a8a); }
  .ck-item-del:hover { color: #f87171 !important; }
  .ck-add { display: flex; gap: 8px; min-width: 0; }
  .ck-add .aa-input { flex: 1; min-width: 0; }
  .ck-wrap > .aa-btn { align-self: flex-start; }
`;
