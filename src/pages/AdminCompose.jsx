import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageShell, ScrollArea, StickyFooterBar, Stack, Row, Card, Button, IconButton, Chip, Input, Checkbox, Sheet, ListRow, Menu, Pill, SegmentedControl, Stagger, EmptyState, ErrorState, SkeletonBlock, SkeletonText, Icon, useToast, useConfirm, useMediaQuery, useDelayedLoading, useRetry } from '../ui';
import EmailEditor, { emailEditorStyles } from '../components/email/EmailEditor';
import EmailPreview, { emailPreviewStyles } from '../components/email/EmailPreview';
import { apiFetch } from '../shared/api';
import { COPY } from '../shared/copy';
import { useShell, useTopBar } from '../shell/ShellContext';
import { suggestEmail } from '../shared/taskRules';
import { templateOf } from '../shared/emailTemplates';
import { projectsOf, isActiveProject } from '../lib/projects';
import { draftKey, readDraft, writeDraft, clearDraft, sameEmail, needsConfirmToSwitch, canSendNow, homeOf, pickerGroups, templateName, knownTemplate, lackingLine, sentMapOf, NO_INSERT, tomorrowNine, isAddress } from '../lib/compose';
import { fmtDateTime } from '../shared/dates';

/* Compose (the email system, milestone 3), at /email/compose?record=<id>&template=<id>&project=<id>&invoice=<id>: a focused screen on a phone
 * (the tab bar hidden, Back through nav-history and the edge swipe), a routed page on a computer, side by side with the preview from 1024 up.
 *
 *   Template     one row; the sheet groups every template by Lead, Deal, Client, Project and Any with the suggestion pinned first and each
 *                one's `when`; a template the record lacks a value for is greyed with the reason; switching asks before dropping edits.
 *   To           chips from the record, add and remove, Copy me (the sender address).
 *   The email    the subject (its count near 60), the preview text and the body as block cards (src/components/email/EmailEditor.jsx), with
 *                Insert field chips that carry the record's current values.
 *   Missing      a banner naming what the record lacks; each chip jumps to where that value is set; Send stays disabled until it is there.
 *   Preview      the server's render in a sandboxed iframe (src/components/email/EmailPreview.jsx), 400 ms after the last edit.
 *   Send         Send test to me, Send, and Send tomorrow at 9am in Send's menu; the confirm sheet only on the first send of a template to a
 *                record or on a duplicate inside ten minutes. Edits apply to this email; Save as my default sits behind the menu and a confirm.
 *   Draft        one per record and template on this device, offered on the next open ("Pick up where you left off?").
 * The server renders every email (POST /api/admin/email/preview, /send); nothing here builds HTML. */
const MODES = [{ id: 'edit', label: 'Edit' }, { id: 'preview', label: 'Preview' }];
const firstNameOf = (lead) => String(lead?.askFor || '').trim().split(/[\s,]+/)[0] || '';

