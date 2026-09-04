import { useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import { Input, Textarea, Select, Button, Grid, Stack, Row, useConfirm } from '../ui';
import { SocialFields } from './SocialLinks';
import { normalizeSocials } from '../lib/socials';
import { PRIORITIES } from '../shared/semantics';

/**
 * LeadForm: the one create/edit form for a call lead, shared by the Leads
 * page and the Call Console (Prompt 7). Fields: business, industry, area,
 * phone, phoneNote, email, askFor, bestWindow, priority, descriptor, angle,
 * socials. Delete goes through useConfirm.
 * @param {object} props
 * @param {object} [props.lead] existing values (or a preset for a new lead)
 * @param {boolean} [props.creating]
 * @param {Function} props.onSave (values with normalized socials) => Promise
 * @param {Function} props.onCancel
 * @param {Function} [props.onDelete] (id) => Promise, shown only when editing
 */
export default function LeadForm({ lead, creating = false, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({
    business: lead?.business || '', industry: lead?.industry || '', area: lead?.area || '',
    phone: lead?.phone || '', phoneNote: lead?.phoneNote || '', email: lead?.email || '',
    askFor: lead?.askFor || '', bestWindow: lead?.bestWindow || (creating ? 'Before 8am or after 5pm.' : ''),
    priority: lead?.priority || 'warm', angle: lead?.angle || '', descriptor: lead?.descriptor || '',
    socials: { ...(lead?.socials || {}) },
  });
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.business.trim()) return;
    setBusy(true);
    try { await onSave({ ...f, socials: normalizeSocials(f.socials) }); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!onDelete || !lead?._id) return;
    if (await confirm({ title: `Delete ${lead.business}?`, body: 'It moves to Recently deleted in Settings and can be restored for 30 days.', danger: true, confirmLabel: 'Delete' })) await onDelete(lead._id);
  };
  return (
    <form className="lf" onSubmit={submit}>
      {confirmDialog}
      <Stack gap={4}>
        <Grid minColumnWidth={200} gap={3}>
          <Input label="Business" value={f.business} onChange={set('business')} required autoComplete="organization" data-autofocus />
          <Input label="Contact name" value={f.askFor} onChange={set('askFor')} placeholder="Damian" />
          <Input label="Phone" value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" />
          <Input label="Phone note" value={f.phoneNote} onChange={set('phoneNote')} placeholder="Front desk, ask for the owner" />
          <Input label="Email" value={f.email} onChange={set('email')} inputMode="email" type="email" />
          <Input label="Industry" value={f.industry} onChange={set('industry')} placeholder="Landscaping" />
          <Input label="Area" value={f.area} onChange={set('area')} placeholder="Wilmington DE" />
          <Input label="Best window" value={f.bestWindow} onChange={set('bestWindow')} placeholder="Before 8am or after 5pm" />
          <Select label="Priority" value={f.priority} onChange={set('priority')} options={PRIORITIES.map(p => ({ id: p.id, label: p.label }))} />
        </Grid>
        <Input label="Descriptor" value={f.descriptor} onChange={set('descriptor')} placeholder="Dead site, great reviews." hint="One line that tells the story at a glance." />
        <Textarea label="The angle" value={f.angle} onChange={set('angle')} rows={3} placeholder="Why this lead, in your words." />
        <div className="v-field"><span className="v-field-label">Social links and website</span><SocialFields values={f.socials} onChange={(k, v) => setF(p => ({ ...p, socials: { ...p.socials, [k]: v } }))} /></div>
        <Row gap={2} wrap>
          <Button type="submit" icon={Check} loading={busy} disabled={!f.business.trim()}>{creating ? 'Add lead' : 'Save changes'}</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          {!creating && onDelete && <><span style={{ flex: 1 }} /><Button variant="danger" icon={Trash01} onClick={del}>Delete</Button></>}
        </Row>
      </Stack>
    </form>
  );
}
