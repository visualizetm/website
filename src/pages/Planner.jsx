import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import Send01 from '@untitled-ui/icons-react/build/esm/Send01';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import Wordmark from '../components/Wordmark';
import { Reveal, Stagger } from '../marketing/motion';
import { useHead } from '../marketing/useHead';
import { COPY } from '../shared/copy';
import { postDateLabel, postLabel } from '../lib/posts';

/* The client facing Content Planner (planner prompt 3), at /planner/:token.
 *
 * The token is the whole credential and api/planner.js deliberately cannot
 * tell an unknown one from a revoked one from a switched off planner: all
 * three are the same 404. So this page has one dead end state and never
 * implies whether a link was ever good.
 *
 * Everything here is read plus two writes: approve, and ask for a change.
 * There is no other action a client can take, which is what makes handing
 * out a link like this safe.
 */

const VIEW_KEY = 'vz_planner_view';
const DRAFT_PREFIX = 'vz_planner_note';
const NOTE_MAX = 500;

/* Statuses, in the client's words. making and posted share the neutral tone
 * and are told apart by icon, exactly as they are in the admin. */
const STATES = {
  making: { label: 'Being made', Icon: Edit02, tone: 'idle' },
  review: { label: 'Needs your approval', Icon: Clock, tone: 'wait' },
  approved: { label: 'Approved and scheduled', Icon: Check, tone: 'ok' },
  posted: { label: 'Posted', Icon: Send01, tone: 'done' },
};
const stateOf = (s) => STATES[s] || STATES.making;
const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', other: 'Other' };

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const thisMonth = () => monthKey(new Date());
const shiftMonth = (m, by) => {
  const [y, mm] = String(m).split('-').map(Number);
  return monthKey(new Date(y, (mm - 1) + by, 1));
};
const monthName = (m) => {
  const [y, mm] = String(m).split('-').map(Number);
  if (!y || !mm) return m;
  return new Date(y, mm - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
};
const dayOf = (date) => Number(String(date || '').slice(-2)) || 0;
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };

/* The month as weeks of days, Monday first, so the grid is a real table with
 * a header row rather than a pile of divs. */
