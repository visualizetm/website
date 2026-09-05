import { useEffect, useMemo, useRef, useState } from 'react';
import ArrowUp from '@untitled-ui/icons-react/build/esm/ArrowUp';
import ArrowDown from '@untitled-ui/icons-react/build/esm/ArrowDown';
import Columns03 from '@untitled-ui/icons-react/build/esm/Columns03';
import Checkbox from './Checkbox';
import IconButton from './IconButton';
import Popover from './Popover';
import { SkeletonBlock } from './Skeleton';
import { durationMs } from './motion';
/**
 * Table: sticky header, sortable columns, row selection, column chooser,
 * density, sticky first column on horizontal scroll, empty slot.
 *
 * @param {object} props
 * @param {Array<{id: string, label: string, render: (row) => ReactNode, sortable?: boolean, width?: number|string, align?: 'start'|'end', sticky?: boolean, always?: boolean}>} props.columns
 *   `always` columns cannot be hidden in the chooser; the first column is sticky on scroll by default.
 * @param {Array} props.rows already sorted by the parent
 * @param {Function} [props.rowKey] (row) => key, default row._id
 * @param {boolean} [props.selectable] header and row checkboxes
 * @param {Set} [props.selected] selected keys
 * @param {Function} [props.onSelect] (nextSet) => void
 * @param {{id: string, dir: 'asc'|'desc'}} [props.sort] current sort (controlled)
 * @param {Function} [props.onSort] ({id, dir}) => void
 * @param {'md'|'sm'} [props.density='md']
 * @param {Function} [props.onRowClick] (row) => void
 * @param {Function} [props.rowActions] (row) => ReactNode rendered in a trailing cell (a Menu)
 * @param {string} [props.storageKey] persist hidden columns in localStorage
 * @param {boolean} [props.columnChooser=true]
 * @param {import('react').ReactNode} [props.empty] shown when rows is empty
 * @param {Function} [props.rowClassName] (row) => string
 * @param {number} [props.pageSize=80] rows mounted per page; the next page mounts as the end scrolls into view
 */
