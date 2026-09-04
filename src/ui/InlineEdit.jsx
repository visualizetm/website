import { useEffect, useRef, useState } from 'react';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Spinner from './Spinner';
import { patchWithRollback } from '../shared/api';
import { useToast } from './Toast';
/**
 * InlineEdit: a display value that becomes a field on tap. Saves on blur or
 * Enter, cancels on Escape, shows a saving indicator, and rolls back on
 * failure with an error toast. This is the row-by-row edit pattern.
 *
 * Two ways to save:
 *  - onSave(next) => Promise<boolean> | boolean  (throw or false = failure)
 *  - patch={{ url, id, key }}  uses patchWithRollback from src/shared/api.js
 *
 * @param {object} props
 * @param {string} props.value current value from the parent
 * @param {Function} [props.onSave]
 * @param {{url: string, id: string, key: string}} [props.patch]
 * @param {Function} [props.onChange] called with the value after a successful save (keep parent state in sync)
 * @param {Function} [props.format] display formatter (value) => string
 * @param {string} [props.placeholder='Add']
 * @param {string} [props.label] accessible name for the edit control
 * @param {string} [props.type='text']
 * @param {string} [props.inputMode]
 * @param {boolean} [props.multiline]
 * @param {string} [props.errorMessage='Could not save. Your change was undone.']
 */
export default function InlineEdit({
  value, onSave, patch, onChange, format, placeholder = 'Add', label = 'Edit', type = 'text', inputMode, multiline = false,
  errorMessage = 'Could not save. Your change was undone.', className = '',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [shown, setShown] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const cancelled = useRef(false);
  const toast = useToast();

  useEffect(() => { if (!editing && !saving) setShown(value ?? ''); }, [value, editing, saving]);
  useEffect(() => { if (editing) { const el = inputRef.current; el?.focus(); el?.select?.(); } }, [editing]);

  const start = () => { cancelled.current = false; setDraft(shown ?? ''); setEditing(true); };
  const cancel = () => { cancelled.current = true; setEditing(false); };

  const commit = async () => {
    if (cancelled.current) { cancelled.current = false; return; }
    setEditing(false);
    const next = multiline ? draft : draft.trim();
    if (next === (shown ?? '')) return;
    const prev = shown;
    setShown(next);           // optimistic
    setSaving(true);
    let ok = false;
    try {
      if (patch) {
        ok = await patchWithRollback({ url: patch.url, id: patch.id, set: { [patch.key]: next }, apply: () => () => setShown(prev) });
      } else if (onSave) {
        ok = (await onSave(next)) !== false;
        if (!ok) setShown(prev);
      } else ok = true;
    } catch { ok = false; setShown(prev); }
    setSaving(false);
    if (ok) onChange?.(next);
    else toast.error(errorMessage);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
  };

  if (editing) {
    const Tag = multiline ? 'textarea' : 'input';
    return (
      <span className={`v-inline v-inline--editing ${className}`.trim()}>
        <Tag ref={inputRef} className="v-inline-input" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
          type={multiline ? undefined : type} inputMode={inputMode} rows={multiline ? 3 : undefined} aria-label={label} />
      </span>
    );
  }
  const display = format ? format(shown) : shown;
  return (
    <button type="button" className={`v-inline${!shown ? ' is-empty' : ''}${saving ? ' is-saving' : ''} ${className}`.trim()} onClick={start} aria-label={`${label}: ${display || placeholder}`} disabled={saving}>
      <span className="v-inline-text">{display || placeholder}</span>
      {saving ? <Spinner size={13} /> : <Edit02 width={13} height={13} className="v-inline-icon" aria-hidden="true" />}
    </button>
  );
}

export const inlineEditStyles = `
  .v-inline {
    display: inline-flex; align-items: center; gap: var(--v-space-2); max-width: 100%; min-height: var(--v-tap); min-width: var(--v-tap);
    padding: 0 var(--v-space-2); margin: 0 calc(-1 * var(--v-space-2)); border-radius: var(--v-radius-sm);
    background: transparent; border: 1px solid transparent; color: inherit; font: inherit; text-align: left; cursor: text;
    transition: background var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out);
  }
  .v-inline:hover { background: var(--v-surface-2); border-color: var(--v-border); }
  .v-inline:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 1px; }
  .v-inline.is-empty .v-inline-text { color: var(--v-text-3); font-style: italic; }
  .v-inline-text { min-width: 0; overflow-wrap: anywhere; }
  .v-inline-icon { color: var(--v-text-3); opacity: 0; flex-shrink: 0; transition: opacity var(--v-dur-fast) var(--v-ease-out); }
  .v-inline:hover .v-inline-icon, .v-inline:focus-visible .v-inline-icon { opacity: 1; }
  @media (hover: none) { .v-inline-icon { opacity: 0.6; } }
  .v-inline--editing { padding: 0; margin: 0 calc(-1 * var(--v-space-2)); border-color: var(--v-border-focus); background: var(--v-surface-2); box-shadow: 0 0 0 3px var(--v-red-soft); cursor: auto; }
  .v-inline-input { width: 100%; min-width: 120px; min-height: calc(var(--v-tap) - 2px); padding: 0 var(--v-space-2); background: transparent; border: 0; outline: 0; color: var(--v-text); font: inherit; resize: vertical; }
  textarea.v-inline-input { padding: var(--v-space-2); }
`;
