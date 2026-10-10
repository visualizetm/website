import { useRef, useState } from 'react';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import { Sheet, Button, Row, Stack, Pill, QrCode, SegmentedControl, Toggle, Input, Select, InlineEdit, Menu, EmptyState, useConfirm, useMediaQuery } from '../../ui';
import { COPY } from '../../shared/copy';
import { relativeTime, fmtDate } from '../../shared/dates';
import { portalOf, portalUrl, generatePortalPatch, portalSentPatch, portalMessage, modulePatch, templatePatch, pinPatch, hoursPatch, documentsPatch, documentsOf, newDocument, moduleRows, DOCUMENT_KINDS, PORTAL_TEMPLATE_OPTIONS, PORTAL_STATE_OPTIONS } from '../../lib/portal';

/* The Portal sheet (client portal, prompt 1): everything about one client's
 * portal link, opened from the workspace's Portal card. The link (copy,
 * open as the client, the QR, regenerate behind a confirm), Send it (the
 * message in my voice, copy, share, mark as sent), the template, one
 * three way control per module with its Auto rule under it, the PIN, the
 * hours line and the documents (label, link, kind; drag to reorder on a
 * desktop, the row menu on a phone; delete with undo). Every write goes
 * through rec.patch with one portal patch from src/lib/portal.js, and the
 * server merges it, so a control never has to resend what it did not
 * touch. Read only hides the controls. */

const copyText = async (toast, text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error(COPY.error.copy); } };
const opts = (pairs) => pairs.map(([id, label]) => ({ id, label }));

function DocumentsEditor({ lead, patch, toast, readOnly }) {
  const docs = documentsOf(lead);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState('link');
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(null);
  const desktop = useMediaQuery('(hover: hover) and (pointer: fine)');
  const save = (next) => patch(documentsPatch(next));
  const move = (i, d) => { const n = [...docs]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; save(n); };
  const drop = (i) => { const from = drag.current; drag.current = null; setDragging(null); if (from == null || from === i) return; const n = [...docs]; const [x] = n.splice(from, 1); n.splice(i, 0, x); save(n); };
  const add = async () => {
    const d = newDocument(label, url, kind);
    if (!d.label || !/^https?:\/\//i.test(d.url)) { toast.error('A label and a link that starts with https.'); return; }
    setBusy(true); const ok = await save([...docs, d]); setBusy(false);
    if (ok) { setLabel(''); setUrl(''); setKind('link'); }
  };
  const remove = (i) => { const gone = docs[i]; save(docs.filter((_, j) => j !== i)); toast.undo(`${gone.label} removed.`, () => save([...documentsOf(lead).slice(0, i), gone, ...documentsOf(lead).slice(i)]), { seconds: 6 }); };
  const edit = (i, set) => save(docs.map((d, j) => (j === i ? { ...d, ...set } : d)));
  return (
    <Stack gap={2} className="ps-docs" data-section="documents">
      {docs.length === 0 && <p className="dt-muted">No documents yet. A link here is a row on their Your documents card.</p>}
      {docs.map((d, i) => (
        <div key={d.id} className={`ps-doc${dragging === i ? ' is-dragging' : ''}`} data-doc={d.id} draggable={desktop && !readOnly} onDragStart={() => { drag.current = i; setDragging(i); }} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} onDragEnd={() => { drag.current = null; setDragging(null); }}>
          <div className="ps-doc-row">
            {readOnly ? <span className="ps-doc-label">{d.label}</span> : <InlineEdit value={d.label} onSave={(v) => edit(i, { label: String(v).trim().slice(0, 120) })} label="Label" className="ps-doc-label" />}
            <Pill tone="neutral" label={(DOCUMENT_KINDS.find(k => k[0] === d.kind) || DOCUMENT_KINDS[4])[1]} size="sm" icon={false} variant="soft" />
            {!readOnly && <Menu label={`${d.label} actions`} items={[
              { id: 'up', label: 'Move up', icon: 'ChevronUp', disabled: i === 0, onSelect: () => move(i, -1) },
              { id: 'down', label: 'Move down', icon: 'ChevronDown', disabled: i === docs.length - 1, onSelect: () => move(i, 1) },
              ...DOCUMENT_KINDS.filter(k => k[0] !== d.kind).map(([id, l]) => ({ id: `kind-${id}`, label: `Mark as ${l}`, onSelect: () => edit(i, { kind: id }) })),
              { id: 'remove', label: 'Remove', icon: 'Trash01', danger: true, onSelect: () => remove(i) },
            ]} />}
          </div>
          {readOnly ? <span className="ps-doc-url lay-truncate">{d.url}</span> : <InlineEdit value={d.url} onSave={(v) => edit(i, { url: String(v).trim().slice(0, 600) })} label="Link" type="url" className="ps-doc-url" />}
        </div>
      ))}
      {!readOnly && (
        <div className="ps-add">
          <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value.slice(0, 120))} placeholder="Brand guide" />
          <Input label="Link" type="url" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 600))} placeholder="https://drive.google.com/..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <Select label="Kind" value={kind} onChange={(e) => setKind(e.target.value)} options={opts(DOCUMENT_KINDS)} />
          <Button variant="secondary" icon={Plus} onClick={add} loading={busy} className="ps-add-btn">Add</Button>
        </div>
      )}
    </Stack>
  );
}

