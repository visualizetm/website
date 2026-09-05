import { useEffect, useMemo, useState } from 'react';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Chip, Pill, Avatar, Input, Button, IconButton, Menu, InlineEdit, ListRow, Sheet, Table, EmptyState, ErrorState, Stagger, IconTile, SkeletonBlock, RecordSkeleton, useDelayedLoading, useMediaQuery, useToast, useConfirm, useRetry,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar, useShell } from '../shell/ShellContext';
import LeadPicker from '../components/LeadPicker';
import LeadForm from '../components/LeadForm';
import { defaultLead } from './AdminCalls';
import { SUBMISSION_TYPES, LEAD_STATUSES, submissionTypeOf } from '../shared/semantics';
import { fmtDate, fmtDateTime, relativeTime } from '../shared/dates';
import { formatPhone, telHref } from '../shared/phone';

/* Submissions (Prompt 12): every website form submission on the kit. Chips by
 * type, unread, search, cards or Table, a detail panel or Sheet, Mark read,
 * Link to lead, Convert to lead, and the readable brief for start forms. */

const DASH = '\u2014'; // the old form stored this placeholder for a missing phone
const hasPhone = (s) => !!s.phone && s.phone !== DASH;
const fields = (s) => Object.entries(s.fields || {}).filter(([, v]) => v !== '' && v != null);
const firstLine = (s) => { const f = fields(s)[0]; return f ? `${f[0]}: ${String(f[1]).slice(0, 80)}` : s.projectType || ''; };
export function matchesSubmission(s, q) { const n = String(q || '').trim().toLowerCase(); if (!n) return true; return [s.name, s.business, s.email, s.phone, s.projectType, ...fields(s).map(([k, v]) => `${k} ${v}`)].join(' ').toLowerCase().includes(n); }
/** The brief as plain text (what the intake skill reads). */
export function briefText(s) {
  const head = [`Brief: ${s.business || s.name}`, s.name && s.business ? `Name: ${s.name}` : '', s.email ? `Email: ${s.email}` : '', s.phone ? `Phone: ${s.phone}` : '', s.projectType ? `Project type: ${s.projectType}` : '', s.createdAt ? `Received: ${fmtDateTime(s.createdAt)}` : ''].filter(Boolean);
  return [...head, '', ...fields(s).flatMap(([k, v]) => [k, String(v), ''])].join('\n').trim();
}
const copyText = async (toast, text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error(COPY.error.copy); } };

export function SubmissionCard({ sub: s, onOpen, selected, compact = false }) {
  return (
    <Card padding={3} interactive onClick={onOpen} selected={selected} className={`sb-card${s.read ? '' : ' is-unread'}${compact ? ' sb-card--compact' : ''}`} aria-label={`Open submission from ${s.business || s.name}`}>
      <Row gap={2} align="center"><Avatar name={s.business || s.name} size="sm" /><span className="sb-card-name lay-truncate">{s.business || s.name}</span>{!s.read && <Pill tone="won" label="Unread" size="sm" variant="solid" icon={false} />}<Pill id={s.type} list={SUBMISSION_TYPES} size="sm" variant="outline" /></Row>
      {!compact && <><span className="sb-card-line lay-truncate">{firstLine(s)}</span><Row gap={2} wrap className="sb-card-meta"><span>{s.name}</span><span>{relativeTime(s.createdAt)}</span><Pill id={s.status} list={LEAD_STATUSES} size="sm" icon={false} /></Row></>}
    </Card>
  );
}
SubmissionCard.Skeleton = function SubmissionCardSkeleton() { return <Card padding={3} aria-busy="true"><Row gap={2}><SkeletonBlock width={32} height={32} radius="50%" /><SkeletonBlock width="50%" height={14} /><SkeletonBlock width={60} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonBlock width="80%" height={12} /><SkeletonBlock width="40%" height={12} /></Card>; };

