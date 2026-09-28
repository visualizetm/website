import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Button, IconButton, Menu, Sheet, Table, Pill, Chip, SegmentedControl, EmptyState, ErrorState, Stagger,
  SkeletonBlock, useDelayedLoading, useMediaQuery, useRetry, useToast, Icon,
} from '../ui';
import { COPY } from '../shared/copy';
import { PRIORITIES, WINDOWS } from '../shared/semantics';
import { useShell } from '../shell/ShellContext';
import { SOCIALS } from '../components/LeadCard';
import { useDecline } from '../components/DeclineSheet';
import { triageLeads } from '../lib/leads';
import { scoreFor, scoreTone, topClientIndustries, briefedLeadIds } from '../lib/score';
import { keepPatch, undoKeepPatch, laterPatch, undoLaterPatch, sourceOf, intelLines } from '../lib/triage';

/* Triage (CRM revamp, step 4): the pile every new lead lands in, sorted by
 * score and then by newest. A phone shows one card at a time with the next
 * peeking behind it: swipe right keeps it, swipe left bins it, swipe down
 * opens Later and Decline, and the three round buttons under the card do
 * the same. Keep opens a sheet for the priority, the best window and an
 * Add to list row, then writes stage lead. A desktop shows a table with one
 * row focused and the keys K, L, D, B and A, plus the same five in the row
 * menu. Every action gets a six second undo. */
const SOURCE_TONE = { scraper: 'progress', brief: 'booked', import: 'neutral', hand: 'new' };
const KEYS = [['K', 'Keep'], ['L', 'Later'], ['D', 'Decline'], ['B', 'Bin'], ['A', 'Add to list'], ['Up and Down', 'Move focus']];

function ScoreBadge({ score }) {
  const n = Number(score) || 0;
  return <span className={`tr-score tr-score--${scoreTone(n)}`} aria-label={`Score ${n} of 100`}>{n}</span>;
}
function SocialRow({ lead, size = 13 }) {
  return (
    <span className="lc-socials" role="img" aria-label={`Socials: ${SOCIALS.filter(([k]) => lead.socials?.[k]).map(([, , l]) => l).join(', ') || 'none'}`}>
      {SOCIALS.map(([k, I]) => <span key={k} className={`lc-social${lead.socials?.[k] ? '' : ' lc-social--off'}`} aria-hidden="true"><I width={size} height={size} /></span>)}
    </span>
  );
}