export default function PortalSheet({ rec, onClose }) {
  const { lead, readOnly, patch, toast } = rec;
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const p = portalOf(lead) || {};
  const url = portalUrl(lead);
  const message = portalMessage(lead);
  const rows = moduleRows(lead);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const generate = async (regenerate = false) => {
    setBusy(true);
    const ok = await patch(generatePortalPatch(lead, regenerate));
    setBusy(false);
    if (ok) toast.success(regenerate ? 'New link made. The old one is dead.' : 'Portal link ready.');
    return ok;
  };
  const regenerate = async () => {
    if (!(await confirm({ title: 'Make a new link?', body: 'The old link, the old QR and every device that unlocked the PIN stop working the moment the new one exists. Anyone who still has them sees the expired page.', danger: true, confirmLabel: 'Regenerate' }))) return;
    await generate(true);
  };
  const share = async () => { try { await navigator.share({ text: message }); } catch { /* cancelled */ } };
  const markSent = async () => { setBusy(true); const ok = await patch(portalSentPatch(lead)); setBusy(false); if (ok) toast.success('Marked sent.'); };
  const setPin = async () => {
    if (!/^\d{4}$/.test(pinDraft)) { toast.error('Four digits.'); return; }
    setBusy(true); const ok = await patch(pinPatch(pinDraft)); setBusy(false);
    if (ok) { setPinDraft(''); setPinOpen(false); toast.success(p.pin ? 'PIN reset.' : 'PIN on.'); }
  };
  const togglePin = async (on) => { if (on) { setPinOpen(true); return; } setPinOpen(false); setPinDraft(''); const ok = await patch(pinPatch('')); if (ok) toast.success('PIN off.'); };
  const slug = lead.showcase?.slug || String(lead.business || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <Sheet open onClose={onClose} title="Portal" description={lead.business} tall className="ps-sheet" label="Portal">
      {!url ? (
        <EmptyState size="sm" icon="Grid01" title={COPY.empty['clients.portal'].title} description={COPY.empty['clients.portal'].description} action={readOnly ? undefined : { label: COPY.empty['clients.portal'].action, onClick: () => generate(false), loading: busy }} />
      ) : (
        <Stack gap={4}>
          <Stack gap={2} data-section="link">
            <p className="pb-card-h">The link</p>
            <Row gap={2} align="center" wrap={false}><span className="ps-url lay-truncate">{url}</span><Button variant="secondary" size="md" icon={Copy01} onClick={() => copyText(toast, url, 'Link')} className="ps-copy" aria-label="Copy the portal link">Copy</Button></Row>
            <Row gap={3} align="start" wrap>
              <QrCode value={url} size={160} icon label={`QR code for ${lead.business}'s portal`} downloadName={`${slug}-portal-qr`} />
              <Stack gap={2} className="ps-side">
                <p className="dt-muted ps-stats">{Number(p.views) || 0} view{Number(p.views) === 1 ? '' : 's'}{p.lastViewedAt ? `, last opened ${relativeTime(p.lastViewedAt)}` : ', not opened yet'}.</p>
                {p.sentAt ? <Pill tone="booked" label={`Sent ${fmtDate(p.sentAt)}`} size="sm" icon={false} /> : <Pill tone="neutral" label="Not sent yet" size="sm" icon={false} />}
                <Row gap={2} wrap>
                  <Button variant="secondary" size="md" icon="LinkExternal01" href={url} target="_blank" rel="noopener noreferrer" className="ps-open">Open as the client</Button>
                  {!readOnly && <Button variant="ghost" size="md" icon="RefreshCw01" onClick={regenerate} loading={busy} className="ps-regen">Regenerate</Button>}
                </Row>
              </Stack>
            </Row>
          </Stack>
          <Stack gap={2} data-section="send">
            <p className="pb-card-h">Send it</p>
            <p className="ps-msg">{message}</p>
            <Row gap={2} wrap>
              <Button variant="secondary" size="md" icon={Copy01} onClick={() => copyText(toast, message, 'Message')} className="ps-copy-msg">Copy</Button>
              {canShare && <Button variant="secondary" size="md" icon="Share01" onClick={share} className="ps-share">Share</Button>}
              {!readOnly && <Button size="md" icon={Check} onClick={markSent} loading={busy} className="ps-sent">{p.sentAt ? 'Sent again' : 'Mark as sent'}</Button>}
            </Row>
          </Stack>
          <Stack gap={2} data-section="template">
            <p className="pb-card-h">Template</p>
            <p className="dt-muted">Sets every card below to the template's defaults; change any card after.</p>
            {readOnly ? <p className="rc-ws-line">{p.template ? `${p.template[0].toUpperCase()}${p.template.slice(1)}` : 'None'}</p>
              : <SegmentedControl label="Template" size="sm" full options={opts(PORTAL_TEMPLATE_OPTIONS)} value={p.template || ''} onChange={(id) => patch(templatePatch(id))} className="ps-template" />}
          </Stack>
          <Stack gap={0} data-section="modules">
            <p className="pb-card-h">Cards</p>
            <p className="dt-muted">Off never shows. On shows when there is something to show. Auto is the same as On today; home is always on.</p>
            {rows.map(r => (
              <div key={r.id} className="ps-mod" data-module={r.id}>
                <div className="ps-mod-head">
                  <span className="ps-mod-title">{r.title}{r.sensitive ? ', behind the PIN' : ''}</span>
                  {readOnly ? <Pill tone="neutral" label={r.state[0].toUpperCase() + r.state.slice(1)} size="sm" icon={false} variant="soft" />
                    : <SegmentedControl label={`${r.title} state`} size="sm" options={opts(PORTAL_STATE_OPTIONS)} value={r.state} onChange={(id) => patch(modulePatch(r.id, id))} className="ps-mod-ctl" />}
                </div>
                <p className="ps-mod-auto">{r.auto}</p>
              </div>
            ))}
          </Stack>
          <Stack gap={2} data-section="pin">
            <p className="pb-card-h">PIN</p>
            <Toggle label="Ask for a PIN" description={p.pin ? 'Four digits gate the sensitive cards; a device remembers it for thirty days.' : 'Off. Every card is open to anyone with the link.'} checked={!!p.pin || pinOpen} onChange={togglePin} disabled={readOnly} className="ps-pin-toggle" />
            {!readOnly && (pinOpen || p.pin) && (
              <div className="ps-pin-row">
                {(pinOpen || !p.pin) && <Input label={p.pin ? 'New PIN' : 'PIN'} inputMode="numeric" maxLength={4} value={pinDraft} onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 digits" className="ps-pin-input" />}
                {(pinOpen || !p.pin) ? <Button size="md" onClick={setPin} loading={busy} className="ps-pin-set">{p.pin ? 'Save new PIN' : 'Set PIN'}</Button> : <Button variant="secondary" size="md" onClick={() => setPinOpen(true)} className="ps-pin-reset">Reset PIN</Button>}
              </div>
            )}
          </Stack>
          <Stack gap={2} data-section="hours">
            <p className="pb-card-h">Hours on their card</p>
            {readOnly ? <p className="rc-ws-line">{p.hours || 'From Settings'}</p> : <InlineEdit value={p.hours || ''} onSave={(v) => patch(hoursPatch(v))} placeholder="Leave empty for the hours in Settings" label="Hours on their card" className="ps-hours" />}
          </Stack>
          <Stack gap={2} data-section="documents">
            <p className="pb-card-h">Documents</p>
            <DocumentsEditor lead={lead} patch={patch} toast={toast} readOnly={readOnly} />
          </Stack>
        </Stack>
      )}
      {confirmDialog}
    </Sheet>
  );
}
