import { useState } from 'react';
import { Button, Stack, useConfirm, useToast } from '../../ui';
import { COPY } from '../../shared/copy';
import { fmtDate } from '../../shared/dates';
import { apiFetch } from '../../shared/api';

/* The client's own code (client app job), as Rob sees it: set or not, the lock, and Reset code. One block for every place a
 * client's link lives, so a planner only client (no portal) can be reset from the planner's Their link card exactly as a portal
 * client is from the portal sheet. Rob never sees the code; Reset code (after a confirm) clears it, unlocks it and signs every
 * device out. Nothing is sent. onReset(status) gets the new status (codeStatus) so the caller can update the record. */
export default function ClientCode({ lead, readOnly = false, onReset }) {
  const K = COPY.clientApp.crm;
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const raw = lead?.portal?.code;
  const code = raw && typeof raw === 'object' ? raw : {};
  const softMin = code.lockedUntil ? Math.max(1, Math.ceil((Date.parse(code.lockedUntil) - Date.now()) / 60000)) : 0;
  const line = code.locked ? K.locked : softMin > 0 ? K.soft(softMin) : code.set ? K.set(fmtDate(code.setAt, { month: 'short', day: 'numeric' })) : K.notSet;
  const reset = async () => {
    if (!(await confirm({ title: K.confirmTitle, body: K.confirmBody, confirmLabel: K.confirm, danger: true }))) return;
    setBusy(true);
    const r = await apiFetch('/api/admin/client-app', { method: 'POST', body: { action: 'reset-code', id: lead._id }, silent: true });
    setBusy(false);
    if (!r.ok) { toast.error(K.failed); return; }
    await onReset?.(r.data?.code || { set: false });
    toast.success(K.done);
  };
  return (
    <Stack gap={2} data-section="code">
      <p className="pb-card-h">{K.heading}</p>
      <p className={`rc-ws-line ps-code-line${code.locked ? ' ps-code-line--locked' : ''}`} role="status">{line}</p>
      <p className="ps-mod-auto">{K.line}</p>
      {!readOnly && (code.set || code.locked || softMin > 0) && <Button variant="secondary" size="md" onClick={reset} loading={busy} className="ps-code-reset">{K.reset}</Button>}
      {confirmDialog}
    </Stack>
  );
}
