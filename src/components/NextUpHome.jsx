import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card, Button, IconButton, Pill, RoundCheck, ProgressBar, SkeletonBlock, SkeletonCircle, ErrorState, Sheet, Stack, Icon, Collapsible, Reveal,
  useToast, useMediaQuery,
} from '../ui';
import { durationMs } from '../ui/motion';
import { COPY } from '../shared/copy';
import { OUTCOMES, nextActionKindOf } from '../shared/semantics';
import { telHref } from '../shared/phone';
import { fmtDateTime } from '../shared/dates';
import { useShell } from '../shell/ShellContext';
import { nextUpItems, homeRowAction, NEXT_TONE } from '../lib/nextAction';
import { homeLists, rowKey, checkWrite, tomorrowWrite, OVERDUE_CAP } from '../lib/homeRows';
import { callOutcomeSet, outcomeUndoSet } from '../lib/callOutcome';
import { applyOutcome, outcomeRemoves, restoreLead } from '../lib/lists';
import OutcomeSheet from './OutcomeSheet';

/* Next up on the home (the home page job): Today, Coming up and Overdue, in that order, as three cards Rob can work from without leaving the page.
 * One rule for every row, in src/lib/nextAction.js (homeRowAction) and src/lib/homeRows.js (what each write is):
 *   the check     a real task completes (the same completePatch the Tasks page writes); a call or a callback opens the Log outcome
 *                 sheet and never writes done; a manual action stamps its doneAt; any other rule action opens the record at its step
 *   Tomorrow      a task, a callback or a manual action moves to 9:00 AM New York tomorrow; a derived rule action has Open instead
 *   the row       opens the record (the one stretched button), as it always did
 * A row finished or moved in this visit stays where it was, struck through or fading, until the page reloads (`ghosts`): the list
 * itself is nextUpItems() and nothing else, so the overview chips and the tab badge, which read the same function, move with every write. */

const NU_KEY = 'vz_home_nextup_n';   // the last known row counts, so the skeleton draws the same height
const COMING_KEY = 'vz_home_coming'; // the Coming up card: '1' open, '0' folded
const readLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage may be off */ } };
/* The last known row counts; a stored 0 is a real answer (that card said it was clear), only a missing one falls back to a normal day.
   Today and Coming up are never capped (they share the first row, so they set where Overdue starts), so the skeleton draws as many rows as they had;
   only Overdue is capped, at the five it shows. LIVE_MAX only guards a corrupt value from drawing a page of skeleton. */
const LIVE_MAX = 60;
const DEFAULT_COUNTS = { t: 3, o: 5, l: 1 };
const lastCounts = () => { try { const o = JSON.parse(readLS(NU_KEY) || 'null'); const n = (v, max, d) => (Number.isFinite(Number(v)) && v !== null && v !== undefined && v !== '' ? Math.min(max, Math.max(0, Number(v))) : d); return o ? { t: n(o.t, LIVE_MAX, DEFAULT_COUNTS.t), o: n(o.o, OVERDUE_CAP, DEFAULT_COUNTS.o), l: n(o.l, LIVE_MAX, DEFAULT_COUNTS.l) } : DEFAULT_COUNTS; } catch { return DEFAULT_COUNTS; } };

