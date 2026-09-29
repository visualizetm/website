import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Button, ProgressBar, Menu, Sheet, Modal, Input, Select, EmptyState, ErrorState, Stagger,
  SkeletonBlock, useDelayedLoading, useMediaQuery, useRetry, useToast, useConfirm, Icon,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';
import LeadCard from '../components/LeadCard';
import ListCard, { listCardStyles } from '../components/ListCard';
import FilterPicker, { useFilterMatches } from '../components/FilterPicker';
import { openLists, listCount, isFull, windowLabel, WINDOWS, onAnyOpenList } from '../lib/lists';
import { effectiveStage } from '../lib/booked';
import { useComputerOnly } from '../components/ComputerOnly';

/* Lists (CRM revamp, step 3): the dial lists Rob builds for the week. A
 * card per open list with its count against the target and a Start that
 * goes primary when the list is full; a list opens to its leads in order,
 * reordered by drag on a desktop and a long press on a phone, a swipe left
 * removes one (and the card menu has Remove for the audits). Fill from
 * filters is the Call Console's chips in a sheet, appending matches up to
 * the target and skipping leads on any open list. The system list Callbacks
 * due fills itself and only offers Start. */

/* One list opened: its leads, in order. */
function ListDetail({ list, leads, phone, hover, onReorder, onRemove, onOpenLead, onFill }) {
  const ordered = useMemo(() => { const m = new Map(leads.map(l => [String(l._id), l])); return (list.leadIds || []).map(id => m.get(String(id))).filter(Boolean); }, [list.leadIds, leads]);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dx, setDx] = useState({});
  const touch = useRef(null);
  const move = (from, to) => { if (from === to || from < 0 || to < 0) return; const ids = ordered.map(l => l._id); const [x] = ids.splice(from, 1); ids.splice(to, 0, x); onReorder(ids); };
  const rowHandlers = (l, i) => phone ? {
    onTouchStart: (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, i, hold: setTimeout(() => { setDragging(i); touch.current = { ...touch.current, drag: true }; }, 450), moved: false }; },
    onTouchMove: (e) => {
      const s = touch.current; if (!s) return; const t = e.touches[0]; const ddx = t.clientX - s.x; const ddy = t.clientY - s.y;
      if (s.drag) { const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-ls-i]'); if (el) { const to = Number(el.getAttribute('data-ls-i')); if (to !== s.i) { move(s.i, to); s.i = to; setDragging(to); } } return; }
      if (!s.moved && Math.abs(ddy) > Math.abs(ddx)) { clearTimeout(s.hold); touch.current = null; return; }
      if (Math.abs(ddx) > 8) { s.moved = true; clearTimeout(s.hold); }
      setDx(d => ({ ...d, [l._id]: Math.min(0, Math.max(-120, ddx)) }));
    },
    onTouchEnd: () => { const s = touch.current; touch.current = null; if (!s) return; clearTimeout(s.hold); const d = dx[l._id] || 0; setDx(x => ({ ...x, [l._id]: 0 })); setDragging(null); if (!s.drag && d < -72) onRemove(l); },
    onTouchCancel: () => { const s = touch.current; if (s) clearTimeout(s.hold); touch.current = null; setDragging(null); setDx({}); },
  } : hover ? {
    draggable: true,
    onDragStart: () => { drag.current = i; setDragging(i); },
    onDragOver: (e) => e.preventDefault(),
    onDragEnd: () => { drag.current = null; setDragging(null); },
    onDrop: () => { const from = drag.current; drag.current = null; setDragging(null); if (from == null || from === i) return; move(from, i); },
  } : {};
  if (!ordered.length) return <Card><EmptyState size="sm" icon="Rows01" title={COPY.empty['lists.empty'].title} description={COPY.empty['lists.empty'].description} action={list.system ? undefined : { label: COPY.empty['lists.empty'].action, icon: 'SearchMd', onClick: onFill }} /></Card>;
  return (
    <Stagger className="ls-stack" cap={6}>
      {ordered.map((l, i) => (
        <div key={l._id} className={`ls-item${dragging === i ? ' is-dragging' : ''}`} data-ls-i={i} style={dx[l._id] ? { transform: `translate3d(${dx[l._id]}px, 0, 0)`, transition: 'none' } : undefined} {...rowHandlers(l, i)}>
          <span className={`ls-remove${(dx[l._id] || 0) < -72 ? ' is-armed' : ''}`} aria-hidden="true"><Icon icon="XClose" size={16} /> Remove</span>
          <span className="ls-pos" aria-hidden="true">{i + 1}</span>
          <LeadCard lead={l} onOpen={() => onOpenLead(l)} actions={list.system ? undefined : { onRemoveFromList: () => onRemove(l) }} handle={phone || hover} className="ls-lead" />
        </div>
      ))}
    </Stagger>
  );
}

