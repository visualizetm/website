import { useState } from 'react';
import { Sheet, Stack, Row, Button, Textarea, Icon, useToast } from '../ui';
import { DECLINE_REASONS } from '../shared/semantics';
import { COPY } from '../shared/copy';
import { declinePatch, undoDeclinePatch } from '../lib/decline';

export { declinePatch, undoDeclinePatch };

/* Decline a lead (CRM revamp, step 1): one sheet, reached from the lead
 * card's menu, the record's action row and the call room. Six reasons as a
 * single select, an optional note, one red button. The write is one PATCH:
 * stage declined, the declined object, the callback cleared, the next
 * action cleared when there is one, with explicit: true so the guard knows
 * a person did it. Undo for six seconds puts the stage and the callback
 * back and clears the reason.
 *
 *   const decline = useDecline({ onPatch, onDeclined });
 *   ... onSelect: () => decline.open(lead) ...
 *   {decline.sheet} */
export function useDecline({ onPatch, onDeclined }) {
  const toast = useToast();
  const [lead, setLead] = useState(null);
  const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) setLead(null); };
  const confirm = async (reason, note) => {
    if (!lead) return;
    const before = lead;
    setBusy(true);
    const ok = await onPatch(before._id, declinePatch(before, reason, note));
    setBusy(false);
    if (!ok) { toast.error(COPY.error.save); return; }
    setLead(null);
    toast.undo(`${before.business} declined.`, () => onPatch(before._id, undoDeclinePatch(before)), { seconds: 6 });
    onDeclined?.(before);
  };
  return { open: setLead, sheet: lead ? <DeclineSheet lead={lead} busy={busy} onClose={close} onConfirm={confirm} /> : null };
}

export default function DeclineSheet({ lead, busy = false, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <Sheet open onClose={onClose} title="Decline this lead" description={lead.business} label="Decline this lead"
      footer={<Row gap={2} justify="end" wrap><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="danger" icon="SlashCircle01" onClick={() => onConfirm(reason, note)} disabled={!reason} loading={busy}>Decline</Button></Row>}>
      <Stack gap={3}>
        <div role="radiogroup" aria-label="Reason" className="dc-reasons">
          {DECLINE_REASONS.map(r => (
            <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} className={`dc-reason${reason === r.id ? ' is-on' : ''}`} onClick={() => setReason(r.id)}>
              <Icon icon={r.icon} size="var(--v-icon-md)" />
              <span className="dc-reason-label">{r.label}</span>
              {reason === r.id && <Icon icon="Check" size="var(--v-icon-sm)" />}
            </button>
          ))}
        </div>
        <Textarea label="Note (optional)" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Their site is new and it is good." hint={`${note.length} of 300. They leave the pool; a re-import never brings them back.`} />
      </Stack>
      <style>{declineStyles}</style>
    </Sheet>
  );
}

export const declineStyles = `
  .dc-reasons { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .dc-reason {
    display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap); width: 100%;
    padding: var(--v-space-2) var(--v-space-3); text-align: left; cursor: pointer;
    background: var(--v-surface-2); color: var(--v-text); border: 1px solid var(--v-border); border-radius: var(--v-radius-md);
    font: inherit; font-size: var(--v-text-md); transition: border-color var(--v-dur-fast) var(--v-ease-out), background var(--v-dur-fast) var(--v-ease-out);
  }
  .dc-reason:hover { background: var(--v-surface-3); }
  .dc-reason.is-on { border-color: var(--v-red); background: var(--v-red-soft); color: var(--v-red-highlight); }
  .dc-reason:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .dc-reason-label { flex: 1 1 auto; min-width: 0; }
`;