/* A swipe on the top card: right keeps, left bins, down opens the sheet. */
function useCardSwipe({ onRight, onLeft, onDown, enabled }) {
  const st = useRef(null);
  const [d, setD] = useState({ x: 0, y: 0 });
  if (!enabled) return { d: { x: 0, y: 0 }, handlers: {} };
  return {
    d,
    handlers: {
      onTouchStart: (e) => { const t = e.touches[0]; st.current = { x: t.clientX, y: t.clientY, axis: null }; },
      onTouchMove: (e) => {
        const s = st.current; if (!s) return; const t = e.touches[0];
        const dx = t.clientX - s.x; const dy = t.clientY - s.y;
        if (!s.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : (dy > 0 ? 'y' : 'none');
        if (s.axis === 'x') setD({ x: Math.max(-160, Math.min(160, dx)), y: 0 });
        else if (s.axis === 'y') setD({ x: 0, y: Math.max(0, Math.min(140, dy)) });
      },
      onTouchEnd: () => { const s = st.current; st.current = null; const cur = d; setD({ x: 0, y: 0 }); if (!s?.axis) return; if (cur.x > 88) onRight?.(); else if (cur.x < -88) onLeft?.(); else if (cur.y > 72) onDown?.(); },
      onTouchCancel: () => { st.current = null; setD({ x: 0, y: 0 }); },
    },
  };
}

function TriageCard({ lead, score, source, style, handlers, hint }) {
  const lines = intelLines(lead);
  return (
    <Card as="article" padding={4} className="tr-card" style={style} {...(handlers || {})}>
      {hint && <span className={`tr-hint tr-hint--${hint}`} aria-hidden="true"><Icon icon={hint === 'keep' ? 'Check' : hint === 'bin' ? 'Trash01' : 'ChevronDown'} size="var(--v-icon-lg)" /></span>}
      <Stack gap={3}>
        <Row gap={3} justify="between" align="start">
          <Stack gap={1} style={{ minWidth: 0, flex: 1 }}>
            <h2 className="tr-name lay-truncate">{lead.business || 'Unnamed'}</h2>
            <Row gap={2} wrap align="center">
              {lead.industry && <Pill label={lead.industry} tone="neutral" icon={false} size="sm" />}
              {lead.area && <span className="tr-area lay-truncate">{lead.area}</span>}
            </Row>
          </Stack>
          <ScoreBadge score={score} />
        </Row>
        <Row gap={2} wrap align="center">
          <Pill label={source.label} tone={SOURCE_TONE[source.id] || 'neutral'} icon={false} size="sm" />
          <SocialRow lead={lead} />
        </Row>
        {lines.length > 0 && <ul className="tr-intel">{lines.map((t, i) => <li key={i} className="lay-truncate">{t}</li>)}</ul>}
      </Stack>
    </Card>
  );
}

function KeepSheet({ lead, onClose, onDone, onAddToList }) {
  const [priority, setPriority] = useState(lead.priority || 'warm');
  const [win, setWin] = useState(() => WINDOWS.find(w => String(lead.bestWindow || '').toLowerCase().includes(w.label.toLowerCase()))?.id || '');
  const pick = () => ({ priority, bestWindow: win ? WINDOWS.find(w => w.id === win).label : (lead.bestWindow || '') });
  return (
    <Sheet open onClose={onClose} title={`Keep ${lead.business}`} description="It goes to Leads with the priority and the window you pick." label="Keep"
      footer={<Row gap={2} justify="end"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Check" onClick={() => onDone(pick())}>Done</Button></Row>}>
      <Stack gap={4}>
        <Section title="Priority"><SegmentedControl label="Priority" full value={priority} onChange={setPriority} options={PRIORITIES.map(p => ({ id: p.id, label: p.label, icon: p.icon }))} /></Section>
        <Section title="Best window"><Row gap={2} wrap>{WINDOWS.map(w => <Chip key={w.id} label={w.label} icon={w.icon} selected={win === w.id} onClick={() => setWin(v => (v === w.id ? '' : w.id))} />)}</Row></Section>
        {onAddToList && <button type="button" className="tr-listrow" onClick={() => onAddToList(pick())}><Icon icon="Rows01" size="var(--v-icon-md)" /><span>Add to list</span><span className="tr-listrow-hint">Keeps it first</span><Icon icon="ArrowRight" size="var(--v-icon-sm)" /></button>}
      </Stack>
    </Sheet>
  );
}

export default function AdminTriage({ leads = [], submissions = [], loading = false, error = false, onRetry, onPatch, onDelete, onRestore, onOpenLead, onCapture }) {
  const toast = useToast();
  const shell = useShell();
  const [retry, retrying] = useRetry(onRetry);
  const showSkel = useDelayedLoading(loading);
  const phone = useMediaQuery('(max-width: 767px)');
  const [keepFor, setKeepFor] = useState(null);
  const [moreFor, setMoreFor] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [leaving, setLeaving] = useState(null); // { id, dir } for the card's exit
  const pile = useMemo(() => triageLeads(leads), [leads]);
  const ctx = useMemo(() => ({ topIndustries: topClientIndustries(leads), briefed: briefedLeadIds(submissions) }), [leads, submissions]);
  const scoreOf = (l) => (l.score === undefined || l.score === null ? scoreFor(l, ctx) : Number(l.score) || 0);
  const srcOf = (l) => sourceOf(l, ctx.briefed);
  const decline = useDecline({ onPatch });
  const top = pile[0] || null;
  const focused = (focusId && pile.find(l => l._id === focusId)) || pile[0] || null;
  useEffect(() => { if (focusId && !pile.some(l => l._id === focusId)) setFocusId(pile[0]?._id || null); }, [pile, focusId]);

  const keep = async (l, picked) => {
    const set = keepPatch(l, picked);
    const ok = await onPatch(l._id, set);
    if (!ok) { toast.error(COPY.error.save); return false; }
    toast.undo(`${l.business} kept. It is in Leads.`, () => onPatch(l._id, undoKeepPatch(l)), { seconds: 6 });
    return true;
  };
  const later = async (l) => {
    const ok = await onPatch(l._id, laterPatch(l));
    if (!ok) { toast.error(COPY.error.save); return; }
    toast.undo(`${l.business} parked for 30 days.`, () => onPatch(l._id, undoLaterPatch(l)), { seconds: 6 });
  };
  const bin = async (l) => {
    const ok = await onDelete(l._id);
    if (!ok) { toast.error(COPY.error.del); return; }
    toast.undo(`${l.business} binned.`, () => onRestore([l._id]), { seconds: 6 });
  };
  const addToList = async (l, picked) => {
    const ok = await keep(l, picked || { priority: l.priority || 'warm', bestWindow: l.bestWindow || '' });
    if (ok) shell?.openListPicker?.([{ ...l, ...keepPatch(l, picked || {}) }]);
  };
  const act = (kind, l) => {
    if (!l) return;
    setMoreFor(null);
    if (kind === 'keep') setKeepFor(l);
    else if (kind === 'later') later(l);
    else if (kind === 'decline') decline.open(l);
    else if (kind === 'bin') bin(l);
    else if (kind === 'list') addToList(l);
  };
  const fling = (dir, l) => { setLeaving({ id: l._id, dir }); if (dir === 'keep') setKeepFor(l); else if (dir === 'bin') bin(l); else setMoreFor(l); };
  useEffect(() => { if (leaving && !pile.some(l => l._id === leaving.id)) setLeaving(null); }, [pile, leaving]);
  const swipe = useCardSwipe({ enabled: phone && !!top, onRight: () => fling('keep', top), onLeft: () => fling('bin', top), onDown: () => setMoreFor(top) });
  const hint = swipe.d.x > 40 ? 'keep' : swipe.d.x < -40 ? 'bin' : swipe.d.y > 30 ? 'more' : null;

  // Desktop keys: K, L, D, B, A on the focused row; Up and Down move it. Never while typing or while a sheet is up.
  useEffect(() => {
    if (phone || showSkel || !pile.length) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (keepFor || moreFor || document.querySelector('.v-sheet, .v-modal')) return;
      const i = Math.max(0, pile.findIndex(l => l._id === (focused?._id)));
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusId(pile[Math.min(pile.length - 1, i + 1)]._id); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusId(pile[Math.max(0, i - 1)]._id); return; }
      const map = { k: 'keep', l: 'later', d: 'decline', b: 'bin', a: 'list' };
      if (map[k]) { e.preventDefault(); act(map[k], focused); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, showSkel, pile, focused, keepFor, moreFor]); // eslint-disable-line react-hooks/exhaustive-deps

  const menuFor = (l) => [
    { id: 'keep', label: 'Keep', icon: 'Check', onSelect: () => act('keep', l) },
    { id: 'later', label: 'Later', icon: 'Clock', onSelect: () => act('later', l) },
    { id: 'decline', label: 'Decline', icon: 'SlashCircle01', onSelect: () => act('decline', l) },
    { id: 'list', label: 'Add to list', icon: 'Rows01', onSelect: () => act('list', l) },
    'divider',
    { id: 'bin', label: 'Bin', icon: 'Trash01', danger: true, onSelect: () => act('bin', l) },
  ];
  const columns = [
    { id: 'business', label: 'Business', sticky: true, always: true, render: (l) => <span className="tr-cell-name lay-truncate">{l.business || 'Unnamed'}</span> },
    { id: 'industry', label: 'Industry', render: (l) => l.industry || '' },
    { id: 'area', label: 'Area', render: (l) => l.area || '' },
    { id: 'score', label: 'Score', align: 'end', render: (l) => <ScoreBadge score={scoreOf(l)} /> },
    { id: 'source', label: 'Source', render: (l) => <Pill label={srcOf(l).label} tone={SOURCE_TONE[srcOf(l).id] || 'neutral'} icon={false} size="sm" /> },
    { id: 'socials', label: 'Socials', render: (l) => <SocialRow lead={l} /> },
  ];
  const E = COPY.empty['triage.none'];

  const body = showSkel ? (
    phone ? <div className="tr-stack" aria-busy="true"><div className="tr-deck"><Card as="div" padding={4} className="tr-card"><Stack gap={3}><Row gap={3} justify="between" align="start"><Stack gap={1} style={{ flex: 1 }}><SkeletonBlock width={200} height={30} /><Row gap={2} align="center"><SkeletonBlock width={96} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width={90} height={14} /></Row></Stack><SkeletonBlock width={44} height={28} radius="var(--v-radius-pill)" /></Row><Row gap={2} align="center"><SkeletonBlock width={110} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width={84} height={14} /></Row><Stack gap={1}><SkeletonBlock width="70%" height={16} /><SkeletonBlock width="76%" height={16} /><SkeletonBlock width="64%" height={16} /></Stack></Stack></Card></div><Row gap={4} justify="center" className="tr-actions">{[1, 2, 3].map(i => <SkeletonBlock key={i} width={56} height={56} radius="var(--v-radius-pill)" />)}</Row><p className="tr-count"><SkeletonBlock width={200} height={14} style={{ margin: '0 auto' }} /></p></div>
      : <Card as="div" padding={3} aria-busy="true"><Stack gap={2}>{[1, 2, 3, 4, 5].map(i => <Row key={i} gap={3} align="center"><SkeletonBlock width={180} height={16} /><SkeletonBlock width={100} height={16} /><SkeletonBlock width={80} height={16} /><SkeletonBlock width={36} height={22} radius="var(--v-radius-pill)" /></Row>)}</Stack></Card>
  ) : error && !leads.length ? (
    <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
  ) : !pile.length ? (
    <Card><EmptyState icon="Inbox01" title={E.title} description={E.description} action={{ label: E.action, icon: 'Zap', onClick: () => onCapture?.() }} /></Card>
  ) : phone ? (
    <Stagger className="tr-stack" cap={3}>
      <div className="tr-deck">
        {pile[1] && <div className="tr-peek" aria-hidden="true" />}
        <TriageCard key={top._id} lead={top} score={scoreOf(top)} source={srcOf(top)} handlers={swipe.handlers} hint={hint}
          style={{ transform: `translate3d(${swipe.d.x}px, ${swipe.d.y}px, 0) rotate(${swipe.d.x / 18}deg)`, transition: swipe.d.x || swipe.d.y ? 'none' : undefined }} />
      </div>
      <Row gap={4} justify="center" align="center" className="tr-actions">
        <IconButton icon="XClose" label={`Bin ${top.business}`} variant="danger" size="lg" className="tr-round" onClick={() => act('bin', top)} />
        <IconButton icon="Clock" label={`Later, ${top.business} comes back in 30 days`} variant="secondary" size="lg" className="tr-round" onClick={() => act('later', top)} />
        <IconButton icon="Check" label={`Keep ${top.business}`} variant="primary" size="lg" className="tr-round" onClick={() => act('keep', top)} />
      </Row>
      <p className="tr-count" role="status">{pile.length === 1 ? 'Last one.' : `${pile.length - 1} more behind it.`} <button type="button" className="tr-link" onClick={() => onOpenLead?.(top)}>Open the record</button></p>
    </Stagger>
  ) : (
    <Stack gap={3}>
      <Table aria-label="Triage" columns={columns} rows={pile} rowKey={(l) => l._id} storageKey="vz_triage_cols" onRowClick={(l) => setFocusId(l._id)} rowActions={(l) => <Menu label={`${l.business} actions`} items={menuFor(l)} />}
        rowClassName={(l) => (focused && l._id === focused._id ? 'tr-focused' : '')} />
      <Row gap={3} wrap align="center" className="tr-keys" aria-label="Keys">
        {KEYS.map(([k, v]) => <span key={k} className="tr-key"><kbd>{k}</kbd> {v}</span>)}
        {focused && <Button variant="ghost" size="sm" onClick={() => onOpenLead?.(focused)}>Open {focused.business}</Button>}
      </Row>
    </Stack>
  );

  return (
    <PageShell className="aa-main aa-main--wide tr-shell">
      <ScrollArea>
        <Section title="Triage" loading={showSkel} description={showSkel ? undefined : pile.length ? `${pile.length} waiting, best first.` : 'Nothing waiting.'}
          action={onCapture ? <Button icon="Zap" variant="secondary" onClick={onCapture}>Capture a lead</Button> : undefined} />
        {body}
      </ScrollArea>
      {keepFor && <KeepSheet lead={keepFor} onClose={() => setKeepFor(null)} onDone={async (picked) => { const l = keepFor; setKeepFor(null); await keep(l, picked); }} onAddToList={shell?.openListPicker ? async (picked) => { const l = keepFor; setKeepFor(null); await addToList(l, picked); } : null} />}
      {moreFor && (
        <Sheet open onClose={() => setMoreFor(null)} title={moreFor.business} description="Park it or say no." label="More">
          <Stack gap={2}>
            <Button variant="secondary" icon="Clock" onClick={() => act('later', moreFor)}>Later, 30 days</Button>
            <Button variant="secondary" icon="SlashCircle01" onClick={() => act('decline', moreFor)}>Decline</Button>
            <Button variant="ghost" onClick={() => { const l = moreFor; setMoreFor(null); onOpenLead?.(l); }}>Open the record</Button>
          </Stack>
        </Sheet>
      )}
      {decline.sheet}
      <style>{trStyles}</style>
    </PageShell>
  );
}

const trStyles = `
  .tr-stack { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .tr-deck { position: relative; min-height: 220px; }
  .tr-card { position: relative; touch-action: pan-y; user-select: none; -webkit-user-select: none; will-change: transform; transition: transform var(--v-dur-base) var(--v-ease-spring); }
  .tr-peek { position: absolute; inset: 0; transform: translateY(10px) scale(0.96); border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); background: var(--v-surface-2); opacity: 0.7; pointer-events: none; z-index: 0; }
  .tr-deck .tr-card { position: relative; z-index: 1; }
  .tr-name { margin: 0; font-family: var(--v-font-display); font-size: var(--v-display-sm); font-weight: var(--v-weight-semibold); line-height: 1.1; color: var(--v-text); }
  .tr-area { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .tr-intel { margin: 0; padding: 0 0 0 var(--v-space-4); display: flex; flex-direction: column; gap: var(--v-space-1); font-size: var(--v-text-sm); color: var(--v-text-2); }
  .tr-score { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; height: 28px; padding: 0 var(--v-space-2); border-radius: var(--v-radius-pill); font-family: var(--v-font-display); font-size: var(--v-text-md); font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .tr-score--booked { background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .tr-score--new { background: var(--v-status-new-soft); color: var(--v-status-new-text); }
  .tr-score--neutral { background: var(--v-status-neutral-soft); color: var(--v-status-neutral-text); }
  .tr-hint { position: absolute; top: var(--v-space-3); display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); border-radius: var(--v-radius-pill); z-index: 2; }
  .tr-hint--keep { right: var(--v-space-3); background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .tr-hint--bin { left: var(--v-space-3); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); }
  .tr-hint--more { left: 50%; transform: translateX(-50%); background: var(--v-surface-3); color: var(--v-text-2); }
  .tr-actions { padding: var(--v-space-2) 0; }
  .tr-round { border-radius: var(--v-radius-pill); border: 1px solid var(--v-border); background: var(--v-surface-2); box-shadow: var(--v-shadow-1); }
  .tr-round.v-ibtn--primary { border-color: transparent; }
  .tr-count { margin: 0; text-align: center; font-size: var(--v-text-sm); color: var(--v-text-3); }
  .tr-link { display: inline-flex; align-items: center; min-height: var(--v-tap); padding: 0 var(--v-space-2); border: 0; background: transparent; color: var(--v-text-2); font: inherit; text-decoration: underline; cursor: pointer; }
  .tr-focused .v-td { background: var(--v-surface-2); }
  .tr-focused .v-td:first-child { box-shadow: inset 3px 0 0 var(--v-red); }
  .tr-cell-name { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .tr-keys { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .tr-key kbd { display: inline-block; min-width: 18px; padding: 0 var(--v-space-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-sm); background: var(--v-surface-2); font-family: var(--v-font-body); font-size: var(--v-text-xs); color: var(--v-text-2); text-align: center; }
  .tr-listrow { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap); padding: var(--v-space-2) var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text); font: inherit; font-weight: var(--v-weight-medium); text-align: left; cursor: pointer; }
  .tr-listrow:hover { border-color: var(--v-border-strong); }
  .tr-listrow:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .tr-listrow-hint { margin-left: auto; font-size: var(--v-text-xs); font-weight: var(--v-weight-regular); color: var(--v-text-3); }
  @media (prefers-reduced-motion: reduce) { .tr-card { transition: none; } }
  [data-v-motion="reduce"] .tr-card { transition: none; }
`;
