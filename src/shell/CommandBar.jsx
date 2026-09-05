import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import UserPlus01 from '@untitled-ui/icons-react/build/esm/UserPlus01';
import { Input, Popover, Sheet, Pill, Icon, Avatar, SegmentedControl, ListRow, SkeletonBlock, useDelayedLoading, useMediaQuery, DESKTOP_QUERY } from '../ui';
import { formatPhone, digitsOf } from '../shared/phone';
import { CALL_STATUSES } from '../shared/semantics';
import { serviceLabel } from '../lib/booked';
import { searchAll } from './search';
import { navById } from './nav';
import { KEYS, readJSON, writeJSON } from './storage';

/**
 * Command bar. Desktop: the top bar Input with a Popover of results.
 * Mobile: a full-height Sheet with the input pinned at the top.
 * Groups: Leads, Clients, Jump to. Digit queries behave like the old
 * reverse phone lookup. Recent (last 8) shows when the query is empty.
 */
const MAX_RECENT = 8;

function ResultRow({ item, active, onPick, onHover }) {
  const l = item.lead;
  const common = { onClick: () => onPick(item), onMouseEnter: onHover, className: `sh-cmd-row${active ? ' is-active' : ''}`, chevron: false, role: 'option', 'aria-selected': active };
  if (item.type === 'lead') {
    return <ListRow {...common} leading={<Avatar name={l.business} size="sm" />} title={l.business}
      subtitle={<span className="sh-cmd-sub">{l.industry && <Pill tone="neutral" label={l.industry} icon={false} size="sm" variant="outline" />}<span>{formatPhone(l.phone) || 'No phone'}</span></span>}
      trailing={<Pill id={l.callStatus} list={CALL_STATUSES} size="sm" />} />;
  }
  if (item.type === 'client') {
    const pkg = l.servicesPlanned?.length ? l.servicesPlanned.slice(0, 2).map(serviceLabel).join(', ') + (l.servicesPlanned.length > 2 ? ` +${l.servicesPlanned.length - 2}` : '') : 'No package yet';
    return <ListRow {...common} leading={<Avatar name={l.business} size="sm" status="booked" />} title={l.business} subtitle={pkg} trailing={<Pill id="client" size="sm" />} />;
  }
  if (item.type === 'jump') {
    return <ListRow {...common} leading={<span className="sh-cmd-jumpicon"><Icon icon={item.nav.icon} size="var(--v-icon-md)" /></span>} title={item.nav.label} subtitle="Jump to" />;
  }
  return <ListRow {...common} leading={<span className="sh-cmd-jumpicon sh-cmd-jumpicon--add"><UserPlus01 width={18} height={18} /></span>} title="Add as new lead" subtitle={`Start a lead with ${item.pretty}`} />;
}

