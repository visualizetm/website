import { useCallback, useEffect, useMemo, useState } from 'react';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import { Badge, Tooltip, Menu, Avatar, Icon, SkeletonBlock, Collapsible } from '../ui';
import { navGroups, NAV_GROUP_META } from './nav';
import { KEYS, readJSON, writeJSON } from './storage';
import { CONTACTED_STATUSES } from '../lib/leads';

/**
 * Desktop sidebar (768px and up), rebuilt around the pipeline: a strip of
 * the four stage numbers with the conversion between each, then the
 * destinations as collapsible groups in the order a client is landed
 * (Pipeline, Clients, Studio, System). Each group is a disclosure (a button
 * with aria-expanded and aria-controls over the list it opens), its state
 * persisted per device, and a closed group still shows the sum of its
 * badges so nothing needing attention is hidden. Only the group holding
 * the current screen is open the first time; the active screen's group
 * opens itself if it was closed. Collapsed to the rail, each group is one
 * icon with a tooltip naming its items and a menu that opens them. Renders
 * from nav.js.
 */
const groupId = (g) => `sh-group-${g.toLowerCase()}`;

function PipelineStrip({ funnel, onGo }) {
  const f = funnel || { leads: 0, contacted: 0, booked: 0, clients: 0 };
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : null);
  const steps = [
    { id: 'leads', label: 'Leads', n: f.leads, go: () => onGo('leads') },
    { id: 'contacted', label: 'Contacted', n: f.contacted, pct: pct(f.contacted, f.leads), go: () => onGo('leads', { status: [...CONTACTED_STATUSES] }) },
    { id: 'booked', label: 'Booked', n: f.booked, pct: pct(f.booked, f.contacted), go: () => onGo('booked') },
    { id: 'clients', label: 'Clients', n: f.clients, pct: pct(f.clients, f.booked), go: () => onGo('clients') },
  ];
  return (
    <div className="sh-strip" role="group" aria-label="Pipeline: leads, contacted, booked, clients">
      {steps.map((s, i) => (
        <span key={s.id} className="sh-strip-cell">
          {i > 0 && <span className="sh-strip-pct" aria-label={s.pct ? `${s.pct} from the previous stage` : undefined}>{s.pct || ''}</span>}
          <button type="button" className="sh-strip-btn" onClick={s.go} aria-label={`${s.label}, ${s.n}${s.pct ? `, ${s.pct} of the previous stage` : ''}`}>
            <span className="sh-strip-n">{s.n}</span>
            <span className="sh-strip-label">{s.label}</span>
          </button>
        </span>
      ))}
    </div>
  );
}