export default function Table({
  columns, rows, rowKey = (r) => r._id, selectable = false, selected, onSelect, sort, onSort, density = 'md',
  onRowClick, rowActions, storageKey, columnChooser = true, empty, rowClassName, className = '', 'aria-label': label, pageSize = 80,
}) {
  // Windowing (Prompt 15): only the first `pageSize` rows render; a sentinel under the table extends the
  // window by another page as it scrolls into view, so 400 rows never mount at once. Selection and sort
  // still cover every row (they read `rows`), only the DOM is paged.
  const [limit, setLimit] = useState(pageSize);
  const sentinelRef = useRef(null);
  useEffect(() => { setLimit(pageSize); }, [rows.length, sort?.id, sort?.dir, pageSize]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || limit >= rows.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) setLimit(l => Math.min(rows.length, l + pageSize)); }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, rows.length, pageSize]);
  const shown = rows.length > limit ? rows.slice(0, limit) : rows;
  const [hidden, setHidden] = useState(() => {
    try { return new Set(storageKey ? JSON.parse(localStorage.getItem(storageKey) || '[]') : []); } catch { return new Set(); }
  });
  useEffect(() => { if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify([...hidden])); } catch { /* fine */ } } }, [hidden, storageKey]);
  const [chooserOpen, setChooserOpen] = useState(false);
  // Row entrance (Prompt 14): the first 8 rows step in --v-stagger apart on
  // mount, everything after arrives with the eighth; rows added later settle.
  const [entering, setEntering] = useState(true);
  useEffect(() => { const t = setTimeout(() => setEntering(false), durationMs('--v-dur-enter') + 8 * durationMs('--v-stagger') + 50); return () => clearTimeout(t); }, []);
  const chooserRef = useRef(null);
  const visible = useMemo(() => columns.filter(c => c.always || !hidden.has(c.id)), [columns, hidden]);
  const keys = rows.map(rowKey);
  const allOn = selectable && rows.length > 0 && keys.every(k => selected?.has(k));
  const someOn = selectable && !allOn && keys.some(k => selected?.has(k));
  const toggleAll = () => { const next = new Set(selected || []); if (allOn) keys.forEach(k => next.delete(k)); else keys.forEach(k => next.add(k)); onSelect?.(next); };
  const toggleRow = (k) => { const next = new Set(selected || []); next.has(k) ? next.delete(k) : next.add(k); onSelect?.(next); };
  const clickSort = (c) => { if (!c.sortable || !onSort) return; onSort({ id: c.id, dir: sort?.id === c.id && sort.dir === 'asc' ? 'desc' : sort?.id === c.id ? 'asc' : (c.defaultDir || 'asc') }); };

  return (
    <div className={`v-table-wrap ${className}`.trim()}>
      <div className="v-table-scroll">
        <table className={`v-table v-table--${density}`} aria-label={label}>
          <thead>
            <tr>
              {selectable && <th className="v-th v-th--check v-td--sticky"><Checkbox checked={allOn} indeterminate={someOn} onChange={toggleAll} aria-label="Select all rows" /></th>}
              {visible.map((c, i) => {
                const on = sort?.id === c.id;
                return (
                  <th key={c.id} className={`v-th${c.sortable ? ' v-th--sortable' : ''}${on ? ' is-sorted' : ''}${i === 0 && !selectable ? ' v-td--sticky' : ''}${c.align === 'end' ? ' v-td--end' : ''}`}
                    style={{ width: c.width }} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortable ? (
                      <button type="button" className="v-th-btn" onClick={() => clickSort(c)}>
                        <span>{c.label}</span>
                        {on ? (sort.dir === 'asc' ? <ArrowUp width={12} height={12} /> : <ArrowDown width={12} height={12} />) : <ArrowDown width={12} height={12} className="v-th-hint" />}
                      </button>
                    ) : <span className="v-th-txt">{c.label}</span>}
                  </th>
                );
              })}
              {(rowActions || columnChooser) && (
                <th className="v-th v-th--actions">
                  <span className="v-sr-only">Actions</span>
                  {columnChooser && (
                    <span ref={chooserRef}>
                      <IconButton icon={Columns03} label="Choose columns" size="md" onClick={() => setChooserOpen(o => !o)} aria-expanded={chooserOpen} tooltip={false} />
                      <Popover open={chooserOpen} onClose={() => setChooserOpen(false)} anchorRef={chooserRef} align="end" width={240} trap label="Columns">
                        <div className="v-table-chooser">
                          {columns.map(c => <Checkbox key={c.id} label={c.label} checked={c.always || !hidden.has(c.id)} disabled={c.always} onChange={(v) => setHidden(h => { const n = new Set(h); v ? n.delete(c.id) : n.add(c.id); return n; })} />)}
                        </div>
                      </Popover>
                    </span>
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, ri) => {
              const k = rowKey(row);
              const on = selected?.has(k);
              return (
                <tr key={k} className={`v-tr${onRowClick ? ' v-tr--click' : ''}${on ? ' is-selected' : ''}${entering ? ' v-tr--enter' : ''} ${rowClassName?.(row) || ''}`.trim()} data-v-enter="" style={entering ? { animationDelay: `calc(${Math.min(ri, 8)} * var(--v-stagger))` } : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined} tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined} aria-selected={on || undefined}>
                  {selectable && <td className="v-td v-td--check v-td--sticky" onClick={(e) => e.stopPropagation()}><Checkbox checked={!!on} onChange={() => toggleRow(k)} aria-label="Select row" /></td>}
                  {visible.map((c, i) => <td key={c.id} className={`v-td${i === 0 && !selectable ? ' v-td--sticky' : ''}${c.align === 'end' ? ' v-td--end' : ''}`}>{c.render(row)}</td>)}
                  {(rowActions || columnChooser) && <td className="v-td v-td--actions" onClick={(e) => e.stopPropagation()}>{rowActions?.(row)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="v-table-empty">{empty}</div>}
        {rows.length > shown.length && <div ref={sentinelRef} className="v-table-more"><button type="button" className="v-table-more-btn" onClick={() => setLimit(l => Math.min(rows.length, l + pageSize))}>Show more ({rows.length - shown.length} of {rows.length} to go)</button></div>}
      </div>
    </div>
  );
}

/** Table.Skeleton: same header shape, `rows` shimmer rows. */
Table.Skeleton = function TableSkeleton({ rows = 8, cols = 6, density = 'md', selectable = true }) {
  return (
    <div className="v-table-wrap" aria-busy="true" aria-hidden="true">
      <div className="v-table-scroll">
        <table className={`v-table v-table--${density}`} role="presentation">
          <thead><tr>{selectable && <th className="v-th v-th--check"><SkeletonBlock width={22} height={22} /></th>}{Array.from({ length: cols }, (_, i) => <th key={i} className="v-th"><SkeletonBlock width={i === 0 ? 120 : 70} height={12} /></th>)}</tr></thead>
          <tbody>{Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="v-tr">{selectable && <td className="v-td v-td--check"><SkeletonBlock width={22} height={22} /></td>}{Array.from({ length: cols }, (_, i) => <td key={i} className="v-td"><SkeletonBlock width={i === 0 ? '80%' : '60%'} height={14} /></td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

export const tableStyles = `
  .v-table-wrap { width: 100%; max-width: 100%; min-width: 0; border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); background: var(--v-surface-1); overflow: hidden; }
  .v-table-scroll { overflow: auto; max-height: 100%; min-width: 0; }
  .v-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text); }
  .v-th { position: sticky; top: 0; z-index: 2; background: var(--v-surface-2); border-bottom: 1px solid var(--v-border); text-align: left; padding: 0 var(--v-space-3); height: var(--v-tap); white-space: nowrap; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .v-th-txt { display: inline-flex; align-items: center; min-height: var(--v-tap); }
  .v-th-btn { display: inline-flex; align-items: center; gap: var(--v-space-1); min-height: var(--v-tap); padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; letter-spacing: inherit; text-transform: inherit; }
  .v-th-btn:hover, .v-th.is-sorted .v-th-btn { color: var(--v-text); }
  .v-th-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-sm); }
  .v-th-hint { opacity: 0; transition: opacity var(--v-dur-fast) var(--v-ease-out); }
  .v-th-btn:hover .v-th-hint { opacity: 0.6; }
  .v-th--check, .v-td--check { width: var(--v-tap); padding: 0 var(--v-space-2); }
  .v-th--actions, .v-td--actions { width: var(--v-tap); padding: 0 var(--v-space-1); text-align: right; }
  .v-td { padding: var(--v-space-2) var(--v-space-3); border-bottom: 1px solid var(--v-border); vertical-align: middle; background: var(--v-surface-1); min-width: 0; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .v-table--md .v-td { height: var(--v-tap-lg); }
  .v-table--sm .v-td { height: var(--v-tap); padding-top: var(--v-space-1); padding-bottom: var(--v-space-1); }
  .v-td--end, .v-th.v-td--end { text-align: right; }
  .v-td--sticky { position: sticky; left: 0; z-index: 1; }
  .v-th.v-td--sticky { z-index: 3; }
  .v-tr:last-child .v-td { border-bottom: 0; }
  .v-tr--enter { animation: v-enter var(--v-dur-enter) var(--v-ease-out) both; }
  .v-tr--click { cursor: pointer; }
  .v-tr--click:hover .v-td { background: var(--v-surface-2); }
  .v-tr:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .v-tr.is-selected .v-td { background: var(--v-red-soft); }
  .v-table-empty { padding: var(--v-space-6) var(--v-space-4); }
  .v-table-more { display: flex; justify-content: center; padding: var(--v-space-2); border-top: 1px solid var(--v-border); }
  .v-table-more-btn { min-height: var(--v-tap); padding: 0 var(--v-space-4); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text-2); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); }
  .v-table-more-btn:hover { background: var(--v-surface-2); color: var(--v-text); }
  .v-table-more-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .v-table-chooser { display: flex; flex-direction: column; padding: var(--v-space-1) var(--v-space-3); }
`;
