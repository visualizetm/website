import { useMemo, useRef, useState } from 'react';
import { Card, StatCard, Grid, Chip, Menu, Icon, Pill, Stack, Row, Stagger } from '../ui';
import { postStatusOf } from '../shared/semantics';
import { postDateLabel, postLabel, formatOf, kindOf } from '../lib/posts';
import { BOARD_COLUMNS, columnOf, dragAllowed, menuMoves, flagOf, chipTone } from '../lib/plannerBoard';
import Lightbulb02 from '@untitled-ui/icons-react/build/esm/Lightbulb02';
import Announcement01 from '@untitled-ui/icons-react/build/esm/Announcement01';
import HoldRow from './HoldRow';

/* Rob's month board for a client's planner (Planner v2, part 2), built from
 * the kit and the Deals board pattern: the activity strip, the four columns
 * (a list grouped by column with a chip row on a phone, never four squeezed
 * columns) and the month calendar. A card is one real control that opens
 * the editor; a drag only sends for approval or takes it back; every other
 * move is the card's menu on a computer and a long press on a phone. */

const titleOf = (p) => (kindOf(p) === 'ad' && p.ad?.name ? p.ad.name : postLabel(p));
const kindWord = (p) => (kindOf(p) === 'ad' ? 'Ad' : formatOf(p) === 'video' ? 'Reel' : formatOf(p) === 'story' ? 'Story' : 'Post');

/** The activity strip: StatCards that wrap on a phone. A tile with nothing honest to say does not render (the ad's best result). */
export function ActivityStrip({ act, client, onPick }) {
  return (
    <Grid minColumnWidth={150} gap={2} className="pb-strip" role="list" aria-label="This month">
      <div role="listitem"><StatCard icon="CheckCircle" tone="booked" value={`${act.ready} of ${act.of}`} label="Posts ready" onClick={() => onPick('approved')} /></div>
      <div role="listitem"><StatCard icon="Clock" tone={act.waiting ? 'won' : 'neutral'} value={act.waiting} label={`Waiting on ${client}`} onClick={() => onPick('review')} /></div>
      <div role="listitem"><StatCard icon="MessageCircle01" tone={act.changes ? 'new' : 'neutral'} value={act.changes} label="Changes asked" onClick={() => onPick('making')} /></div>
      <div role="listitem"><StatCard icon={Lightbulb02} tone={act.ideas ? 'new' : 'neutral'} value={act.ideas} label="New ideas" onClick={() => onPick('ideas')} /></div>
      {act.adBest > 0 && <div role="listitem"><StatCard icon={Announcement01} tone="progress" value={act.adBest} label="Quote asks from the live ad" /></div>}
    </Grid>
  );
}