export default function CommandBar({ open, onOpenChange, leads, leadsLoading, onRefetch, onOpenLead, onJump, onNewLead }) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('text');
  const [idx, setIdx] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [recent, setRecent] = useState(() => readJSON(KEYS.recent, []));
  const inputRef = useRef(null);
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const showSkel = useDelayedLoading(leadsLoading || fetching);

  const res = useMemo(() => searchAll(q, leads), [q, leads]);
  const flat = useMemo(() => {
    if (!q.trim()) {
      return recent.map(r => {
        if (r.type === 'jump') { const nav = navById(r.id); return nav ? { type: 'jump', nav, key: `j:${nav.id}` } : null; }
        const lead = leads.find(l => l._id === r.id);
        return lead ? { type: r.type, lead, key: `${r.type}:${lead._id}` } : null;
      }).filter(Boolean);
    }
    const out = [
      ...res.leads.map(x => ({ type: 'lead', lead: x.lead, key: `l:${x.lead._id}` })),
      ...res.clients.map(x => ({ type: 'client', lead: x.lead, key: `c:${x.lead._id}` })),
      ...res.jumps.map(n => ({ type: 'jump', nav: n, key: `j:${n.id}` })),
    ];
    if (res.digits && !out.length && !showSkel) out.push({ type: 'add', pretty: res.digitsPretty, digits: digitsOf(q), key: 'add' });
    return out;
  }, [q, res, recent, leads, showSkel]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { if (!open) { setQ(''); setMode('text'); } else if (desktop) setTimeout(() => inputRef.current?.focus(), 0); }, [open, desktop]);
  useEffect(() => { if (q && /^\d/.test(q.trim()) && mode === 'text') setMode('tel'); }, [q, mode]);

  // Debounced refetch when memory has nothing for the query (keeps results fresh after the nightly jobs).
  useEffect(() => {
    if (!open || !q.trim() || res.leads.length || res.clients.length || !onRefetch) return undefined;
    const t = setTimeout(async () => { setFetching(true); try { await onRefetch(); } finally { setFetching(false); } }, 350);
    return () => clearTimeout(t);
  }, [q, open, res.leads.length, res.clients.length, onRefetch]);

  const remember = (item) => {
    const entry = item.type === 'jump' ? { type: 'jump', id: item.nav.id } : { type: item.type, id: item.lead._id };
    const next = [entry, ...recent.filter(r => !(r.type === entry.type && r.id === entry.id))].slice(0, MAX_RECENT);
    setRecent(next); writeJSON(KEYS.recent, next);
  };
  const pick = useCallback((item) => {
    if (!item) return;
    if (item.type === 'add') { onOpenChange(false); onNewLead({ phone: item.pretty }); return; }
    remember(item);
    onOpenChange(false);
    if (item.type === 'jump') onJump(item.nav); else onOpenLead(item.lead);
  }, [onOpenChange, onJump, onOpenLead, onNewLead, recent]);

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(flat[idx]); }
    else if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false); inputRef.current?.blur(); }
  };
  useEffect(() => { listRef.current?.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' }); }, [idx]);

  const groupLabel = (i) => {
    if (!q.trim()) return i === 0 ? 'Recent' : null;
    const item = flat[i]; const prev = flat[i - 1];
    if (prev && prev.type === item.type) return null;
    return { lead: 'Leads', client: 'Clients', jump: 'Jump to', add: 'No match' }[item.type];
  };

  const results = (
    <div ref={listRef} className="sh-cmd-list" role="listbox" aria-label="Results">
      {showSkel && q.trim() && !flat.length && [1, 2, 3].map(i => <ListRow.Skeleton key={i} />)}
      {!q.trim() && !flat.length && <p className="sh-cmd-hint">Type a business, a name, an industry, or the number that is calling. Recent results land here.</p>}
      {q.trim() && !flat.length && !showSkel && !res.digits && <p className="sh-cmd-hint">Nothing matches "{q}". Try a shorter word or the phone number.</p>}
      {flat.map((item, i) => (
        <div key={item.key} className="sh-cmd-item">
          {groupLabel(i) && <p className="sh-cmd-group">{groupLabel(i)}</p>}
          <ResultRow item={item} active={i === idx} onPick={pick} onHover={() => setIdx(i)} />
        </div>
      ))}
    </div>
  );

  const input = (
    <Input ref={inputRef} className="sh-cmd-field" placeholder={desktop ? 'Search leads, clients, or jump to a screen' : 'Search or paste a number'} value={q}
      onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onFocus={() => onOpenChange(true)}
      inputMode={mode === 'tel' ? 'tel' : 'text'} autoComplete="off" spellCheck={false} aria-label="Search" role="combobox" aria-expanded={open} aria-autocomplete="list"
      leading={<SearchMd width={16} height={16} />}
      trailing={desktop
        ? (q ? <button type="button" className="sh-cmd-clear" onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Clear"><XClose width={14} height={14} /></button> : <kbd className="sh-kbd">/</kbd>)
        : <SegmentedControl size="sm" label="Keyboard" options={[{ id: 'text', label: 'Abc' }, { id: 'tel', label: '123' }]} value={mode} onChange={(m) => { setMode(m); inputRef.current?.focus(); }} />}
    />
  );

  if (desktop) {
    return (
      <div ref={anchorRef} className="sh-cmd">
        {input}
        <Popover open={open} onClose={() => onOpenChange(false)} anchorRef={anchorRef} align="stretch" trap={false} label="Search results" className="sh-cmd-pop">
          {results}
        </Popover>
      </div>
    );
  }
  return (
    <Sheet open={open} onClose={() => onOpenChange(false)} tall label="Search" className="sh-cmd-sheet">
      <div className="sh-cmd-mobile">
        {input}
        {results}
      </div>
    </Sheet>
  );
}

export const commandBarStyles = `
  .sh-cmd { width: 100%; max-width: 560px; }
  .sh-cmd .v-field-shell { min-height: var(--v-control-h); background: var(--v-surface-2); }
  .sh-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border-strong); background: var(--v-surface-3); color: var(--v-text-3); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--v-text-xs); }
  .sh-cmd-clear { display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); margin-right: calc(-1 * var(--v-space-3)); border: 0; border-radius: var(--v-radius-sm); background: transparent; color: var(--v-text-3); cursor: pointer; }
  .sh-cmd-clear:hover { color: var(--v-text); background: var(--v-surface-3); }
  .sh-cmd-pop { padding: var(--v-space-1); }
  .sh-cmd-list { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sh-cmd-item { display: flex; flex-direction: column; gap: 2px; }
  .sh-cmd-group { margin: var(--v-space-2) var(--v-space-3) var(--v-space-1); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .sh-cmd-row { border-color: transparent; background: transparent; min-height: var(--v-tap-lg); }
  .sh-cmd-row.is-active, .sh-cmd-row:hover { background: var(--v-surface-3); border-color: var(--v-border); }
  .sh-cmd-sub { display: inline-flex; align-items: center; gap: var(--v-space-2); min-width: 0; }
  .sh-cmd-jumpicon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--v-radius-md); background: var(--v-surface-3); color: var(--v-text-2); }
  .sh-cmd-jumpicon--add { background: var(--v-red-soft); color: var(--v-red-highlight); }
  .sh-cmd-hint { margin: 0; padding: var(--v-space-4) var(--v-space-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .sh-cmd-mobile { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .sh-cmd-sheet .v-sheet-body { padding-top: var(--v-space-3); }
  .sh-cmd-mobile .v-field-trail .v-seg { margin-right: calc(-1 * var(--v-space-2)); }
`;
