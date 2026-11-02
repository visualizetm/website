import { useEffect, useState } from 'react';
import { Sheet, Stack, Row, Button, Pill, ErrorState, useToast } from '../../ui';
import EmailPreview, { emailPreviewStyles } from './EmailPreview';
import { apiFetch } from '../../shared/api';
import { fmtDateTime } from '../../shared/dates';
import { statusOf, logTitle } from '../../lib/compose';
import { useShell } from '../../shell/ShellContext';

/* One logged email (the email system, milestone 4): the exact HTML that went,
 * in the same sandboxed preview Compose uses, with Send again (Compose
 * prefilled on the template, the project and the invoice), Cancel send for
 * a queued one and Send now for a draft, which opens the send sheet (the
 * Drafts rule: only that sheet's Send now sends, after Rob read it). The record's
 * Emails section and Settings' Recent sends both open it. The row comes in
 * without its html; the sheet fetches the entry. */
export default function EmailLogSheet({ item, onClose, onSendAgain = null, onChanged }) {
  const toast = useToast();
  const shell = useShell();
  const [full, setFull] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let on = true; setFull(null); setError('');
    apiFetch(`/api/admin/email/log?id=${encodeURIComponent(String(item._id))}`).then(r => { if (!on) return; if (r.ok && r.data?.item) setFull(r.data.item); else setError(r.data?.error || 'It did not come back.'); });
    return () => { on = false; };
  }, [item._id, tick]);
  const e = full || item;
  const st = statusOf(e.status);
  const cancel = async () => {
    setBusy(true);
    const r = await apiFetch('/api/admin/email/log', { method: 'POST', body: { id: String(item._id), cancel: true } });
    setBusy(false);
    if (!r.ok) { toast.error(r.data?.error || 'Could not cancel it.'); return; }
    toast.success('Cancelled. It stays here as a draft.');
    onChanged?.({ ...e, status: 'draft', sendAt: '' });
    onClose();
  };
  /* The Drafts rule (email safety): this sheet never sends. Send now hands the entry to the send sheet, the one door out. */
  const sendNow = () => { onClose(); shell?.openSendSheet?.(e, { onChanged }); };
  const when = e.status === 'queued' && e.sendAt ? `Goes out ${fmtDateTime(e.sendAt)}` : e.sentAt ? `Sent ${fmtDateTime(e.sentAt)}` : `Written ${fmtDateTime(e.createdAt)}`;
  return (
    <Sheet open onClose={onClose} title={logTitle(e)} label="Email" description={`To ${(e.to || []).join(', ') || 'nobody yet'}${e.cc?.length ? `, copy to ${e.cc.join(', ')}` : ''}. ${when}.`} tall width={680} className="el-sheet"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        {e.status === 'queued' && <Button variant="secondary" loading={busy} onClick={cancel} className="el-cancel">Cancel send</Button>}
        {(e.status === 'draft' || e.status === 'queued') && <Button icon="Send01" onClick={sendNow} className="el-send">Send now</Button>}
        {onSendAgain && !(e.status === 'draft' || e.status === 'queued') && <Button icon="Send01" onClick={() => { onClose(); onSendAgain(e); }} className="el-again">Send again</Button>}
        {onSendAgain && (e.status === 'draft' || e.status === 'queued') && <Button variant="secondary" icon="Edit02" onClick={() => { onClose(); onSendAgain(e); }} className="el-again">Edit</Button>}
      </>}>
      <Stack gap={3}>
        <Row gap={2} align="center" wrap>
          <Pill tone={st.tone} label={st.label} size="sm" icon={false} />
          {e.auto && <Pill tone="neutral" label="Automatic" size="sm" icon={false} variant="outline" />}
          {e.toSelf && <Pill tone="neutral" label="To me" size="sm" icon={false} variant="outline" />}
        </Row>
        {e.status === 'failed' && e.error ? <p className="el-error" role="status">{e.error}</p> : null}
        {error ? <ErrorState title="That email did not load." description={error} onRetry={() => setTick(t => t + 1)} />
          : <EmailPreview html={full?.html || ''} text={full?.text || e.text || ''} loading={!full} />}
      </Stack>
      <style>{emailPreviewStyles + elStyles}</style>
    </Sheet>
  );
}
const elStyles = `
  .el-error { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-status-danger-text); overflow-wrap: anywhere; }
`;