/* mode 'send' is Compose; mode 'template' (Settings, Emails) edits the template itself on a record to preview with: no To, Save as default in the footer, Reset to default in the menu, a draft under the template's own key. */
export default function AdminCompose({ lead, projects = [], sets = [], loading = false, leadsError = false, onRetryLeads, templateId: initialTemplate = '', projectId = '', invoiceId = '', mode: composeMode = 'send', onBack }) {
  const tplMode = composeMode === 'template';
  const shell = useShell();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [retry, retrying] = useRetry(onRetryLeads);
  useTopBar({ title: tplMode ? 'Template' : 'Email', back: onBack });
  const recordId = lead ? String(lead._id) : '';
  const keyOf = useCallback((tid) => (tplMode ? draftKey('template', tid) : draftKey(recordId, tid)), [tplMode, recordId]);
  const mine = useMemo(() => projectsOf(projects, recordId), [projects, recordId]);
  const project = useMemo(() => mine.find(p => String(p._id) === String(projectId)) || mine.find(isActiveProject) || mine.find(p => p.kind !== 'retainer') || null, [mine, projectId]);
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState(null); // the record's email log, null until it is here
  const [templateId, setTemplateId] = useState(initialTemplate);
  const [source, setSource] = useState(null); // the effective template, what the edits are measured against
  const [value, setValue] = useState(null); // { subject, preheader, blocks }
  const [draftOffer, setDraftOffer] = useState(null);
  const [to, setTo] = useState(null);
  const [addTo, setAddTo] = useState('');
  const [copyMe, setCopyMe] = useState(false);
  const [mode, setMode] = useState('edit');
  const [picker, setPicker] = useState(false);
  const [pv, setPv] = useState({ state: 'idle', data: null, error: '' });
  const [sending, setSending] = useState('');
  const [sendError, setSendError] = useState('');
  const [confirmReq, setConfirmReq] = useState(null); // { kind: 'first' | 'duplicate', message, opts }
  const [driveShared, setDriveShared] = useState(false); // the delivery email's one required box
  const reqId = useRef(0);
  const lastPreviewed = useRef('');
  const lastOpts = useRef(null);
  const showSkel = useDelayedLoading(loading && !lead);

  /* The connection and the sender, once; the record's log, for the suggestion and the first send confirm. */
  useEffect(() => { let on = true; apiFetch('/api/admin/email/status').then(r => { if (on && r.ok) setStatus(r.data); }); return () => { on = false; }; }, []);
  useEffect(() => {
    if (!recordId) return undefined;
    let on = true;
    apiFetch(`/api/admin/email/log?recordId=${encodeURIComponent(recordId)}`).then(r => { if (on) setLog(r.ok && Array.isArray(r.data?.items) ? r.data.items : []); });
    return () => { on = false; };
  }, [recordId]);
  const sent = useMemo(() => sentMapOf(log || []), [log]);
  const suggestion = useMemo(() => (lead ? knownTemplate(suggestEmail(lead, { project, sets, projects: mine, sent })) : null), [lead, project, sets, mine, sent]);
  /* No template asked for: the suggestion once the log is here, else a blank one. */
  useEffect(() => { if (lead && log !== null && !templateId) setTemplateId(suggestion || 'custom'); }, [lead, log, templateId, suggestion]);

  const runPreview = useCallback(async (tid, override) => {
    const n = ++reqId.current;
    setPv(p => ({ ...p, state: 'loading' }));
    const r = await apiFetch('/api/admin/email/preview', { method: 'POST', body: { templateId: tid, recordId, projectId: project ? String(project._id) : '', invoiceId: invoiceId || '', ...(override ? { override } : {}) } });
    if (n !== reqId.current) return null;
    if (!r.ok) { setPv({ state: 'error', data: null, error: r.data?.error || 'The preview did not load.' }); return null; }
    setPv({ state: 'ready', data: r.data, error: '' });
    return r.data;
  }, [recordId, project, invoiceId]);

  /* A template: its effective source, the addresses, and the draft kept for it on this device. */
  useEffect(() => {
    if (!recordId || !templateId) return undefined;
    let on = true;
    (async () => {
      const data = await runPreview(templateId, null);
      if (!on || !data?.template) return;
      const src = { subject: data.template.subject || '', preheader: data.template.preheader || '', blocks: Array.isArray(data.template.blocks) ? data.template.blocks : [] };
      lastPreviewed.current = 'null';
      setSource(src); setValue(src);
      setTo(t => (t === null ? (data.to || []) : t));
      const d = readDraft(keyOf(templateId));
      setDraftOffer(d && !sameEmail(d, src) ? d : null);
    })();
    return () => { on = false; };
  }, [recordId, templateId, runPreview, keyOf]);

  /* An edit: the draft on the device and, 400 ms later, the preview; back at the source the draft goes. */
  useEffect(() => {
    if (!value || !source) return undefined;
    const key = keyOf(templateId);
    const same = sameEmail(value, source);
    if (same) clearDraft(key); else writeDraft(key, value);
    const override = same ? null : value;
    const sig = JSON.stringify(override);
    if (sig === lastPreviewed.current) return undefined;
    const t = setTimeout(() => { lastPreviewed.current = sig; runPreview(templateId, override); }, 400);
    return () => clearTimeout(t);
  }, [value, source, recordId, templateId, runPreview, keyOf]);

  const pickTemplate = async (id) => {
    setPicker(false);
    if (!id || id === templateId) return;
    if (needsConfirmToSwitch(value, source)) {
      const okx = await confirm({ title: 'Switch templates?', body: `Your edits to ${templateName(templateId).toLowerCase()} stay as a draft on this device.`, confirmLabel: 'Switch' });
      if (!okx) return;
    }
    setValue(null); setSource(null); setDraftOffer(null); setSendError(''); setMode('edit');
    setTemplateId(id);
  };
  const addAddress = () => { const a = addTo.trim().toLowerCase(); if (!isAddress(a)) return; setTo(t => (t.includes(a) ? t : [...t, a])); setAddTo(''); };
  const jump = (key) => {
    const h = homeOf(key);
    if (!lead) return;
    if (h.go === 'settings') { shell?.go?.('settings'); return; }
    if (h.go === 'concepts' && shell?.openConcepts) { shell.openConcepts(lead); return; }
    if (h.go === 'money') { shell?.openRecord?.(lead, 'payments'); return; }
    shell?.openRecord?.(lead);
  };

  const data = pv.data;
  const missing = useMemo(() => [...new Set([...(data?.missing || []), ...(data?.lacking || [])])], [data]);
  const noTo = to !== null && to.length === 0;
  const optedOut = !!data?.optedOut;
  const isDelivery = templateId === 'delivery' && !tplMode;
  const canSend = canSendNow({ value, missing, to: to || [], sending, optedOut, previewOk: pv.state !== 'error' }) && (!isDelivery || driveShared);
  const canTest = !!value && !sending && !missing.length && pv.state !== 'error';
  const insertVars = useMemo(() => (data?.vars || []).filter(v => v.value && !NO_INSERT.includes(v.key)), [data]);

  const doSend = async (opts = {}) => {
    const kind = opts.testToSelf ? 'test' : opts.sendAt ? 'later' : 'send';
    lastOpts.current = opts;
    setSending(kind); setSendError('');
    const override = sameEmail(value, source) ? undefined : value;
    const body = { templateId, recordId, projectId: project ? String(project._id) : '', invoiceId: invoiceId || '', ...(override ? { override } : {}), to, cc: copyMe && status?.sender?.address ? [status.sender.address] : [], testToSelf: !!opts.testToSelf, confirmDuplicate: !!opts.confirmDuplicate, ...(opts.sendAt ? { sendAt: opts.sendAt } : {}), ...(isDelivery ? { driveShared } : {}) };
    const r = await apiFetch('/api/admin/email/send', { method: 'POST', body });
    setSending('');
    if (r.status === 409 && !opts.testToSelf) { setConfirmReq({ kind: 'duplicate', message: r.data?.error || 'This one went out a few minutes ago. Send it again?', opts: { ...opts, confirmDuplicate: true, confirmed: true } }); return; }
    if (!r.ok) { setSendError(r.data?.error || 'That email did not go out.'); return; }
    if (opts.testToSelf) { toast.success(r.data?.message || 'Test sent.'); return; }
    clearDraft(keyOf(templateId));
    if (r.data?.queued) toast.success(`Queued for ${fmtDateTime(r.data.sendAt)}.`);
    else toast.success(r.data?.test ? (r.data.message || 'Test only, email is not connected yet.') : `Sent to ${firstNameOf(lead) || lead.business}`);
    shell?.refreshLeads?.(); shell?.projectOps?.reload?.();
    onBack?.();
  };
  const send = (opts = {}) => {
    if (!canSend) return;
    if (!opts.confirmed) {
      const before = (log || []).some(e => e.templateId === templateId && !e.toSelf && ['sent', 'test', 'queued'].includes(e.status));
      if (!before) { setConfirmReq({ kind: 'first', message: `The first ${templateName(templateId).toLowerCase()} email to ${lead.business}.`, opts: { ...opts, confirmed: true } }); return; }
    }
    doSend(opts);
  };
  const saveDefault = async () => {
    if (!value || !source || sameEmail(value, source)) return;
    const okx = await confirm({ title: `Make this my default ${templateName(templateId).toLowerCase()}?`, body: tplMode ? 'Every record gets this version from now on.' : 'Every record gets this version from now on. Reset to default lives in Settings, Emails.', confirmLabel: 'Save as default' });
    if (!okx) return;
    const service = data?.template?.service;
    const payload = templateOf(templateId)?.variants && service ? { subject: value.subject, preheader: value.preheader, variants: { [service]: value.blocks } } : { subject: value.subject, preheader: value.preheader, blocks: value.blocks };
    const r = await apiFetch('/api/admin/email/settings', { method: 'PUT', body: { templates: { [templateId]: payload } } });
    if (!r.ok) { toast.error(r.data?.error || 'Not saved.'); return; }
    setSource({ ...value }); clearDraft(keyOf(templateId));
    toast.success('Saved as your default.');
  };
  const edited = !!value && !!source && !sameEmail(value, source);
  const resetDefault = async () => {
    const okx = await confirm({ title: `Reset ${templateName(templateId).toLowerCase()} to the default?`, body: 'Your saved edits to this template go. Every record gets the default again.', confirmLabel: 'Reset', danger: true });
    if (!okx) return;
    const r = await apiFetch('/api/admin/email/settings', { method: 'PUT', body: { templates: { [templateId]: null } } });
    if (!r.ok) { toast.error(r.data?.error || 'Not reset.'); return; }
    clearDraft(keyOf(templateId)); setValue(null); setSource(null);
    const fresh = await runPreview(templateId, null);
    if (fresh?.template) { const src = { subject: fresh.template.subject || '', preheader: fresh.template.preheader || '', blocks: fresh.template.blocks || [] }; lastPreviewed.current = 'null'; setSource(src); setValue(src); }
    toast.success('Back to the default.');
  };
  const moreItems = tplMode ? [
    { id: 'resetdefault', label: 'Reset to default', icon: 'ReverseLeft', disabled: !(data?.template?.edited || edited), onSelect: resetDefault },
    { id: 'reset', label: 'Back to the saved version', icon: 'ReverseLeft', disabled: !edited, onSelect: () => { setValue(source); clearDraft(keyOf(templateId)); } },
    'divider',
    { id: 'record', label: 'Open the record', icon: 'User01', disabled: !lead, onSelect: () => shell?.openRecord?.(lead) },
  ] : [
    { id: 'default', label: 'Save as my default for this template', icon: 'Save01', disabled: !edited, onSelect: saveDefault },
    { id: 'reset', label: 'Back to the template', icon: 'ReverseLeft', disabled: !edited, onSelect: () => { setValue(source); clearDraft(keyOf(templateId)); } },
    'divider',
    { id: 'record', label: 'Open the record', icon: 'User01', disabled: !lead, onSelect: () => shell?.openRecord?.(lead) },
  ];
  const groups = useMemo(() => pickerGroups(data?.availability || {}, suggestion), [data, suggestion]);

  let body;
  if (leadsError && !lead) {
    body = <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>;
  } else if (!lead && !loading) {
    body = <Card><EmptyState icon="Mail01" title="That record is not here." description="It may have been deleted, or the link is old." action={{ label: 'Back', onClick: onBack }} /></Card>;
  } else if (showSkel || !lead || (!value && pv.state !== 'error')) {
    /* The skeleton mirrors the loaded screen block for block (the feel audit's fit check): the head card, the envelope card, the Edit or
       Preview switch on a phone, the subject and the preview text, the Insert field chips, three block cards, and the two footer buttons. */
    body = (
      <div className={`cp-body${desktop ? ' cp-body--split' : ''}`} aria-busy="true">
        <Stack gap={3} className="cp-col cp-col--edit cp-skel">
          <Card padding={3} className="cp-head"><Row gap={2} align="center" wrap={false}><Stack gap={0} style={{ flex: 1, minWidth: 0 }}><SkeletonBlock width={180} height={24} /><SkeletonBlock width={140} height={20} /></Stack><SkeletonBlock width={44} height={44} radius="var(--v-radius-pill)" /></Row></Card>
          <Card padding={3} className="cp-envelope">
            <ListRow.Skeleton />
            {!tplMode && <div className="cp-to cp-to--skel"><span className="cp-label">To</span><div className="cp-to-chips"><SkeletonBlock width={200} height={44} radius="var(--v-radius-pill)" /><div className="cp-to-add cp-to-add--skel"><SkeletonBlock height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={60} height={44} radius="var(--v-radius-pill)" /></div></div><SkeletonBlock width={220} height={24} /></div>}
          </Card>
          {!desktop && <SkeletonBlock height={50} radius="var(--v-radius-md)" />}
          <SkeletonBlock height={94} radius="var(--v-radius-md)" />
          <SkeletonBlock height={68} radius="var(--v-radius-md)" />
          <div className="cp-skel-chips"><span className="cp-label">Insert a field</span><div className="cp-skel-chiprow">{[153, 147, 206].map((w, i) => <SkeletonBlock key={i} width={w} height={44} radius="var(--v-radius-pill)" />)}</div></div>
          {[1, 2, 3].map(i => <Card key={i} padding={3} style={{ height: 150, boxSizing: 'border-box', overflow: 'hidden' }}><SkeletonText lines={3} /></Card>)}
        </Stack>
        {desktop && <div className="cp-col cp-col--preview"><div className="cp-pv-wait" aria-hidden="true" /></div>}
      </div>
    );
  } else if (!value && pv.state === 'error') {
    body = <Card><ErrorState title="The preview did not load." description={pv.error} onRetry={() => runPreview(templateId, null)} /></Card>;
  } else {
    const tpl = templateOf(templateId);
    const missingKeys = [...(noTo ? ['email'] : []), ...missing.filter(k => k !== 'email' || !noTo)];
    const editor = (
      <Stagger className="v-stack cp-col cp-col--edit cp-edit" style={{ gap: 'var(--v-space-3)' }} cap={6}>
        <Card padding={3} className="cp-head">
          <Row gap={2} align="center" wrap={false}>
            <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
              <span className="cp-biz lay-truncate">{tplMode ? `${templateName(templateId)} template` : lead.business}</span>
              <span className="cp-sub lay-truncate">{tplMode ? `Previewing with ${lead.business}` : project ? project.name || 'Project' : (lead.email || 'No email on the record')}</span>
            </Stack>
            {status && !status.connected && <Pill tone="neutral" label="Test mode" size="sm" icon={false} />}
            <Menu label="Email options" items={moreItems} />
          </Row>
        </Card>
        {draftOffer && (
          <Card level={2} padding={3} className="cp-draft" role="status">
            <Row gap={2} align="center" wrap>
              <span className="cp-draft-text">Pick up where you left off?</span>
              <Row gap={2}><Button size="md" onClick={() => { setValue({ subject: draftOffer.subject || '', preheader: draftOffer.preheader || '', blocks: draftOffer.blocks || [] }); setDraftOffer(null); }} className="cp-draft-pick">Pick up</Button><Button variant="ghost" size="md" onClick={() => { clearDraft(keyOf(templateId)); setDraftOffer(null); }} className="cp-draft-fresh">Start fresh</Button></Row>
            </Row>
          </Card>
        )}
        <Card padding={3} className="cp-envelope">
          <ListRow className="cp-template" leading={<Icon icon="Mail01" size="var(--v-icon-md)" />} title={templateName(templateId)} subtitle={tpl?.when || 'Pick a template'} meta={tplMode ? (data?.template?.edited ? 'Edited' : 'Default') : suggestion === templateId ? 'Suggested' : edited ? 'Edited' : ''} onClick={tplMode ? undefined : () => setPicker(true)} aria-label="Template" aria-haspopup={tplMode ? undefined : 'dialog'} />
          {!tplMode && <div className="cp-to" role="group" aria-label="To">
            <span className="cp-label">To</span>
            <div className="cp-to-chips">
              {to.map(a => <span key={a} className="cp-chip"><span className="cp-chip-text">{a}</span><IconButton icon="XClose" label={`Remove ${a}`} onClick={() => setTo(t => t.filter(x => x !== a))} className="cp-chip-x" /></span>)}
              <form className="cp-to-add" onSubmit={(e) => { e.preventDefault(); addAddress(); }}>
                <Input aria-label="Add an address" value={addTo} onChange={(e) => setAddTo(e.target.value.slice(0, 200))} placeholder="Add an address" type="email" inputMode="email" autoComplete="off" className="cp-to-input" />
                <Button variant="secondary" size="md" type="submit" disabled={!isAddress(addTo.trim())}>Add</Button>
              </form>
            </div>
            {status?.sender?.address && <Checkbox label={`Copy me, ${status.sender.address}`} checked={copyMe} onChange={setCopyMe} className="cp-copyme" />}
          </div>}
        </Card>
        {missingKeys.length > 0 && (
          <div className="cp-missing" role="status">
            <Row gap={2} align="center"><Icon icon="AlertTriangle" size={16} className="cp-missing-icon" /><span className="cp-missing-h">{tplMode ? `${lead.business} lacks` : 'Missing before this can go'}</span></Row>
            <div className="cp-missing-chips">{missingKeys.map(k => <Chip key={k} label={homeOf(k).label} icon="ArrowRight" onClick={() => jump(k)} className="cp-missing-chip" />)}</div>
          </div>
        )}
        {optedOut && <p className="cp-note" role="status">{lead.business} opted out of these emails. Only a transactional one can go.</p>}
        {isDelivery && <Checkbox label="The Drive folder is shared as Viewer" checked={driveShared} onChange={setDriveShared} className="cp-drive-shared" />}
        {!desktop && <SegmentedControl label="Edit or preview" options={MODES} value={mode} onChange={setMode} full className="cp-mode" />}
        {(desktop || mode === 'edit') && <EmailEditor value={value} onChange={setValue} vars={insertVars} />}
      </Stagger>
    );
    const preview = <EmailPreview html={data?.html || ''} text={data?.text || ''} loading={pv.state === 'loading'} stale={pv.state === 'loading'} className="cp-pv" />;
    body = (
      <div className={`cp-body${desktop ? ' cp-body--split' : ''}`}>
        {editor}
        {(desktop || mode === 'preview') && <div className="cp-col cp-col--preview">{preview}</div>}
      </div>
    );
  }

  return (
    <PageShell className="cp aa-main aa-main--wide">
      <ScrollArea wide className="cp-scroll">
        {body}
        <style>{cpStyles + emailEditorStyles + emailPreviewStyles}</style>
      </ScrollArea>
      {(showSkel || (lead && !value && pv.state !== 'error')) && (
        <StickyFooterBar className="cp-foot" aria-hidden="true">
          <Row gap={2} className="cp-foot-row" wrap><span className="cp-test"><SkeletonBlock height={44} radius="var(--v-radius-pill)" /></span><span className="cp-send-group"><SkeletonBlock height={44} radius="var(--v-radius-pill)" /><SkeletonBlock width={44} height={44} radius="var(--v-radius-pill)" /></span></Row>
        </StickyFooterBar>
      )}
      {lead && value && (
        <StickyFooterBar className="cp-foot">
          {sendError && <div className="cp-senderr" role="alert"><span className="cp-senderr-text">{sendError}</span><Button variant="ghost" size="md" onClick={() => doSend(lastOpts.current || {})} className="cp-retry">Retry</Button></div>}
          <Row gap={2} className="cp-foot-row" wrap>
            <Button variant="secondary" onClick={() => doSend({ testToSelf: true })} loading={sending === 'test'} disabled={!canTest} className="cp-test">Send test to me</Button>
            {tplMode ? <Button icon="Save01" onClick={saveDefault} disabled={!edited || !!sending} className="cp-save-default">Save as default</Button> : <div className="cp-send-group">
              <Button icon="Send01" onClick={() => send({})} loading={sending === 'send' || sending === 'later'} disabled={!canSend} className="cp-send">Send</Button>
              <Menu label="Send options" items={[{ id: 'later', label: 'Send tomorrow at 9am', icon: 'Clock', disabled: !canSend, onSelect: () => send({ sendAt: tomorrowNine() }) }]} trigger={<IconButton icon="ChevronDown" label="Send options" variant="secondary" disabled={!canSend} className="cp-send-more" />} />
            </div>}
          </Row>
        </StickyFooterBar>
      )}
      {picker && (
        <Sheet open onClose={() => setPicker(false)} title="Pick a template" label="Pick a template" tall width={480} className="cp-picker">
          <Stack gap={4}>
            {groups.map(g => (
              <Stack key={g.id} gap={1} role="group" aria-label={g.label}>
                <span className="cp-group-h">{g.label}</span>
                {g.rows.map(r => (
                  <ListRow key={r.id} title={r.name} subtitle={r.available ? r.when : lackingLine(r.lacking)} meta={r.id === templateId ? 'Current' : !r.available ? 'Not ready' : r.class === 'marketing' ? 'Marketing' : ''} selected={r.id === templateId} onClick={r.available ? () => pickTemplate(r.id) : undefined} chevron={false} className={`cp-pick${r.available ? '' : ' cp-pick--off'}`} aria-label={r.available ? r.name : `${r.name}, ${lackingLine(r.lacking)}`} />
                ))}
              </Stack>
            ))}
          </Stack>
        </Sheet>
      )}
      {confirmReq && (
        <Sheet open onClose={() => setConfirmReq(null)} title={confirmReq.kind === 'duplicate' ? 'Send it again?' : 'Send this email?'} label="Confirm the send" width={440}
          footer={<><Button variant="ghost" onClick={() => setConfirmReq(null)}>Cancel</Button><Button icon="Send01" onClick={() => { const o = confirmReq.opts; setConfirmReq(null); doSend(o); }} className="cp-confirm-send">{confirmReq.opts.sendAt ? 'Queue it' : 'Send'}</Button></>}>
          <Stack gap={3}>
            <p className="cp-confirm-msg">{confirmReq.message}</p>
            <div className="cw-kv"><span className="dt-fact-label">To</span><span className="cp-kv-val">{(to || []).join(', ')}{copyMe && status?.sender?.address ? `, copy to ${status.sender.address}` : ''}</span></div>
            <div className="cw-kv"><span className="dt-fact-label">Subject</span><span className="cp-kv-val">{data?.subject || value?.subject}</span></div>
            {confirmReq.opts.sendAt && <div className="cw-kv"><span className="dt-fact-label">When</span><span className="cp-kv-val">Tomorrow at 9am</span></div>}
            {status && !status.connected && <p className="cp-note">Email is not connected yet, so this is a test send: the record is stamped and nothing leaves.</p>}
          </Stack>
        </Sheet>
      )}
      {confirmDialog}
    </PageShell>
  );
}

