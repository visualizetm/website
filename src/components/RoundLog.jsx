import { useState } from 'react';
import { COPY } from '../shared/copy';
import { Button, Modal, Textarea, useToast } from '../ui';
import { money } from '../shared/format';
import { REVISION_ROUNDS } from '../shared/pricing';
import { invoicesOf, newInvoice } from '../lib/invoices';
import { today, revisionsUsed, extraRounds, revisionsMax, revisionsExhausted, extraRoundFeeFor } from '../lib/projects';

/* Log a round, once: the revision round modal and its write, shared by the client's Project section (ClientWorkspace) and the Concepts
 * editor's "Log as a round". `open(project, note)` opens it, with `note` prefilled when a caller already knows what changed. A round past
 * the included ones is logged as an extra: the fee lands on the schedule as an unpaid line, in the same write. */
export function useRoundLog({ onPatchProject }) {
  const toast = useToast();
  const [round, setRound] = useState(null); // { project, extra }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = (p, prefill = '') => { setRound({ project: p, extra: revisionsExhausted(p) }); setNote(String(prefill || '')); };
  const save = async () => {
    const p = round.project; const rev = { max: revisionsMax(p), used: revisionsUsed(p), log: [...(p.revisions?.log || [])], ...(p.revisions || {}) };
    rev.log = [...(p.revisions?.log || []), { at: new Date().toISOString(), note: note.trim(), extra: !!round.extra }];
    rev.used = rev.log.filter(r => !r.extra).length;
    const set = { revisions: rev };
    if (round.extra) {
      const fee = extraRoundFeeFor(p); const n = extraRounds(p) + 1;
      set.invoices = [...invoicesOf(p), { ...newInvoice({ label: `Extra round ${n}`, amount: fee, dueAt: today(), status: 'sent' }), ledgerId: '', extra: true }];
      set.total = (Number(p.total) || 0) + fee;
    }
    setBusy(true);
    const ok = onPatchProject ? await onPatchProject(p._id, set) : false;
    setBusy(false);
    if (!ok) { toast.error(COPY.error.save); return; }
    toast.success(round.extra ? `Extra round logged, ${money(extraRoundFeeFor(p))} added as an invoice.` : `Round ${rev.used} of ${rev.max} logged.`);
    setRound(null); setNote('');
  };
  const modal = (
      <Modal open={!!round} onClose={() => setRound(null)} title={round?.extra ? 'Log an extra round' : `Log round ${round ? revisionsUsed(round.project) + 1 : ''} of ${round ? revisionsMax(round.project) : REVISION_ROUNDS}`} description={round?.extra ? `${money(round ? extraRoundFeeFor(round.project) : 0)} for a ${round?.project.kind === 'web' || round?.project.kind === 'combined' ? 'web' : 'design'} round, added to the schedule as an unpaid line.` : 'What changed in this round.'}
        footer={<><Button variant="ghost" onClick={() => setRound(null)}>Cancel</Button><Button loading={busy} onClick={save}>{round?.extra ? 'Log extra round' : 'Log round'}</Button></>}>
        <Textarea label={round?.extra ? 'Reason' : 'What changed'} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={round?.extra ? 'They want the mark reworked after approving it.' : 'Tightened the wordmark spacing, swapped the secondary color.'} data-autofocus />
      </Modal>
  );
  return { open, modal, busy, logging: !!round };
}