function SubmissionDetail({ sub: s, leads, onPatch, onPatchRaw, onDelete, onLinkLead, onPatchLead, onCreateLead, onClose }) {
  const shell = useShell();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [pick, setPick] = useState(false);
  const [convert, setConvert] = useState(false);
  const [brief, setBrief] = useState(false);
  const [pendingLink, setPendingLink] = useState(null);
  const linked = s.linkedLeadId ? leads.find(l => String(l._id) === String(s.linkedLeadId)) : null;
  useEffect(() => { if (!pendingLink) return; const l = leads.find(x => x.business === pendingLink); if (l) { onLinkLead(s._id, String(l._id)); setPendingLink(null); toast.success(`${l.business} created and linked.`); } }, [leads, pendingLink]); // eslint-disable-line react-hooks/exhaustive-deps
  const link = async (lead) => {
    setPick(false);
    await onLinkLead(s._id, String(lead._id));
    if (!lead.email && s.email && onPatchLead) await onPatchLead(lead._id, { email: s.email });
    toast.success(`Linked to ${lead.business}.`);
  };
  const del = async () => { if (await confirm({ title: `Delete this submission from ${s.business || s.name}?`, body: 'It moves to Recently deleted in Settings and can be restored for 30 days.', danger: true, confirmLabel: 'Delete' })) { const ok = await onDelete([s._id]); if (ok === false) toast.error(COPY.error.del); else onClose?.(); } };
  const prefill = { business: s.business || '', askFor: s.name || '', phone: s.phone || '', email: s.email || '', descriptor: s.projectType ? `${s.projectType} brief from the site` : 'From the website form', angle: fields(s).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join('\n') };
  return (
    <div className="sb-detail">
    <Stagger className="v-stack" style={{ gap: 'var(--v-space-4)' }}>
      <Card className="sb-head">
        <Row gap={3} align="start">
          <Avatar name={s.business || s.name} size="lg" />
          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <h2 className="sb-name">{s.business || s.name}</h2>
            <Row gap={1} wrap><Pill id={s.type} list={SUBMISSION_TYPES} size="sm" /><Menu label="Change status" trigger={<button type="button" className="dt-pillbtn" aria-label={`Status ${s.status}, change`}><Pill id={s.status} list={LEAD_STATUSES} size="sm" /></button>} items={LEAD_STATUSES.map(x => ({ id: x.id, label: x.label, icon: x.icon, disabled: x.id === s.status, onSelect: () => onPatch(s._id, { status: x.id }) }))} />{!s.read && <Pill tone="won" label="Unread" size="sm" variant="solid" icon={false} />}</Row>
            <span className="dt-muted">{s.name}{s.projectType ? `, ${s.projectType}` : ''}, {fmtDateTime(s.createdAt)}</span>
          </Stack>
          {onClose && <IconButton icon={XClose} label="Close" variant="ghost" onClick={onClose} />}
        </Row>
        <Row gap={1} wrap>
          <Button variant="secondary" size="md" icon="Mail01" href={s.email ? `mailto:${s.email}` : undefined} disabled={!s.email} className="sb-email">{s.email || 'No email'}</Button>
          <Button variant="secondary" size="md" icon="Phone" href={hasPhone(s) ? telHref(s.phone) : undefined} disabled={!hasPhone(s)}>{hasPhone(s) ? formatPhone(s.phone) || s.phone : 'No phone'}</Button>
          <Button variant="ghost" size="md" icon={s.read ? 'Mail01' : 'Check'} onClick={() => onPatch(s._id, { read: !s.read })} className="sb-read">{s.read ? 'Mark unread' : 'Mark read'}</Button>
        </Row>
        <Row gap={1} wrap>
          {linked ? <Button variant="secondary" size="md" icon="Users01" onClick={() => shell?.openRecord(linked)}>Open {linked.business}</Button> : <Button variant="secondary" size="md" icon="Users01" onClick={() => setPick(true)} className="sb-link">Link to lead</Button>}
          {linked && <Button variant="ghost" size="md" onClick={() => setPick(true)}>Change link</Button>}
          {!linked && <Button variant="secondary" size="md" icon="Plus" onClick={() => setConvert(true)} className="sb-convert">Convert to lead</Button>}
          {s.type === 'start' && <Button size="md" icon="File06" onClick={() => setBrief(true)} className="sb-open-brief">Open brief</Button>}
          <span style={{ flex: 1 }} />
          <IconButton icon={Trash01} label="Delete" variant="danger" onClick={del} />
        </Row>
      </Card>
      <Card>
        <p className="pb-card-h">{s.type === 'shop-order' ? 'Order' : s.type === 'review' ? 'Review' : 'Answers'}</p>
        {fields(s).length ? <Stack gap={1}>{fields(s).map(([k, v]) => <ListRow key={k} title={k} subtitle={String(v)} chevron={false} className="sb-field" />)}</Stack> : <EmptyState size="sm" icon="Inbox01" title={COPY.empty['submissions.fields'].title} description={COPY.empty['submissions.fields'].description} />}
      </Card>
      <Card><p className="pb-card-h">Private notes</p><InlineEdit value={s.notes || ''} onSave={(v) => (onPatchRaw || onPatch)(s._id, { notes: v })} multiline placeholder="Only you can see these." label="Private notes" /></Card>
    </Stagger>
      {confirmDialog}
      {pick && <LeadPicker leads={leads} title="Link to lead" description="The lead gets this email if it has none." onClose={() => setPick(false)} onPick={link} />}
      {convert && <Sheet open onClose={() => setConvert(false)} title="Convert to lead" description="Prefilled from the submission. The lead is linked back when it is created." tall width={640}><LeadForm creating lead={prefill} onSave={async (f) => { const ok = await onCreateLead(defaultLead(f)); if (ok) { setConvert(false); setPendingLink(f.business); } else toast.error(COPY.error.create); }} onCancel={() => setConvert(false)} /></Sheet>}
      {brief && (
        <Sheet open onClose={() => setBrief(false)} title={`Brief: ${s.business || s.name}`} description={[s.name, s.projectType, fmtDate(s.createdAt)].filter(Boolean).join(', ')} tall width={640} className="sb-brief-sheet"
          footer={<><Button variant="ghost" onClick={() => setBrief(false)}>Close</Button><Button icon={Copy01} onClick={() => copyText(toast, briefText(s), 'Brief')} className="sb-copy-brief">Copy brief</Button></>}>
          <Stack gap={3} className="sb-brief">
            <p className="sb-brief-contact">{[s.email, hasPhone(s) ? formatPhone(s.phone) || s.phone : ''].filter(Boolean).join(', ')}</p>
            {fields(s).map(([k, v]) => <div key={k} className="sb-brief-q"><p className="sb-brief-k">{k}</p><p className="sb-brief-a">{String(v)}</p></div>)}
            {!fields(s).length && <p className="dt-muted">This submission carries no answers.</p>}
          </Stack>
        </Sheet>
      )}
    </div>
  );
}

