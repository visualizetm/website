import { useEffect, useRef, useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import { Input, Textarea, Select, Button, Grid, Stack, Row, Collapsible, useConfirm } from '../ui';
import { PRIORITIES } from '../shared/semantics';
import { normalizeSocials } from '../lib/socials';
import { SocialFields } from './SocialLinks';
import { prepFacts } from '../lib/callSession';

/**
 * LeadForm: shared by the Call Console (New lead, Edit lead), the Leads page (New lead) and the record (Edit all).
 * Two steps (prompt 2 of 3, audit item 21): who they are and how to reach them first (Business, Contact name, Phone, Email),
 * everything else under More details. Editing saves on blur when `saveOnBlur` is set (audit item 20): a changed field leaves,
 * the whole form saves (onSave(values, { stay: true })), and the host warns before discarding what has not saved (onDirty).
 * Fill from Google copies the lead's own stored enrichment (the phone, the town, the rating line) into empty fields.
 * @param {object} [props.lead] existing values (or a preset for a new lead)
 * @param {boolean} [props.creating]
 * @param {Function} props.onSave (values with normalized socials, { stay }) => Promise<boolean|void>
 * @param {Function} props.onCancel
 * @param {Function} [props.onDelete] (id) => Promise, shown only when editing
 * @param {boolean} [props.saveOnBlur]
 * @param {Function} [props.onDirty] (dirty: boolean) whenever the unsaved state changes
 */
const valuesOf = (lead, creating) => ({
  business: lead?.business || '', industry: lead?.industry || '', area: lead?.area || '',
  phone: lead?.phone || '', phoneNote: lead?.phoneNote || '', email: lead?.email || '',
  askFor: lead?.askFor || '', bestWindow: lead?.bestWindow || (creating ? 'Before 8am or after 5pm.' : ''),
  priority: lead?.priority || 'warm', angle: lead?.angle || '', descriptor: lead?.descriptor || '',
  socials: { ...(lead?.socials || {}) },
});
export default function LeadForm({ lead, creating = false, onSave, onCancel, onDelete, saveOnBlur = false, onDirty = null }) {
  const [f, setF] = useState(() => valuesOf(lead, creating));
  const saved = useRef(JSON.stringify(valuesOf(lead, creating)));
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false); // More details starts closed: who and how to reach them is the first screen (audit item 21)
  const [confirm, confirmDialog] = useConfirm();
  const dirty = JSON.stringify(f) !== saved.current;
  useEffect(() => { onDirty?.(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const commit = async (stay) => {
    if (!f.business.trim()) return false;
    setBusy(true);
    try { const r = await onSave({ ...f, socials: normalizeSocials(f.socials) }, { stay }); if (r !== false) saved.current = JSON.stringify(f); return r; } finally { setBusy(false); }
  };
  const submit = async (e) => { e.preventDefault(); await commit(false); };
  const blur = (e) => {
    if (!saveOnBlur || creating || busy || !dirty) return;
    /* Leaving the form for one of its own buttons is not a blur worth a save (the button does its own thing). */
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget) && e.relatedTarget.tagName === 'BUTTON') return;
    commit(true);
  };
  const del = async () => {
    if (!onDelete || !lead?._id) return;
    if (await confirm({ title: `Delete ${lead.business}?`, body: 'It moves to Recently deleted in Settings and can be restored for 30 days.', danger: true, confirmLabel: 'Delete' })) await onDelete(lead._id);
  };
  /* Fill from Google: the lead's own stored enrichment (the scraper writes the phone, the town and the reviews on the record). */
  const facts = !creating && lead ? prepFacts(lead) : null;
  const canFill = !!facts && ((lead.phone && !f.phone.trim()) || (lead.area && !f.area.trim()));
  const fill = () => { setF(p => ({ ...p, phone: p.phone.trim() || lead.phone || '', area: p.area.trim() || lead.area || '' })); setMore(true); };
  return (
    <form className="lf" onSubmit={submit} onBlur={blur}>
      {confirmDialog}
      <Stack gap={4}>
        <Grid minColumnWidth={200} gap={3}>
          <Input label="Business" value={f.business} onChange={set('business')} required autoComplete="organization" data-autofocus />
          <Input label="Contact name" value={f.askFor} onChange={set('askFor')} placeholder="Damian" />
          <Input label="Phone" value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" />
          <Input label="Email" value={f.email} onChange={set('email')} inputMode="email" type="email" />
        </Grid>
        {facts && (facts.rating || lead.area || lead.phone) && (
          <Row gap={2} align="center" wrap className="lf-google">
            <span className="lf-google-line">From Google: {[facts.rating, lead.area, lead.phone].filter(Boolean).join(', ')}</span>
            {canFill && <Button variant="ghost" size="md" icon="MarkerPin01" onClick={fill} className="lf-fill">Use these</Button>}
          </Row>
        )}
        <Button variant="ghost" iconEnd={more ? 'ChevronUp' : 'ChevronDown'} onClick={() => setMore(v => !v)} aria-expanded={more} className="lf-more-btn">{more ? 'Fewer details' : 'More details'}</Button>
        <Collapsible open={more} className="lf-more">
          <Stack gap={3} style={{ paddingTop: 'var(--v-space-2)' }}>
            <Grid minColumnWidth={200} gap={3}>
              <Input label="Phone note" value={f.phoneNote} onChange={set('phoneNote')} placeholder="Front desk, ask for the owner" />
              <Input label="Industry" value={f.industry} onChange={set('industry')} placeholder="Landscaping" />
              <Input label="Area" value={f.area} onChange={set('area')} placeholder="Wilmington DE" />
              <Input label="Best window" value={f.bestWindow} onChange={set('bestWindow')} placeholder="Before 8am or after 5pm" />
              <Select label="Priority" value={f.priority} onChange={set('priority')} options={PRIORITIES.map(p => ({ id: p.id, label: p.label }))} />
            </Grid>
            <Input label="Descriptor" value={f.descriptor} onChange={set('descriptor')} placeholder="Dead site, great reviews." hint="One line that tells the story at a glance." />
            <Textarea label="The angle" value={f.angle} onChange={set('angle')} rows={3} placeholder="Why this lead, in your words." />
            <div className="v-field"><span className="v-field-label">Social links and website</span><SocialFields values={f.socials} onChange={(k, v) => setF(p => ({ ...p, socials: { ...p.socials, [k]: v } }))} /></div>
          </Stack>
        </Collapsible>
        <Row gap={2} wrap>
          <Button type="submit" icon={Check} loading={busy} disabled={!f.business.trim()}>{creating ? 'Add lead' : dirty ? 'Save changes' : 'Saved'}</Button>
          <Button variant="ghost" onClick={onCancel}>{creating ? 'Cancel' : 'Close'}</Button>
          {!creating && onDelete && <><span style={{ flex: 1 }} /><Button variant="danger" icon={Trash01} onClick={del}>Delete</Button></>}
        </Row>
      </Stack>
    </form>
  );
}
