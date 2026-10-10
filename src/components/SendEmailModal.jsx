import { useState } from 'react';
import { Modal, Stack, Row, Button, InlineEdit, Pill, Tooltip, useToast } from '../ui';
import { apiFetch } from '../shared/api';
import { useShell } from '../shell/ShellContext';
import { buildEmailPayload } from '../lib/emailPayload';
import { applySendResult } from '../lib/emailSend';
import { money } from '../shared/format';
import { fmtDate } from '../shared/dates';

/* The send modal (CRM revamp, step 6): one small Modal for the four
 * branded emails. It shows who it goes to (the lead's email, editable in
 * place when empty, written to the record), the fields going out, and
 * Send, which posts to /api/admin/send-email; the server builds the same
 * payload from the record and stamps the checkpoint, the invoice or the
 * delivery flag. A 503 (no hook) or a 502 (Zapier said no) toasts the
 * server's message and stamps nothing, so a manual Tick stays available.
 *
 *   useSendEmail({ lead, patch }) -> { open(kind, { invoice, project }), modal, connected(kind) } */
export const EMAIL_LABEL = { intro: 'Intro email', onboarding: 'Onboarding email', invoice: 'Invoice email', delivery: 'Delivery email' };

export function useSendEmail({ lead, patch, onSent }) {
  const shell = useShell();
  const toast = useToast();
  const [req, setReq] = useState(null); // { kind, invoice, project }
  const [busy, setBusy] = useState(false);
  const connected = (kind) => !!shell?.emails?.[kind];
  const open = (kind, extra = {}) => setReq({ kind, invoice: extra.invoice || null, project: extra.project || null });
  const send = async () => {
    if (!req || !lead?.email) return;
    setBusy(true);
    const body = { leadId: String(lead._id), kind: req.kind, ...(req.invoice ? { invoiceId: req.invoice.id } : {}), ...(req.project ? { projectId: String(req.project._id) } : {}) };
    const r = await apiFetch('/api/admin/send-email', { method: 'POST', body });
    setBusy(false);
    if (!r.ok) { toast.error(r.data?.error || 'That email did not go out.'); return; }
    toast.success(`${EMAIL_LABEL[req.kind]} sent to ${lead.email}.`);
    setReq(null);
    /* CRM revamp, step 7: the server's stamps land on the local record now (same shape as its write); the refetch that follows skips every cache. */
    const { leadSet, projectSet } = applySendResult(lead, req.kind, { sentAt: r.data?.sentAt || new Date().toISOString(), invoice: req.invoice, project: req.project }, { projects: shell?.projects || [], sets: shell?.sets || [] });
    shell?.leadOps?.applyLocal?.(lead._id, leadSet);
    if (projectSet && req.project) shell?.projectOps?.applyLocal?.(req.project._id, projectSet);
    onSent?.(req.kind, r.data, req);
  };
  const modal = req ? <SendEmailModal lead={lead} kind={req.kind} invoice={req.invoice} project={req.project} busy={busy} onClose={() => { if (!busy) setReq(null); }} onSend={send} onEmail={(v) => patch?.({ email: v.trim() })} /> : null;
  return { open, modal, connected, sending: busy };
}

function Field({ label, value }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return null;
  return <div className="cw-kv"><span className="dt-fact-label">{label}</span><span className="se-val">{Array.isArray(value) ? value.join(', ') : String(value)}</span></div>;
}

export default function SendEmailModal({ lead, kind, invoice = null, project = null, busy = false, onClose, onSend, onEmail }) {
  const payload = buildEmailPayload(kind, { lead, project, invoice });
  const hasEmail = !!lead?.email;
  const sendBtn = <Button icon="Send01" loading={busy} disabled={!hasEmail || busy} onClick={onSend} className="se-send">Send</Button>;
  return (
    <Modal open onClose={onClose} title={`Send the ${EMAIL_LABEL[kind].toLowerCase()}`} label={EMAIL_LABEL[kind]} description={lead?.business}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>{hasEmail ? sendBtn : <Tooltip label="Add an email first."><span className="se-tipwrap">{sendBtn}</span></Tooltip>}</>}>
      <Stack gap={3}>
        <div className="cw-kv">
          <span className="dt-fact-label">To</span>
          {hasEmail ? <Row gap={2} align="center" wrap><span className="se-val">{lead.email}</span><Pill tone="booked" label="On the record" size="sm" icon={false} /></Row>
            : onEmail ? <InlineEdit value="" onSave={onEmail} placeholder="Add their email" label="Email" inputMode="email" type="email" /> : <span className="se-val se-val--muted">No email on the record</span>}
        </div>
        <Field label="Name" value={payload.name} />
        <Field label="Package" value={payload.packageLabel || 'No package'} />
        <Field label="Includes" value={payload.packageIncluded} />
        <Field label="Plan" value={payload.planLine} />
        {kind === 'onboarding' && <Field label="Variant" value={payload.variant} />}
        {kind === 'invoice' && <Field label="Invoice" value={payload.invoice ? `${payload.invoice.label || 'Invoice'}, ${money(payload.invoice.amount)}, due ${fmtDate(payload.invoice.dueAt) || payload.invoice.dueAt}` : 'None picked'} />}
        {kind === 'delivery' && <Field label="Drive link" value={payload.driveLink || 'No Drive link yet'} />}
        {kind === 'delivery' && <Field label="Review link" value={payload.reviewLink || 'No review link yet, generate one on Reviews'} />}
        <Field label="Meeting link" value={payload.calendlyLink} />
        <p className="dt-muted">Zapier sends it from the studio address. The record gets a stamp and a contact log entry when it goes.</p>
      </Stack>
      <style>{sendEmailStyles}</style>
    </Modal>
  );
}
export const sendEmailStyles = `
  .se-val { color: var(--v-text); overflow-wrap: anywhere; }
  .se-val--muted { color: var(--v-text-3); }
  .se-tipwrap { display: inline-flex; }
`;
