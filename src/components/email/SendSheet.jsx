import { useEffect, useMemo, useState } from 'react';
import { Sheet, Stack, Row, Button, Pill, Chip, Input, Textarea, Checkbox, SegmentedControl, ListRow, ErrorState, SkeletonBlock, SkeletonText, useToast, useConfirm } from '../../ui';
import EmailPreview, { emailPreviewStyles } from './EmailPreview';
import EmailEditor, { emailEditorStyles } from './EmailEditor';
import { apiFetch } from '../../shared/api';
import { fmtDateTime } from '../../shared/dates';
import { templateName, statusOf, NO_INSERT } from '../../lib/compose';
import { scheduleOptions, mailtoHref, smsHref, whyLine, toLocalInput, fromLocalInput } from '../../lib/sendTimes';

/* The send sheet (email safety, prompt 1 of 3): the one screen an email leaves from. It shows the recipient, the subject and the
 * body of that exact draft, and its Send now is the only caller of email/approve, the one door out (api/_lib/email/approve.js).
 * Every path that used to send (the Tasks row, Compose, the log sheet, Concepts) opens this instead. The body is editable (Edit
 * swaps the text for the block editor and Save renders it again on the server), "As they see it" shows the branded template in
 * the sandboxed preview, Later queues it for one of three times or a picked one, Open in Mail hands it to Mail, and a text row
 * (channel 'text') gets Edit and Text it, which opens Messages with the body filled and marks it sent by hand.
 *
 *   item        a log row, or { _id } to fetch
 *   onClose
 *   onChanged   (next) the row after a send, a queue, an edit or a cancel
 *   startLater  open on the Later times (Compose's Send later)
 *   startEdit   open editing */
const VIEWS = [{ id: 'text', label: 'Text' }, { id: 'branded', label: 'As they see it' }];
const changed = () => { try { window.dispatchEvent(new CustomEvent('vz:drafts-changed')); } catch { /* an old browser */ } };

