import { useRef, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import { Row, Input, IconButton, InlineEdit, Menu, useMediaQuery } from '../../ui';

/* Editable list of strings with add, edit, remove, reorder (drag on a
 * desktop, the row menu on a phone). The Playbook's intel lists and Before
 * you dial read it. */
export default function ListEditor({ items, onChange, placeholder = 'Add a line' }) {
  const [draft, setDraft] = useState('');
  const drag = useRef(null);
  const desktop = useMediaQuery('(hover: hover) and (pointer: fine)');
  const move = (i, d) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...items, v]); setDraft(''); };
  return (
    <div className="dt-list">
      {items.map((t, i) => (
        <div key={i} className="dt-list-row" draggable={desktop} onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag.current == null || drag.current === i) return; const n = [...items]; const [x] = n.splice(drag.current, 1); n.splice(i, 0, x); drag.current = null; onChange(n); }}>
          <InlineEdit value={t} onSave={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} label="Line" className="dt-list-text" />
          <Menu label="Line actions" items={[{ id: 'up', label: 'Move up', icon: 'ChevronLeft', disabled: i === 0, onSelect: () => move(i, -1) }, { id: 'down', label: 'Move down', icon: 'ChevronDown', disabled: i === items.length - 1, onSelect: () => move(i, 1) }, 'divider', { id: 'rm', label: 'Remove', icon: 'Trash01', danger: true, onSelect: () => onChange(items.filter((_, j) => j !== i)) }]} />
        </div>
      ))}
      <Row gap={1}><Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><IconButton icon={Plus} label="Add" variant="secondary" onClick={add} /></Row>
    </div>
  );
}