export default function Sidebar({ collapsed, canToggle = true, onToggle, activeId, counts, countsLoading, funnel, onGo, menuItems }) {
  const groups = navGroups();
  const activeGroup = groups.find(g => g.items.some(n => n.id === activeId))?.group;
  /* Persisted per device. First time: only the active screen's group is open. */
  const [open, setOpen] = useState(() => {
    const saved = readJSON(KEYS.sideGroups, null);
    if (saved && typeof saved === 'object') return saved;
    return Object.fromEntries(groups.map(g => [g.group, g.group === activeGroup]));
  });
  useEffect(() => { if (activeGroup && !open[activeGroup]) setOpen(o => { const n = { ...o, [activeGroup]: true }; writeJSON(KEYS.sideGroups, n); return n; }); }, [activeGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = useCallback((g) => setOpen(o => { const n = { ...o, [g]: !o[g] }; writeJSON(KEYS.sideGroups, n); return n; }), []);
  const countOf = (n) => (n.badge ? counts?.[n.badge] || 0 : 0);
  const groupCount = useMemo(() => Object.fromEntries(groups.map(g => [g.group, g.items.reduce((s, n) => s + countOf(n), 0)])), [groups, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = (n) => {
    const count = countOf(n);
    const active = n.id === activeId;
    return (
      <button key={n.id} type="button"
        className={`sh-nav${active ? ' is-active' : ''}${n.soon ? ' is-soon' : ''}`}
        onClick={() => !n.soon && onGo(n.id)} disabled={n.soon} aria-current={active ? 'page' : undefined}>
        <span className="sh-nav-icon"><Icon icon={n.icon} size="var(--v-icon-md)" /></span>
        <span className="sh-nav-label">{n.label}</span>
        {n.soon && <span className="sh-nav-soon">Soon</span>}
        {!n.soon && n.badge && (countsLoading ? <SkeletonBlock width={22} height={18} radius="var(--v-radius-pill)" /> : count > 0 && <Badge count={count} inline tone={active ? 'won' : 'neutral'} />)}
      </button>
    );
  };

  return (
    <nav className={`sh-side${collapsed ? ' is-collapsed' : ''}`} aria-label="Admin sections">
      <button type="button" className="sh-side-brand" onClick={() => onGo('dashboard')} aria-label="Dashboard">
        <span className="img-fit img-fit--1x1 img-fit--contain sh-side-mark">
          <img src="/logo.svg" alt="" width="28" height="28" />
        </span>
        {!collapsed && <span className="sh-wordmark">Visualize<span className="sh-wordmark-dot">.</span></span>}
      </button>
      {!collapsed && <PipelineStrip funnel={funnel} onGo={onGo} />}
      <div className="sh-side-groups">
        {groups.map(g => {
          const meta = NAV_GROUP_META[g.group] || {};
          const isOpen = !!open[g.group];
          const total = groupCount[g.group] || 0;
          const holdsActive = g.group === activeGroup;
          if (collapsed) {
            /* The rail: one icon per group, its items in the tooltip and in a menu. */
            const names = g.items.map(n => n.label).join(', ');
            return (
              <div key={g.group} className="sh-side-group sh-side-group--rail">
                <Tooltip label={`${g.group}: ${names}`} side="right">
                  <Menu label={`${g.group} sections`} align="start"
                    items={g.items.map(n => ({ id: n.id, label: n.label, icon: n.icon, disabled: !!n.soon, onSelect: () => onGo(n.id) }))}
                    trigger={(
                      <button type="button" className={`sh-nav sh-nav--group${holdsActive ? ' is-active' : ''}`} aria-label={`${g.group}: ${names}`} aria-haspopup="menu">
                        <span className="sh-nav-icon"><Icon icon={meta.icon || 'LayoutAlt01'} size="var(--v-icon-md)" />{total > 0 && <Badge count={total} />}</span>
                      </button>
                    )} />
                </Tooltip>
              </div>
            );
          }
          return (
            <div key={g.group} className={`sh-side-group${isOpen ? ' is-open' : ''}`}>
              <button type="button" className="sh-group-btn" onClick={() => toggle(g.group)} aria-expanded={isOpen} aria-controls={groupId(g.group)}>
                <span className="sh-side-label">{g.group}</span>
                {!isOpen && meta.blurb && <span className="sh-group-blurb lay-truncate">{meta.blurb}</span>}
                {!isOpen && total > 0 && <Badge count={total} inline tone="neutral" />}
                <ChevronDown width={14} height={14} className="sh-group-chev" aria-hidden="true" />
              </button>
              <Collapsible open={isOpen}>
                <div id={groupId(g.group)} role="group" aria-label={`${g.group} sections`} className="sh-group-items">
                  {g.items.map(item)}
                </div>
              </Collapsible>
            </div>
          );
        })}
      </div>
      <div className="sh-side-bottom">
        <Menu label="Account" align="start" items={menuItems}
          trigger={
            <button type="button" className="sh-side-user" aria-label="Account menu">
              <Avatar name="Rob" size="sm" />
              {!collapsed && <span className="sh-side-user-text"><strong>Rob</strong><span>Visualize Studio</span></span>}
            </button>
          } />
        {canToggle && (
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="top">
            <button type="button" className="sh-side-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
              {collapsed ? <ChevronRight width={16} height={16} /> : <ChevronLeft width={16} height={16} />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}

export const sidebarStyles = `
  .sh-side {
    display: none; flex-direction: column; flex-shrink: 0;
    width: var(--v-sidebar-w); height: 100%; min-height: 0;
    background: var(--v-sidebar-bg);
    border-right: 1px solid var(--v-sidebar-border); color: var(--v-sidebar-text);
    padding: var(--v-space-3) var(--v-space-2) calc(var(--v-space-3) + var(--v-inset-bottom)) max(var(--v-space-2), env(safe-area-inset-left));
    transition: width var(--v-dur-base) var(--v-ease-out);
  }
  .sh-side.is-collapsed { width: var(--v-sidebar-rail-w); }
  @media (min-width: 768px) { .sh-side { display: flex; } }
  .sh-side-brand { display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); padding: 0 var(--v-space-2); margin-bottom: var(--v-space-2); border: 0; background: transparent; border-radius: var(--v-radius-md); color: var(--v-sidebar-text); cursor: pointer; }
  .sh-side-brand:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .sh-side-mark { width: 28px; flex-shrink: 0; }
  .sh-side.is-collapsed .sh-side-brand { justify-content: center; padding: 0; }
  .sh-wordmark { font-family: var(--v-font-body); font-size: var(--v-text-lg); font-weight: var(--v-weight-bold); letter-spacing: -0.02em; white-space: nowrap; }
  .sh-wordmark-dot { color: var(--v-red); }
  /* The pipeline strip: four numbers, the conversion between each. */
  .sh-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0 0 var(--v-space-3); padding: var(--v-space-2) var(--v-space-1); border: 1px solid var(--v-sidebar-border); border-radius: var(--v-radius-md); background: var(--v-sidebar-hover); }
  .sh-strip-cell { position: relative; display: flex; min-width: 0; }
  .sh-strip-pct { position: absolute; left: 0; top: 2px; transform: translateX(-50%); font-size: 9px; line-height: 12px; font-weight: var(--v-weight-bold); color: var(--v-sidebar-text-3); background: var(--v-sidebar-bg); border: 1px solid var(--v-sidebar-border); border-radius: var(--v-radius-pill); padding: 0 4px; white-space: nowrap; pointer-events: none; }
  .sh-strip-btn { flex: 1; min-width: 0; min-height: var(--v-tap); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 2px 0 0; border: 0; border-radius: var(--v-radius-sm); background: transparent; color: var(--v-sidebar-text-2); cursor: pointer; font-family: var(--v-font-body); }
  .sh-strip-btn:hover { color: var(--v-sidebar-text); background: var(--v-sidebar-active-bg); }
  .sh-strip-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-strip-n { font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: 1.1; font-weight: var(--v-weight-bold); color: var(--v-sidebar-text); font-variant-numeric: tabular-nums; }
  .sh-strip-label { font-size: 9px; line-height: 12px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-sidebar-text-3); white-space: nowrap; }
  .sh-side-groups { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: var(--v-space-2); scrollbar-width: none; }
  .sh-side-groups::-webkit-scrollbar { display: none; }
  .sh-side-group { display: flex; flex-direction: column; gap: 2px; }
  .sh-side-group--rail { align-items: center; }
  /* The group disclosure: the label row is the button. */
  .sh-group-btn { display: flex; align-items: center; gap: var(--v-space-2); width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-sidebar-text-3); cursor: pointer; text-align: left; font-family: var(--v-font-body); }
  .sh-group-btn:hover { background: var(--v-sidebar-hover); color: var(--v-sidebar-text-2); }
  .sh-group-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-group-btn .sh-side-label { padding: 0; }
  .sh-group-blurb { flex: 1; min-width: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-sidebar-text-3); font-weight: var(--v-weight-medium); text-transform: none; letter-spacing: 0; }
  .sh-group-btn .v-badge--inline { margin-left: auto; }
  .sh-group-blurb + .v-badge--inline { margin-left: 0; }
  .sh-group-chev { flex-shrink: 0; margin-left: auto; transition: transform var(--v-dur-fast) var(--v-ease-out); }
  .sh-group-blurb ~ .sh-group-chev, .v-badge--inline ~ .sh-group-chev { margin-left: 0; }
  .sh-side-group.is-open .sh-group-chev { transform: rotate(180deg); }
  .sh-group-items { display: flex; flex-direction: column; gap: 2px; padding-bottom: var(--v-space-1); }
  .sh-side-label { margin: 0; padding: 0 var(--v-space-3); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .sh-side .sh-side-label { color: var(--v-sidebar-text-3); }
  .sh-nav {
    position: relative; display: flex; align-items: center; gap: var(--v-space-3); width: 100%;
    min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md);
    background: transparent; color: var(--v-sidebar-text-2); cursor: pointer; text-align: left;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold);
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out);
  }
  .sh-side.is-collapsed .sh-nav { justify-content: center; padding: 0; width: var(--v-tap); }
  .sh-nav:hover:not(:disabled) { background: var(--v-sidebar-hover); color: var(--v-sidebar-text); }
  .sh-nav:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-nav.is-active { background: var(--v-sidebar-active-bg); color: var(--v-sidebar-active); }
  .sh-nav.is-active::before { content: ''; position: absolute; left: -2px; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: var(--v-sidebar-active); }
  .sh-side.is-collapsed .sh-nav.is-active::before { left: 0; }
  .sh-nav.is-soon { opacity: 0.5; cursor: not-allowed; }
  .sh-nav-icon { position: relative; display: inline-flex; flex-shrink: 0; }
  .sh-nav-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sh-nav-soon { font-size: 10px; line-height: 1; letter-spacing: 0.08em; text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-sidebar-text-3); border: 1px solid var(--v-sidebar-border); border-radius: var(--v-radius-pill); padding: 3px 6px; }
  .sh-side-bottom { display: flex; flex-direction: column; gap: 0; padding-top: var(--v-space-2); border-top: 1px solid var(--v-sidebar-border); }
  .sh-side-user { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-2); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-sidebar-text); cursor: pointer; text-align: left; font-family: var(--v-font-body); }
  .sh-side-user:hover { background: var(--v-sidebar-hover); }
  .sh-side-user:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-side.is-collapsed .sh-side-user { justify-content: center; padding: 0; }
  .sh-side-user-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
  .sh-side-user-text strong { font-size: var(--v-text-sm); }
  .sh-side-user-text span { font-size: var(--v-text-xs); color: var(--v-sidebar-text-3); }
  .sh-side-toggle { display: flex; align-items: center; gap: var(--v-space-2); width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-sidebar-text-2); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); }
  .sh-side.is-collapsed .sh-side-toggle { justify-content: center; padding: 0; }
  .sh-side-toggle:hover { background: var(--v-sidebar-hover); color: var(--v-sidebar-text); }
  .sh-side .v-badge--inline { background: rgba(255,255,255,0.10); color: var(--v-sidebar-text-2); }
  .sh-side .sh-nav.is-active .v-badge--inline { background: var(--v-red-hover); color: var(--v-text-on-red); }
  .sh-side-toggle:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-side .v-menu, .sh-side .v-menu-trig { width: 100%; }
  .sh-side-group--rail .v-menu, .sh-side-group--rail .v-menu-trig { width: auto; }
`;
