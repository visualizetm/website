import { useState } from 'react';
import { Sheet, Stack, Row, Button, Input, useToast } from '../ui';
import { parseCapture, captureLead } from '../lib/capture';
import { COPY } from '../shared/copy';

/* Capture a lead (CRM revamp, step 4): from the Quick add menu, one field
 * that takes an Instagram handle, a phone number or a business name, and
 * makes a triage lead with that field filled. The nightly scan fills in
 * the rest. */
export default function CaptureSheet({ onClose, onCreate, onCaptured }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = parseCapture(value);
  const hint = !parsed ? '' : parsed.kind === 'instagram' ? `Instagram handle, @${parsed.business}` : parsed.kind === 'phone' ? `Phone, ${parsed.phone}` : 'Business name';
  const submit = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    const ok = await onCreate(captureLead(parsed));
    setBusy(false);
    if (!ok) { toast.error(COPY.error.create); return; }
    toast.success('Captured. It is waiting in Triage.');
    onCaptured?.();
    onClose();
  };
  return (
    <Sheet open onClose={busy ? () => {} : onClose} title="Capture a lead" description="A handle, a number or a name." label="Capture a lead"
      footer={<Row gap={2} justify="end"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button icon="Zap" onClick={submit} disabled={!parsed || busy} loading={busy}>Capture</Button></Row>}>
      <Stack gap={2}>
        <Input label="Handle, phone or business" value={value} onChange={(e) => setValue(e.target.value)} placeholder="@thebakeryco, 555 010 2030, or Bay Ridge Bakery" autoComplete="off" data-autofocus hint={hint || undefined} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        <p className="cs-copy">The nightly scan fills in the rest.</p>
      </Stack>
      <style>{captureStyles}</style>
    </Sheet>
  );
}
const captureStyles = `
  .cs-copy { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-3); }
`;