function weeksOf(month) {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return [];
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells = [...Array(lead).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(0);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ── Small pieces ─────────────────────────────────────────────────── */

function StatusPill({ status }) {
  const st = stateOf(status);
  return (
    <span className={`pl-pill pl-pill--${st.tone}`}>
      <st.Icon width={13} height={13} aria-hidden="true" />
      {st.label}
    </span>
  );
}

/* The dot on a calendar cell. Color alone never carries it: every dot has
 * text beside it for a screen reader. */
function StatusDot({ status }) {
  const st = stateOf(status);
  return (
    <>
      <span className={`pl-dot pl-dot--${st.tone}`} aria-hidden="true" />
      <span className="visually-hidden">{st.label}</span>
    </>
  );
}

function Skeleton() {
  return (
    <div className="pl-skel" aria-busy="true" aria-label="Loading your planner">
      <span className="pl-skel-line pl-skel-line--title" />
      <span className="pl-skel-line pl-skel-line--lead" />
      <div className="pl-skel-grid">{Array.from({ length: 35 }, (_, i) => <span key={i} className="pl-skel-cell" />)}</div>
    </div>
  );
}

/* ── The post detail: a Sheet on a phone, a side panel on a desktop ── */
function PostDetail({ post, client, token, onClose, onApprove, onChange, busy, formError }) {
  const [asking, setAsking] = useState(false);
  const draftKey = `${DRAFT_PREFIX}:${token}:${post.id}`;
  const [note, setNote] = useState(() => { try { return sessionStorage.getItem(draftKey) || ''; } catch { return ''; } });
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(null);
  const C = COPY.planner.detail;
  const st = stateOf(post.status);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { try { sessionStorage.setItem(draftKey, note); } catch { /* private mode */ } }, [note, draftKey]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(post.caption || ''); setCopied(true); setTimeout(() => setCopied(false), 2400); }
    catch { setCopied(false); }
  };

  const send = async () => {
    const ok = await onChange(post, note.trim());
    if (ok) { try { sessionStorage.removeItem(draftKey); } catch { /* nothing to clear */ } setNote(''); setAsking(false); }
  };

  return (
    <div className="pl-panel-wrap" role="dialog" aria-modal="true" aria-label={`${postLabel(post)}, ${st.label}`}>
      <button type="button" className="pl-scrim" aria-label="Close" onClick={onClose} />
      <div className="pl-panel">
        <div className="pl-panel-head">
          <span className="pl-panel-title">{postDateLabel(post.date) || 'No date yet'}{post.time ? `, ${post.time}` : ''}</span>
          <button type="button" ref={closeRef} className="pl-icon-btn" onClick={onClose} aria-label={C.close}>
            <XClose width={18} height={18} aria-hidden="true" />
          </button>
        </div>

        <div className="pl-panel-body">
          <span className="img-fit img-fit--1x1 pl-panel-img">
            {post.imageUrl
              ? <img src={post.imageUrl} alt="" width={720} height={720} loading="lazy" decoding="async" />
              : <span className="pl-noimg">Image coming</span>}
          </span>

          <div className="pl-pills">
            <span className="pl-pill pl-pill--idle">{PLATFORM_LABEL[post.platform] || 'Other'}</span>
            <StatusPill status={post.status} />
          </div>

          {post.caption && (
            <div className="pl-caption">
              <div className="pl-caption-head">
                <span className="pl-label">{C.caption}</span>
                <button type="button" className="pl-btn pl-btn--ghost pl-copy" onClick={copyCaption}>
                  {copied ? <Check width={15} height={15} aria-hidden="true" /> : <Copy01 width={15} height={15} aria-hidden="true" />}
                  {copied ? 'Copied' : C.copy}
                </button>
              </div>
              <p className="pl-caption-body">{post.caption}</p>
            </div>
          )}

          {post.note && (
            <div className="pl-note pl-note--rob">
              <span className="pl-label">{C.fromRob}</span>
              <p className="pl-note-body">{post.note}</p>
            </div>
          )}

          {post.clientNote && (
            <div className="pl-note">
              <span className="pl-label">{C.yourNote}</span>
              <p className="pl-note-body">{post.clientNote}</p>
            </div>
          )}

          {asking && (
            <div className="pl-ask">
              <label className="pl-label" htmlFor="pl-note">{C.changeLabel}</label>
              <textarea id="pl-note" className="pl-textarea" rows={4} maxLength={NOTE_MAX} value={note}
                placeholder="Swap the photo, change the date, fix a word" autoFocus
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} />
              <p className="pl-hint">{note.length} of {NOTE_MAX}. {C.changeHint}</p>
              {formError && <p className="pl-formerr" role="alert">{formError}</p>}
            </div>
          )}
        </div>

        <div className="pl-panel-foot">
          {post.status === 'review' ? (
            asking ? (
              <>
                <button type="button" className="pl-btn pl-btn--ghost" onClick={() => setAsking(false)} disabled={busy}>Back</button>
                <button type="button" className="pl-btn" onClick={send} disabled={busy} aria-busy={busy ? 'true' : undefined}>
                  {busy ? C.sending : C.send}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="pl-btn pl-btn--ghost pl-ask-btn" onClick={() => setAsking(true)} disabled={busy}>{C.change}</button>
                <button type="button" className="pl-btn pl-approve" onClick={() => onApprove(post)} disabled={busy} aria-busy={busy ? 'true' : undefined}>
                  <Check width={16} height={16} aria-hidden="true" />{C.approve}
                </button>
              </>
            )
          ) : (
            <>
              <p className="pl-foot-note">{C.states[post.status] || C.states.making}</p>
              <button type="button" className="pl-btn pl-btn--ghost" onClick={onClose}>{C.close}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── The page ─────────────────────────────────────────────────────── */

export default function Planner() {
  const { token = '' } = useParams();
  const C = COPY.planner;

  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState(null);          // { client, month, posts }
  const [state, setState] = useState('loading');   // loading | ready | dead | error
  const [view, setView] = useState(() => readLS(VIEW_KEY, ''));
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const wide = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;
  const [desktop, setDesktop] = useState(() => !!wide?.matches);
  /* Seven columns of 44px do not fit a phone: 320 minus the page padding is
     288, which is 41 a column even with no gaps. So the calendar is offered
     from 430 up and the list is the whole story below that, rather than
     shrinking the days into targets nobody can hit or making somebody swipe
     sideways through their own month. */
  const roomy = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 430px)') : null;
  const [canGrid, setCanGrid] = useState(() => !!roomy?.matches);
  useEffect(() => {
    if (!roomy) return undefined;
    const on = (e) => setCanGrid(e.matches);
    roomy.addEventListener('change', on);
    return () => roomy.removeEventListener('change', on);
  }, [roomy]);

  useHead({ title: 'Content planner | Visualize.', description: 'Your posts for the month.', noindex: true });

  useEffect(() => {
    if (!wide) return undefined;
    const on = (e) => setDesktop(e.matches);
    wide.addEventListener('change', on);
    return () => wide.removeEventListener('change', on);
  }, [wide]);

  // Calendar on a desktop, list on a phone, and whatever they picked after that.
  const activeView = canGrid ? (view || (desktop ? 'calendar' : 'list')) : 'list';
  const pickView = (v) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };

  const load = useCallback(async (m = month, { quiet = false } = {}) => {
    if (!quiet) setState(s => (s === 'ready' ? s : 'loading'));
    try {
      const res = await fetch(`/api/planner?token=${encodeURIComponent(token)}&month=${encodeURIComponent(m)}`);
      if (res.status === 404) { setState('dead'); return; }
      if (!res.ok) { setState(d => (d === 'ready' ? d : 'error')); return; }
      const body = await res.json();
      setData(body);
      setState('ready');
    } catch {
      setState(d => (d === 'ready' ? d : 'error'));
    }
  }, [token, month]);

  useEffect(() => { load(month); }, [month, load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const posts = data?.posts || [];
  const open = openId ? posts.find(p => p.id === openId) : null;
  const waiting = posts.filter(p => p.status === 'review').length;
  const ready = posts.filter(p => p.status === 'approved' || p.status === 'posted').length;
  const perMonth = Number(data?.client?.postsPerMonth) || 8;
  const byDay = useMemo(() => {
    const m = new Map();
    for (const p of posts) { const d = dayOf(p.date); if (d) m.set(d, [...(m.get(d) || []), p]); }
    return m;
  }, [posts]);

  /* One place where every answer the endpoint can give is turned into
   * something a person can act on. 404 here means the link was revoked while
   * they were reading, so the page becomes the dead end rather than throwing
   * a raw error at them. */
  const act = useCallback(async (post, action, note) => {
    setBusy(true);
    setFormError('');
    try {
      const res = await fetch(`/api/planner?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, action, note }),
      });
      setBusy(false);
      if (res.ok) return true;
      if (res.status === 404) { setState('dead'); return false; }
      if (res.status === 409) { setToast(C.toast.stale); setOpenId(null); await load(month, { quiet: true }); return false; }
      if (res.status === 429) { setToast(C.toast.tooMany); return false; }
      if (res.status === 400) { setFormError(C.detail.needNote); return false; }
      setToast(C.toast.failed);
      return false;
    } catch {
      setBusy(false);
      setToast(C.toast.failed);
      return false;
    }
  }, [token, month, load, C]);

  const approve = useCallback(async (post) => {
    // Optimistic: the tick lands now, and rolls back if the server says no.
    const before = post.status;
    setData(d => ({ ...d, posts: d.posts.map(p => (p.id === post.id ? { ...p, status: 'approved' } : p)) }));
    const ok = await act(post, 'approve');
    if (ok) { setToast(C.toast.approved); setOpenId(null); }
    else setData(d => (d ? { ...d, posts: d.posts.map(p => (p.id === post.id ? { ...p, status: before } : p)) } : d));
    return ok;
  }, [act, C]);

  const requestChange = useCallback(async (post, note) => {
    if (!note) { setFormError(C.detail.needNote); return false; }
    const ok = await act(post, 'request-change', note);
    if (ok) {
      setData(d => ({ ...d, posts: d.posts.map(p => (p.id === post.id ? { ...p, status: 'making', clientNote: note } : p)) }));
      setToast(C.toast.changeSent);
      setOpenId(null);
    }
    return ok;
  }, [act, C]);

  if (state === 'dead') {
    return (
      <section className="pl section pl-dead-wrap">
        <div className="wrap pl-narrow">
          <Bar />
          <Reveal as="h1" className="pl-title display">{C.dead.title}</Reveal>
          <Reveal as="p" className="pl-lead" delay={60}>
            {C.dead.body} <a className="pl-mail" href={`mailto:${C.dead.email}`}>{C.dead.email}</a>
          </Reveal>
        </div>
        <style>{plannerStyles}</style>
      </section>
    );
  }

  return (
    <section className="pl section">
      <div className="wrap pl-wrap">
        <Bar />

        {state === 'loading' && <Skeleton />}

        {state === 'error' && (
          <div className="pl-error" role="alert">
            <h1 className="pl-title display">{C.error.title}</h1>
            <p className="pl-lead">{C.error.body}</p>
            <button type="button" className="pl-btn" onClick={() => load(month)}>{C.error.retry}</button>
          </div>
        )}

        {state === 'ready' && data && (
          <>
            <Reveal as="h1" className="pl-title display">{data.client.displayName}</Reveal>
            {data.client.welcome
              ? <Reveal as="p" className="pl-lead" delay={60}>{data.client.welcome}</Reveal>
              : <Reveal as="p" className="pl-lead" delay={60}>{C.planned(posts.length)}</Reveal>}
            <Reveal as="p" className={`pl-waiting${waiting ? ' is-waiting' : ''}`} delay={100} role="status">
              {waiting ? C.waiting(waiting) : C.nothingWaiting}
            </Reveal>

            <Reveal as="div" className="pl-monthbar" delay={140}>
              <div className="pl-monthnav">
                <button type="button" className="pl-icon-btn" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month">
                  <ChevronLeft width={18} height={18} aria-hidden="true" />
                </button>
                <h2 className="pl-month">{monthName(data.month)}</h2>
                <button type="button" className="pl-icon-btn pl-next" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month">
                  <ChevronLeft width={18} height={18} aria-hidden="true" />
                </button>
              </div>
              {canGrid && <div className="pl-views" role="radiogroup" aria-label="How to show the month">
                {['calendar', 'list'].map(v => (
                  <button key={v} type="button" role="radio" aria-checked={activeView === v}
                    className={`pl-view${activeView === v ? ' is-on' : ''}`} onClick={() => pickView(v)}>
                    {C.views[v]}
                  </button>
                ))}
              </div>}
            </Reveal>

            <Reveal as="div" className="pl-progress" delay={160}>
              <span className="pl-progress-label">{C.progress(ready, perMonth)}</span>
              <span className="pl-progress-track">
                <span className="pl-progress-fill" style={{ width: `${perMonth ? Math.min(100, (ready / perMonth) * 100) : 0}%` }} />
              </span>
            </Reveal>

            {!posts.length ? (
              <Reveal as="div" className="pl-empty" delay={180}>
                <p className="pl-empty-title">{C.emptyMonth}</p>
                <p className="pl-empty-sub">{C.emptyMonthSub}</p>
              </Reveal>
            ) : activeView === 'calendar' ? (
              <div className="pl-cal-wrap">
                <table className="pl-cal">
                  <caption className="visually-hidden">{`Posts for ${monthName(data.month)}`}</caption>
                  <thead>
                    <tr>{DOW.map(d => <th key={d} scope="col"><span aria-hidden="true">{d.slice(0, 1)}</span><span className="visually-hidden">{d}</span></th>)}</tr>
                  </thead>
                  <tbody>
                    {weeksOf(data.month).map((week, wi) => (
                      <tr key={wi}>
                        {/* No row header: a week number means nothing to
                            anybody, and a visually hidden th still takes a
                            real column in a fixed layout table, which is
                            what was pushing the month past the screen. The
                            day columns are the headers that matter. */}
                        {week.map((day, di) => (
                          <td key={di} className={`pl-cell${day ? '' : ' is-blank'}`}>
                            {day ? (
                              <>
                                <span className="pl-cell-day" aria-hidden="true">{day}</span>
                                {(byDay.get(day) || []).map(p => (
                                  <button key={p.id} type="button" className="pl-cell-post" onClick={() => setOpenId(p.id)}>
                                    <span className="img-fit img-fit--1x1 pl-cell-img">
                                      {p.imageUrl
                                        ? <img src={p.imageUrl} alt="" width={200} height={200} loading="lazy" decoding="async" />
                                        : <span className="pl-cell-noimg" aria-hidden="true" />}
                                    </span>
                                    <span className="pl-cell-meta">
                                      <span className="pl-cell-badge" aria-hidden="true">{(PLATFORM_LABEL[p.platform] || 'O').slice(0, 1)}</span>
                                      <StatusDot status={p.status} />
                                    </span>
                                    <span className="visually-hidden">{`${postDateLabel(p.date)}, ${PLATFORM_LABEL[p.platform] || 'Other'}, ${postLabel(p)}`}</span>
                                  </button>
                                ))}
                              </>
                            ) : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Stagger as="ul" itemAs="li" itemClassName="pl-rowwrap" className="pl-list">
                {posts.map(p => (
                  <button key={p.id} type="button" className="pl-row" onClick={() => setOpenId(p.id)}>
                    <span className="img-fit img-fit--1x1 pl-row-img">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" width={160} height={160} loading="lazy" decoding="async" />
                        : <span className="pl-cell-noimg" aria-hidden="true" />}
                    </span>
                    <span className="pl-row-main">
                      <span className="pl-row-when">{postDateLabel(p.date) || 'No date yet'}{p.time ? `, ${p.time}` : ''}</span>
                      <span className="pl-row-cap">{p.caption ? p.caption.split('\n')[0] : postLabel(p)}</span>
                      <span className="pl-row-pills">
                        <span className="pl-pill pl-pill--idle">{PLATFORM_LABEL[p.platform] || 'Other'}</span>
                        <StatusPill status={p.status} />
                      </span>
                    </span>
                  </button>
                ))}
              </Stagger>
            )}

            <Reveal as="div" className="pl-legend" delay={80}>
              <h2 className="pl-legend-title">What the states mean</h2>
              <ul>
                {C.legend.map(l => (
                  <li key={l.id}>
                    <span className={`pl-dot pl-dot--${stateOf(l.id).tone}`} aria-hidden="true" />
                    <span className="pl-legend-name">{l.label}</span>
                    <span className="pl-legend-text">{l.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </>
        )}
      </div>

      {open && (
        <PostDetail post={open} client={data?.client?.displayName} token={token} busy={busy} formError={formError}
          onClose={() => { setOpenId(null); setFormError(''); }}
          onApprove={approve} onChange={requestChange} />
      )}

      {toast && <p className="pl-toast" role="status">{toast}</p>}
      <style>{plannerStyles}</style>
    </section>
  );
}

function Bar() {
  return (
    <div className="pl-bar">
      <span className="pl-bar-mark"><Wordmark size={20} /></span>
      <span className="pl-bar-div" aria-hidden="true" />
      <span className="pl-bar-name">{COPY.planner.heading}</span>
    </div>
  );
}

const plannerStyles = `
  .pl { background: var(--bg); }
  .pl-wrap { max-width: 1000px; }
  .pl-narrow { max-width: 560px; }
  .pl-bar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-10); }
  .pl-bar-mark { display: inline-flex; }
  .pl-bar-div { width: 1px; height: 20px; background: var(--border-light); }
  .pl-bar-name { font-size: 0.9375rem; font-weight: 600; color: var(--text-secondary); }

  .pl-title { font-size: clamp(2.2rem, 6vw, 3.6rem); color: var(--text); }
  .pl-lead { margin: var(--space-4) 0 0; font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.6; max-width: 60ch; }
  .pl-waiting { margin: var(--space-3) 0 var(--space-10); font-size: 1.125rem; font-weight: 700; color: var(--success); }
  .pl-waiting.is-waiting { color: var(--brand-text); }
  .pl-mail { color: var(--brand-text); font-weight: 600; }

  .pl-monthbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
  .pl-monthnav { display: flex; align-items: center; gap: var(--space-2); }
  .pl-month { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text); min-width: 9ch; text-align: center; }
  .pl-icon-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; padding: 0;
    background: var(--glass-bg); color: var(--text);
    border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .pl-icon-btn:hover { background: var(--hover-soft); border-color: var(--border-light); }
  .pl-icon-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-next svg { transform: rotate(180deg); }

  .pl-views { display: inline-flex; padding: 3px; background: var(--glass-bg); border: 1px solid var(--border); border-radius: var(--radius); }
  .pl-view {
    min-height: 44px; padding: 0 var(--space-4);
    background: none; border: 0; border-radius: 6px; cursor: pointer;
    font: inherit; font-size: 0.875rem; font-weight: 600; color: var(--text-secondary);
  }
  .pl-view.is-on { background: var(--surface); color: var(--text); }
  .pl-view:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

  .pl-progress { display: flex; flex-direction: column; gap: var(--space-2); margin: var(--space-6) 0 var(--space-8); }
  .pl-progress-label { font-size: 0.875rem; color: var(--text-secondary); }
  .pl-progress-track { height: 6px; border-radius: 999px; background: var(--glass-bg-strong); overflow: hidden; }
  .pl-progress-fill { display: block; height: 100%; border-radius: 999px; background: var(--brand); transition: width 0.4s var(--ease); }

  /* The calendar. A real table: day-of-week column headers and a week row
     header, so it reads as a grid rather than as a pile of buttons. */
  .pl-cal-wrap { overflow-x: auto; }
  /* Seven columns cannot each be 44px inside a 320px screen, and a day is a
     tap target like any other, so below 430 the month keeps 44px cells and
     the wrap scrolls sideways instead of shrinking them. The default view on
     a phone is the list, so this only affects somebody who chose the
     calendar there on purpose. */
  .pl-cal { width: 100%; border-collapse: separate; border-spacing: 4px; table-layout: fixed; }
  @media (min-width: 768px) { .pl-cal { border-spacing: var(--space-2); } }
  .pl-cal th { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: var(--space-1); }
  .pl-cell { vertical-align: top; height: 84px; padding: 0; border-radius: var(--radius); background: var(--bg-card); border: 1px solid var(--border); position: relative; }
  .pl-cell.is-blank { background: none; border-color: transparent; }
  .pl-cell-day { position: absolute; top: 4px; left: 6px; z-index: 1; font-size: 0.6875rem; color: var(--text-muted); }
  .pl-cell-post {
    display: block; position: relative; width: 100%; height: 100%; padding: 0;
    background: none; border: 0; border-radius: var(--radius); overflow: hidden; cursor: pointer;
  }
  .pl-cell-post:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-cell-img { width: 100%; height: 100%; border-radius: var(--radius); }
  .pl-cell-noimg { display: block; width: 100%; height: 100%; background: var(--surface); }
  .pl-cell-meta { position: absolute; right: 4px; bottom: 4px; display: flex; align-items: center; gap: 4px; }
  .pl-cell-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--chrome-solid); color: var(--text);
    font-size: 0.625rem; font-weight: 700;
  }
  @media (min-width: 768px) { .pl-cell { height: 116px; } }

  .pl-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: 0 0 10px; }
  .pl-dot--idle { background: var(--text-muted); }
  .pl-dot--wait { background: var(--brand-light); }
  .pl-dot--ok { background: var(--success); }
  .pl-dot--done { background: var(--text-faint); }

  .pl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
  .pl-row {
    display: flex; align-items: center; gap: var(--space-4); width: 100%;
    padding: var(--space-3); text-align: left;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
    cursor: pointer; transition: border-color 0.2s, transform 0.2s;
  }
  .pl-row:hover { border-color: var(--border-light); transform: translateY(-1px); }
  .pl-row:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-row-img { width: 64px; flex: 0 0 64px; border-radius: var(--radius); }
  .pl-row-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .pl-row-when { font-size: 0.8125rem; font-weight: 700; color: var(--text); }
  .pl-row-cap { font-size: 0.9375rem; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-row-pills { display: flex; gap: var(--space-2); flex-wrap: wrap; }

  .pl-pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 999px;
    background: var(--glass-bg); color: var(--text-secondary);
    font-size: 0.75rem; font-weight: 600; white-space: nowrap;
  }
  .pl-pill--wait { background: var(--glass-bg-brand); color: var(--brand-text); }
  .pl-pill--ok { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); }
  .pl-pill--done { color: var(--text-muted); }

  .pl-empty { padding: var(--space-12) var(--space-6); text-align: center; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); }
  .pl-empty-title { margin: 0; font-size: 1.0625rem; font-weight: 700; color: var(--text); }
  .pl-empty-sub { margin: var(--space-2) 0 0; font-size: 0.9375rem; color: var(--text-secondary); }

  .pl-legend { margin-top: var(--space-12); }
  .pl-legend-title { font-size: 0.875rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 var(--space-4); }
  .pl-legend ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
  .pl-legend li { display: flex; align-items: baseline; gap: var(--space-3); font-size: 0.9375rem; line-height: 1.5; flex-wrap: wrap; }
  .pl-legend-name { font-weight: 700; color: var(--text); }
  .pl-legend-text { color: var(--text-secondary); min-width: 0; }

  /* The detail: a bottom sheet on a phone, a side panel from 768 up. */
  .pl-panel-wrap { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; }
  .pl-scrim { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; background: rgba(0, 0, 0, 0.6); border: 0; cursor: pointer; }
  .pl-panel {
    position: relative; display: flex; flex-direction: column;
    width: 100%; max-height: 92vh; margin-top: auto;
    background: var(--bg-elevated); border-top: 1px solid var(--border);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    animation: plUp 0.28s var(--ease);
  }
  @keyframes plUp { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .pl-panel { animation: none; } }
  @media (min-width: 768px) {
    .pl-panel { width: min(480px, 100%); max-height: none; height: 100%; margin-top: 0; border-radius: 0; border-top: 0; border-left: 1px solid var(--border); }
  }
  .pl-panel-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border); }
  .pl-panel-title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .pl-panel-body { display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-5); overflow-y: auto; }
  .pl-panel-img { width: 100%; border-radius: var(--radius); }
  .pl-noimg { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--text-muted); font-size: 0.875rem; }
  .pl-pills { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .pl-label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .pl-caption { display: flex; flex-direction: column; gap: var(--space-2); }
  .pl-caption-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
  .pl-caption-body { margin: 0; font-size: 1rem; line-height: 1.65; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; }
  .pl-note { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); background: var(--glass-bg); border-radius: var(--radius); }
  .pl-note--rob { background: var(--glass-bg-brand); }
  .pl-note-body { margin: 0; font-size: 0.9375rem; line-height: 1.6; color: var(--text-secondary); overflow-wrap: anywhere; }
  .pl-ask { display: flex; flex-direction: column; gap: var(--space-2); }
  .pl-textarea {
    width: 100%; min-height: 110px; padding: var(--space-3) var(--space-4);
    background: var(--bg-card); color: var(--text);
    border: 1px solid var(--border); border-radius: var(--radius);
    font: inherit; font-size: 1rem; line-height: 1.6; resize: vertical;
  }
  .pl-textarea:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-hint { margin: 0; font-size: 0.8125rem; color: var(--text-muted); }
  .pl-formerr { margin: 0; font-size: 0.8125rem; font-weight: 600; color: var(--brand-light); }
  .pl-panel-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border); flex-wrap: wrap; }
  .pl-foot-note { margin: 0; font-size: 0.875rem; color: var(--text-secondary); flex: 1; min-width: 0; }

  .pl-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 44px; padding: 0 var(--space-5);
    background: linear-gradient(135deg, rgba(212, 76, 67, 0.85) 0%, rgba(168, 58, 50, 0.85) 100%);
    color: var(--text); border: 1px solid var(--glass-border-brand); border-radius: var(--radius);
    font: inherit; font-size: 0.9375rem; font-weight: 700; cursor: pointer;
    transition: background 0.2s, transform 0.2s, opacity 0.2s;
  }
  .pl-btn:hover { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%); }
  .pl-btn:focus-visible { outline: 2px solid var(--brand-light); outline-offset: 3px; }
  .pl-btn[disabled] { opacity: 0.7; cursor: default; }
  .pl-btn--ghost { background: var(--glass-bg); border-color: var(--border-light); color: var(--text); }
  .pl-btn--ghost:hover { background: var(--hover-soft); }
  .pl-copy { min-height: 44px; }

  .pl-toast {
    position: fixed; left: 50%; bottom: var(--space-6); transform: translateX(-50%);
    z-index: 70; margin: 0; max-width: min(92vw, 460px);
    padding: var(--space-3) var(--space-5);
    background: var(--chrome-solid); color: var(--text);
    border: 1px solid var(--border-light); border-radius: var(--radius);
    font-size: 0.9375rem; box-shadow: var(--shadow-chrome-strong);
  }

  .pl-error { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); }

  .pl-skel { display: flex; flex-direction: column; gap: var(--space-4); }
  .pl-skel-line { display: block; height: 20px; border-radius: var(--radius); background: var(--glass-bg-strong); }
  .pl-skel-line--title { width: min(60%, 340px); height: 44px; }
  .pl-skel-line--lead { width: min(80%, 480px); }
  .pl-skel-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-2); margin-top: var(--space-6); }
  .pl-skel-cell { display: block; height: 84px; border-radius: var(--radius); background: var(--glass-bg); }
  @media (min-width: 768px) { .pl-skel-cell { height: 116px; } }
  @media (prefers-reduced-motion: no-preference) {
    .pl-skel-line, .pl-skel-cell { animation: plPulse 1.6s ease-in-out infinite; }
    @keyframes plPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  }
`;