function BoardCard({ post, client, ctx, onOpen, onMove, readOnly, phone, drag }) {
  const flag = flagOf(post, ctx);
  const st = postStatusOf(post.status);
  const thumb = post.imageUrl || post.video?.poster || '';
  const moves = readOnly ? [] : menuMoves(post, client).map(m => ({ id: `${m.column}-${m.status}`, label: m.label, icon: m.column === 'review' ? 'Send01' : m.column === 'making' ? 'Edit02' : 'Check', onSelect: () => onMove(post, m.status) }));
  const title = titleOf(post);
  const card = (
    <Card as="div" padding={3} interactive className={`pb-card${flag ? ' has-flag' : ''}`} data-col={columnOf(post)} data-drag={drag ? 'on' : undefined} {...(drag || {})}>
      <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Edit ${title}${flag ? `, ${flag}` : ''}`}>{`Edit ${title}`}</button>
      <Row gap={3} align="center" wrap={false} style={{ minWidth: 0 }}>
        <span className="img-fit img-fit--1x1 pb-thumb">
          {thumb ? <img src={thumb} alt="" width={96} height={96} loading="lazy" decoding="async" /> : <span className="pb-thumb-empty" aria-hidden="true"><Icon icon={formatOf(post) === 'video' ? 'Play' : 'Image01'} size="var(--v-icon-md)" /></span>}
        </span>
        <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <span className="pb-title lay-truncate">{title}</span>
          <span className="pb-line">{[postDateLabel(kindOf(post) === 'ad' ? (post.ad?.startDate || post.date) : post.date) || 'No date', kindWord(post)].join(' · ')}</span>
        </Stack>
        {moves.length > 0 && <Menu label={`${title} moves`} items={moves} />}
      </Row>
      {post.status === 'live' && <Pill label={st.label} icon={st.icon} size="sm" variant="soft" style={{ '--sc': st.color }} className="pb-live" />}
      {flag && <span className="pb-flag" role="note">{flag}</span>}
    </Card>
  );
  if (phone && moves.length) return <HoldRow title={title} subtitle={`${client}, ${st.label.toLowerCase()}`} items={[{ id: 'open', label: 'Edit', icon: 'Edit02', onSelect: onOpen }, 'divider', ...moves]}>{card}</HoldRow>;
  return card;
}

/** The board. posts are the month's, drafts merged; ctx is { lastViewedAt, now, today } for the red lines. */
export function Board({ posts, client, ctx, onOpen, onMove, readOnly, phone, pick, onPick }) {
  const groups = useMemo(() => BOARD_COLUMNS.map(c => ({ ...c, label: c.id === 'review' ? `Waiting on ${client}` : c.label, items: posts.filter(p => columnOf(p) === c.id) })), [posts, client]);
  const [dragFrom, setDragFrom] = useState(null); // { id, col }, for the columns' look
  const fromRef = useRef(null); // the same, read by dragover and drop at once (a fast drag arrives before the state does)
  const [over, setOver] = useState('');
  if (phone) {
    const col = groups.find(g => g.id === pick) || groups[0];
    return (
      <Stack gap={3}>
        <Row gap={2} wrap className="pb-chips" role="group" aria-label="Column">
          {groups.map(g => <Chip key={g.id} label={`${g.id === 'review' ? 'Waiting' : g.label} (${g.items.length})`} selected={col.id === g.id} onClick={() => onPick(g.id)} aria-label={`${g.label}, ${g.items.length}`} />)}
        </Row>
        <section aria-label={`${col.label}, ${col.items.length}`} className="pb-list">
          {col.items.length
            ? <Stagger className="pb-stack" cap={4}>{col.items.map(p => <BoardCard key={p._id} post={p} client={client} ctx={ctx} onOpen={() => onOpen(p)} onMove={onMove} readOnly={readOnly} phone />)}</Stagger>
            : <p className="pb-col-empty">Nothing in {col.label} this month.</p>}
        </section>
      </Stack>
    );
  }
  return (
    <div className="pb-board">
      {groups.map(g => {
        const canDrop = dragFrom && dragAllowed(dragFrom.col, g.id);
        const allowed = () => !!fromRef.current && dragAllowed(fromRef.current.col, g.id);
        return (
          <section key={g.id} className={`pb-col${canDrop ? ' can-drop' : ''}${canDrop && over === g.id ? ' is-over' : ''}`} aria-label={`${g.label}, ${g.items.length}`}
            onDragOver={(e) => { if (allowed()) { e.preventDefault(); setOver(g.id); } }}
            onDragLeave={() => setOver(o => (o === g.id ? '' : o))}
            onDrop={(e) => { e.preventDefault(); const from = fromRef.current; fromRef.current = null; setDragFrom(null); setOver(''); if (!from || !dragAllowed(from.col, g.id)) return; const p = posts.find(x => String(x._id) === from.id); if (p) onMove(p, g.id); }}>
            <div className="pb-col-head"><span className="pb-col-label">{g.label}</span><span className="pb-col-count">{g.items.length}</span></div>
            {g.items.length
              ? <Stagger className="pb-stack" cap={4}>{g.items.map(p => {
                  const col = columnOf(p);
                  const draggable = !readOnly && (col === 'making' || col === 'review');
                  return <BoardCard key={p._id} post={p} client={client} ctx={ctx} onOpen={() => onOpen(p)} onMove={onMove} readOnly={readOnly}
                    drag={draggable ? { draggable: true, onDragStart: (e) => { try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(p._id)); } catch { /* old browsers */ } fromRef.current = { id: String(p._id), col }; setDragFrom(fromRef.current); }, onDragEnd: () => { fromRef.current = null; setDragFrom(null); setOver(''); } } : undefined} />;
                })}</Stagger>
              : <p className="pb-col-empty">{dragFrom && canDrop ? 'Drop it here' : 'Nothing here'}</p>}
          </section>
        );
      })}
    </div>
  );
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function weeksOf(month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return [];
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells = [...Array(lead).fill(''), ...Array.from({ length: days }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push('');
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
const dayOfItem = (p) => (kindOf(p) === 'ad' ? (p.ad?.startDate || p.date) : p.date) || '';

/** The month calendar: each item a chip coloured by status (waiting red, an ad blue, the rest neutral); a click opens it. A phone gets the
 *  days that have something, in order, since seven columns of chips do not fit one. */
export function MonthCalendar({ posts, month, onOpen, phone }) {
  const byDay = useMemo(() => { const m = {}; for (const p of posts) { const d = dayOfItem(p); (m[d] = m[d] || []).push(p); } return m; }, [posts]);
  const chip = (p) => <button key={p._id} type="button" className={`pb-chip pb-chip--${chipTone(p)}`} onClick={() => onOpen(p)} aria-label={`${titleOf(p)}, ${postStatusOf(p.status).label}`}>{titleOf(p)}</button>;
  if (phone) {
    const days = Object.keys(byDay).filter(d => d.startsWith(month)).sort();
    const undated = byDay[''] || [];
    if (!days.length && !undated.length) return <p className="pb-col-empty">Nothing planned this month.</p>;
    return (
      <Stack gap={3} className="pb-agenda">
        {days.map(d => <section key={d} aria-label={postDateLabel(d)}><p className="pb-col-label">{postDateLabel(d)}</p><div className="pb-chiprow">{byDay[d].map(chip)}</div></section>)}
        {undated.length > 0 && <section aria-label="No date"><p className="pb-col-label">No date</p><div className="pb-chiprow">{undated.map(chip)}</div></section>}
      </Stack>
    );
  }
  return (
    <div className="pb-cal" role="table" aria-label="The month">
      <div className="pb-cal-row" role="row">{DOW.map(d => <span key={d} role="columnheader" className="pb-cal-dow">{d}</span>)}</div>
      {weeksOf(month).map((w, i) => (
        <div key={i} className="pb-cal-row" role="row">
          {w.map((d, j) => (
            <div key={j} role="cell" className={`pb-cal-cell${d ? '' : ' is-pad'}`}>
              {d && <span className="pb-cal-num">{Number(d.slice(-2))}</span>}
              {d && (byDay[d] || []).map(chip)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const plannerBoardStyles = `
  .pb-strip .v-stat { height: 100%; }
  .pb-board { display: grid; grid-template-columns: repeat(4, minmax(200px, 1fr)); gap: var(--v-space-2); align-items: start; overflow-x: auto; padding: 2px; margin: -2px; scrollbar-width: thin; min-width: 0; max-width: calc(100% + 4px); }
  .pb-col { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; min-height: 120px; padding: var(--v-space-1); border-radius: var(--v-radius-md); border: 1px dashed transparent; transition: background var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out); }
  .pb-col.can-drop { border-color: var(--v-border-strong); }
  .pb-col.is-over { background: var(--v-red-soft); border-color: var(--v-red); }
  .pb-col-head { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); min-height: 28px; padding: 0 var(--v-space-1); }
  .pb-col-head .pb-col-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .pb-col-label { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .pb-col-count { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .pb-stack { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .pb-stack > .v-stagger-item { display: contents; }
  .pb-col-empty { margin: 0; padding: var(--v-space-3); border: 1px dashed var(--v-border); border-radius: var(--v-radius-md); font-size: var(--v-text-xs); color: var(--v-text-3); text-align: center; }
  .pb-card { gap: var(--v-space-2); }
  .pb-card[data-drag='on'], .pb-card[data-drag='on'] .v-stretch { cursor: grab; }
  /* A press on a card's picture or icon is a press on the card: an SVG or an image under the pointer would not start the card's drag. */
  .pb-card img, .pb-card svg { pointer-events: none; }
  .pb-card:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .pb-card .v-stretch:focus-visible { outline: 0; }
  .pb-card .v-menu, .pb-card .v-menu-trigger { position: relative; z-index: 1; }
  .pb-thumb { width: 48px; flex: 0 0 48px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border); background: var(--v-surface-3); }
  .pb-thumb-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--v-text-3); }
  .pb-title { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .pb-line { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .pb-flag { display: block; padding-top: var(--v-space-2); border-top: 2px solid var(--v-red); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); color: var(--v-red-highlight); }
  .pb-live { align-self: flex-start; }
  .pb-chips { min-width: 0; }
  .pb-cal { display: flex; flex-direction: column; gap: 2px; }
  .pb-cal-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  .pb-cal-dow { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); padding: var(--v-space-1); }
  .pb-cal-cell { display: flex; flex-direction: column; gap: 2px; min-height: 96px; min-width: 0; padding: var(--v-space-1); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-sm); }
  .pb-cal-cell.is-pad { background: transparent; border-color: transparent; }
  .pb-cal-num { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-2); }
  .pb-chip { display: block; width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-2); border-radius: var(--v-radius-sm); border: 1px solid transparent; font-family: var(--v-font-body); font-size: var(--v-text-xs); font-weight: var(--v-weight-semibold); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
  .pb-chip--won { background: var(--v-status-won-soft); color: var(--v-status-won-text); border-color: color-mix(in srgb, var(--v-status-won-text) 30%, transparent); }
  .pb-chip--progress { background: var(--v-status-progress-soft); color: var(--v-status-progress-text); border-color: color-mix(in srgb, var(--v-status-progress-text) 30%, transparent); }
  .pb-chip--neutral { background: var(--v-status-neutral-soft); color: var(--v-status-neutral-text); border-color: var(--v-border); }
  .pb-chip:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 1px; }
  .pb-chiprow { display: flex; flex-direction: column; gap: var(--v-space-1); margin-top: var(--v-space-1); }
`;
