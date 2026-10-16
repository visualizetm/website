import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Row, Stack, Input, Textarea, Button, IconButton, Menu, Chip, Sheet, SegmentedControl, Checkbox, ListRow, Icon, useMediaQuery } from '../../ui';
import { BLOCK_LABELS, BLOCK_ICONS, BLOCK_HINTS, ADD_ORDER, SUBJECT_SOFT_MAX, newBlock, moveBlock, removeBlock, updateBlock, insertBlock, insertToken, subjectCount } from '../../lib/compose';

/* The email editor (the email system, milestone 3), shared by Compose and
 * Settings, Emails: the subject (with its count near 60) and the preview
 * text, then the body as editable block cards (auto growing textareas,
 * editable rows for lines and totals, drag to reorder on a computer plus
 * Move up and Move down in every card's menu, Remove, Add block), and the
 * Insert field chips that drop {{key}} where the caret is. Edits go up as
 * one value: { subject, preheader, blocks }. */

/** A textarea that grows with its text, never scrolling inside itself. */
function GrowArea({ value, onChange, onFocus, placeholder, label, rows = 1, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.max(44, el.scrollHeight + 2)}px`; }, [value]);
  return <Textarea ref={ref} label={label} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} placeholder={placeholder} className={`ee-grow ${className}`.trim()} />;
}

const STYLE_OPTIONS = [{ id: 'primary', label: 'Red' }, { id: 'secondary', label: 'Grey' }];
const TONE_OPTIONS = [{ id: 'default', label: 'Plain' }, { id: 'red', label: 'Red rule' }];

/** One block card. `focus(path, el)` tells the editor which field the next Insert field chip writes into. */
function BlockCard({ block, index, count, depth, onChange, onMove, onRemove, focus, dragging, onDragStart, onDragOver, onDrop, onDragEnd, hover }) {
  const b = block;
  const f = (field) => (e) => focus([index, field], e.target);
  const set = (patch) => onChange({ ...b, ...patch });
  const rows = (key) => (Array.isArray(b[key]) ? b[key] : []);
  const setRow = (key, i, patch) => set({ [key]: rows(key).map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const addRow = (key, row) => set({ [key]: [...rows(key), row] });
  const dropRow = (key, i) => set({ [key]: rows(key).filter((_, k) => k !== i) });
  const menu = [
    { id: 'up', label: 'Move up', icon: 'ArrowUp', disabled: index === 0, onSelect: () => onMove(-1) },
    { id: 'down', label: 'Move down', icon: 'ArrowDown', disabled: index === count - 1, onSelect: () => onMove(1) },
    'divider',
    { id: 'remove', label: 'Remove', icon: 'Trash01', danger: true, onSelect: onRemove },
  ];
  let body = null;
  if (b.type === 'eyebrow') body = <Input label="Label" value={b.text || ''} onChange={(e) => set({ text: e.target.value.slice(0, 160) })} onFocus={f('text')} placeholder="Next step" />;
  else if (b.type === 'heading') body = <GrowArea label="Heading" value={b.text || ''} onChange={(v) => set({ text: v.slice(0, 160) })} onFocus={f('text')} placeholder="Good talking to you, {{firstName}}" />;
  else if (b.type === 'text') body = <GrowArea label="Text" value={b.text || ''} onChange={(v) => set({ text: v.slice(0, 2000) })} onFocus={f('text')} placeholder="Short and human. **bold** and [label](url) work." rows={2} />;
  else if (b.type === 'button') body = (
    <Stack gap={2}>
      <Input label="Label" value={b.label || ''} onChange={(e) => set({ label: e.target.value.slice(0, 80) })} onFocus={f('label')} placeholder="Book the call" />
      <Input label="Link" value={b.url || ''} onChange={(e) => set({ url: e.target.value.slice(0, 600) })} onFocus={f('url')} placeholder="{{calendlyLink}} or https://" inputMode="url" />
      <SegmentedControl label="Style" size="sm" options={STYLE_OPTIONS} value={b.style || 'primary'} onChange={(id) => set({ style: id })} />
    </Stack>
  );
  else if (b.type === 'lines' || b.type === 'totals') {
    const key = 'rows';
    body = b.from ? <p className="ee-note">Rows come from the record: <code>{`{{${b.from}}}`}</code>. <Button variant="ghost" size="md" onClick={() => set({ from: '', rows: b.type === 'lines' ? [{ label: '', sub: '', value: '' }] : [{ label: '', value: '', big: false }] })}>Type rows by hand</Button></p> : (
      <Stack gap={2}>
        {rows(key).map((r, i) => (
          <div key={i} className="ee-row">
            <Input label={i === 0 ? 'Label' : undefined} aria-label={i ? `Row ${i + 1} label` : undefined} value={r.label || ''} onChange={(e) => setRow(key, i, { label: e.target.value.slice(0, 120) })} onFocus={(e) => focus([index, 'rows', i, 'label'], e.target)} placeholder="Month 2 of 6" />
            {b.type === 'lines' && <Input label={i === 0 ? 'Sub' : undefined} aria-label={i ? `Row ${i + 1} sub` : undefined} value={r.sub || ''} onChange={(e) => setRow(key, i, { sub: e.target.value.slice(0, 160) })} onFocus={(e) => focus([index, 'rows', i, 'sub'], e.target)} placeholder="Optional" />}
            <Input label={i === 0 ? 'Value' : undefined} aria-label={i ? `Row ${i + 1} value` : undefined} value={r.value || ''} onChange={(e) => setRow(key, i, { value: e.target.value.slice(0, 60) })} onFocus={(e) => focus([index, 'rows', i, 'value'], e.target)} placeholder="$200" className="ee-row-val" />
            {b.type === 'totals' && <Checkbox label="Big" checked={!!r.big} onChange={(v) => setRow(key, i, { big: v })} className="ee-row-big" />}
            <IconButton icon="XClose" label={`Remove row ${i + 1}`} onClick={() => dropRow(key, i)} className="ee-row-x" />
          </div>
        ))}
        <Row gap={2}><Button variant="ghost" size="md" icon="Plus" onClick={() => addRow(key, b.type === 'lines' ? { label: '', sub: '', value: '' } : { label: '', value: '', big: false })}>Add row</Button></Row>
      </Stack>
    );
  } else if (b.type === 'list') body = b.from ? <p className="ee-note">Items come from the record: <code>{`{{${b.from}}}`}</code>. <Button variant="ghost" size="md" onClick={() => set({ from: '', items: [''] })}>Type items by hand</Button></p>
    : <GrowArea label="Items, one a line" value={(b.items || []).join('\n')} onChange={(v) => set({ items: v.split('\n').slice(0, 30).map(x => x.slice(0, 300)) })} onFocus={f('items')} placeholder="One item a line" rows={2} />;
  else if (b.type === 'files') body = <p className="ee-note">The file groups come from the project's deliverables: <code>{`{{${b.from || 'deliverables.groups'}}}`}</code>.</p>;
  else if (b.type === 'spacer') body = <p className="ee-note">16px of air.</p>;
  else if (b.type === 'pay') body = <p className="ee-note">The pay buttons come from the record: the invoice's own Stripe link, then the portal or Cash App, Venmo and Zelle from Settings. A method with nothing set does not show.</p>;
  else if (b.type === 'box') body = (
    <Stack gap={2}>
      <Input label="Title" value={b.title || ''} onChange={(e) => set({ title: e.target.value.slice(0, 120) })} onFocus={f('title')} placeholder="The terms" />
      <SegmentedControl label="Tone" size="sm" options={TONE_OPTIONS} value={b.tone || 'default'} onChange={(id) => set({ tone: id })} />
      <BlockList blocks={Array.isArray(b.blocks) ? b.blocks : []} onChange={(blocks) => set({ blocks })} depth={1} focus={(path, el) => focus([index, 'blocks', ...path], el)} />
    </Stack>
  );
  return (
    <Card className={`ee-block ee-block--${b.type}${dragging ? ' is-dragging' : ''}`} level={depth ? 2 : 1} padding={3} data-block-index={index} onDragOver={onDragOver} onDrop={onDrop}>
      <Row gap={2} align="center" className="ee-block-head">
        {hover && depth === 0 && <span className="ee-grip" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title="Drag to reorder" aria-hidden="true"><Icon icon="DotsGrid" size={16} /></span>}
        <Icon icon={BLOCK_ICONS[b.type]} size={16} className="ee-block-icon" />
        <span className="ee-block-type">{BLOCK_LABELS[b.type]}</span>
        <span className="ee-block-hint lay-truncate">{BLOCK_HINTS[b.type]}</span>
        <Menu label={`${BLOCK_LABELS[b.type]} block ${index + 1} actions`} items={menu} />
      </Row>
      {body}
    </Card>
  );
}

/** A list of blocks with Add block at the end; a box holds one at depth 1 (no box inside). */
function BlockList({ blocks, onChange, depth = 0, focus }) {
  const [adding, setAdding] = useState(false);
  const [drag, setDrag] = useState(null); // the index being dragged
  const hover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const types = ADD_ORDER.filter(t => (depth ? t !== 'box' : true));
  const onDrop = (i) => (e) => { e.preventDefault(); if (drag === null || drag === i) { setDrag(null); return; } const next = blocks.slice(); const [b] = next.splice(drag, 1); next.splice(i, 0, b); onChange(next); setDrag(null); };
  return (
    <Stack gap={2} className={`ee-blocks${depth ? ' ee-blocks--inner' : ''}`}>
      {blocks.map((b, i) => (
        <BlockCard key={i} block={b} index={i} count={blocks.length} depth={depth} hover={hover}
          onChange={(nb) => onChange(updateBlock(blocks, i, nb))} onMove={(dir) => onChange(moveBlock(blocks, i, dir))} onRemove={() => onChange(removeBlock(blocks, i))}
          focus={focus} dragging={drag === i} onDragStart={(e) => { setDrag(i); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch { /* fine */ } }} onDragOver={(e) => { if (drag !== null) e.preventDefault(); }} onDrop={onDrop(i)} onDragEnd={() => setDrag(null)} />
      ))}
      <Row gap={2}><Button variant="secondary" size="md" icon="Plus" onClick={() => setAdding(true)} className={depth ? 'ee-add-inner' : 'ee-add'}>Add block</Button></Row>
      {adding && (
        <Sheet open onClose={() => setAdding(false)} title="Add a block" label="Add a block" width={420}>
          <Stack gap={1}>
            {types.map(t => <ListRow key={t} leading={<Icon icon={BLOCK_ICONS[t]} size="var(--v-icon-md)" />} title={BLOCK_LABELS[t]} subtitle={BLOCK_HINTS[t]} onClick={() => { onChange(insertBlock(blocks, blocks.length, newBlock(t))); setAdding(false); }} className={`ee-add-opt ee-add-opt--${t}`} />)}
          </Stack>
        </Sheet>
      )}
    </Stack>
  );
}

/**
 * EmailEditor
 *   value      { subject, preheader, blocks }
 *   onChange   (next) => void
 *   vars       [{ key, value }] the Insert field chips, with each one's current value
 *   readOnly
 */
export default function EmailEditor({ value, onChange, vars = [], readOnly = false, className = '' }) {
  const v = value || { subject: '', preheader: '', blocks: [] };
  const active = useRef(null); // { path, el }
  const focus = useCallback((path, el) => { active.current = { path, el }; }, []);
  const setField = (field, text) => onChange({ ...v, [field]: text });
  /* Insert a field: into the focused subject, preview text, or a block's text, at the caret; with nothing focused, at the end of the subject. */
  const insert = (key) => {
    const a = active.current;
    const el = a?.el; const start = el?.selectionStart; const end = el?.selectionEnd;
    if (!a || a.path[0] === 'subject' || a.path[0] === 'preheader') { const field = a?.path?.[0] === 'preheader' ? 'preheader' : 'subject'; const r = insertToken(v[field], start, end, key); setField(field, r.text); return; }
    const [i, ...rest] = a.path;
    const walk = (block, path) => {
      if (!path.length) return block;
      const [k, ...more] = path;
      if (k === 'blocks') { const [j, ...deeper] = more; return { ...block, blocks: (block.blocks || []).map((bb, idx) => (idx === j ? walk(bb, deeper) : bb)) }; }
      if (k === 'rows') { const [j, field] = more; return { ...block, rows: (block.rows || []).map((r, idx) => (idx === j ? { ...r, [field]: insertToken(r[field], start, end, key).text } : r)) }; }
      if (k === 'items') { const joined = (block.items || []).join('\n'); return { ...block, items: insertToken(joined, start, end, key).text.split('\n') }; }
      return { ...block, [k]: insertToken(block[k], start, end, key).text };
    };
    onChange({ ...v, blocks: v.blocks.map((b, idx) => (idx === i ? walk(b, rest) : b)) });
  };
  const n = subjectCount(v.subject);
  return (
    <div className={`ee ${className}`.trim()}>
      <Stack gap={3}>
        <Input label="Subject" value={v.subject} onChange={(e) => setField('subject', e.target.value.slice(0, 200))} onFocus={(e) => focus(['subject'], e.target)} disabled={readOnly} hint={`${n} of ${SUBJECT_SOFT_MAX}${n > SUBJECT_SOFT_MAX ? ', long for a phone' : ''}`} className={`ee-subject${n > SUBJECT_SOFT_MAX ? ' is-long' : ''}`} />
        <Input label="Preview text" value={v.preheader} onChange={(e) => setField('preheader', e.target.value.slice(0, 200))} onFocus={(e) => focus(['preheader'], e.target)} disabled={readOnly} placeholder="The line under the subject in the inbox" className="ee-preheader" />
        {vars.length > 0 && !readOnly && (
          <div className="ee-fields" role="group" aria-label="Insert a field">
            <span className="ee-fields-h">Insert a field</span>
            <div className="ee-fields-row">{vars.filter(x => x.value).map(x => <Chip key={x.key} label={`${x.key}: ${String(x.value).slice(0, 28)}`} onClick={() => insert(x.key)} className="ee-field-chip" title={String(x.value)} />)}</div>
          </div>
        )}
        {readOnly ? <p className="ee-note">Read only.</p> : <BlockList blocks={v.blocks} onChange={(blocks) => onChange({ ...v, blocks })} focus={focus} />}
      </Stack>
    </div>
  );
}

export const emailEditorStyles = `
  .ee { min-width: 0; }
  .ee-grow .v-field-control { resize: none; overflow: hidden; min-height: var(--v-tap); }
  .ee-subject.is-long .v-field-msg { color: var(--v-status-new-text); }
  .ee-fields { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .ee-fields-h { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .ee-fields-row { display: flex; gap: var(--v-space-2); overflow-x: auto; scrollbar-width: none; padding: 2px; margin: -2px; -webkit-overflow-scrolling: touch; }
  .ee-fields-row::-webkit-scrollbar { display: none; }
  .ee-field-chip { flex-shrink: 0; max-width: 240px; }
  .ee-field-chip .v-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ee-blocks { min-width: 0; }
  .ee-blocks--inner { padding-left: 0; }
  .ee-block { gap: var(--v-space-2); }
  .ee-block.is-dragging { opacity: 0.5; }
  .ee-block-head { min-height: var(--v-tap); }
  .ee-grip { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: var(--v-tap); color: var(--v-text-3); cursor: grab; flex-shrink: 0; }
  .ee-block-icon { color: var(--v-text-2); flex-shrink: 0; }
  .ee-block-type { font-weight: var(--v-weight-semibold); color: var(--v-text); flex-shrink: 0; }
  .ee-block-hint { flex: 1; min-width: 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .ee-note { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); display: flex; flex-wrap: wrap; align-items: center; gap: var(--v-space-2); }
  .ee-note code { font-family: var(--v-font-mono, monospace); font-size: var(--v-text-xs); color: var(--v-text); background: var(--v-surface-3); padding: 2px 6px; border-radius: var(--v-radius-sm); }
  .ee-row { display: grid; grid-template-columns: 1fr; gap: var(--v-space-2); align-items: end; padding-bottom: var(--v-space-2); border-bottom: 1px solid var(--v-border); }
  .ee-row:last-of-type { border-bottom: 0; }
  @media (min-width: 560px) { .ee-row { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.7fr) auto; } .ee-block--totals .ee-row { grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.7fr) auto auto; } }
  .ee-row-x { justify-self: end; }
`;
