import { useState, useMemo, useEffect, useRef } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Upload01 from '@untitled-ui/icons-react/build/esm/Upload01';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import {
  PageShell, ScrollArea, StickyFooterBar, ConfirmDialog, Section, Row, Stack, Card, Button, Input, Select, Chip, SegmentedControl,
  Pill, Pill as UiPill, Avatar, Menu, Popover, Checkbox, Modal, Table, EmptyState, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery, DESKTOP_QUERY, useToast,
} from '../ui';
import { useTopBar, useShell } from '../shell/ShellContext';
import LeadCard, { leadMenuItems } from '../components/LeadCard';
import LeadForm from '../components/LeadForm';
import LeadDetail from '../components/LeadDetail';
import {
  EMPTY_FILTERS, openLeads, findDuplicates, applyFilters, countFor, industryFacets, sortLeads, SORTS, isNewLead, lastCall, conflicts, mergePayload, leadsToCsv,
} from '../lib/leads';
import { apiFetch } from '../shared/api';
import LeadImport from '../components/LeadImport';
import { normalizeSocials } from '../lib/socials';
import { formatPhone } from '../shared/phone';
import { effectiveStage, checklistProgress, deleteBlockReason } from '../lib/booked';
import { CALL_STATUSES as SEM_CALL_STATUSES, PRIORITIES, callStatusOf, industryKey, displayIndustry } from '../shared/semantics';
import { fmtDateTime, fmtDate, relativeTime, todayInput } from '../shared/dates';
import { telHref } from '../shared/phone';
import { defaultLead } from './AdminCalls';

// Status/priority/outcome maps: src/shared/semantics.js (one source of truth).
const CALL_STATUSES = SEM_CALL_STATUSES.filter(x => x.id !== 'booked');


/* ── Leads list screen (Prompt 6): kanban, table, cards, filters, bulk, duplicates ── */

const VIEW_KEY = 'vz_leads_view';
const VIEWS_KEY = 'vz_leads_views';
const DEFAULT_VIEWS = [
  { id: 'v-tocall', name: 'To call', filters: { ...EMPTY_FILTERS, status: ['not-called'] }, q: '', sort: { id: 'priority', dir: 'asc' } },
  { id: 'v-callbacks', name: 'Callbacks', filters: { ...EMPTY_FILTERS, status: ['callback'] }, q: '', sort: { id: 'lastCall', dir: 'desc' } },
  { id: 'v-hot', name: 'Hot leads', filters: { ...EMPTY_FILTERS, prio: ['hot'] }, q: '', sort: { id: 'added', dir: 'desc' } },
];
const BOARD_STATUSES = CALL_STATUSES; // not-called, callback, no-answer, no (booked leaves the board)
const PAGE = 60;
const DATA_CHIPS = [['phone', 'Has phone'], ['socials', 'Has socials'], ['never', 'Never scanned'], ['dupes', 'Possible duplicates']];
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fine */ } };
const sameFilters = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function FilterRow({ label, options, values, onChange, more }) {
  return (
    <div className="ld-frow">
      <span className="ld-frow-label">{label}</span>
      <div className="ld-frow-chips">
        {options.map(o => <Chip key={o.id} label={o.label} count={o.count} icon={o.icon} selected={values.includes(o.id)} onClick={() => onChange(values.includes(o.id) ? values.filter(v => v !== o.id) : [...values, o.id])} />)}
        {more}
      </div>
    </div>
  );
}

function KanbanColumn({ status, leads, total, collapsed, onToggle, onMore, onStartSession, cardProps, dropping, dragHandlers, stagger }) {
  const items = leads.map(l => <LeadCard key={l._id} lead={l} {...cardProps(l)} {...dragHandlers(l)} />);
  return (
    <section className={`ld-col${collapsed ? ' is-collapsed' : ''}${dropping ? ' is-dropping' : ''}`} data-col={status.id} aria-label={`${status.label}, ${total}`}>
      <header className="ld-col-head">
        {collapsed ? (
          <button type="button" className="ld-col-strip" onClick={onToggle} aria-label={`Expand ${status.label}`}><Pill id={status.id} list={CALL_STATUSES} size="sm" dot /><span className="ld-col-n">{total}</span></button>
        ) : (
          <>
            <Pill id={status.id} list={CALL_STATUSES} size="sm" />
            <span className="ld-col-n">{total}</span>
            <span style={{ flex: 1 }} />
            <Menu label={`${status.label} column`} items={[{ id: 'session', label: 'Start session with these', icon: 'PhoneCall01', disabled: !total, onSelect: onStartSession }, { id: 'collapse', label: 'Collapse column', icon: 'ChevronLeft', onSelect: onToggle }]} />
          </>
        )}
      </header>
      {!collapsed && (
        <div className="ld-col-body">
          {stagger ? <Stagger className="ld-col-stack">{items}</Stagger> : <div className="ld-col-stack">{items}</div>}
          {leads.length < total && <Button variant="ghost" onClick={onMore} full>Show more ({total - leads.length} left)</Button>}
          {!total && <p className="ld-col-empty">Nothing here.</p>}
        </div>
      )}
    </section>
  );
}