const cpStyles = `
  .cp-head, .cp-envelope { gap: var(--v-space-3); }
  .cp-head .v-menu, .cp-head .v-menu-trig { flex-shrink: 0; }
  .cp-biz { font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .cp-sub { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .cp-body { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  .cp-body--split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--v-space-6); align-items: start; }
  .cp-col { min-width: 0; }
  .cp-body--split .cp-col--preview { position: sticky; top: 0; }
  .cp-draft { gap: 0; }
  .cp-draft-text { flex: 1; min-width: 0; font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .cp-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .cp-to { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .cp-to-chips { display: flex; flex-wrap: wrap; gap: var(--v-space-2); align-items: center; min-width: 0; }
  .cp-chip { display: inline-flex; align-items: center; gap: 2px; min-height: var(--v-tap); padding-left: var(--v-space-3); border-radius: var(--v-radius-pill); border: 1px solid var(--v-border); background: var(--v-surface-2); color: var(--v-text); max-width: 100%; }
  .cp-chip-text { font-size: var(--v-text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .cp-to-add { display: flex; gap: var(--v-space-2); align-items: flex-end; flex: 1 1 240px; min-width: 0; }
  .cp-to-input { flex: 1; min-width: 0; }
  .cp-missing { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); border-radius: var(--v-radius-md); border: 1px solid var(--v-status-new-border, var(--v-border)); background: var(--v-status-new-bg, var(--v-surface-2)); }
  .cp-missing-icon { color: var(--v-status-new-text); flex-shrink: 0; }
  .cp-missing-h { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .cp-missing-chips { display: flex; flex-wrap: wrap; gap: var(--v-space-2); }
  .cp-note { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .cp-foot { gap: var(--v-space-2); }
  .cp-foot-row { width: 100%; max-width: var(--lay-content-max, 1120px); }
  .cp-test { flex: 1 1 150px; }
  .cp-send-group { display: flex; flex: 1 1 150px; gap: 2px; min-width: 0; }
  .cp-send-group > .v-skel:first-child { flex: 1; }
  .cp-send { flex: 1; }
  .cp-senderr { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); color: var(--v-status-danger-text); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .cp-senderr-text { min-width: 0; overflow-wrap: anywhere; }
  .cp-group-h { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); padding: var(--v-space-1) 0; }
  .cp-pick--off .v-lrow-title { color: var(--v-text-2); }
  .cp-pv-wait { min-height: 420px; border-radius: var(--v-radius-md); border: 1px dashed var(--v-border); background: var(--v-surface-1); }
  .cp-to--skel { min-height: 176px; }
  .cp-to-add--skel { flex: 1 1 100%; }
  .cp-skel-chips { display: flex; flex-direction: column; gap: var(--v-space-1); }
  .cp-skel-chiprow { display: flex; gap: var(--v-space-2); overflow: hidden; }
  .cp-confirm-msg { margin: 0; color: var(--v-text); }
  .cp-kv-val { color: var(--v-text); overflow-wrap: anywhere; }
  .cp-skel { min-width: 0; }
`;