export default function AdminSubmissions({ items = [], loading, error, onRetry, leads = [], onPatch, onDelete, onLinkLead, onPatchLead, onCreateLead, onRefresh, openId }) {
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const E = (k) => COPY.empty[k];
  const patch = async (id, set) => { const ok = await onPatch(id, set); if (!ok) toast.error(COPY.error.save); return ok; };
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [selId, setSelId] = useState(null);
  const [type, setType] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState('');
  const showSkel = useDelayedLoading(loading);
  const pending = loading && !showSkel;
  useTopBar(null);
  useEffect(() => { if (openId?.id) setSelId(openId.id); }, [openId]);
  const live = useMemo(() => items.filter(s => !s.deleted), [items]);
  const counts = useMemo(() => Object.fromEntries(SUBMISSION_TYPES.map(t => [t.id, live.filter(s => (s.type || 'other') === t.id).length])), [live]);
  const unread = live.filter(s => !s.read).length;
  const list = useMemo(() => live.filter(s => (!type || (s.type || 'other') === type) && (!unreadOnly || !s.read) && matchesSubmission(s, q)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [live, type, unreadOnly, q]);
  const sel = selId ? live.find(s => String(s._id) === String(selId)) : null;
  const columns = [
    { id: 'from', label: 'From', always: true, render: (s) => <span className="cl-cell-biz"><Avatar name={s.business || s.name} size="sm" /><span className="lay-truncate">{s.business || s.name}</span>{!s.read && <span className="sb-dot" aria-label="Unread" />}</span> },
    { id: 'name', label: 'Name', render: (s) => s.name },
    { id: 'type', label: 'Type', width: 120, render: (s) => <Pill id={s.type} list={SUBMISSION_TYPES} size="sm" variant="outline" /> },
    { id: 'status', label: 'Status', width: 120, render: (s) => <Pill id={s.status} list={LEAD_STATUSES} size="sm" /> },
    { id: 'first', label: 'Detail', render: (s) => firstLine(s) },
    { id: 'date', label: 'Received', render: (s) => fmtDateTime(s.createdAt) },
  ];
  const pendingOpen = !!openId?.id && loading && !sel;
  const detail = pendingOpen ? (showSkel && <RecordSkeleton cards={2} />) : sel && <SubmissionDetail sub={sel} leads={leads} onPatch={patch} onPatchRaw={onPatch} onDelete={onDelete} onLinkLead={onLinkLead} onPatchLead={onPatchLead} onCreateLead={onCreateLead} onClose={desktop ? () => setSelId(null) : undefined} />;
  const panelOpen = !!sel || pendingOpen;
  return (
    <PageShell className={`aa-main aa-main--wide po-shell sb-shell${panelOpen && desktop ? ' has-panel' : ''}`}>
      <div className="po-split">
        <ScrollArea wide className="po-page">
          <Section title="Submissions" loading={loading} description={loading ? undefined : `${live.length} submission${live.length === 1 ? '' : 's'}, ${unread} unread`}>
            <Stack gap={2}>
              <Input className="cl-search" placeholder="Search name, business, email, answers" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search submissions" trailing={q ? <button type="button" className="cl-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={14} height={14} /></button> : undefined} />
              <Row gap={2} wrap className="sb-chips"><Chip label="All" count={live.length} selected={!type && !unreadOnly} onClick={() => { setType(''); setUnreadOnly(false); }} /><Chip label="Unread" count={unread} icon="Bell01" selected={unreadOnly} onClick={() => setUnreadOnly(v => !v)} />{SUBMISSION_TYPES.map(t => <Chip key={t.id} label={t.label} count={counts[t.id]} icon={t.icon} selected={type === t.id} onClick={() => setType(type === t.id ? '' : t.id)} />)}</Row>
            </Stack>
          </Section>
          {pending ? null : showSkel ? (
            desktop && !panelOpen ? <Table.Skeleton rows={6} cols={6} selectable={false} /> : <Stack gap={2} aria-busy="true">{[1, 2, 3, 4].map(i => <SubmissionCard.Skeleton key={i} />)}</Stack>
          ) : error && !items.length ? (
            <Card><ErrorState title={COPY.error.submissions.title} description={COPY.error.submissions.description} onRetry={retry} retrying={retrying} /></Card>
          ) : !live.length ? (
            <Card><EmptyState icon="Inbox01" title={E('submissions.none').title} description={E('submissions.none').description} action={{ label: E('submissions.none').action, href: 'https://visualizestudio.org/start' }} /></Card>
          ) : !list.length ? (
            <Card><EmptyState size="sm" icon="SearchMd" title={E('submissions.filter').title} description={E('submissions.filter').description} action={{ label: E('submissions.filter').action, onClick: () => { setType(''); setUnreadOnly(false); setQ(''); } }} /></Card>
          ) : desktop && !sel ? (
            <Table aria-label="Submissions" columns={columns} rows={list} rowKey={(s) => String(s._id)} onRowClick={(s) => setSelId(s._id)} rowClassName={(s) => (s.read ? '' : 'is-unread')} storageKey="vz_subs_cols" className="sb-table" />
          ) : (
            <Stagger className="cl-stack">{list.map(s => <SubmissionCard key={s._id} sub={s} onOpen={() => setSelId(s._id)} selected={sel && String(sel._id) === String(s._id)} compact={!!sel && desktop} />)}</Stagger>
          )}
          {!loading && <Row gap={2} justify="end"><Button variant="ghost" size="md" icon="RefreshCw01" onClick={onRefresh}>Refresh</Button></Row>}
        </ScrollArea>
        {panelOpen && desktop && <aside className="po-panel"><ScrollArea bare className="po-panel-scroll">{detail}</ScrollArea></aside>}
      </div>
      {panelOpen && !desktop && <Sheet open onClose={() => setSelId(null)} title={sel ? (sel.business || sel.name) : <SkeletonBlock width={140} height={22} />} description={sel ? submissionTypeOf(sel.type).label : <SkeletonBlock width={120} height={14} />} tall width={520}>{detail}</Sheet>}
      <style>{sbStyles}</style>
    </PageShell>
  );
}

