import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/* One navigation model for the admin (Back, done once).
 *
 * Every open of a record, an editor, a setup page, a sheet sized page or a
 * console mode is a history push, never a replace. The pushed entry's state
 * carries:
 *   open    { section, id, intent, mode }   what the entry shows inside its screen
 *   create  { section, preset }             a create form the entry opens
 *   preset  { section, preset }             a filter or builder preset for the screen
 *   origin  { path, search, scrollTop, panelScrollTop, selectedId, filters, view, tab }
 *           the screen that was leaving, captured at the moment of the push
 *   idx     the entry's depth, so a popstate can tell back from forward
 *
 * Back is history.back(). The popstate handler sees the entry that was left,
 * and when its origin points at the screen that comes back, hands that
 * origin to the screen (useRestore) and restores the scroll once the data
 * is present (never on a skeleton). Browser back and the phone's edge swipe
 * run through the same path, so Forward after Back re-opens the record from
 * the entry's own state.
 *
 * Section roots have no origin and no Back. A record reached by a deep link
 * (?open=, ?submission=, a push notification) has no origin either; its Back
 * goes to the section root. Sheets and modals are not history entries. */

let BASE = '';
export const setNavBase = (b) => { BASE = b || ''; };
const relOf = (pathname) => (BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname) || '/';
/* A section root is the first path segment alone: /, /leads, /settings. Everything deeper (an editor, /settings/deleted, /projects/new) is one level in. */
export const isSectionRoot = (pathname) => relOf(pathname).split('/').filter(Boolean).length <= 1;
export const sectionRootOf = (pathname) => { const seg = relOf(pathname).split('/').filter(Boolean)[0]; return `${BASE}/${seg || ''}`; };

/* ── The pending restore, handed from the popstate handler to the screen ── */
let pending = null; // { ...origin, n }
const subs = new Set();
const emit = () => subs.forEach(fn => fn());
const setPending = (o) => { pending = o; emit(); };
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const getPending = () => pending;

/* ── What the leaving screen holds beyond path and search ── */
let originGetter = null;
const scrollers = () => {
  const root = document.querySelector('.sh-content');
  if (!root) return { main: null, panel: null };
  const all = [...root.querySelectorAll('.lay-scroll')];
  const panel = all.find(el => el.closest('.aa-panel')) || null;
  const main = all.find(el => !el.closest('.aa-panel') && !el.closest('.v-sheet, .v-modal')) || null;
  return { main, panel };
};
export function captureOrigin(location, extra = {}) {
  const { main, panel } = scrollers();
  const g = (originGetter && originGetter()) || {};
  return {
    path: location.pathname, search: location.search || '',
    scrollTop: main ? Math.round(main.scrollTop) : 0, panelScrollTop: panel ? Math.round(panel.scrollTop) : 0,
    selectedId: extra.selectedId != null ? String(extra.selectedId) : (g.selectedId != null ? String(g.selectedId) : null),
    filters: g.filters ?? null, view: g.view ?? null, tab: g.tab ?? null,
  };
}
/** The mounted screen registers what it holds: () => ({ filters, view, tab, selectedId }). */
export function useScreenOrigin(getter) {
  const ref = useRef(getter); ref.current = getter;
  useEffect(() => { const fn = () => ref.current?.() || {}; originGetter = fn; return () => { if (originGetter === fn) originGetter = null; }; }, []);
}

/* ── Scroll and row restore, once the screen's data is present ── */
const HIGHLIGHT_MS = 2400;
/* The row that was opened gets .nav-restored for a moment. A list can re-render its rows while the mark is up (a
   filter restored on the same tick, an entrance ending), so the mark is re-asserted until its time is over. */
function highlightRow(id, main) {
  if (!id) return;
  const sel = `.sh-content [data-row-id="${CSS.escape(String(id))}"]`;
  const first = document.querySelector(sel);
  if (!first) return;
  if (main) { const r = first.getBoundingClientRect(); const m = main.getBoundingClientRect(); if (r.bottom < m.top || r.top > m.bottom) first.scrollIntoView({ block: 'nearest' }); }
  const until = Date.now() + HIGHLIGHT_MS;
  const mark = () => { const el = document.querySelector(sel); if (!el) return; if (Date.now() >= until) { el.classList.remove('nav-restored'); return; } el.classList.add('nav-restored'); setTimeout(mark, 150); };
  mark();
}
function restoreScroll(o) {
  const deadline = Date.now() + 3000;
  let calm = 0; // frames in a row with the data present, so the screen's own restore (a filter, a view) has rendered
  const tick = () => {
    const root = document.querySelector('.sh-content');
    if (!root) return;
    const busy = root.querySelector('.v-skel, [aria-busy="true"]');
    const { main, panel } = scrollers();
    if (busy && Date.now() < deadline) { calm = 0; requestAnimationFrame(tick); return; }
    if (calm < 2 && Date.now() < deadline) { calm++; requestAnimationFrame(tick); return; }
    const set = (el, top) => { if (!el) return true; const prev = el.style.scrollBehavior; el.style.scrollBehavior = 'auto'; el.scrollTop = top; el.style.scrollBehavior = prev; return Math.abs(el.scrollTop - top) <= 8; };
    const ok = set(main, o.scrollTop || 0) & set(panel, o.panelScrollTop || 0);
    if (!ok && Date.now() < deadline) { requestAnimationFrame(tick); return; }
    highlightRow(o.selectedId, main);
  };
  requestAnimationFrame(tick);
}