export default function SendSheet({ item, onClose, onChanged, startLater = false, startEdit = false }) {
  const toast = useToast();
  const [confirm, confirmEl] = useConfirm();
  const [full, setFull] = useState(item && item.html !== undefined && item.text !== undefined ? item : null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState('text');
  const [later, setLater] = useState(!!startLater);
  const [pick, setPick] = useState('');
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(null); // { subject, preheader, blocks, to, text }
  const [vars, setVars] = useState([]);
  const [driveShared, setDriveShared] = useState(false);
  const id = String(item?._id || '');
  useEffect(() => {
    let on = true; setError('');
    apiFetch(`/api/admin/email/log?id=${encodeURIComponent(id)}`).then(r => { if (!on) return; if (r.ok && r.data?.item) setFull(r.data.item); else setError(r.data?.error || 'It did not come back.'); });
    return () => { on = false; };
  }, [id, tick]);
  const e = full || item || {};
  const isText = e.channel === 'text';
  const open = e.status === 'draft' || e.status === 'queued';
  const st = statusOf(e.status);
  const tpl = templateName(e.templateId);
  const why = whyLine(e, tpl);
  const options = useMemo(() => scheduleOptions(new Date()), [later]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Edit: a text edits in place; an email opens the block editor on the draft's own blocks (its edits, else the template's). */
  const startEditing = async () => {
    if (isText) { setEdit({ text: e.text || '', subject: e.subject || '' }); setEditing(true); return; }
    setBusy('edit');
    const r = await apiFetch('/api/admin/email/preview', { method: 'POST', body: { templateId: e.templateId, recordId: e.recordId, projectId: e.projectId || '', invoiceId: e.invoiceId || '', ...(e.override ? { override: e.override } : {}) } });
    setBusy('');
    if (!r.ok || !r.data?.template) { toast.error(r.data?.error || 'The editor did not load.'); return; }
    const src = e.override && Array.isArray(e.override.blocks) ? e.override : r.data.template;
    setEdit({ subject: src.subject || '', preheader: src.preheader || '', blocks: Array.isArray(src.blocks) ? src.blocks : [], to: (e.to || []).join(', ') });
    setVars((r.data.vars || []).filter(v => v.value && !NO_INSERT.includes(v.key)));
    setEditing(true);
  };
  useEffect(() => { if (startEdit && full && !editing && !edit) startEditing(); }, [startEdit, full]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveEdit = async () => {
    setBusy('save');
    const body = isText ? { id, edit: { text: edit.text, subject: edit.subject } } : { id, edit: { subject: edit.subject, preheader: edit.preheader, blocks: edit.blocks }, to: String(edit.to || '').split(/[\s,]+/).filter(Boolean) };
    const r = await apiFetch('/api/admin/email/log', { method: 'POST', body });
    setBusy('');
    if (!r.ok) { toast.error(r.data?.error || 'Not saved.'); return; }
    setFull(r.data.item); setEditing(false); setEdit(null); onChanged?.(r.data.item); changed();
    toast.success('Saved. Read it once more, then send.');
  };

  /* Send now, or Later: the approve door, the duplicate guard asked through a confirm. */
  const approve = async (extra = {}) => {
    const post = (more) => apiFetch('/api/admin/email/approve', { method: 'POST', body: { id, ...extra, ...more, ...(e.templateId === 'delivery' ? { driveShared } : {}) } });
    setBusy(extra.sendAt ? 'later' : 'send');
    let r = await post({});
    if (r.status === 409 && r.data?.duplicate) { const yes = await confirm({ title: 'Send it again?', body: r.data.error, confirmLabel: 'Send again' }); r = yes ? await post({ confirmDuplicate: true }) : null; }
    setBusy('');
    if (!r) return false;
    if (!r.ok) { toast.error(r.data?.error || 'It did not go out.'); return false; }
    const next = r.data?.queued ? { ...e, status: 'queued', sendAt: r.data.sendAt, approvedBy: 'rob' } : { ...e, status: r.data?.test ? 'test' : 'sent', sentAt: r.data?.sentAt || new Date().toISOString(), sendAt: '', approvedBy: 'rob' };
    toast.success(r.data?.queued ? `Queued for ${fmtDateTime(r.data.sendAt)}.` : r.data?.text ? 'Marked sent.' : (r.data?.message || 'Sent.'));
    onChanged?.(next); changed(); onClose();
    return true;
  };
  const textIt = async () => {
    const href = smsHref(e.phone, e.text);
    const ok = await approve({});
    if (ok) window.location.href = href;
  };
  const cancelSend = async () => {
    setBusy('cancel');
    const r = await apiFetch('/api/admin/email/log', { method: 'POST', body: { id, cancel: true } });
    setBusy('');
    if (!r.ok) { toast.error(r.data?.error || 'Could not cancel it.'); return; }
    toast.success('Cancelled. It waits here as a draft.');
    setFull(f => (f ? { ...f, status: 'draft', sendAt: '', approvedBy: '' } : f)); onChanged?.({ ...e, status: 'draft', sendAt: '' }); changed();
  };

  const when = e.status === 'queued' && e.sendAt ? `Goes out ${fmtDateTime(e.sendAt)}` : e.sentAt ? `Sent ${fmtDateTime(e.sentAt)}` : e.createdAt ? `Written ${fmtDateTime(e.createdAt)}` : '';
  const title = isText ? `Text: ${e.subject || 'to them'}` : (e.subject || tpl);
  const footer = editing ? <>
    <Button variant="ghost" onClick={() => { setEditing(false); setEdit(null); }} disabled={busy === 'save'}>Cancel</Button>
    <Button icon="Save01" loading={busy === 'save'} onClick={saveEdit} className="ss-save">Save</Button>
  </> : later ? <>
    <Button variant="ghost" onClick={() => setLater(false)}>Back</Button>
    <Button icon="Clock" loading={busy === 'later'} disabled={!fromLocalInput(pick)} onClick={() => approve({ sendAt: fromLocalInput(pick) })} className="ss-queue">Queue it</Button>
  </> : !open ? <Button variant="ghost" onClick={onClose}>Close</Button>
    : isText ? <>
      <Button variant="secondary" icon="Edit02" onClick={startEditing} disabled={!full}>Edit</Button>
      <Button icon="MessageCircle01" loading={busy === 'send'} disabled={!full || !e.phone} onClick={textIt} className="ss-text-it">Text it</Button>
    </> : <>
      {e.status === 'queued' && <Button variant="ghost" loading={busy === 'cancel'} onClick={cancelSend} className="ss-cancel">Cancel send</Button>}
      <Button variant="ghost" icon="Clock" onClick={() => setLater(true)} disabled={!full} className="ss-later">Later</Button>
      <Button variant="secondary" icon="Mail01" href={full ? mailtoHref(e.to, e.subject, e.text) : undefined} disabled={!full} className="ss-mail">Open in Mail</Button>
      <Button icon="Send01" loading={busy === 'send'} disabled={!full || !!error || (e.templateId === 'delivery' && !driveShared)} onClick={() => approve({})} className="ss-send">Send now</Button>
    </>;
  return (
    <Sheet open onClose={onClose} title={title} label={isText ? 'Text' : 'Email'} description={when} tall width={680} className="ss-sheet" footer={footer}>
      <Stack gap={3}>
        <Row gap={2} align="center" wrap>
          <Pill tone={st.tone} label={st.label} size="sm" icon={false} />
          {!isText && <Chip label={tpl} icon="Mail01" className="ss-template" />}
          {isText && <Chip label="Text" icon="MessageCircle01" className="ss-template" />}
          {e.auto && <Pill tone="neutral" label="Automatic" size="sm" icon={false} variant="outline" />}
          {e.gmailDraftId && <Pill tone="progress" label="In Gmail" size="sm" icon={false} variant="outline" />}
        </Row>
        {why && <p className="ss-why">{why}</p>}
        {error ? <ErrorState title="That email did not load." description={error} onRetry={() => setTick(t => t + 1)} /> : !full ? (
          <Stack gap={2} aria-busy="true"><SkeletonBlock width={220} height={18} /><SkeletonBlock width={260} height={18} /><SkeletonText lines={5} /></Stack>
        ) : editing && edit ? (
          <Stack gap={3} className="ss-edit">
            {!isText && <Input label="To" value={edit.to} onChange={(ev) => setEdit(d => ({ ...d, to: ev.target.value }))} inputMode="email" autoComplete="off" />}
            <Input label="Subject" value={edit.subject} onChange={(ev) => setEdit(d => ({ ...d, subject: ev.target.value.slice(0, 200) }))} />
            {isText ? <Textarea label="Text" value={edit.text} rows={6} onChange={(ev) => setEdit(d => ({ ...d, text: ev.target.value.slice(0, 1000) }))} />
              : <EmailEditor value={{ subject: edit.subject, preheader: edit.preheader, blocks: edit.blocks }} onChange={(v) => setEdit(d => ({ ...d, preheader: v.preheader, blocks: v.blocks, subject: v.subject ?? d.subject }))} vars={vars} />}
          </Stack>
        ) : later ? (
          <Stack gap={2} className="ss-later-list" role="group" aria-label="When to send">
            <p className="ss-why">It goes out on its own at the time you pick. Edit it before then and it waits for your tap again.</p>
            {options.map(o => <ListRow key={o.id} title={o.label} subtitle={fmtDateTime(o.at)} onClick={() => approve({ sendAt: o.at })} chevron={false} className="ss-when" />)}
            <Input label="Pick a time" type="datetime-local" value={pick} min={toLocalInput(new Date())} onChange={(ev) => setPick(ev.target.value)} />
          </Stack>
        ) : (
          <Stack gap={2}>
            <div className="cw-kv"><span className="dt-fact-label">{isText ? 'To (phone)' : 'To'}</span><span className="ss-val">{isText ? (e.phone || 'No phone on the record') : ((e.to || []).join(', ') || 'No address yet')}{e.cc?.length ? `, copy to ${e.cc.join(', ')}` : ''}</span></div>
            {!isText && <div className="cw-kv"><span className="dt-fact-label">Subject</span><span className="ss-val">{e.subject}</span></div>}
            <Row gap={2} align="center" justify="between" wrap>
              {!isText ? <SegmentedControl label="How to read it" size="sm" options={VIEWS} value={view} onChange={setView} className="ss-view" /> : <span />}
              {open && <Button variant="ghost" size="md" icon="Edit02" loading={busy === 'edit'} onClick={startEditing} className="ss-edit-btn">Edit</Button>}
            </Row>
            {e.status === 'failed' && e.error ? <p className="ss-error" role="status">{e.error}</p> : null}
            {e.error && e.status === 'draft' ? <p className="ss-error" role="status">{e.error}</p> : null}
            {!isText && view === 'branded' ? <EmailPreview html={e.html || ''} text={e.text || ''} /> : <pre className="ss-text" tabIndex={0} aria-label={isText ? 'The text as it reads' : 'The email as plain text'}>{e.text || ''}</pre>}
            {open && e.templateId === 'delivery' && <Checkbox label="The Drive folder is shared as Viewer" checked={driveShared} onChange={setDriveShared} className="ss-drive" />}
          </Stack>
        )}
      </Stack>
      {confirmEl}
      <style>{emailPreviewStyles + emailEditorStyles + ssStyles}</style>
    </Sheet>
  );
}
const ssStyles = `
  .ss-why { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .ss-val { color: var(--v-text); overflow-wrap: anywhere; }
  .ss-text { margin: 0; padding: var(--v-space-3); border-radius: var(--v-radius-md); border: 1px solid var(--v-border); background: var(--v-surface-1); color: var(--v-text); font-family: var(--v-font-body); font-size: var(--v-text-md); line-height: var(--v-lh-md); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 50vh; overflow: auto; }
  .ss-error { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-status-danger-text); overflow-wrap: anywhere; }
  .ss-edit { min-width: 0; }
`;