export default function AdminLists({ lists = [], leads = [], loading = false, error = false, onRetry, ops, onOpenLead, onStart, openId }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [retry, retrying] = useRetry(onRetry);
  const showSkel = useDelayedLoading(loading);
  const phone = useMediaQuery('(max-width: 767px)');
  const hover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [selId, setSelId] = useState(null);
  const [modal, setModal] = useState(null); // { kind: 'new' | 'rename' | 'target', list }
  const [name, setName] = useState('');
  const [target, setTarget] = useState('25');
  const [win, setWin] = useState('any');
  const [fillFor, setFillFor] = useState(null);
  /* CRM revamp, step 7: Fill from filters is computer only; a phone gets the card. */
  const co = useComputerOnly();
  const openFill = (l) => (co.phone ? co.open('Fill from filters', l.name) : setFillFor(l));
  const open = useMemo(() => openLists(lists), [lists]);
  const sel = selId ? open.find(l => String(l._id) === String(selId)) || null : null;
  useEffect(() => { if (openId?.id) setSelId(openId.id); }, [openId]);
  useTopBar(sel ? { title: sel.name, back: () => setSelId(null) } : null);

  const pool = useMemo(() => leads.filter(l => effectiveStage(l) === 'lead'), [leads]);
  const f = useFilterMatches(pool);
  const taken = useMemo(() => onAnyOpenList(lists), [lists]);
  const fillable = useMemo(() => (fillFor ? f.matches.filter(l => !taken.has(String(l._id)) && l.phone).slice(0, Math.max(0, (fillFor.target || 0) - listCount(fillFor))) : []), [f.matches, taken, fillFor]);

  const create = async () => {
    const n = name.trim(); if (!n) return;
    const item = await ops.createList({ name: n, target: Math.max(1, Math.min(500, Math.round(Number(target)) || 25)), window: win });
    if (!item) { toast.error(COPY.error.create); return; }
    setModal(null); setSelId(item._id); toast.success(`${item.name} made. Add leads or fill it from the filters.`);
  };
  const rename = async () => { const n = name.trim(); if (!n || !modal?.list) return; const ok = await ops.patchList(modal.list._id, { name: n }); if (ok) { setModal(null); toast.success('Renamed.'); } else toast.error(COPY.error.save); };
  const retarget = async () => { const n = Math.max(1, Math.min(500, Math.round(Number(target)) || 0)); if (!n || !modal?.list) return; const ok = await ops.patchList(modal.list._id, { target: n }); if (ok) { setModal(null); toast.success(`Target is ${n}.`); } else toast.error(COPY.error.save); };
  const markDone = async (l) => { const yes = await confirm({ title: `Mark ${l.name} done?`, body: 'It leaves the open lists and its leads are free to join another.', confirmLabel: 'Mark done' }); if (!yes) return; const ok = await ops.finishList(l._id); if (ok) { if (String(selId) === String(l._id)) setSelId(null); toast.success(`${l.name} done.`); } else toast.error(COPY.error.save); };
  const remove = async (l) => { const yes = await confirm({ title: `Delete ${l.name}?`, body: 'The list goes; the leads stay where they are.', confirmLabel: 'Delete', danger: true }); if (!yes) return; const ok = await ops.finishList(l._id, true); if (ok) { if (String(selId) === String(l._id)) setSelId(null); toast.success(`${l.name} deleted.`); } else toast.error(COPY.error.del); };
  const fill = async () => {
    if (!fillFor) return;
    const ids = fillable.map(l => l._id);
    if (!ids.length) { toast.info('Nothing new matches. Loosen a chip.'); return; }
    const r = await ops.addToList(ids, fillFor._id);
    if (r) toast.success(`Added ${ids.length} to ${fillFor.name}, ${r.count} of ${fillFor.target}.`); else toast.error(COPY.error.save);
    setFillFor(null);
  };
  const menuFor = (l) => (l.system ? [{ id: 'start', label: 'Start', icon: 'Play', onSelect: () => onStart(l), disabled: !listCount(l) }] : [
    { id: 'start', label: 'Start', icon: 'Play', onSelect: () => onStart(l), disabled: !listCount(l) },
    { id: 'rename', label: 'Rename', icon: 'Edit02', onSelect: () => { setName(l.name); setModal({ kind: 'rename', list: l }); } },
    { id: 'target', label: 'Set target', icon: 'Users01', onSelect: () => { setTarget(String(l.target || 25)); setModal({ kind: 'target', list: l }); } },
    { id: 'fill', label: 'Fill from filters', icon: 'SearchMd', onSelect: () => openFill(l) },
    'divider',
    { id: 'done', label: 'Mark done', icon: 'Check', onSelect: () => markDone(l) },
    { id: 'del', label: 'Delete', icon: 'Trash01', danger: true, onSelect: () => remove(l) },
  ]);
  const E = COPY.empty['lists.none'];

  const body = showSkel ? (
    <Grid minColumnWidth={260} gap={3} aria-busy="true">{[1, 2, 3].map(i => <Card key={i} as="div" padding={4}><Stack gap={3}><Row gap={2} justify="between"><SkeletonBlock width={140} height={18} /><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row><Stack gap={1}><SkeletonBlock width={60} height={14} /><SkeletonBlock height={6} radius="var(--v-radius-pill)" /></Stack><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Stack></Card>)}</Grid>
  ) : error && !lists.length ? (
    <Card><ErrorState title={COPY.error.lists.title} description={COPY.error.lists.description} onRetry={retry} retrying={retrying} /></Card>
  ) : sel ? (
    <Stack gap={4}>
      <Card padding={3}>
        <Row gap={3} align="center" justify="between" wrap>
          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <span className="ls-count">{sel.system ? `${listCount(sel)} due` : `${listCount(sel)} of ${sel.target}`}{sel.window && sel.window !== 'any' ? `, ${windowLabel(sel.window).toLowerCase()}` : ''}</span>
            <ProgressBar value={sel.system ? (listCount(sel) ? 100 : 0) : sel.target ? Math.min(100, (listCount(sel) / sel.target) * 100) : 0} tone="booked" size="sm" label={`${listCount(sel)} of ${sel.target}`} />
          </Stack>
          <Row gap={2} wrap>
            <Button variant={isFull(sel) || (sel.system && listCount(sel)) ? 'primary' : 'secondary'} icon="Play" onClick={() => onStart(sel)} disabled={!listCount(sel)}>Start</Button>
            <Menu label={`${sel.name} actions`} items={menuFor(sel)} />
          </Row>
        </Row>
      </Card>
      <ListDetail list={sel} leads={leads} phone={phone} hover={hover}
        onReorder={(ids) => ops.patchList(sel._id, { leadIds: ids }).then(ok => { if (!ok) toast.error(COPY.error.save); })}
        onRemove={(l) => ops.removeFromList(l._id, sel._id).then(ok => { if (ok) toast.undo(`${l.business} removed from ${sel.name}.`, () => ops.addToList([l._id], sel._id), { seconds: 6 }); else toast.error(COPY.error.save); })}
        onOpenLead={(l) => onOpenLead(l)} onFill={() => openFill(sel)} />
    </Stack>
  ) : !open.length ? (
    <Card><EmptyState icon="Rows01" title={E.title} description={E.description} action={{ label: E.action, icon: 'Plus', onClick: () => { setName(''); setTarget('25'); setWin('any'); setModal({ kind: 'new' }); } }} /></Card>
  ) : (
    <Stagger className="ls-grid" cap={6}>
      {open.map(l => <ListCard key={l._id} list={l} onOpen={() => setSelId(l._id)} onStart={onStart} onMenu={menuFor} />)}
    </Stagger>
  );

  return (
    <PageShell className="aa-main aa-main--wide ls-shell">
      <ScrollArea wide>
        {!sel && <Section title="Lists" loading={showSkel} description={showSkel ? undefined : `${open.filter(l => !l.system).length} open, ${open.filter(isFull).length} ready to start`}
          action={<Button icon="Plus" onClick={() => { setName(''); setTarget('25'); setWin('any'); setModal({ kind: 'new' }); }}>New list</Button>} />}
        {body}
      </ScrollArea>
      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal.kind === 'new' ? 'New list' : modal.kind === 'rename' ? `Rename ${modal.list.name}` : `Target for ${modal.list.name}`}
          footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={modal.kind === 'new' ? create : modal.kind === 'rename' ? rename : retarget} disabled={modal.kind === 'target' ? !Number(target) : !name.trim()}>{modal.kind === 'new' ? 'Create' : 'Save'}</Button></>}>
          <Stack gap={3}>
            {modal.kind !== 'target' && <Input label="Name" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="Tuesday morning" data-autofocus onKeyDown={(e) => { if (e.key === 'Enter') (modal.kind === 'new' ? create : rename)(); }} />}
            {modal.kind !== 'rename' && <Input label="Target" type="number" inputMode="numeric" min={1} max={500} value={target} onChange={(e) => setTarget(e.target.value)} hint="How many leads make it a full session." />}
            {modal.kind === 'new' && <Select label="Window" value={win} onChange={(e) => setWin(e.target.value)} options={WINDOWS.map(w => ({ id: w.id, label: w.label }))} hint="When these leads pick up." />}
          </Stack>
        </Modal>
      )}
      {fillFor && (
        <Sheet open onClose={() => setFillFor(null)} title="Fill from filters" description={`${fillFor.name}, ${listCount(fillFor)} of ${fillFor.target}`} label="Fill from filters" tall
          footer={<Row gap={2} justify="between" align="center" wrap><span className="ls-count" role="status">{fillable.length} to add{f.matches.length > fillable.length ? `, ${f.matches.length - fillable.length} already on a list or without a phone` : ''}</span><Row gap={2}><Button variant="ghost" onClick={() => setFillFor(null)}>Cancel</Button><Button icon="Plus" onClick={fill} disabled={!fillable.length}>Add {fillable.length}</Button></Row></Row>}>
          <FilterPicker f={f} />
        </Sheet>
      )}
      {confirmDialog}
      {co.sheet}
      <style>{listCardStyles + lsStyles}</style>
    </PageShell>
  );
}

const lsStyles = `
  .ls-stack { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ls-item { position: relative; display: flex; align-items: stretch; gap: var(--v-space-2); transition: transform var(--v-dur-base) var(--v-ease-out), opacity var(--v-dur-fast) var(--v-ease-out); touch-action: pan-y; }
  .ls-item.is-dragging { opacity: 0.6; }
  .ls-item > .lc { flex: 1; min-width: 0; }
  .ls-pos { flex: 0 0 24px; display: flex; align-items: center; justify-content: center; font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); font-variant-numeric: tabular-nums; }
  .ls-remove { position: absolute; top: 0; bottom: 0; right: 0; left: 40%; display: flex; align-items: center; justify-content: flex-end; gap: var(--v-space-1); padding: 0 var(--v-space-4); border-radius: var(--v-radius-lg); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); opacity: 0; z-index: -1; }
  .ls-item[style*="translate3d"] .ls-remove { opacity: 0.6; z-index: 0; }
  .ls-remove.is-armed { opacity: 1; }
`;