/* Whether Coming up opens on arrival: what Rob left it at, else open on a computer and folded on a phone. */
const comingOpen = () => { const v = readLS(COMING_KEY); return v === '1' ? true : v === '0' ? false : (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 768px)').matches : false); };
const kindLabel = (a) => (a.taskId ? 'Task' : nextActionKindOf(a.kind).label);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── One row of Today or Overdue ───────────────────────────────── */
function NuRow({ r, overdue, now, compact, onCheck, onTomorrow, onOpen, onCall, onOpenBtn }) {
  const { item, done, leaving } = r;
  const plan = homeRowAction(item, now);
  const a = item.action;
  const biz = item.lead.business;
  const checkLabel = plan.check === 'outcome' ? `Log the outcome: ${plan.title}, ${biz}` : plan.check === 'open' ? `Open at this step: ${plan.title}, ${biz}` : `Mark done: ${plan.title}, ${biz}`;
  const third = done ? <span className="nh-when is-done">Done</span> : overdue ? <span className="nh-when is-late">{plan.late || 'Overdue'}</span> : <span className={`nh-when${plan.late ? ' is-late' : ''}`}>{plan.time}</span>;
  return (
    <li className={`nh-row${done ? ' is-done' : ''}${leaving ? ' is-leaving' : ''}${overdue ? ' is-overdue' : ''}`} data-row-id={item.lead._id}>
      <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Open ${biz}, ${plan.title}`}>{`Open ${biz}`}</button>
      <RoundCheck className="v-above" label={done ? `Done: ${plan.title}, ${biz}` : checkLabel} done={done} tone={overdue ? 'danger' : 'neutral'} onClick={onCheck} />
      <div className="nh-body">
        <span className="nh-title lay-truncate">{plan.title}</span>
        <span className="nh-biz lay-truncate">{biz}</span>
        <span className="nh-meta">{third}{!done && <Pill tone={NEXT_TONE[a.kind] || 'neutral'} label={kindLabel(a)} size="sm" icon={false} variant="soft" />}</span>
      </div>
      {!done && !leaving && (
        <span className="nh-act v-above">
          {plan.call && <IconButton icon="Phone" label={`Call ${biz}`} variant="secondary" onClick={onCall} tooltip={false} />}
          {overdue && (plan.tomorrow
            /* On a very narrow phone the words give way to an icon so the title keeps some room; the label still says it. */
            ? (compact
              ? <IconButton icon="Clock" label={`Move to tomorrow: ${plan.title}, ${biz}`} variant="secondary" onClick={onTomorrow} tooltip={false} className="nh-tomorrow" />
              : <Button variant="secondary" size="md" onClick={onTomorrow} aria-label={`Move to tomorrow: ${plan.title}, ${biz}`} className="nh-tomorrow">Tomorrow</Button>)
            : (compact
              ? <IconButton icon="ArrowRight" label={`Open the record: ${plan.title}, ${biz}`} variant="secondary" onClick={onOpenBtn} tooltip={false} className="nh-openbtn" />
              : <Button variant="secondary" size="md" icon="ArrowRight" onClick={onOpenBtn} aria-label={`Open the record: ${plan.title}, ${biz}`} className="nh-openbtn">Open</Button>))}
        </span>
      )}
    </li>
  );
}

/* ── The shape of the loaded block, drawn while the leads load: the same cards, the same row heights ─ */
function Skeleton({ counts }) {
  const rows = (n, key, later) => Array.from({ length: n }, (_, i) => (
    <li key={`${key}${i}`} className={`nh-row nh-row--skel${later ? ' nh-row--later' : ''}`}>
      {later ? <SkeletonBlock width={44} height={40} radius="var(--v-radius-md)" /> : <SkeletonCircle size={26} />}
      <div className="nh-body"><SkeletonBlock width="55%" height={18} />{!later && <SkeletonBlock width="40%" height={14} />}{!later && <SkeletonBlock width="30%" height={20} radius="var(--v-radius-pill)" />}</div>
    </li>
  ));
  const head = (w) => (<div className="nh-head"><div className="nh-headl"><SkeletonBlock width={56} height={12} /><SkeletonBlock width={w} height={30} /></div></div>);
  const open = comingOpen();
  /* A card that was clear last time draws its one line, not rows. */
  const list = (n, key, later) => (n > 0 ? <ul className="nh-list">{rows(n, key, later)}</ul> : <p className="nh-clear"><SkeletonBlock width={180} height={16} /></p>);
  return (
    <div className="nh" aria-busy="true" aria-hidden="true">
      <div className="nh-grid">
        <Card className="nh-card">{head(96)}{list(counts.t, 't')}</Card>
        <Card className="nh-card nh-card--coming">
          <div className="nh-coming-head"><SkeletonBlock width={112} height={14} /></div>
          {open && list(counts.l, 'l', true)}
        </Card>
        <Card className="nh-card nh-wide">{head(120)}{list(counts.o, 'o')}</Card>
      </div>
      <div className="nh-foot"><SkeletonBlock width={104} height={44} radius="var(--v-radius-md)" /></div>
    </div>
  );
}

export default function NextUpHome({ leads = [], projects = [], sets = [], loading = false, error = false, onRetry, onPatchLead, onPatchProject }) {
  const shell = useShell();
  const toast = useToast();
  /* No delay before the skeleton: the block is the tallest thing above the numbers, and a region that is empty for the first moments and then
     appears pushes everything under it down (the feel audit's layout shift). The skeleton holds the place from the first paint. */
  const showSkel = loading && !leads.length;
  const compact = useMediaQuery('(max-width: 380px)');
  const now = Date.now();
  const q = useMemo(() => nextUpItems(leads, projects, sets, now), [leads, projects, sets]); // eslint-disable-line react-hooks/exhaustive-deps
  const taskCtx = useMemo(() => ({ projects, sets }), [projects, sets]);

  /* The rows finished or moved this visit, kept in place until a reload. */
  const [ghosts, setGhosts] = useState({});
  const timers = useRef({});
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);
  const ghost = useCallback((item, mode) => setGhosts(g => ({ ...g, [rowKey(item)]: { key: rowKey(item), item, card: item.bucket === 'overdue' ? 'overdue' : 'today', mode } })), []);
  const unghost = useCallback((key) => { clearTimeout(timers.current[key]); delete timers.current[key]; setGhosts(g => Object.fromEntries(Object.entries(g).filter(([k]) => k !== key))); }, []);
  const [expanded, setExpanded] = useState(false);
  const [coming, setComing] = useState(comingOpen);
  const toggleComing = () => setComing(c => { writeLS(COMING_KEY, c ? '0' : '1'); return !c; });
  const [said, setSaid] = useState({ n: 0, text: '' });
  const say = (text) => setSaid(s => ({ n: s.n + 1, text }));
  const [logging, setLogging] = useState(null); // { item, outcome | null }
  /* The shell's lists as they are when an Undo runs, a few seconds after the write that made it. */
  const shellRef = useRef(shell); shellRef.current = shell;

  const L = useMemo(() => homeLists(q, ghosts, { expanded }), [q, ghosts, expanded]);
  /* The newest copy of a record, for an undo that runs a few seconds after the write. */
  const latest = useRef({ leads, projects }); latest.current = { leads, projects };
  const fresh = (item) => (item.project ? latest.current.projects.find(p => String(p._id) === String(item.project._id)) : latest.current.leads.find(l => String(l._id) === String(item.lead._id))) || item.record;
  const patch = async (item, set) => {
    const ok = item.project ? await onPatchProject(item.project._id, set) : await onPatchLead(item.lead._id, set);
    if (!ok) toast.error(COPY.error.save);
    return ok;
  };
  useEffect(() => { // the last known counts, for the next skeleton
    if (loading) return;
    writeLS(NU_KEY, JSON.stringify({ t: q.today.length, o: Math.min(OVERDUE_CAP, q.overdue.length), l: q.later.length }));
  }, [loading, q]);

  const openRecord = (item, intent) => { if (item.lead) shell.openRecord(item.lead, intent); };
  const openStep = (item, plan) => { if (plan.open === 'concepts' && shell.openConcepts) shell.openConcepts(item.lead); else openRecord(item, plan.open || undefined); };

  /* The check. */
  const check = async (item) => {
    const plan = homeRowAction(item, now);
    if (plan.check === 'outcome') { setLogging({ item, outcome: null }); return; }
    if (plan.check === 'open') { openStep(item, plan); return; }
    const w = checkWrite(item, taskCtx, Date.now());
    if (!w) return;
    const key = rowKey(item);
    ghost(item, 'done');
    const ok = await patch(item, w.set);
    if (!ok) { unghost(key); return; }
    say(COPY.home.markedDone);
    toast.undo(`${plan.title} done for ${item.lead.business}.`, async () => { unghost(key); await patch(item, w.undo(fresh(item))); }, { seconds: 6 });
  };

  /* Tomorrow: 9:00 AM New York. The row fades, then goes. */
  const tomorrow = async (item, el) => {
    const w = tomorrowWrite(item, taskCtx, Date.now());
    if (!w) return;
    const key = rowKey(item);
    /* The button that was pressed goes with its row; focus moves to the neighbouring row's check rather than dropping to the page. */
    const li = el?.closest?.('li'); const near = li?.nextElementSibling || li?.previousElementSibling || null;
    ghost(item, 'leaving');
    timers.current[key] = setTimeout(() => { unghost(key); setTimeout(() => { if (near?.isConnected && (!document.activeElement || document.activeElement === document.body)) near.querySelector('.v-rcheck')?.focus(); }, 0); }, durationMs('--v-dur-slow') + 60);
    const ok = await patch(item, w.set);
    if (!ok) { unghost(key); return; }
    say(COPY.home.movedTomorrow);
    toast.undo(`${item.lead.business} moved to tomorrow, 9:00 AM.`, async () => { unghost(key); await patch(item, w.undo(fresh(item))); }, { seconds: 6 });
  };

  /* A logged outcome: the same write the Call Console makes (src/lib/callOutcome.js), the dial list's rule on the same beat, an Undo. */
  const logOutcome = async (item, outcome, extra) => {
    const lead = fresh(item);
    const { set, prev } = callOutcomeSet(lead, outcome, extra);
    const key = rowKey(item);
    const listId = lead.listId ? String(lead.listId) : '';
    const list = listId ? (shell.lists || []).find(l => String(l._id) === listId) : null;
    const prevIndex = list ? (list.leadIds || []).map(String).indexOf(String(lead._id)) : -1;
    ghost(item, 'done');
    setLogging(null);
    const ok = await onPatchLead(lead._id, set);
    if (!ok) { unghost(key); toast.error(COPY.error.save); return false; }
    if (list && shell.listOps) { const next = applyOutcome(list.leadIds, lead._id, outcome); if (next) shell.listOps.applyOutcome(listId, lead._id, next, outcomeRemoves(outcome)); }
    say(COPY.home.markedDone);
    const label = OUTCOMES.find(o => o.id === outcome)?.label || outcome;
    toast.undo(`${label}: ${lead.business}`, async () => {
      unghost(key);
      const back = await onPatchLead(lead._id, outcomeUndoSet(prev));
      if (!back) { toast.error('Undo failed. Fix it on the lead.'); return; }
      const sh = shellRef.current;
      if (list && prevIndex >= 0 && sh.listOps) { const cur = (sh.lists || []).find(l => String(l._id) === listId) || list; await sh.listOps.patchList(list._id, { leadIds: restoreLead(cur.leadIds, lead._id, prevIndex) }); }
      toast.success(`Undid ${label.toLowerCase()} for ${lead.business}.`);
    }, { seconds: 6 });
    return true;
  };

  if (error && !leads.length) return <Card className="nh-card"><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={onRetry} /></Card>;
  if (showSkel) return <Skeleton counts={lastCounts()} />;

  const rowProps = (r, overdue) => ({
    r, overdue, now, compact,
    onCheck: () => check(r.item),
    onTomorrow: (e) => tomorrow(r.item, e?.currentTarget),
    onOpen: () => openRecord(r.item),
    onCall: () => { if (r.item.lead.phone) window.location.href = telHref(r.item.lead.phone); },
    onOpenBtn: () => openStep(r.item, homeRowAction(r.item, now)),
  });

  return (
    <Reveal className="nh" as="section" aria-label="Next up">
      <div className="nh-grid">
        <Card className="nh-card nh-card--today" data-card="next-today">
          <div className="nh-head">
            <div className="nh-headl"><span className="nh-kicker">Next up</span><h2 className="nh-h">Today</h2></div>
            {L.today.length > 0 && (
              <div className="nh-prog"><span className="nh-prog-t">{L.doneToday} of {L.today.length} done</span><span aria-hidden="true"><ProgressBar value={Math.round((L.doneToday / L.today.length) * 100)} tone="won" size="sm" /></span></div>
            )}
          </div>
          {L.today.length ? <ul className="nh-list">{L.today.map(r => <NuRow key={r.key} {...rowProps(r, false)} />)}</ul> : <p className="nh-clear" role="status">{COPY.home.todayClear}</p>}
        </Card>

        <Card className="nh-card nh-card--coming" data-card="next-coming">
          <button type="button" className="nh-coming-head" aria-expanded={coming} aria-controls="nh-coming-body" onClick={toggleComing}>
            <span className="nh-coming-label">Coming up</span>
            <span className="nh-coming-n">{L.later.length} this week</span>
            <Icon icon="ChevronDown" size="var(--v-icon-md)" className={`nh-chev${coming ? ' is-open' : ''}`} />
          </button>
          <Collapsible open={coming}>
            <div id="nh-coming-body">
              {L.later.length ? (
                <ul className="nh-list">
                  {L.later.map(it => {
                    const d = new Date(it.due);
                    const biz = it.lead.business;
                    const plan = homeRowAction(it, now);
                    return (
                      <li key={rowKey(it)} className="nh-row nh-row--later" data-row-id={it.lead._id}>
                        <button type="button" className="v-stretch" onClick={() => openRecord(it)} aria-label={`Open ${biz}, ${plan.title}, ${fmtDateTime(it.due)}`}>{`Open ${biz}`}</button>
                        <span className="nh-stamp" aria-hidden="true"><span className="nh-stamp-d">{DAYS[d.getDay()]}</span><span className="nh-stamp-n">{d.getDate()}</span></span>
                        <div className="nh-body"><span className="nh-title lay-truncate">{plan.title}</span><span className="nh-biz lay-truncate">{biz}</span></div>
                        <Pill tone={NEXT_TONE[it.action.kind] || 'neutral'} label={kindLabel(it.action)} size="sm" icon={false} variant="soft" className="nh-later-pill" />
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="nh-clear">{COPY.home.comingClear}</p>}
            </div>
          </Collapsible>
        </Card>

        <Card className="nh-card nh-card--overdue nh-wide" data-card="next-overdue">
          <div className="nh-head">
            <div className="nh-headl"><span className="nh-kicker">Next up</span><h2 className="nh-h">Overdue{L.overdueCount > 0 && <span className="nh-count">{L.overdueCount}</span>}</h2></div>
            <span className="nh-sort">Oldest first</span>
          </div>
          {L.overdue.length ? <ul className="nh-list">{L.overdue.map(r => <NuRow key={r.key} {...rowProps(r, true)} />)}</ul> : <p className="nh-clear is-good" role="status">{COPY.home.overdueClear}</p>}
          {L.overdueTotal > OVERDUE_CAP && (
            <Button variant="ghost" size="md" icon={expanded ? 'ChevronUp' : 'ChevronDown'} aria-expanded={expanded} onClick={() => setExpanded(e => !e)} className="nh-more">{expanded ? 'Show fewer' : `Show ${L.hidden} more`}</Button>
          )}
        </Card>
      </div>

      <div className="nh-foot"><Button variant="ghost" size="md" icon="ArrowRight" onClick={() => shell.go('tasks')} className="nh-all">All tasks</Button></div>
      <span className="visually-hidden" role="status" aria-live="polite" key={said.n}>{said.text}</span>

      {logging && !logging.outcome && (
        <Sheet open onClose={() => setLogging(null)} title="Log the outcome" description={logging.item.lead.business} label="Log the outcome" className="nh-pick">
          <Stack gap={2}>
            {OUTCOMES.map(o => <Button key={o.id} variant="secondary" full icon={o.icon} onClick={() => setLogging({ item: logging.item, outcome: o.id })}>{o.label}</Button>)}
          </Stack>
        </Sheet>
      )}
      {logging?.outcome && <OutcomeSheet key={`${logging.item.id}-${logging.outcome}`} outcome={logging.outcome} lead={fresh(logging.item)} onLog={(o, extra) => logOutcome(logging.item, o, extra)} onClose={() => setLogging(null)} />}
    </Reveal>
  );
}

export const nextUpHomeStyles = `
  .nh { display: flex; flex-direction: column; gap: var(--v-space-3); min-width: 0; }
  .nh-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--v-space-3); min-width: 0; align-items: start; }
  /* Today, Coming up, Overdue, in that order at every width. From 768 Today and Coming up share the top row and Overdue takes the full row under them. */
  @media (min-width: 768px) { .nh-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .nh-wide { grid-column: 1 / -1; } }
  .nh-card { gap: 0; min-width: 0; border-radius: var(--v-radius-xl); }
  .nh-card--overdue { border-color: color-mix(in srgb, var(--v-status-danger-text) 38%, var(--v-border)); }
  .nh-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--v-space-3); min-height: 56px; min-width: 0; }
  .nh-headl { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .nh-kicker { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .nh-h { margin: 0; display: flex; align-items: center; gap: var(--v-space-2); font-family: var(--v-font-display); font-size: var(--v-text-3xl); line-height: var(--v-lh-3xl); letter-spacing: var(--v-ls-3xl); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .nh-card--overdue .nh-h { color: var(--v-status-danger-text); }
  .nh-count { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 var(--v-space-2); box-sizing: border-box; border-radius: var(--v-radius-pill); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); font-family: var(--v-font-body); font-size: var(--v-text-sm); line-height: 1; font-weight: var(--v-weight-bold); letter-spacing: 0; }
  .nh-sort { padding-top: var(--v-space-1); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); white-space: nowrap; }
  .nh-prog { display: flex; flex-direction: column; align-items: flex-end; gap: var(--v-space-2); width: 112px; flex-shrink: 0; padding-top: var(--v-space-1); }
  .nh-prog-t { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .nh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; min-width: 0; }
  .nh-row { position: relative; display: flex; align-items: center; gap: var(--v-space-2); min-height: 88px; padding: var(--v-space-3) 0; box-sizing: border-box; min-width: 0; border-top: 1px solid var(--v-border); transition: opacity var(--v-dur-slow) var(--v-ease-out); }
  .nh-row .v-stretch { border-radius: var(--v-radius-md); }
  .nh-row:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-md); }
  .nh-row .v-stretch:focus-visible { outline: 0; }
  .nh-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0; pointer-events: none; }
  .nh-title { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); transition: color var(--v-dur-base) var(--v-ease-out); text-decoration: line-through transparent; text-decoration-thickness: 2px; }
  .nh-biz { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .nh-meta { display: flex; align-items: center; gap: var(--v-space-2); min-width: 0; min-height: 22px; }
  .nh-when { flex: 0 0 auto; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* The late words are the point of an overdue row, so the kind pill is what gives way when the line is short. */
  .nh-meta .v-pill { flex: 0 1 auto; min-width: 0; overflow: hidden; }
  .nh-meta .v-pill-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .nh-when.is-late { color: var(--v-status-danger-text); font-weight: var(--v-weight-semibold); }
  .nh-when.is-done { color: var(--v-status-booked-text); font-weight: var(--v-weight-semibold); }
  .nh-act { display: inline-flex; align-items: center; gap: var(--v-space-2); flex-shrink: 0; }
  .nh-act .v-btn.nh-tomorrow, .nh-act .v-btn.nh-openbtn { padding: 0 var(--v-space-3); }
  @media (max-width: 767px) { .nh-act { gap: var(--v-space-1); } }
  .nh-row.is-done .nh-title { color: var(--v-text-3); text-decoration-color: var(--v-text-3); }
  .nh-row.is-leaving { opacity: 0; pointer-events: none; }
  .nh-row--skel { gap: var(--v-space-3); padding-left: var(--v-space-2); }
  .nh-clear { margin: 0; display: flex; align-items: center; min-height: 56px; border-top: 1px solid var(--v-border); font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .nh-clear.is-good { color: var(--v-status-booked-text); }
  .nh-more { align-self: flex-start; margin-top: var(--v-space-1); }
  .nh-card--coming { padding-top: 0; padding-bottom: 0; }
  .nh-coming-head { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: 56px; padding: 0; border: 0; background: transparent; color: var(--v-text); text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; border-radius: var(--v-radius-md); }
  .nh-coming-head:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .nh-coming-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-2); }
  .nh-coming-n { flex: 1; font-size: var(--v-text-sm); color: var(--v-text-3); }
  .nh-chev { color: var(--v-text-3); transition: transform var(--v-dur-base) var(--v-ease-out); }
  .nh-chev.is-open { transform: rotate(180deg); }
  .nh-card--coming .nh-list { padding-bottom: var(--v-space-2); }
  .nh-card--coming .nh-clear { margin-bottom: var(--v-space-2); }
  .nh-row--later { min-height: 72px; gap: var(--v-space-3); }
  .nh-stamp { display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; width: 44px; pointer-events: none; }
  .nh-stamp-d { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .nh-stamp-n { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .nh-later-pill { pointer-events: none; }
  .nh-foot { display: flex; justify-content: flex-start; }
  .nh-all { margin-left: calc(-1 * var(--v-space-4)); }
  @media (prefers-reduced-motion: reduce) { .nh-row, .nh-title, .nh-chev { transition: none; } }
  [data-v-motion='reduce'] .nh-row, [data-v-motion='reduce'] .nh-title, [data-v-motion='reduce'] .nh-chev { transition: none; }
`;
