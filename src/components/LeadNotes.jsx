import { useEffect, useState } from 'react';
import { Textarea, Row, Spinner } from '../ui';
import { useToast } from '../ui';

/**
 * LeadNotes: a Textarea bound to lead.notes with InlineEdit semantics:
 * saves on blur (and Cmd/Ctrl+Enter), shows a saving indicator, rolls back
 * and toasts on failure. Reusable in the lead detail (Prompt 8).
 * @param {object} props
 * @param {object} props.lead
 * @param {Function} props.onSave (id, notes) => Promise<boolean>
 * @param {number} [props.rows=5]
 */
export default function LeadNotes({ lead, onSave, rows = 5, placeholder = 'Notes on this lead.' }) {
  const [draft, setDraft] = useState(lead.notes || '');
  const [state, setState] = useState('idle'); // idle | dirty | saving | saved
  const toast = useToast();
  useEffect(() => { setDraft(lead.notes || ''); setState('idle'); }, [lead._id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (draft === (lead.notes || '')) { setState('idle'); return; }
    setState('saving');
    const ok = await onSave(lead._id, draft);
    if (ok) { setState('saved'); setTimeout(() => setState(s => (s === 'saved' ? 'idle' : s)), 1500); }
    else { setDraft(lead.notes || ''); setState('idle'); toast.error('Could not save the notes. Your change was undone.'); }
  };
  return (
    <div className="ln">
      <Textarea rows={rows} value={draft} placeholder={placeholder} aria-label="Notes" onChange={(e) => { setDraft(e.target.value); setState('dirty'); }} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.blur(); } }} />
      <Row gap={2} className="ln-state" aria-live="polite">
        {state === 'saving' && <><Spinner size={12} /><span>Saving</span></>}
        {state === 'saved' && <span className="ln-saved">Saved</span>}
        {state === 'dirty' && <span>Saves when you tap away</span>}
      </Row>
    </div>
  );
}
export const leadNotesStyles = `
  .ln { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .ln-state { min-height: var(--v-lh-xs); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .ln-saved { color: var(--v-status-booked-text); }
`;