/* ── Hooks ── */
/** Mounted once in AdminApp: turns a popstate that lands on an entry's origin into a pending restore. */
export function useNavHistory() {
  const location = useLocation();
  const prev = useRef(null);
  useEffect(() => {
    const from = prev.current; prev.current = location;
    if (!from || from.key === location.key) return;
    const fromIdx = from.state?.idx || 0; const toIdx = location.state?.idx || 0;
    const o = from.state?.origin;
    /* Back: the entry we leave sits deeper than the one we land on, and it points at the screen that comes back. */
    if (o && toIdx < fromIdx && o.path === location.pathname) setPending({ ...o, n: Date.now() });
  }, [location]);
}
/** push(to, { open, create, preset, selectedId, replace }): a history push whose state carries the origin. */
export function usePush() {
  const navigate = useNavigate(); const location = useLocation();
  const loc = useRef(location); loc.current = location;
  return useCallback((to, opts = {}) => {
    const cur = loc.current;
    const origin = captureOrigin(cur, { selectedId: opts.selectedId });
    const idx = (cur.state?.idx || 0) + 1;
    const state = { idx, origin, ...(opts.open ? { open: opts.open } : {}), ...(opts.create ? { create: opts.create } : {}), ...(opts.preset ? { preset: opts.preset } : {}) };
    if (opts.replace) { state.idx = cur.state?.idx || 0; state.origin = cur.state?.origin || null; }
    navigate(to, { state, replace: !!opts.replace });
  }, [navigate]);
}
/** push by admin relative path (/design), for a screen that does not hold BASE. */
export function usePushRel() { const push = usePush(); return useCallback((rel, opts) => push(`${BASE}${rel}`, opts), [push]); }
/** The entry's own request for one section: { section, id, intent, mode, n }. */
export function useOpenEntry(section) { const { state } = useLocation(); const o = state?.open; return o && o.section === section ? o : null; }
export function useCreateEntry(section) { const { state } = useLocation(); const o = state?.create; return o && o.section === section ? o : null; }
export function usePresetEntry(section) { const { state } = useLocation(); const o = state?.preset; return o && o.section === section ? o : null; }
/** Back for the current entry: null at a section root, else { back, deep } (deep: no origin, Back goes to the section root). */
export function useBack() {
  const location = useLocation(); const navigate = useNavigate();
  const origin = location.state?.origin || null;
  const inside = !!location.state?.open || !!location.state?.create || !isSectionRoot(location.pathname);
  const root = sectionRootOf(location.pathname);
  const back = useCallback(() => { if (origin) navigate(-1); else navigate(root, { replace: true }); }, [origin, navigate, root]);
  if (!origin && !inside) return null;
  return { back, deep: !origin, origin };
}
/** A screen's own record or mode: selId from the entry, open() pushes, close() goes back. */
export function useSelection(section) {
  const location = useLocation(); const push = usePush(); const nav = useBack();
  const entry = useOpenEntry(section);
  const selId = entry?.id != null ? String(entry.id) : null;
  const loc = useRef(location); loc.current = location;
  const open = useCallback((id, extra = {}) => {
    const cur = loc.current;
    push(cur.pathname + (cur.search || ''), { open: { section, id: String(id), n: Date.now(), ...extra }, selectedId: id, replace: !!extra.replace });
  }, [push, section]);
  const navRef = useRef(nav); navRef.current = nav;
  const close = useCallback(() => { navRef.current?.back(); }, []);
  return { entry, selId, open, close };
}
/** apply(origin) runs once when this screen comes back through Back; the scroll and the row follow once the data is present. */
export function useRestore(apply) {
  const location = useLocation();
  const p = useSyncExternalStore(subscribe, getPending, getPending);
  const ref = useRef(apply); ref.current = apply;
  useEffect(() => {
    if (!p || p.path !== location.pathname) return;
    setPending(null);
    try { ref.current?.(p); } catch { /* the screen decides what it restores */ }
    restoreScroll(p);
  }, [p, location.pathname]);
}
export const navHistoryStyles = `
  .nav-restored { outline: 2px solid var(--v-border-focus); outline-offset: 2px; transition: outline-color var(--v-dur-slow) var(--v-ease-out); }
`;