function MergeModal({ group, onClose, onMerge }) {
  const [winnerId, setWinnerId] = useState(group.leads[0]._id);
  const winner = group.leads.find(l => l._id === winnerId);
  const loser = group.leads.find(l => l._id !== winnerId) || group.leads[1];
  const fields = useMemo(() => conflicts(winner, loser), [winner, loser]);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setChoice({}); }, [winnerId]);
  const show = (f, v) => (f.show ? f.show(v) : String(v ?? '')) || 'empty';
  return (
    <Modal open onClose={onClose} title="Merge duplicates" size="md" description={`${group.reason === 'phone' ? 'Same phone number' : 'Same business name and industry'}. The winner keeps its record; calls, contacts, purchases, and notes from both are combined.`}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button icon="GitMerge" loading={busy} onClick={async () => { setBusy(true); try { await onMerge(winner, loser, choice); } finally { setBusy(false); } }}>Merge into {winner.business}</Button></>}>
      <div className="ld-merge-pick" role="radiogroup" aria-label="Keep which record">
        {group.leads.slice(0, 2).map(l => (
          <label key={l._id} className={`ld-merge-lead${l._id === winnerId ? ' is-on' : ''}`}>
            <input type="radio" name="winner" checked={l._id === winnerId} onChange={() => setWinnerId(l._id)} />
            <Avatar name={l.business} size="sm" />
            <span className="ld-merge-lead-text"><strong>{l.business}</strong><span>{formatPhone(l.phone) || 'no phone'}, {(l.callLog || []).length} call{(l.callLog || []).length === 1 ? '' : 's'}, added {fmtDate(l.createdAt)}</span></span>
            {l._id === winnerId && <Pill tone="booked" label="Keeps its id" size="sm" icon={false} />}
          </label>
        ))}
      </div>
      {fields.length ? (
        <div className="ld-merge-fields">
          {fields.map(f => (
            <div key={f.id} className="ld-merge-field" role="radiogroup" aria-label={f.label}>
              <span className="ld-merge-flabel">{f.label}</span>
              {[['a', winner], ['b', loser]].map(([side, l]) => (
                <label key={side} className={`ld-merge-opt${(choice[f.id] || 'a') === side ? ' is-on' : ''}`}>
                  <input type="radio" name={`f-${f.id}`} checked={(choice[f.id] || 'a') === side} onChange={() => setChoice(c => ({ ...c, [f.id]: side }))} />
                  <span>{show(f, l[f.id])}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      ) : <p className="ld-muted">No conflicting fields. Everything from {loser.business} folds into {winner.business}.</p>}
    </Modal>
  );
}

export default function AdminLeads({
  leads, submissions, loading, onPatch, onCreate, onDelete, onBulkDelete, onRestore, onRefresh,
  onLinkSubmission, onMobileOpen, onMobileClose, onGo, openId, createPreset, filterPreset,
}) {
  const shell = useShell();
  const toast = useToast();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ id: 'added', dir: 'desc' });
  const [view, setView] = useState(() => readLS(VIEW_KEY, null));
  const [views, setViews] = useState(() => { const v = readLS(VIEWS_KEY, null); if (v) return v; writeLS(VIEWS_KEY, DEFAULT_VIEWS); return DEFAULT_VIEWS; });
  const [selId, setSelId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState(() => new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [shown, setShown] = useState({});
  const [industryMore, setIndustryMore] = useState(false);
  const industryMoreRef = useRef(null);
  const [mergeGroup, setMergeGroup] = useState(null);
  const [drag, setDrag] = useState(null); // { id, x, y, over }
  const dragTimer = useRef(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const showSkel = useDelayedLoading(loading && !leads.length);
  const mode = view || (desktop ? 'kanban' : 'list');
  const setMode = (m) => { setView(m); writeLS(VIEW_KEY, m); };

  const pool = useMemo(() => openLeads(leads), [leads]);
  const dupes = useMemo(() => findDuplicates(pool), [pool]);
  const filtered = useMemo(() => applyFilters(pool, filters, q, dupes.ids), [pool, filters, q, dupes]);
  const sorted = useMemo(() => sortLeads(filtered, sort), [filtered, sort]);
  const facets = useMemo(() => industryFacets(applyFilters(pool, filters, q, dupes.ids, 'industry')), [pool, filters, q, dupes]);
  const count = (g, v) => countFor(pool, filters, q, dupes.ids, g, v);
  const toCall = pool.filter(l => (l.callStatus || 'not-called') === 'not-called').length;
  const activeCount = filters.status.length + filters.prio.length + filters.industry.length + filters.data.length + (q ? 1 : 0);
  const setGroup = (g) => (vals) => setFilters(f => ({ ...f, [g]: vals }));
  const clearAll = () => { setFilters(EMPTY_FILTERS); setQ(''); };

  const sel = selId ? pool.find(l => l._id === selId) : null;
  const pick = (id) => { setSelId(id); setCreating(false); onMobileOpen?.(); };
  const back = () => { setSelId(null); setCreating(false); onMobileClose?.(); };
  useEffect(() => { if (openId?.id) { setSelId(openId.id); setCreating(false); onMobileOpen?.(); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (createPreset) { setCreating(true); setSelId(null); onMobileOpen?.(); } }, [createPreset]); // eslint-disable-line react-hooks/exhaustive-deps
  // Filter preset from the shell: { status, prio, industry }. Missing keys clear that filter; {} clears everything.
  useEffect(() => {
    if (!filterPreset) return;
    const p = filterPreset.preset || {};
    setFilters({ ...EMPTY_FILTERS, status: p.status || [], prio: p.prio || [], industry: p.industry && p.industry !== 'all' ? [industryKey(p.industry)] : [] });
    setQ(''); setSelId(null); setCreating(false); onMobileClose?.();
  }, [filterPreset]); // eslint-disable-line react-hooks/exhaustive-deps
  useTopBar(creating ? { title: 'New lead', back } : sel ? { title: sel.business, back } : null);

  // Writes: AdminApp's onPatch is already optimistic with rollback; this adds the error toast.
  const patch = async (id, set, fail = 'Could not save. Your change was undone.') => { const ok = await onPatch(id, set); if (!ok) toast.error(fail); return ok; };
  const bulkPatch = async (ids, set, label) => { const rs = await Promise.all(ids.map(id => onPatch(id, set))); const bad = rs.filter(r => !r).length; if (bad) toast.error(`${bad} of ${ids.length} could not be ${label}. Those were undone.`); else toast.success(`${ids.length} lead${ids.length === 1 ? '' : 's'} ${label}.`); };
  const cardActions = (l) => ({ onPriority: (p) => patch(l._id, { priority: p }), onStatus: (s) => patch(l._id, { callStatus: s }), onDelete: () => { setChecked(new Set([l._id])); setBulkConfirm(true); } });
  const toggleCheck = (id, on) => setChecked(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  const cardProps = (l) => ({ onOpen: () => pick(l._id), selected: sel?._id === l._id, selectable: selectMode || checked.size > 0, checked: checked.has(l._id), onCheck: (v) => toggleCheck(l._id, v), actions: cardActions(l) });

  // Bulk
  const checkedLeads = pool.filter(l => checked.has(l._id));
  const deletable = checkedLeads.filter(l => !deleteBlockReason(l));
  const blockedCount = checkedLeads.length - deletable.length;
  const runBulkDelete = async () => {
    setBulkConfirm(false);
    const ids = deletable.map(l => l._id);
    if (ids.length) {
      const ok = await onBulkDelete(ids);
      if (!ok) { toast.error('Delete failed. Nothing was removed.'); return; }
      if (sel && ids.includes(sel._id)) back();
      toast.undo(`Deleted ${ids.length} lead${ids.length === 1 ? '' : 's'}${blockedCount ? `, skipped ${blockedCount} protected` : ''}.`, () => onRestore?.(ids), { seconds: 6 });
    }
    setChecked(new Set()); setSelectMode(false);
  };
  const exportCsv = () => {
    const cols = [{ id: 'business', label: 'Business' }, { id: 'industry', label: 'Industry' }, { id: 'priority', label: 'Priority' }, { id: 'callStatus', label: 'Status' }, { id: 'phone', label: 'Phone', csv: (l) => formatPhone(l.phone) }, { id: 'askFor', label: 'Contact' }, { id: 'area', label: 'Area' }, { id: 'website', label: 'Website', csv: (l) => l.socials?.website || '' }, { id: 'lastCall', label: 'Last call', csv: (l) => (lastCall(l) ? `${fmtDateTime(lastCall(l).at)} ${lastCall(l).outcome}` : '') }, { id: 'calls', label: 'Calls', csv: (l) => (l.callLog || []).length }, { id: 'createdAt', label: 'Added', csv: (l) => fmtDate(l.createdAt) }];
    const rows = checkedLeads.length ? checkedLeads : sorted;
    const blob = new Blob([leadsToCsv(rows, cols)], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `leads-${todayInput()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}.`);
  };
  const addToSession = () => { shell.go('calls', { ids: checkedLeads.map(l => l._id) }); };

  // Saved views
  const applyView = (v) => { setFilters({ ...EMPTY_FILTERS, ...v.filters }); setQ(v.q || ''); if (v.sort) setSort(v.sort); };
  const activeView = views.find(v => sameFilters({ ...EMPTY_FILTERS, ...v.filters }, filters) && (v.q || '') === q);
  const saveView = () => { const name = viewName.trim(); if (!name) return; const next = [...views, { id: `v-${Date.now()}`, name, filters, q, sort }]; setViews(next); writeLS(VIEWS_KEY, next); setSaveOpen(false); setViewName(''); toast.success(`Saved view "${name}".`); };
  const viewMenu = (v) => [
    { id: 'rename', label: 'Rename', icon: 'Edit02', onSelect: () => { const name = window.prompt('View name', v.name); if (name?.trim()) { const next = views.map(x => x.id === v.id ? { ...x, name: name.trim() } : x); setViews(next); writeLS(VIEWS_KEY, next); } } },
    { id: 'update', label: 'Update with current filters', icon: 'Check', onSelect: () => { const next = views.map(x => x.id === v.id ? { ...x, filters, q, sort } : x); setViews(next); writeLS(VIEWS_KEY, next); toast.success(`Updated "${v.name}".`); } },
    'divider',
    { id: 'delete', label: 'Delete view', icon: 'Trash01', danger: true, onSelect: () => { const next = views.filter(x => x.id !== v.id); setViews(next); writeLS(VIEWS_KEY, next); } },
  ];

  // Merge: PATCH the winner (union arrays sent whole), mark the loser mergedInto, soft delete it with reason=merged.
  const doMerge = async (winner, loser, choice) => {
    const payload = mergePayload(winner, loser, choice);
    const ok = await patch(winner._id, payload, 'Merge failed before anything changed.');
    if (!ok) return;
    await onPatch(loser._id, { mergedInto: winner._id });
    const r = await apiFetch(`/api/admin/call-leads?ids=${encodeURIComponent(loser._id)}&reason=merged`, { method: 'DELETE' });
    if (!r.ok) { toast.error(`${winner.business} was updated, but ${loser.business} could not be removed. Delete it by hand.`); }
    else toast.success(`Merged ${loser.business} into ${winner.business}.`);
    setMergeGroup(null);
    await onRefresh?.();
  };

  // Kanban drag: HTML5 on desktop, long press on touch.
  const columns = BOARD_STATUSES.map(s => ({ status: s, all: sorted.filter(l => (l.callStatus || 'not-called') === s.id) }));
  const changeStatus = (id, statusId) => { const l = pool.find(x => x._id === id); if (l && (l.callStatus || 'not-called') !== statusId) patch(id, { callStatus: statusId }, 'Could not move the lead. It went back.'); };
  const dropAt = (x, y, id) => { const el = document.elementFromPoint(x, y)?.closest?.('[data-col]'); if (el) changeStatus(id, el.getAttribute('data-col')); };
  const dragHandlers = (l) => ({
    draggable: desktop,
    onDragStart: (e) => { e.dataTransfer.setData('text/plain', l._id); e.dataTransfer.effectAllowed = 'move'; setDrag({ id: l._id }); },
    onDragEnd: () => setDrag(null),
    onPointerDown: (e) => { if (e.pointerType !== 'touch') return; const t = e.currentTarget; dragTimer.current = setTimeout(() => { setDrag({ id: l._id, x: e.clientX, y: e.clientY, touch: true }); t.setPointerCapture?.(e.pointerId); }, 450); },
    onPointerMove: (e) => { if (drag?.touch && drag.id === l._id) { e.preventDefault(); setDrag(d => ({ ...d, x: e.clientX, y: e.clientY })); } },
    onPointerUp: (e) => { clearTimeout(dragTimer.current); if (drag?.touch && drag.id === l._id) { dropAt(e.clientX, e.clientY, l._id); setDrag(null); } },
    onPointerCancel: () => { clearTimeout(dragTimer.current); setDrag(null); },
    dragging: drag?.id === l._id,
    style: drag?.touch && drag.id === l._id ? { touchAction: 'none' } : undefined,
  });
  const colDrop = (statusId) => ({
    onDragOver: (e) => { if (drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (drag.over !== statusId) setDrag(d => ({ ...d, over: statusId })); } },
    onDragLeave: () => setDrag(d => (d && d.over === statusId ? { ...d, over: null } : d)),
    onDrop: (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag?.id; if (id) changeStatus(id, statusId); setDrag(null); },
  });
  const dragLead = drag?.touch ? pool.find(l => l._id === drag.id) : null;

  // Table columns
  const tableCols = useMemo(() => [
    { id: 'business', label: 'Business', always: true, sortable: true, width: 260, render: (l) => <span className="ld-cell-biz"><Avatar name={l.business} size="xs" /><span className="lay-truncate">{l.business}</span>{isNewLead(l) && <Pill tone="new" label="New" size="sm" variant="solid" icon={false} />}</span> },
    { id: 'industry', label: 'Industry', sortable: false, render: (l) => (l.industry ? displayIndustry(l.industry) : '') },
    { id: 'priority', label: 'Priority', sortable: true, render: (l) => <Pill id={l.priority || 'warm'} size="sm" /> },
    { id: 'status', label: 'Status', sortable: true, render: (l) => <Pill id={l.callStatus || 'not-called'} list={CALL_STATUSES} size="sm" /> },
    { id: 'phone', label: 'Phone', render: (l) => (l.phone ? <a className="ld-cell-phone" href={telHref(l.phone)} onClick={(e) => e.stopPropagation()}>{formatPhone(l.phone)}</a> : <span className="ld-muted">none</span>) },
    { id: 'socials', label: 'Socials', render: (l) => <LeadSocials lead={l} /> },
    { id: 'lastCall', label: 'Last call', sortable: true, defaultDir: 'desc', render: (l) => { const c = lastCall(l); return c ? <span className="ld-cell-last">{fmtDate(c.at)} <Pill id={c.outcome} list={CALL_STATUSES} size="sm" icon={false} /></span> : <span className="ld-muted">never</span>; } },
    { id: 'calls', label: 'Calls', sortable: true, defaultDir: 'desc', align: 'end', render: (l) => (l.callLog || []).length },
    { id: 'scanned', label: 'Scanned', sortable: true, defaultDir: 'desc', render: (l) => (l.enrichment?.lastScanAt ? relativeTime(l.enrichment.lastScanAt) : <span className="ld-muted">never</span>) },
    { id: 'added', label: 'Added', sortable: true, defaultDir: 'desc', render: (l) => relativeTime(l.createdAt) },
  ], []);

  const summary = `${pool.length} lead${pool.length === 1 ? '' : 's'}, ${toCall} to call`;
  const stackList = (list) => (
    <Stagger className="ld-stack">{list.map(l => <LeadCard key={l._id} lead={l} {...cardProps(l)} />)}</Stagger>
  );

  /* ── Detail open: split (desktop) or full screen (mobile) ── */
  if (sel || creating) {
    return (
      <>
        <aside className="aa-panel ld-panel">
          <ScrollArea bare className="ld-panel-scroll">
            <Stack gap={2}>
              <Input placeholder="Search leads" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search leads" />
              <p className="ld-muted">{sorted.length} of {pool.length}</p>
              <div className="ld-stack">{sorted.slice(0, 80).map(l => <LeadCard key={l._id} lead={l} compact onOpen={() => pick(l._id)} selected={sel?._id === l._id} />)}</div>
            </Stack>
          </ScrollArea>
        </aside>
        <main className="aa-main ld-main">
          {creating ? (
            <ScrollArea className="ld-create"><Card><Section title="New lead"><LeadForm creating lead={createPreset?.preset?.phone ? { phone: createPreset.preset.phone } : undefined} onSave={async (f) => { await onCreate(defaultLead(f)); back(); }} onCancel={back} /></Section></Card></ScrollArea>
          ) : (
            <LeadDetail lead={sel} submissions={submissions} onPatch={onPatch} onDelete={async (id) => { await onDelete(id); back(); }} onLinkSubmission={onLinkSubmission} onClose={back} />
          )}
        </main>
        <style>{ldStyles}</style>
      </>
    );
  }

  /* ── List screen ── */
  return (
    <PageShell className="aa-main aa-main--wide ld-shell">
      <ScrollArea wide className="ld-page">
        <Section title="Leads" description={showSkel ? undefined : summary}
          action={<Row gap={2} wrap>
            <SegmentedControl size="sm" label="View" options={[{ id: 'kanban', label: 'Kanban', icon: 'Columns03' }, { id: 'list', label: 'List', icon: 'Rows01' }]} value={mode} onChange={setMode} />
            <Button variant="secondary" icon={Upload01} onClick={() => setImportOpen(true)}>Import</Button>
            <Button icon={Plus} onClick={() => { setCreating(true); setSelId(null); onMobileOpen?.(); }}>Add lead</Button>
          </Row>}>
          <Row gap={2} wrap>
            <Input className="ld-search" placeholder="Search business, contact, phone, industry" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search leads"
              trailing={q ? <button type="button" className="ld-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={14} height={14} /></button> : undefined} />
            {!desktop && <Button variant={selectMode ? 'primary' : 'secondary'} size="md" onClick={() => { setSelectMode(v => !v); if (selectMode) setChecked(new Set()); }}>{selectMode ? 'Done' : 'Select'}</Button>}
          </Row>
        </Section>

        {showSkel ? (
          <Stack gap={3} aria-busy="true">
            <Row gap={2}>{[1, 2, 3, 4].map(i => <SkeletonBlock key={i} width={90} height={44} radius="var(--v-radius-md)" />)}</Row>
            <Row gap={2}>{[1, 2, 3, 4, 5].map(i => <SkeletonBlock key={i} width={110} height={44} radius="var(--v-radius-md)" />)}</Row>
            {mode === 'kanban' && desktop ? (
              <div className="ld-board">{BOARD_STATUSES.map(s => <section key={s.id} className="ld-col"><header className="ld-col-head"><SkeletonBlock width={80} height={22} radius="var(--v-radius-pill)" /></header><div className="ld-col-body"><div className="ld-col-stack">{[1, 2, 3].map(i => <LeadCard.Skeleton key={i} />)}</div></div></section>)}</div>
            ) : mode === 'kanban' ? (
              <div className="ld-board">{BOARD_STATUSES.slice(0, 2).map(s => <section key={s.id} className="ld-col"><header className="ld-col-head"><SkeletonBlock width={80} height={22} radius="var(--v-radius-pill)" /></header><div className="ld-col-body"><div className="ld-col-stack">{[1, 2, 3].map(i => <LeadCard.Skeleton key={i} />)}</div></div></section>)}</div>
            ) : desktop ? <Table.Skeleton rows={10} cols={7} /> : <div className="ld-stack">{[1, 2, 3, 4, 5].map(i => <LeadCard.Skeleton key={i} />)}</div>}
          </Stack>
        ) : (
          <>
            <div className="ld-views">
              <div className="ld-frow-chips">
                {views.map(v => (
                  <span key={v.id} className="ld-view">
                    <Chip label={v.name} selected={activeView?.id === v.id} onClick={() => applyView(v)} />
                    <Menu label={`${v.name} view`} items={viewMenu(v)} />
                  </span>
                ))}
                <span ref={industryMoreRef} />
                <Button variant="ghost" icon="Plus" onClick={() => setSaveOpen(true)}>Save view</Button>
              </div>
            </div>
            <div className="ld-filters">
              <FilterRow label="Status" values={filters.status} onChange={setGroup('status')} options={BOARD_STATUSES.map(s => ({ id: s.id, label: s.label, icon: s.icon, count: count('status', s.id) }))} />
              <FilterRow label="Priority" values={filters.prio} onChange={setGroup('prio')} options={PRIORITIES.map(p => ({ id: p.id, label: p.label, icon: p.icon, count: count('prio', p.id) }))} />
              <FilterRow label="Industry" values={filters.industry} onChange={setGroup('industry')} options={facets.slice(0, 8).map(f => ({ id: f.key, label: f.label, count: f.count }))}
                more={facets.length > 8 && (
                  <span ref={industryMoreRef}>
                    <Chip label={`More (${facets.length - 8})`} onClick={() => setIndustryMore(o => !o)} aria-expanded={industryMore} />
                    <Popover open={industryMore} onClose={() => setIndustryMore(false)} anchorRef={industryMoreRef} width={280} trap label="More industries">
                      <div className="ld-more">{facets.slice(8).map(f => <Checkbox key={f.key} label={`${f.label} (${f.count})`} checked={filters.industry.includes(f.key)} onChange={(v) => setGroup('industry')(v ? [...filters.industry, f.key] : filters.industry.filter(x => x !== f.key))} />)}</div>
                    </Popover>
                  </span>
                )} />
              <FilterRow label="Data" values={filters.data} onChange={setGroup('data')} options={DATA_CHIPS.map(([id, label]) => ({ id, label, count: id === 'dupes' ? dupes.ids.size : count('data', id) }))} />
              {activeCount > 0 && (
                <p className="ld-summary">{sorted.length} of {pool.length} match {activeCount} filter{activeCount === 1 ? '' : 's'}{q ? ` and "${q}"` : ''}. <button type="button" className="ld-link" onClick={clearAll}>Clear all</button></p>
              )}
            </div>

            {!pool.length ? (
              <Card><EmptyState icon="Users01" title="No open leads" description="Add one, import a spreadsheet, or check Booked and Clients. Everyone might just be further down the pipeline." action={{ label: 'Add lead', icon: Plus, onClick: () => { setCreating(true); onMobileOpen?.(); } }} secondary={{ label: 'Import spreadsheet', onClick: () => setImportOpen(true) }} /></Card>
            ) : filters.data.includes('dupes') ? (
              <Stack gap={4}>
                {!dupes.groups.length && <Card><EmptyState size="sm" icon="Check" title="No duplicates found" description="No two leads share a phone number or a business name in the same industry." /></Card>}
                {dupes.groups.filter(g => g.leads.some(l => sorted.includes(l))).map(g => (
                  <Card key={g.ids.join('|')} level={1} header={<><span className="ld-dupe-why">{g.reason === 'phone' ? 'Same phone' : 'Same name and industry'}</span><Button variant="secondary" icon="GitMerge" onClick={() => setMergeGroup(g)} disabled={g.leads.length < 2}>Merge</Button></>}>
                    <div className="ld-stack">{g.leads.map(l => <LeadCard key={l._id} lead={l} {...cardProps(l)} />)}</div>
                  </Card>
                ))}
              </Stack>
            ) : !sorted.length ? (
              <Card><EmptyState size="sm" icon="SearchMd" title="Nothing matches" description="Loosen a filter or clear the search." action={{ label: 'Clear all', onClick: clearAll }} /></Card>
            ) : mode === 'kanban' ? (
              <div className={`ld-board${drag ? ' is-dragging' : ''}`} role="list" aria-label="Leads by call status">
                {columns.map((c, i) => {
                  const n = shown[c.status.id] || PAGE;
                  return <div key={c.status.id} className="ld-col-wrap" {...colDrop(c.status.id)} data-col={c.status.id}>
                    <KanbanColumn status={c.status} leads={c.all.slice(0, n)} total={c.all.length} collapsed={collapsed.has(c.status.id)} dropping={drag?.over === c.status.id}
                      onToggle={() => setCollapsed(p => { const s = new Set(p); s.has(c.status.id) ? s.delete(c.status.id) : s.add(c.status.id); return s; })}
                      onMore={() => setShown(p => ({ ...p, [c.status.id]: n + PAGE }))}
                      onStartSession={() => shell.go('calls', { status: [c.status.id], prio: filters.prio })}
                      cardProps={cardProps} dragHandlers={dragHandlers} stagger={i < 4} />
                  </div>;
                })}
              </div>
            ) : desktop ? (
              <Table aria-label="Leads" columns={tableCols} rows={sorted} selectable selected={checked} onSelect={setChecked} sort={sort} onSort={setSort} density="md" storageKey="vz_leads_cols"
                onRowClick={(l) => pick(l._id)} rowActions={(l) => <Menu items={leadMenuItems(l, cardActions(l))} label={`Actions for ${l.business}`} />} empty={<EmptyState size="sm" icon="SearchMd" title="Nothing matches" />} />
            ) : (
              <Stack gap={2}>
                <Select label="Sort" value={sort.id} onChange={(e) => { const s = SORTS.find(x => x.id === e.target.value); setSort({ id: s.id, dir: s.dir }); }} options={SORTS.map(s => ({ id: s.id, label: s.label }))} />
                {stackList(sorted.slice(0, (shown.list || PAGE)))}
                {sorted.length > (shown.list || PAGE) && <Button variant="ghost" full onClick={() => setShown(p => ({ ...p, list: (p.list || PAGE) + PAGE }))}>Show more ({sorted.length - (shown.list || PAGE)} left)</Button>}
              </Stack>
            )}
          </>
        )}
      </ScrollArea>

      {checked.size > 0 && (
        <StickyFooterBar className="ld-bulk">
          <Row gap={2} wrap justify="center" className="ld-bulk-row">
            <span className="ld-bulk-n">{checked.size} selected{blockedCount ? `, ${blockedCount} protected` : ''}</span>
            <Menu label="Change priority" align="start" trigger={<Button variant="secondary" iconEnd="ChevronDown">Priority</Button>} items={PRIORITIES.map(p => ({ id: p.id, label: p.label, icon: p.icon, onSelect: () => bulkPatch([...checked], { priority: p.id }, `set to ${p.label.toLowerCase()}`) }))} />
            <Menu label="Change status" align="start" trigger={<Button variant="secondary" iconEnd="ChevronDown">Status</Button>} items={BOARD_STATUSES.map(s => ({ id: s.id, label: s.label, icon: s.icon, onSelect: () => bulkPatch([...checked], { callStatus: s.id }, `marked ${s.label.toLowerCase()}`) }))} />
            <Button variant="secondary" icon="PhoneCall01" onClick={addToSession}>Add to session</Button>
            <Button variant="secondary" icon={Download01} onClick={exportCsv}>Export CSV</Button>
            <Button variant="danger" icon={Trash01} onClick={() => setBulkConfirm(true)} disabled={!deletable.length}>Delete{deletable.length ? ` ${deletable.length}` : ''}</Button>
            <Button variant="ghost" onClick={() => { setChecked(new Set()); setSelectMode(false); }}>Clear</Button>
          </Row>
        </StickyFooterBar>
      )}

      <ConfirmDialog open={bulkConfirm} danger confirmLabel="Delete"
        title={`Delete ${deletable.length} lead${deletable.length === 1 ? '' : 's'}?`}
        body={`They move to Recently deleted in Settings and can be restored for 30 days.${blockedCount ? ` ${blockedCount} protected lead${blockedCount === 1 ? '' : 's'} with call history will be skipped.` : ''}`}
        onConfirm={runBulkDelete} onClose={() => setBulkConfirm(false)} />
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save view" description="Current filters, search, and sort under a name."
        footer={<><Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button><Button onClick={saveView} disabled={!viewName.trim()}>Save</Button></>}>
        <Input label="Name" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Warm bakeries" data-autofocus onKeyDown={(e) => { if (e.key === 'Enter') saveView(); }} />
      </Modal>
      {mergeGroup && <MergeModal group={mergeGroup} onClose={() => setMergeGroup(null)} onMerge={doMerge} />}
      {importOpen && <LeadImport existingLeads={leads} onClose={() => setImportOpen(false)} onImported={onRefresh} />}
      {dragLead && <div className="ld-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true"><LeadCard lead={dragLead} compact /></div>}
      <style>{ldStyles}</style>
    </PageShell>
  );
}

function LeadSocials({ lead }) {
  const keys = ['website', 'instagram', 'facebook', 'google'].filter(k => lead.socials?.[k]);
  if (!keys.length) return <span className="ld-muted">none</span>;
  return <span className="ld-cell-soc">{keys.map(k => <a key={k} href={lead.socials[k]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{k === 'google' ? 'maps' : k}</a>)}</span>;
}


const ldStyles = `
  /* ── List screen ── */
  .ld-shell.aa-main { display: flex; flex-direction: column; }
  .ld-page { --v-content-w-wide: 1400px; --v-stack-gap: var(--v-space-4); }
  .ld-page .lay-content--wide { max-width: var(--v-content-w-wide); }
  .ld-search { max-width: 480px; flex: 1; }
  .ld-clear { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: var(--v-radius-sm); background: transparent; color: var(--v-text-3); cursor: pointer; }
  .ld-clear:hover { color: var(--v-text); background: var(--v-surface-3); }
  .ld-views .ld-frow-chips { align-items: center; }
  .ld-view { display: inline-flex; align-items: center; gap: 2px; }
  .ld-view .v-ibtn { width: 32px; height: var(--v-tap); }
  .ld-filters { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ld-frow { display: flex; align-items: center; gap: var(--v-space-3); min-width: 0; }
  .ld-frow-label { flex-shrink: 0; width: 72px; white-space: nowrap; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .ld-frow-chips { display: flex; gap: var(--v-space-2); min-width: 0; flex: 1; overflow-x: auto; scrollbar-width: none; padding: 2px; margin: -2px; }
  .ld-frow-chips::-webkit-scrollbar { display: none; }
  @media (min-width: 768px) { .ld-frow-chips { flex-wrap: wrap; overflow: visible; } }
  .ld-more { display: flex; flex-direction: column; padding: var(--v-space-1) var(--v-space-3); max-height: 320px; overflow-y: auto; }
  .ld-summary { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .ld-link { border: 0; background: transparent; color: var(--v-red-highlight); font: inherit; font-weight: var(--v-weight-bold); cursor: pointer; padding: 0; min-height: var(--v-tap); }
  .ld-link:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  .ld-stack { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .ld-dupe-why { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-status-new-text); }
  /* Kanban */
  .ld-board { display: flex; gap: var(--v-space-3); overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; min-width: 0; padding: 2px; margin: -2px; }
  .ld-board::-webkit-scrollbar { height: 6px; }
  .ld-col-wrap { flex: 0 0 min(88vw, 320px); scroll-snap-align: start; min-width: 0; display: flex; }
  .ld-col-wrap:has(.is-collapsed) { flex-basis: 56px; }
  @media (min-width: 1280px) { .ld-board { scroll-snap-type: none; } .ld-col-wrap { flex: 1 1 0; min-width: 240px; } .ld-col-wrap:has(.is-collapsed) { flex: 0 0 56px; min-width: 56px; } }
  .ld-col { display: flex; flex-direction: column; gap: var(--v-space-2); width: 100%; min-width: 0; background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); padding: var(--v-space-2); transition: border-color var(--v-dur-fast) var(--v-ease-out), background var(--v-dur-fast) var(--v-ease-out); }
  .ld-col.is-dropping { border-color: var(--v-red); background: var(--v-red-soft); }
  .ld-col.is-collapsed { align-items: center; }
  .ld-col-head { display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); padding: 0 var(--v-space-1); }
  .ld-col-n { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .ld-col-strip { display: flex; flex-direction: column; align-items: center; gap: var(--v-space-2); min-width: var(--v-tap); min-height: 120px; padding: var(--v-space-2) 0; border: 0; background: transparent; color: var(--v-text); cursor: pointer; writing-mode: vertical-rl; }
  .ld-col-strip .v-pill { writing-mode: vertical-rl; transform: rotate(180deg); }
  .ld-col-strip:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-md); }
  .ld-col-body { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .ld-col-stack { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .ld-col-stack > .v-stagger-item { display: contents; }
  .ld-col-empty { margin: 0; padding: var(--v-space-4); text-align: center; font-size: var(--v-text-sm); color: var(--v-text-3); }
  .ld-board .lc[draggable='true'] { cursor: grab; }
  .ld-board.is-dragging .lc { cursor: grabbing; }
  .ld-ghost { position: fixed; z-index: var(--v-z-command); width: 280px; pointer-events: none; transform: translate(-50%, -30%) rotate(1deg); opacity: 0.92; }
  /* Table cells */
  .ld-cell-biz { display: inline-flex; align-items: center; gap: var(--v-space-2); min-width: 0; max-width: 100%; font-weight: var(--v-weight-semibold); }
  .ld-cell-phone { color: var(--v-text-2); text-decoration: none; font-variant-numeric: tabular-nums; }
  .ld-cell-phone:hover { color: var(--v-red-highlight); }
  .ld-cell-last { display: inline-flex; align-items: center; gap: var(--v-space-2); }
  .ld-cell-soc { display: inline-flex; gap: var(--v-space-2); }
  .ld-cell-soc a { color: var(--v-text-2); text-decoration: none; text-transform: capitalize; font-size: var(--v-text-xs); border-bottom: 1px dotted var(--v-border-strong); }
  .ld-cell-soc a:hover { color: var(--v-red-highlight); }
  /* Bulk bar */
  .ld-bulk-row { width: 100%; }
  .ld-bulk-n { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text); margin-right: var(--v-space-2); }
  /* Merge modal */
  .ld-merge-pick { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ld-merge-lead { display: flex; align-items: center; gap: var(--v-space-3); padding: var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); cursor: pointer; min-height: var(--v-tap-lg); }
  .ld-merge-lead.is-on { border-color: var(--v-red); background: var(--v-red-soft); }
  .ld-merge-lead input, .ld-merge-opt input { accent-color: var(--v-red); width: 18px; height: 18px; margin: 0; flex-shrink: 0; }
  .ld-merge-lead-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .ld-merge-lead-text span { font-size: var(--v-text-sm); color: var(--v-text-3); }
  .ld-merge-fields { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .ld-merge-field { display: grid; grid-template-columns: 90px 1fr 1fr; gap: var(--v-space-2); align-items: center; }
  @media (max-width: 560px) { .ld-merge-field { grid-template-columns: 1fr; } }
  .ld-merge-flabel { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .ld-merge-opt { display: flex; align-items: center; gap: var(--v-space-2); padding: var(--v-space-2) var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); cursor: pointer; min-height: var(--v-tap); font-size: var(--v-text-sm); overflow-wrap: anywhere; }
  .ld-merge-opt.is-on { border-color: var(--v-red); background: var(--v-red-soft); }
  /* Detail split: the list stays in the left panel */
  .ld-panel { padding: var(--v-space-3); }
  .ld-panel-scroll { padding: 0; }
  .ld-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  @media (max-width: 767px) { .aa-app.has-detail .aa-main.ld-main { display: flex; } }
  .ld-muted { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .ld-create { --v-stack-gap: var(--v-space-4); }
`;