const sbStyles = `
  .sb-card { gap: var(--v-space-2); text-align: left; align-items: stretch; }
  .sb-card.is-unread { border-color: var(--v-border-strong); }
  .sb-card-name { flex: 1; min-width: 0; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .sb-card-line { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .sb-card-meta { font-size: var(--v-text-xs); color: var(--v-text-3); align-items: center; }
  .sb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--v-red); flex-shrink: 0; }
  .sb-table .v-tr.is-unread .v-td:first-child { font-weight: var(--v-weight-bold); }
  .sb-detail { min-width: 0; }
  .sb-head { gap: var(--v-space-3); }
  .sb-name { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); overflow-wrap: anywhere; }
  .sb-email { max-width: 100%; }
  .sb-email .v-btn-label { overflow: hidden; text-overflow: ellipsis; }
  .sb-field .v-lrow-sub { white-space: pre-wrap; overflow-wrap: anywhere; }
  .sb-field .v-lrow-title { font-size: var(--v-text-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; color: var(--v-text-3); }
  .sb-brief { min-width: 0; }
  .sb-brief-contact { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .sb-brief-q { display: flex; flex-direction: column; gap: var(--v-space-1); padding-bottom: var(--v-space-3); border-bottom: 1px solid var(--v-border); }
  .sb-brief-q:last-child { border-bottom: 0; }
  .sb-brief-k { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .sb-brief-a { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text); white-space: pre-wrap; overflow-wrap: anywhere; }
`;
