import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import Send01 from '@untitled-ui/icons-react/build/esm/Send01';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import Home02 from '@untitled-ui/icons-react/build/esm/Home02';
import Image01 from '@untitled-ui/icons-react/build/esm/Image01';
import Announcement01 from '@untitled-ui/icons-react/build/esm/Announcement01';
import Lightbulb02 from '@untitled-ui/icons-react/build/esm/Lightbulb02';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import Play from '@untitled-ui/icons-react/build/esm/Play';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Camera01 from '@untitled-ui/icons-react/build/esm/Camera01';
import Link01 from '@untitled-ui/icons-react/build/esm/Link01';
import { ClientBar, ClientFoot, clientChromeStyles } from '../components/ClientPageChrome';
import { Reveal, Stagger } from '../marketing/motion';
import { useHead } from '../marketing/useHead';
import { COPY } from '../shared/copy';
import { AD_GOALS, AD_PLACEMENTS, SUGGESTION_KINDS, SUGGESTION_GOALS, suggestionStatusOf } from '../shared/semantics';
import { postDateLabel, postLabel, platformsOf, formatOf, hashtagsOf, kindOf, isDone } from '../lib/posts';
import { saveMedia, saveLabel } from '../lib/share';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../lib/cloudinary';

/* The client's planner dashboard (planner dashboard, milestone 3), at
 * /planner/:token.
 *
 * Four destinations: Home (what needs me, how the month is going), Posts
 * (the things they post themselves), Ads (the things Rob runs for them) and
 * Ideas (what they want next). A bottom tab bar on a phone, a segmented
 * control on a computer; both hide while a detail or the Suggest sheet is up.
 *
 * The token is the whole credential and api/planner.js deliberately cannot
 * tell an unknown one from a revoked one from a switched off planner: all
 * three are the same 404. So this page has one dead end state and never
 * implies whether a link was ever good.
 *
 * Everything here is read plus three writes: approve, ask for a change, and
 * suggest an idea. The copy speaks as Rob, in the first person.
 */

const VIEW_KEY = 'vz_planner_view';
const HOW_KEY = 'vz_planner_how';
const DRAFT_PREFIX = 'vz_planner_note';
const NOTE_MAX = 500;
const TABS = ['home', 'posts', 'ads', 'ideas'];
const TAB_ICON = { home: Home02, posts: Image01, ads: Announcement01, ideas: Lightbulb02 };
const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', other: 'Other' };
const PHOTO_MAX = 3;

/* Statuses, in the client's words, one list per kind. Two accents only:
 * Needs you (brand) and Live (green). Everything else is quiet. */
const TONE = { making: 'idle', review: 'wait', approved: 'ok', posted: 'done', live: 'live', finished: 'done' };
const ICON = { making: Edit02, review: Clock, approved: Check, posted: Send01, live: Play, finished: Check };
const statusMeta = (item) => {
  const kind = kindOf(item);
  const s = COPY.planner.status[kind][item.status] ? item.status : 'making';
  return { label: COPY.planner.status[kind][s], tone: TONE[s], Icon: ICON[s], kind };
};
const platformNames = (item) => platformsOf(item).map(id => PLATFORM_LABEL[id] || 'Other');
const adGoalLabel = (id) => (AD_GOALS.find(g => g.id === id) || AD_GOALS[AD_GOALS.length - 1]).client;
const placementNames = (ids = []) => ids.map(id => (AD_PLACEMENTS.find(p => p.id === id) || {}).label).filter(Boolean);
const isVideo = (item) => formatOf(item) === 'video';
const hasVideoFile = (item) => isVideo(item) && !!item.video?.url;
/** The picture a row or a detail shows: the image, or a video's poster. */
const pictureOf = (item) => item.imageUrl || item.video?.poster || '';
/** What Save to photos saves: the video file when there is one, else the picture. */
const mediaOf = (item) => (hasVideoFile(item) ? { url: item.video.url, kind: 'video' } : pictureOf(item) ? { url: pictureOf(item), kind: 'image' } : null);
const whenOf = (item) => (kindOf(item) === 'ad' ? (item.ad?.startDate || item.date) : item.date);
const titleOf = (item) => (kindOf(item) === 'ad' ? (item.ad?.name || postLabel(item)) : (item.caption ? item.caption.split('\n')[0] : postLabel(item)));
/** The one line that says how an ad did, for a row: "1,240 people reached, 38 clicks". */
function resultLine(ad) {
  const r = ad?.results;
  if (!r) return '';
  const A = COPY.planner.ad;
  return [r.reach > 0 && A.reach(r.reach), r.clicks > 0 && A.clicks(r.clicks), r.messages > 0 && A.messages(r.messages)].filter(Boolean).slice(0, 2).join(', ');
}

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
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const byWhen = (a, b) => (whenOf(a) || '9999').localeCompare(whenOf(b) || '9999') || String(a.time || '').localeCompare(String(b.time || ''));

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

/* Every layer on this page that means "the screen" is portaled to the body,
 * the same way the admin kit portals its Sheet, Modal, Toast and Popover
 * (src/ui/portal.js). position: fixed only means the viewport while nothing
 * between the element and the root carries a transform, a filter or a
 * containment; any one of those makes that ancestor the containing block.
 * The page's <style> is global, so a portaled layer keeps every rule. */
const overlay = (node) => (typeof document === 'undefined' ? node : createPortal(node, document.body));

/* ── Small pieces ─────────────────────────────────────────────────── */

function StatusPill({ item }) {
  const st = statusMeta(item);
  return (
    <span className={`pl-pill pl-pill--${st.tone}`}>
      <st.Icon width={13} height={13} aria-hidden="true" />
      {st.label}
    </span>
  );
}

/** Post or Ad, and Video with its length when the item is a video. */
function KindPills({ item }) {
  const C = COPY.planner;
  return (
    <>
      <span className={`pl-pill pl-pill--kind pl-pill--${kindOf(item)}`}>{C.kinds[kindOf(item)]}</span>
      {isVideo(item) && (
        <span className="pl-pill pl-pill--kind">
          <Play width={12} height={12} aria-hidden="true" />
          {C.kinds.video}{item.video?.durationSec ? `, ${C.detail.length(item.video.durationSec)}` : ''}
        </span>
      )}
    </>
  );
}

/* The picture slot, used by the detail, the calendar and the rows.
 *
 * An item with no picture yet is the reason this exists: the client was
 * being asked to approve something they could not see, and an empty cell
 * reads as "nothing planned" rather than "not finished". So an empty or
 * broken picture draws a solid tile in the item's own status tone, labelled;
 * a video with no file says so. */
function Thumb({ item, size, label = true, onExpand }) {
  const [broken, setBroken] = useState(false);
  const src = pictureOf(item);
  useEffect(() => { setBroken(false); }, [src]);
  const st = statusMeta(item);
  const shown = src && !broken;
  const D = COPY.planner.detail;
  /* A calendar cell and a row thumbnail are square and crop: they are a
     glance. The detail is where approving happens, so there the whole picture
     shows, letterboxed inside the format's own aspect. */
  const ratio = size === 'panel' ? (formatOf(item) === 'portrait' ? 'img-fit--4x5' : 'img-fit--9x16') : 'img-fit--1x1';
  const whole = size === 'panel';
  const Tag = whole && shown && onExpand ? 'button' : 'span';
  const tagProps = Tag === 'button' ? { type: 'button', onClick: onExpand, 'aria-label': 'See the whole picture' } : {};
  const emptyText = broken ? D.imageBroken : isVideo(item) ? D.videoSoon : D.imageSoon;
  return (
    <Tag className={`img-fit ${ratio} pl-img pl-img--${size}${whole ? ' pl-img--whole' : ''}${shown ? '' : ` is-placeholder pl-img--${st.tone}`}`} {...tagProps}>
      {shown ? (
        <img src={src} alt="" width={720} height={720} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <span className="pl-img-empty">
          <span className="pl-img-initial" aria-hidden="true">{isVideo(item) ? <Play width={18} height={18} /> : platformNames(item).map(n => n[0]).slice(0, 2).join('')}</span>
          {label ? <span className="pl-img-label">{emptyText}</span> : <span className="visually-hidden">{emptyText}</span>}
        </span>
      )}
      {hasVideoFile(item) && size !== 'panel' && <span className="pl-img-play" aria-hidden="true"><Play width={14} height={14} /></span>}
      {whole && shown && onExpand && <span className="pl-img-zoom" aria-hidden="true">Tap to see it whole</span>}
    </Tag>
  );
}

/* The whole picture on its own, fit to the screen. A dialog: labelled, focus
 * trapped, Escape closes, and so does tapping anywhere. */
function Expanded({ src, label, onClose }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = ref.current?.querySelectorAll('button, a');
      if (!f?.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return overlay(
    <div className="pl-zoom" role="dialog" aria-modal="true" aria-label={label} ref={ref} onClick={onClose}>
      <img className="pl-zoom-img" src={src} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" ref={closeRef} className="pl-zoom-close" onClick={onClose} aria-label="Close the picture">
        <XClose width={20} height={20} aria-hidden="true" />
      </button>
    </div>
  );
}

/* Where Save to photos lands when the share sheet or the download could not
 * take the file: the picture itself, big, and the one gesture that always
 * works on a phone, with the original file behind a link for a computer. */
function HoldSheet({ media, href, onClose }) {
  const D = COPY.planner.detail;
  const ref = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = ref.current?.querySelectorAll('button, a');
      if (!f?.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return overlay(
    <div className="pl-zoom pl-hold" role="dialog" aria-modal="true" aria-label={media.kind === 'video' ? D.holdVideo : D.hold} ref={ref}>
      {media.kind === 'video'
        ? <video className="pl-zoom-img" src={media.url} controls playsInline preload="metadata" />
        : <img className="pl-zoom-img" src={media.url} alt="" />}
      <div className="pl-hold-foot">
        <p className="pl-hold-text">{media.kind === 'video' ? D.holdVideo : D.hold}</p>
        <a className="pl-btn pl-btn--ghost" href={href} target="_blank" rel="noopener noreferrer" download>{D.openFile}</a>
      </div>
      <button type="button" ref={closeRef} className="pl-zoom-close" onClick={onClose} aria-label={D.close}>
        <XClose width={20} height={20} aria-hidden="true" />
      </button>
    </div>
  );
}

/* The dot on a calendar cell. Colour alone never carries it: every dot has
 * text beside it for a screen reader. */
function StatusDot({ item }) {
  const st = statusMeta(item);
  return (
    <>
      <span className={`pl-dot pl-dot--${st.tone}`} aria-hidden="true" />
      <span className="visually-hidden">{st.label}</span>
    </>
  );
}

/* A labelled section inside a detail: one heading, one body. Empty facts do
 * not render, so a caller passes nothing and gets nothing. */
function Fact({ label, children, action }) {
  if (children == null || children === '' || (Array.isArray(children) && !children.some(Boolean))) return null;
  return (
    <div className="pl-fact">
      <div className="pl-fact-head">
        <span className="pl-label">{label}</span>
        {action}
      </div>
      <div className="pl-fact-body">{children}</div>
    </div>
  );
}

function Skeleton({ kind = 'list' }) {
  return (
    <div className="pl-skel" aria-busy="true" aria-label="Loading your planner">
      <span className="pl-skel-line pl-skel-line--title" />
      {kind === 'home' && <><span className="pl-skel-line pl-skel-line--strip" /><span className="pl-skel-line pl-skel-line--lead" /></>}
      {kind !== 'home' && <span className="pl-skel-line pl-skel-line--lead" />}
      <div className="pl-skel-rows">{Array.from({ length: kind === 'home' ? 3 : 5 }, (_, i) => <span key={i} className="pl-skel-row" />)}</div>
    </div>
  );
}

/* The four destinations: a bar at the bottom on a phone, a segmented control
 * under the title on a computer. One component, two layouts, the same
 * buttons, so a test finds .pl-tab at every width. */
function Tabs({ tab, onPick, needs, bottom }) {
  const C = COPY.planner;
  return (
    <nav className={bottom ? 'pl-tabbar' : 'pl-seg'} aria-label="Planner sections">
      {TABS.map(id => {
        const Icon = TAB_ICON[id];
        const n = id === 'home' ? 0 : needs[id] || 0;
        return (
          <button key={id} type="button" className={`pl-tab${tab === id ? ' is-on' : ''}`} data-tab={id} aria-current={tab === id ? 'page' : undefined} onClick={() => onPick(id)}>
            <span className="pl-tab-icon"><Icon width={20} height={20} aria-hidden="true" />{n > 0 && <span className="pl-tab-dot" aria-hidden="true" />}</span>
            <span className="pl-tab-label">{C.tabs[id]}</span>
            {n > 0 && <span className="visually-hidden">{`, ${C.needs(n)}`}</span>}
          </button>
        );
      })}
    </nav>
  );
}

/* One row in a list: the picture, the kind and status, when, and what. The
 * whole row is the one button. */
function ItemRow({ item, onOpen }) {
  const ad = kindOf(item) === 'ad' ? item.ad : null;
  const A = COPY.planner.ad;
  const result = ad ? resultLine(ad) : '';
  return (
    <button type="button" className="pl-row" onClick={() => onOpen(item.id)}>
      <Thumb item={item} size="row" label={false} />
      <span className="pl-row-main">
        <span className="pl-row-pills"><KindPills item={item} /><StatusPill item={item} /></span>
        <span className="pl-row-title">{titleOf(item)}</span>
        {ad ? (
          <>
            <span className="pl-row-when">{A.range(postDateLabel(ad.startDate), postDateLabel(ad.endDate))}</span>
            <span className="pl-row-sub">{adGoalLabel(ad.goal)}{result ? `. ${result}` : ''}</span>
          </>
        ) : (
          <>
            <span className="pl-row-when">{postDateLabel(item.date) || 'No date yet'}{item.time ? `, ${item.time}` : ''}</span>
            <span className="pl-row-chips">{platformNames(item).map(n => <span key={n} className="pl-chip">{n}</span>)}</span>
          </>
        )}
      </span>
    </button>
  );
}

function Empty({ title, body, action, first }) {
  return (
    <Reveal as="div" className="pl-empty" data-state={first ? 'empty' : 'none'} delay={120}>
      <p className="pl-empty-title">{title}</p>
      <p className="pl-empty-sub">{body}</p>
      {action}
    </Reveal>
  );
}

function MonthBar({ month, onShift, children }) {
  return (
    <Reveal as="div" className="pl-monthbar" delay={40}>
      <div className="pl-monthnav">
        <button type="button" className="pl-icon-btn" onClick={() => onShift(-1)} aria-label="Previous month">
          <ChevronLeft width={18} height={18} aria-hidden="true" />
        </button>
        <h2 className="pl-month">{monthName(month)}</h2>
        <button type="button" className="pl-icon-btn pl-next" onClick={() => onShift(1)} aria-label="Next month">
          <ChevronLeft width={18} height={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </Reveal>
  );
}

/* ── Home ─────────────────────────────────────────────────────────── */

function HomeView({ data, items, month, onOpen, onTab, onSuggest }) {
  const C = COPY.planner;
  const [how, setHow] = useState(() => readLS(HOW_KEY, '') !== 'seen');
  const needs = items.filter(i => i.status === 'review');
  const done = items.filter(isDone).length;
  const of = Math.max(Number(data.client?.postsPerMonth) || 0, items.length);
  const today = todayKey();
  const sorted = [...items].sort(byWhen);
  const upcoming = sorted.filter(i => (whenOf(i) || '') >= today);
  const next = (upcoming.length ? upcoming : sorted.slice(-3)).slice(0, 3);
  const dismiss = () => { setHow(false); writeLS(HOW_KEY, 'seen'); };
  const reopen = () => { setHow(true); writeLS(HOW_KEY, ''); };
  return (
    <>
      <Reveal as="h1" className="pl-title display">{data.client.displayName}</Reveal>
      {data.client.welcome && <Reveal as="p" className="pl-lead" delay={40}>{data.client.welcome}</Reveal>}

      <Reveal as="div" className={`pl-needs${needs.length ? ' is-waiting' : ''}`} delay={80}>
        <p className="pl-needs-text" role="status">{needs.length ? C.needs(needs.length) : C.caughtUp}</p>
        {needs.length
          ? <button type="button" className="pl-btn pl-needs-btn" onClick={() => onOpen(needs.sort(byWhen)[0].id)}>{C.review}</button>
          : <button type="button" className="pl-btn pl-btn--ghost pl-needs-btn" onClick={onSuggest}><Lightbulb02 width={16} height={16} aria-hidden="true" />{C.suggest}</button>}
      </Reveal>

      {items.length > 0 && (
        <Reveal as="div" className="pl-progress" delay={120}>
          <span className="pl-progress-row">
            <span className="pl-progress-label">{C.progress(done, of)}</span>
            <span className="pl-progress-month">{monthName(month)}</span>
          </span>
          <span className="pl-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={done} aria-label={`${C.progress(done, of)}, ${monthName(month)}`}>
            <span className="pl-progress-fill" style={{ width: `${of ? Math.min(100, (done / of) * 100) : 0}%` }} />
          </span>
        </Reveal>
      )}

      <Reveal as="div" className="pl-block" delay={160}>
        <div className="pl-block-head">
          <h2 className="pl-h2">{C.comingUp}</h2>
          {items.length > 3 && <button type="button" className="pl-link" onClick={() => onTab('posts')}>{C.tabs.posts}</button>}
        </div>
        {next.length
          ? <ul className="pl-list">{next.map(i => <li key={i.id} className="pl-rowwrap"><ItemRow item={i} onOpen={onOpen} /></li>)}</ul>
          : <p className="pl-quiet">{C.nothingComing}</p>}
      </Reveal>

      {how ? (
        <Reveal as="section" className="pl-how" aria-labelledby="pl-how-title" delay={200}>
          <h2 id="pl-how-title" className="pl-h2">{C.how.title}</h2>
          <ol className="pl-how-list">{C.how.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>
          <button type="button" className="pl-btn pl-btn--ghost" onClick={dismiss}>{C.how.close}</button>
        </Reveal>
      ) : (
        <p className="pl-how-reopen"><button type="button" className="pl-link" onClick={reopen}>{C.how.open}</button></p>
      )}
    </>
  );
}

/* ── Posts ────────────────────────────────────────────────────────── */

function PostsView({ items, month, onShift, onOpen, canGrid, view, onView }) {
  const C = COPY.planner;
  const posts = useMemo(() => items.filter(i => kindOf(i) === 'post').sort(byWhen), [items]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const p of posts) { const d = dayOf(p.date); if (d) m.set(d, [...(m.get(d) || []), p]); }
    return m;
  }, [posts]);
  const first = month === thisMonth();
  return (
    <>
      <Reveal as="h1" className="pl-title display">{C.tabs.posts}</Reveal>
      <Reveal as="p" className="pl-lead" delay={30}>{C.kindHelp.post}.</Reveal>
      <MonthBar month={month} onShift={onShift}>
        {canGrid && posts.length > 0 && (
          <div className="pl-views" role="radiogroup" aria-label="How to show the month">
            {['calendar', 'list'].map(v => (
              <button key={v} type="button" role="radio" aria-checked={view === v} className={`pl-view${view === v ? ' is-on' : ''}`} onClick={() => onView(v)}>{C.views[v]}</button>
            ))}
          </div>
        )}
      </MonthBar>
      {!posts.length ? (
        <Empty first={first} {...(first ? C.empty.postsFirst : C.empty.postsMonth)} />
      ) : view === 'calendar' && canGrid ? (
        <div className="pl-cal-wrap">
          <table className="pl-cal">
            <caption className="visually-hidden">{`Posts for ${monthName(month)}`}</caption>
            <thead>
              <tr>{DOW.map(d => <th key={d} scope="col"><span aria-hidden="true">{d.slice(0, 1)}</span><span className="visually-hidden">{d}</span></th>)}</tr>
            </thead>
            <tbody>
              {weeksOf(month).map((week, wi) => (
                <tr key={wi}>
                  {week.map((day, di) => (
                    <td key={di} className={`pl-cell${day ? '' : ' is-blank'}`}>
                      {day ? (
                        <>
                          <span className="pl-cell-day" aria-hidden="true">{day}</span>
                          {(byDay.get(day) || []).map(p => (
                            <button key={p.id} type="button" className="pl-cell-post" onClick={() => onOpen(p.id)}>
                              <Thumb item={p} size="cell" label={false} />
                              <span className="pl-cell-meta"><StatusDot item={p} /></span>
                              <span className="visually-hidden">{`${postDateLabel(p.date)}, ${platformNames(p).join(', ')}, ${postLabel(p)}`}</span>
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
          {posts.map(p => <ItemRow key={p.id} item={p} onOpen={onOpen} />)}
        </Stagger>
      )}
    </>
  );
}

/* ── Ads ──────────────────────────────────────────────────────────── */

function AdsView({ items, month, onShift, onOpen }) {
  const C = COPY.planner;
  const ads = useMemo(() => items.filter(i => kindOf(i) === 'ad').sort(byWhen), [items]);
  const first = month === thisMonth();
  return (
    <>
      <Reveal as="h1" className="pl-title display">{C.tabs.ads}</Reveal>
      <Reveal as="p" className="pl-lead" delay={30}>{C.kindHelp.ad}.</Reveal>
      <MonthBar month={month} onShift={onShift} />
      {!ads.length ? (
        <Empty first={first} {...(first ? C.empty.adsFirst : C.empty.adsMonth)} />
      ) : (
        <Stagger as="ul" itemAs="li" itemClassName="pl-rowwrap" className="pl-list">
          {ads.map(a => <ItemRow key={a.id} item={a} onOpen={onOpen} />)}
        </Stagger>
      )}
    </>
  );
}

/* ── Ideas ────────────────────────────────────────────────────────── */

const SUGGESTION_TONE = { new: 'idle', planned: 'ok', declined: 'done' };
const SUGGESTION_ICON = { new: Send01, planned: Check, declined: XClose };

function IdeasView({ suggestions, onSuggest }) {
  const C = COPY.planner;
  const I = C.ideas;
  const list = [...suggestions].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return (
    <>
      <Reveal as="h1" className="pl-title display">{I.title}</Reveal>
      <Reveal as="p" className="pl-lead" delay={30}>{I.lead}</Reveal>
      {list.length > 0 && (
        <Reveal as="div" className="pl-actions" delay={60}>
          <button type="button" className="pl-btn pl-suggest" onClick={onSuggest}><Plus width={16} height={16} aria-hidden="true" />{I.suggest}</button>
        </Reveal>
      )}
      {!list.length ? (
        <Empty first title={C.empty.ideasFirst.title} body={C.empty.ideasFirst.body}
          action={<button type="button" className="pl-btn pl-suggest" onClick={onSuggest}><Plus width={16} height={16} aria-hidden="true" />{I.suggest}</button>} />
      ) : (
        <Stagger as="ul" itemAs="li" itemClassName="pl-rowwrap" className="pl-list">
          {list.map(s => {
            const st = suggestionStatusOf(s.status);
            const Icon = SUGGESTION_ICON[st.id];
            return (
              <div key={s.id} className="pl-idea">
                <span className="pl-row-pills">
                  <span className={`pl-pill pl-pill--kind pl-pill--${s.kind === 'ad' ? 'ad' : 'post'}`}>{C.kinds[s.kind] || C.kinds.post}</span>
                  <span className={`pl-pill pl-pill--${SUGGESTION_TONE[st.id]}`}><Icon width={13} height={13} aria-hidden="true" />{st.client}</span>
                </span>
                <span className="pl-row-title">{s.subject}</span>
                <span className="pl-row-when">{s.createdAt ? new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}{s.goal && s.goal !== 'other' ? `. ${(SUGGESTION_GOALS.find(g => g.id === s.goal) || {}).label || ''}` : ''}</span>
                {s.note && <span className="pl-idea-note"><span className="pl-label">{I.note}</span>{s.note}</span>}
              </div>
            );
          })}
        </Stagger>
      )}
    </>
  );
}

/* ── The Suggest sheet ────────────────────────────────────────────── */

function SuggestSheet({ onClose, onSend }) {
  const S = COPY.planner.ideas.sheet;
  const [kind, setKind] = useState('post');
  const [subject, setSubject] = useState('');
  const [goal, setGoal] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState('');
  const [link, setLink] = useState('');
  const [photos, setPhotos] = useState([]);
  const [linkMode, setLinkMode] = useState(!cloudinaryEnabled);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const closeRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickFiles = async (files) => {
    const room = PHOTO_MAX - photos.length;
    const list = Array.from(files || []).slice(0, Math.max(0, room));
    if (!list.length) return;
    setUploading(true);
    setError('');
    const got = [];
    for (const f of list) {
      const r = await uploadToCloudinary(f);
      if (r.url) got.push(r.url);
      else { setError(`${S.uploadFailed} ${r.error || ''}`.trim()); break; }
    }
    setPhotos(p => [...p, ...got].slice(0, PHOTO_MAX));
    setUploading(false);
  };

  const send = async () => {
    if (!subject.trim()) { setError(S.needSubject); return; }
    setBusy(true);
    setError('');
    const r = await onSend({ kind, subject: subject.trim(), goal: goal || 'other', details: details.trim(), preferredDate: date, link: linkMode ? link.trim() : '', photos: linkMode ? [] : photos });
    setBusy(false);
    if (r === true) setSent(true);
    else if (r === 400) setError(S.needSubject);
    else if (r === 429) setError(S.tooMany);
    else if (r) setError(COPY.planner.toast.failed);
  };

  return overlay(
    <div className="pl-panel-wrap" role="dialog" aria-modal="true" aria-label={S.title}>
      <button type="button" className="pl-scrim" aria-label="Close" onClick={onClose} />
      <div className="pl-panel pl-sheet">
        <div className="pl-panel-head">
          <span className="pl-panel-title">{S.title}</span>
          <button type="button" ref={closeRef} className="pl-icon-btn" onClick={onClose} aria-label={COPY.planner.detail.close}>
            <XClose width={18} height={18} aria-hidden="true" />
          </button>
        </div>

        {sent ? (
          <div className="pl-panel-body">
            <div className="pl-sent" role="status">
              <Check width={28} height={28} aria-hidden="true" />
              <p className="pl-sent-text">{S.sent}</p>
            </div>
          </div>
        ) : (
          <div className="pl-panel-body">
            <fieldset className="pl-field">
              <legend className="pl-label">{S.kind}</legend>
              <div className="pl-kinds" role="radiogroup" aria-label={S.kind}>
                {SUGGESTION_KINDS.map(k => {
                  const Icon = k.id === 'ad' ? Announcement01 : k.id === 'video' ? Play : Image01;
                  return (
                    <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`pl-kind${kind === k.id ? ' is-on' : ''}`} onClick={() => setKind(k.id)}>
                      <Icon width={22} height={22} aria-hidden="true" />
                      <span>{k.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-subject">{S.subject}</label>
              <input id="pl-subject" className="pl-input" type="text" maxLength={120} value={subject} placeholder={S.subjectPlaceholder} required
                onChange={(e) => { setSubject(e.target.value.slice(0, 120)); if (error) setError(''); }} />
            </div>

            <fieldset className="pl-field">
              <legend className="pl-label">{S.goal} <span className="pl-opt">{S.optional}</span></legend>
              <div className="pl-chips" role="radiogroup" aria-label={S.goal}>
                {SUGGESTION_GOALS.map(g => (
                  <button key={g.id} type="button" role="radio" aria-checked={goal === g.id} className={`pl-chipbtn${goal === g.id ? ' is-on' : ''}`} onClick={() => setGoal(goal === g.id ? '' : g.id)}>{g.label}</button>
                ))}
              </div>
            </fieldset>

            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-details">{S.details} <span className="pl-opt">{S.optional}</span></label>
              <textarea id="pl-details" className="pl-textarea pl-textarea--short" rows={3} maxLength={1000} value={details} placeholder={S.detailsPlaceholder}
                onChange={(e) => setDetails(e.target.value.slice(0, 1000))} />
            </div>

            <div className="pl-field">
              <label className="pl-label" htmlFor="pl-date">{S.date} <span className="pl-opt">{S.optional}</span></label>
              <input id="pl-date" className="pl-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {linkMode ? (
              <div className="pl-field">
                <label className="pl-label" htmlFor="pl-link">{S.link} <span className="pl-opt">{S.optional}</span></label>
                <input id="pl-link" className="pl-input" type="url" inputMode="url" maxLength={500} value={link} placeholder={S.linkPlaceholder} onChange={(e) => setLink(e.target.value)} />
                {cloudinaryEnabled && <button type="button" className="pl-link" onClick={() => { setLinkMode(false); setError(''); }}><Camera01 width={14} height={14} aria-hidden="true" />{S.photos}</button>}
              </div>
            ) : (
              <div className="pl-field">
                <span className="pl-label" id="pl-photos-label">{S.photos} <span className="pl-opt">{S.optional}</span></span>
                <div className="pl-photos" role="group" aria-labelledby="pl-photos-label">
                  {photos.map((u, i) => (
                    <span key={u} className="pl-photo">
                      <img src={u} alt="" width={72} height={72} loading="lazy" decoding="async" />
                      <button type="button" className="pl-photo-x" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} aria-label={`Remove picture ${i + 1}`}><XClose width={14} height={14} aria-hidden="true" /></button>
                    </span>
                  ))}
                  {photos.length < PHOTO_MAX && (
                    <button type="button" className="pl-photo pl-photo--add" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading ? 'true' : undefined}>
                      <Camera01 width={20} height={20} aria-hidden="true" />
                      <span>{uploading ? 'Uploading' : S.photos}</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple style={{ display: 'none' }} onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
                </div>
                <p className="pl-hint">{S.photosHint} <button type="button" className="pl-link" onClick={() => { setLinkMode(true); setError(''); }}><Link01 width={14} height={14} aria-hidden="true" />{S.addLink}</button></p>
              </div>
            )}

            {error && <p className="pl-formerr" role="alert">{error}</p>}
          </div>
        )}

        <div className="pl-panel-foot">
          {sent ? (
            <button type="button" className="pl-btn" onClick={onClose}>{COPY.planner.detail.close}</button>
          ) : (
            <>
              <button type="button" className="pl-btn pl-btn--ghost" onClick={onClose} disabled={busy}>{COPY.planner.detail.close}</button>
              <button type="button" className="pl-btn pl-send-idea" onClick={send} disabled={busy || uploading} aria-busy={busy ? 'true' : undefined}>
                <Send01 width={16} height={16} aria-hidden="true" />{busy ? S.sending : S.send}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── The detail: a Sheet on a phone, a side panel on a desktop ────── */

function ItemDetail({ item, token, onClose, onApprove, onChange, busy, formError, toast }) {
  const [asking, setAsking] = useState(false);
  const draftKey = `${DRAFT_PREFIX}:${token}:${item.id}`;
  const [note, setNote] = useState(() => { try { return sessionStorage.getItem(draftKey) || ''; } catch { return ''; } });
  const [copied, setCopied] = useState('');
  const [zoom, setZoom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hold, setHold] = useState(null);
  const tags = hashtagsOf(item).join(' ');
  const closeRef = useRef(null);
  const C = COPY.planner;
  const D = C.detail;
  const A = C.ad;
  const st = statusMeta(item);
  const ad = kindOf(item) === 'ad' ? (item.ad || {}) : null;
  const media = item.allowDownload !== false ? mediaOf(item) : null;
  const label = useMemo(() => saveLabel(), []);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { try { sessionStorage.setItem(draftKey, note); } catch { /* private mode */ } }, [note, draftKey]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !zoom && !hold) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoom, hold]);

  const copy = async (what, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 2400); }
    catch { setCopied(''); }
  };
  const CopyBtn = ({ what, text }) => (
    <button type="button" className="pl-copy" onClick={() => copy(what, text)} aria-label={`${D.copy} ${what}`}>
      {copied === what ? <Check width={15} height={15} aria-hidden="true" /> : <Copy01 width={15} height={15} aria-hidden="true" />}
      {copied === what ? D.copied : D.copy}
    </button>
  );

  const save = async () => {
    if (!media || saving) return;
    setSaving(true);
    const r = await saveMedia({ url: media.url, kind: media.kind });
    setSaving(false);
    if (r.outcome === 'shared') toast(C.toast.saved);
    else if (r.outcome === 'downloaded') toast(C.toast.downloaded);
    else if (r.outcome === 'fallback') setHold({ media, href: r.href });
  };

  const send = async () => {
    const ok = await onChange(item, note.trim());
    if (ok) { try { sessionStorage.removeItem(draftKey); } catch { /* nothing to clear */ } setNote(''); setAsking(false); }
  };

  const title = ad ? (ad.name || postLabel(item)) : `${postDateLabel(item.date) || 'No date yet'}${item.time ? `, ${item.time}` : ''}`;
  const picture = pictureOf(item);

  return overlay(
    <div className="pl-panel-wrap" role="dialog" aria-modal="true" aria-label={`${title}, ${st.label}`}>
      <button type="button" className="pl-scrim" aria-label="Close" onClick={onClose} />
      <div className="pl-panel">
        <div className="pl-panel-head">
          <span className="pl-panel-title">{title}</span>
          <button type="button" ref={closeRef} className="pl-icon-btn" onClick={onClose} aria-label={D.close}>
            <XClose width={18} height={18} aria-hidden="true" />
          </button>
        </div>

        <div className="pl-panel-body">
          {/* The creative. A video with a file plays here, inline, and never
              on its own; a video without one says what it will be. */}
          {hasVideoFile(item) ? (
            <video className="pl-video" src={item.video.url} poster={item.video.poster || undefined} controls playsInline preload="metadata" />
          ) : isVideo(item) ? (
            <div className="pl-soon">
              <Play width={24} height={24} aria-hidden="true" />
              <p className="pl-soon-title">{D.videoSoon}{item.video?.durationSec ? `, ${D.length(item.video.durationSec)}` : ''}</p>
              {item.video?.concept && <p className="pl-soon-body"><span className="pl-label">{D.concept}</span>{item.video.concept}</p>}
            </div>
          ) : (
            <Thumb item={item} size="panel" onExpand={() => setZoom(true)} />
          )}
          {zoom && picture && <Expanded src={picture} label={`${title}, the whole picture`} onClose={() => setZoom(false)} />}
          {hold && <HoldSheet media={hold.media} href={hold.href} onClose={() => setHold(null)} />}

          <div className="pl-pills">
            <KindPills item={item} />
            <StatusPill item={item} />
            <span className="pl-pill-help">{C.kindHelp[kindOf(item)]}</span>
          </div>

          {media && (
            <button type="button" className="pl-btn pl-btn--ghost pl-save" onClick={save} disabled={saving} aria-busy={saving ? 'true' : undefined}>
              <Download01 width={16} height={16} aria-hidden="true" />{saving ? D.saving : label}
            </button>
          )}

          {ad ? (
            <>
              <Fact label={A.says} action={item.caption ? <CopyBtn what="caption" text={item.caption} /> : null}>
                {item.caption && <p className="pl-caption-body">{item.caption}</p>}
                {ad.buttonText && <p className="pl-fact-line">{A.button}: <strong>{ad.buttonText}</strong></p>}
              </Fact>
              <Fact label={A.sees}>{ad.audience}</Fact>
              <Fact label={A.shows}>{[...placementNames(ad.placements), ...platformNames(item)].length ? <span className="pl-row-chips">{[...new Set([...platformNames(item), ...placementNames(ad.placements)])].map(n => <span key={n} className="pl-chip">{n}</span>)}</span> : null}</Fact>
              <Fact label={A.runs}>{A.range(postDateLabel(ad.startDate), postDateLabel(ad.endDate))}</Fact>
              <Fact label={A.goal}>{adGoalLabel(ad.goal)}</Fact>
              {ad.budget != null && (
                <Fact label={A.cost}>
                  <p className="pl-fact-line">{A.budget(ad.budget)}</p>
                  {ad.results?.spend > 0 && <p className="pl-fact-line">{A.spend(ad.results.spend)}</p>}
                </Fact>
              )}
              {ad.results && (
                <Fact label={A.results}>
                  <ul className="pl-results">
                    {ad.results.reach > 0 && <li>{A.reach(ad.results.reach)}</li>}
                    {ad.results.clicks > 0 && <li>{A.clicks(ad.results.clicks)}</li>}
                    {ad.results.messages > 0 && <li>{A.messages(ad.results.messages)}</li>}
                  </ul>
                </Fact>
              )}
            </>
          ) : (
            <>
              <Fact label={D.when}>{item.date ? `${postDateLabel(item.date)}${item.time ? `, ${item.time}` : ''}` : null}</Fact>
              <Fact label={D.where}><span className="pl-row-chips">{platformNames(item).map(n => <span key={n} className="pl-chip">{n}</span>)}</span></Fact>
              <Fact label={D.caption} action={item.caption ? <CopyBtn what="caption" text={item.caption} /> : null}>
                {item.caption && <p className="pl-caption-body">{item.caption}</p>}
              </Fact>
              <Fact label={D.hashtags} action={tags ? <CopyBtn what="hashtags" text={tags} /> : null}>
                {tags && <p className="pl-tags">{tags}</p>}
              </Fact>
            </>
          )}

          {item.note && (
            <div className="pl-note pl-note--rob">
              <span className="pl-label">{D.fromRob}</span>
              <p className="pl-note-body">{item.note}</p>
            </div>
          )}
          {item.clientNote && (
            <div className="pl-note">
              <span className="pl-label">{D.yourNote}</span>
              <p className="pl-note-body">{item.clientNote}</p>
            </div>
          )}

          {asking && (
            <div className="pl-ask">
              <label className="pl-label" htmlFor="pl-note">{D.changeLabel}</label>
              <textarea id="pl-note" className="pl-textarea" rows={4} maxLength={NOTE_MAX} value={note} placeholder={D.changePlaceholder} autoFocus
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} />
              <p className="pl-hint">{note.length} of {NOTE_MAX}. {D.changeHint}</p>
              {formError && <p className="pl-formerr" role="alert">{formError}</p>}
            </div>
          )}
        </div>

        <div className="pl-panel-foot">
          {item.status === 'review' ? (
            asking ? (
              <>
                <button type="button" className="pl-btn pl-btn--ghost" onClick={() => setAsking(false)} disabled={busy}>Back</button>
                <button type="button" className="pl-btn" onClick={send} disabled={busy} aria-busy={busy ? 'true' : undefined}>{busy ? D.sending : D.send}</button>
              </>
            ) : (
              <>
                <button type="button" className="pl-btn pl-btn--ghost pl-ask-btn" onClick={() => setAsking(true)} disabled={busy}>{D.change}</button>
                <button type="button" className="pl-btn pl-approve" onClick={() => onApprove(item)} disabled={busy} aria-busy={busy ? 'true' : undefined}>
                  <Check width={16} height={16} aria-hidden="true" />{D.approve}
                </button>
              </>
            )
          ) : (
            <>
              <p className="pl-foot-note">{C.settled[st.kind][item.status] || C.settled[st.kind].making}</p>
              <button type="button" className="pl-btn pl-btn--ghost" onClick={onClose}>{D.close}</button>
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
  const [params, setParams] = useSearchParams();
  const C = COPY.planner;
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'home';

  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState(null);          // { client, month, posts, suggestions }
  const [state, setState] = useState('loading');   // loading | ready | dead | error
  const [view, setView] = useState(() => readLS(VIEW_KEY, ''));
  const [openId, setOpenId] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const wide = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;
  const [desktop, setDesktop] = useState(() => !!wide?.matches);
  /* Seven columns of 44px do not fit a phone: 320 minus the page padding is
     288, which is 41 a column even with no gaps. So the calendar is offered
     from 430 up and the list is the whole story below that. */
  const roomy = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 430px)') : null;
  const [canGrid, setCanGrid] = useState(() => !!roomy?.matches);
  useEffect(() => {
    if (!roomy) return undefined;
    const on = (e) => setCanGrid(e.matches);
    roomy.addEventListener('change', on);
    return () => roomy.removeEventListener('change', on);
  }, [roomy]);
  useEffect(() => {
    if (!wide) return undefined;
    const on = (e) => setDesktop(e.matches);
    wide.addEventListener('change', on);
    return () => wide.removeEventListener('change', on);
  }, [wide]);

  useHead({ title: 'Your planner | Visualize.', description: 'Your posts, ads and ideas for the month.', noindex: true });

  const activeView = canGrid ? (view || (desktop ? 'calendar' : 'list')) : 'list';
  const pickView = (v) => { setView(v); writeLS(VIEW_KEY, v); };
  const pickTab = useCallback((t) => {
    setParams(t === 'home' ? {} : { tab: t }, { replace: true });
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { /* old browsers */ }
  }, [setParams]);

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

  const dataPosts = data?.posts;
  const items = useMemo(() => dataPosts || [], [dataPosts]);
  const suggestions = useMemo(() => data?.suggestions || [], [data]);
  const open = openId ? items.find(p => p.id === openId) : null;
  const needs = useMemo(() => ({
    posts: items.filter(i => kindOf(i) === 'post' && i.status === 'review').length,
    ads: items.filter(i => kindOf(i) === 'ad' && i.status === 'review').length,
  }), [items]);
  const overlayUp = !!open || suggesting;

  /* One place where every answer the endpoint can give is turned into
   * something a person can act on. 404 here means the link was revoked while
   * they were reading, so the page becomes the dead end. */
  const post = useCallback(async (body) => {
    try {
      const res = await fetch(`/api/planner?token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.status === 404) { setState('dead'); return { status: 404 }; }
      let json = null; try { json = await res.json(); } catch { json = null; }
      return { status: res.status, ok: res.ok, json };
    } catch {
      return { status: 0 };
    }
  }, [token]);

  const act = useCallback(async (item, action, note) => {
    setBusy(true);
    setFormError('');
    const r = await post({ postId: item.id, action, note });
    setBusy(false);
    if (r.ok) return true;
    if (r.status === 404) return false;
    if (r.status === 409) { setToast(C.toast.stale); setOpenId(null); await load(month, { quiet: true }); return false; }
    if (r.status === 429) { setToast(C.toast.tooMany); return false; }
    if (r.status === 400) { setFormError(C.detail.needNote); return false; }
    setToast(C.toast.failed);
    return false;
  }, [post, month, load, C]);

  const approve = useCallback(async (item) => {
    // Optimistic: the tick lands now, and rolls back if the server says no.
    const before = item.status;
    setData(d => ({ ...d, posts: d.posts.map(p => (p.id === item.id ? { ...p, status: 'approved' } : p)) }));
    const ok = await act(item, 'approve');
    if (ok) { setToast(C.toast.approved); setOpenId(null); }
    else setData(d => (d ? { ...d, posts: d.posts.map(p => (p.id === item.id ? { ...p, status: before } : p)) } : d));
    return ok;
  }, [act, C]);

  const requestChange = useCallback(async (item, note) => {
    if (!note) { setFormError(C.detail.needNote); return false; }
    const ok = await act(item, 'request-change', note);
    if (ok) {
      setData(d => ({ ...d, posts: d.posts.map(p => (p.id === item.id ? { ...p, status: 'making', clientNote: note } : p)) }));
      setToast(C.toast.changeSent);
      setOpenId(null);
    }
    return ok;
  }, [act, C]);

  /** Sends one idea. Resolves true, or the status to show. */
  const suggest = useCallback(async (fields) => {
    const r = await post({ action: 'suggest', ...fields });
    if (r.ok) {
      const s = r.json?.suggestion || { id: `tmp${Date.now()}`, kind: fields.kind, subject: fields.subject, goal: fields.goal, status: 'new', note: '', createdAt: new Date().toISOString() };
      setData(d => (d ? { ...d, suggestions: [s, ...(d.suggestions || [])] } : d));
      setToast(C.toast.ideaSent);
      return true;
    }
    return r.status || 500;
  }, [post, C]);

  const openSuggest = useCallback(() => setSuggesting(true), []);
  const closeSuggest = useCallback(() => setSuggesting(false), []);
  const closeOpen = useCallback(() => { setOpenId(null); setFormError(''); }, []);

  if (state === 'dead') {
    return (
      <section className="pl section pl-dead-wrap">
        <div className="wrap pl-narrow">
          <ClientBar label={C.heading} />
          <Reveal as="h1" className="pl-title display">{C.dead.title}</Reveal>
          <Reveal as="p" className="pl-lead" delay={60}>
            {C.dead.body} <a className="pl-mail" href={`mailto:${C.dead.email}`}>{C.dead.email}</a>
          </Reveal>
          <ClientFoot />
        </div>
        <style>{clientChromeStyles + plannerStyles}</style>
      </section>
    );
  }

  return (
    <section className={`pl section${desktop ? '' : ' pl--phone'}`}>
      <div className="wrap pl-wrap">
        <ClientBar label={C.heading} />
        {desktop && state === 'ready' && <Tabs tab={tab} onPick={pickTab} needs={needs} bottom={false} />}

        {state === 'loading' && <Skeleton kind={tab === 'home' ? 'home' : 'list'} />}

        {state === 'error' && (
          <div className="pl-error" role="alert">
            <h1 className="pl-title display">{C.error.title}</h1>
            <p className="pl-lead">{C.error.body}</p>
            <button type="button" className="pl-btn" onClick={() => load(month)}>{C.error.retry}</button>
          </div>
        )}

        {state === 'ready' && data && (
          <div className="pl-screen" key={tab}>
            {tab === 'home' && <HomeView data={data} items={items} month={month} onOpen={setOpenId} onTab={pickTab} onSuggest={openSuggest} />}
            {tab === 'posts' && <PostsView items={items} month={month} onShift={(by) => setMonth(m => shiftMonth(m, by))} onOpen={setOpenId} canGrid={canGrid} view={activeView} onView={pickView} />}
            {tab === 'ads' && <AdsView items={items} month={month} onShift={(by) => setMonth(m => shiftMonth(m, by))} onOpen={setOpenId} />}
            {tab === 'ideas' && <IdeasView suggestions={suggestions} onSuggest={openSuggest} />}
          </div>
        )}
        {state !== 'loading' && <ClientFoot />}
      </div>

      {!desktop && state === 'ready' && !overlayUp && overlay(<Tabs tab={tab} onPick={pickTab} needs={needs} bottom />)}

      {open && (
        <ItemDetail item={open} token={token} busy={busy} formError={formError} toast={setToast}
          onClose={closeOpen} onApprove={approve} onChange={requestChange} />
      )}
      {suggesting && <SuggestSheet onClose={closeSuggest} onSend={suggest} />}

      {toast && overlay(<p className="pl-toast" role="status">{toast}</p>)}
      <style>{clientChromeStyles + plannerStyles}</style>
    </section>
  );
}


const plannerStyles = `
  .pl { background: var(--bg); }
  .pl-wrap { max-width: 1000px; }
  .pl-narrow { max-width: 560px; }
  /* The bottom bar needs the page to end above it. */
  .pl--phone .pl-wrap { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }

  .pl-title { font-size: clamp(2.2rem, 6vw, 3.6rem); color: var(--text); }
  .pl-lead { margin: var(--space-3) 0 0; font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.6; max-width: 60ch; }
  .pl-mail { color: var(--brand-text); font-weight: 600; }
  .pl-h2 { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--text); }
  .pl-quiet { margin: 0; font-size: 0.9375rem; color: var(--text-secondary); }
  .pl-link {
    display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 var(--space-2);
    background: none; border: 0; cursor: pointer;
    font: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--brand-text); text-decoration: underline; text-underline-offset: 3px;
  }
  .pl-link:hover { color: var(--text); }
  .pl-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: var(--radius); }
  .pl-screen { display: flex; flex-direction: column; }

  /* The destinations. On a computer a segmented control under the bar; on a
     phone a fixed bar along the bottom, hidden while a detail is up. */
  .pl-seg { display: inline-flex; gap: 2px; padding: 3px; margin: 0 0 var(--space-8); background: var(--glass-bg); border: 1px solid var(--border); border-radius: var(--radius); align-self: flex-start; }
  .pl-seg .pl-tab { flex-direction: row; gap: 8px; min-height: 44px; padding: 0 var(--space-4); border-radius: 6px; }
  .pl-seg .pl-tab.is-on { background: var(--surface); }
  .pl-tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    display: grid; grid-template-columns: repeat(4, 1fr);
    padding: 4px var(--space-2) calc(4px + env(safe-area-inset-bottom, 0px));
    background: var(--chrome-solid); border-top: 1px solid var(--border);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  }
  .pl-tab {
    display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    min-height: 56px; padding: 6px 4px; background: none; border: 0; border-radius: var(--radius); cursor: pointer;
    font: inherit; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);
    transition: color 0.2s, background 0.2s;
  }
  .pl-tab.is-on { color: var(--text); }
  .pl-tabbar .pl-tab.is-on .pl-tab-icon { color: var(--brand-text); }
  .pl-tab:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
  .pl-tab-icon { position: relative; display: inline-flex; }
  .pl-tab-dot { position: absolute; top: -2px; right: -4px; width: 8px; height: 8px; border-radius: 50%; background: var(--brand-light); border: 2px solid var(--bg); box-sizing: content-box; }
  .pl-tab-label { line-height: 1.2; }

  /* Home. The strip is the one accent: what waits for them. */
  .pl-needs {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap;
    margin: var(--space-6) 0 0; padding: var(--space-4) var(--space-5);
    background: var(--glass-bg); border: 1px solid var(--border); border-radius: var(--radius-lg);
  }
  .pl-needs.is-waiting { background: var(--glass-bg-brand); border-color: var(--glass-border-brand); }
  .pl-needs-text { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--success); }
  .pl-needs.is-waiting .pl-needs-text { color: var(--brand-text); }
  .pl-needs-btn { flex: 0 0 auto; }
  .pl-progress { display: flex; flex-direction: column; gap: var(--space-2); margin: var(--space-6) 0 0; }
  .pl-progress-row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
  .pl-progress-label { font-size: 0.9375rem; font-weight: 700; color: var(--text); }
  .pl-progress-month { font-size: 0.875rem; color: var(--text-secondary); }
  .pl-progress-track { display: block; height: 6px; border-radius: 999px; background: var(--glass-bg-strong); overflow: hidden; }
  .pl-progress-fill { display: block; height: 100%; border-radius: 999px; background: var(--brand); transition: width 0.4s var(--ease); }
  .pl-block { margin-top: var(--space-8); display: flex; flex-direction: column; gap: var(--space-4); }
  .pl-block-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .pl-how { margin-top: var(--space-10); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); align-items: flex-start; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); }
  .pl-how-list { margin: 0; padding-left: 1.25em; display: flex; flex-direction: column; gap: var(--space-2); font-size: 0.9375rem; line-height: 1.55; color: var(--text-secondary); }
  .pl-how-reopen { margin: var(--space-8) 0 0; }
  .pl-actions { margin-top: var(--space-6); display: flex; gap: var(--space-3); flex-wrap: wrap; }

  .pl-monthbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; margin: var(--space-6) 0 var(--space-5); }
  .pl-monthnav { display: flex; align-items: center; gap: var(--space-2); }
  .pl-month { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--text); min-width: 9ch; text-align: center; }
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

  /* The calendar: a real table, day-of-week headers, 44px cells. */
  .pl-cal-wrap { overflow-x: auto; }
  .pl-cal { width: 100%; border-collapse: separate; border-spacing: 4px; table-layout: fixed; }
  @media (min-width: 768px) { .pl-cal { border-spacing: var(--space-2); } }
  .pl-cal th { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: var(--space-1); }
  .pl-cell { vertical-align: top; height: 84px; padding: 0; border-radius: var(--radius); background: var(--bg-card); border: 1px solid var(--border); position: relative; }
  .pl-cell.is-blank { background: none; border-color: transparent; }
  .pl-cell-day {
    position: absolute; top: 4px; left: 4px; z-index: 1;
    padding: 1px 5px; border-radius: 999px;
    background: var(--chrome-solid); color: var(--text-secondary);
    font-size: 0.6875rem; font-weight: 600;
  }
  .pl-cell-post {
    display: block; position: relative; width: 100%; height: 100%; padding: 0;
    background: none; border: 0; border-radius: var(--radius); overflow: hidden; cursor: pointer;
  }
  .pl-cell-post:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-cell-meta { position: absolute; right: 4px; bottom: 4px; display: flex; align-items: center; gap: 4px; }
  @media (min-width: 768px) { .pl-cell { height: 116px; } }

  /* The picture slot, in three sizes. */
  .pl-img { position: relative; }
  .pl-img--cell { width: 100%; height: 100%; border-radius: var(--radius); }
  .pl-img--row { width: 72px; flex: 0 0 72px; border-radius: var(--radius); }
  .pl-img--panel { width: 100%; border-radius: var(--radius); flex: 0 0 auto; }
  .pl-img--whole > img { object-fit: contain; }
  .pl-img--whole { background: var(--surface); padding: 0; border: 0; width: 100%; cursor: zoom-in; }
  button.pl-img--whole:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
  .pl-img-zoom {
    position: absolute; right: var(--space-2); bottom: var(--space-2);
    padding: 4px 9px; border-radius: 999px;
    background: var(--chrome-solid); color: var(--text-secondary);
    font-size: 0.75rem; font-weight: 600;
  }
  .pl-img-play {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%;
    background: var(--chrome-solid); color: var(--text);
  }
  .pl-img.is-placeholder { border: 1px dashed var(--border-light); }
  .pl-img--idle.is-placeholder, .pl-img--ok.is-placeholder { background: var(--glass-bg-strong); }
  .pl-img--wait.is-placeholder { background: var(--glass-bg-brand); border-color: var(--glass-border-brand); }
  .pl-img--live.is-placeholder { background: color-mix(in srgb, var(--success) 14%, transparent); }
  .pl-img--done.is-placeholder { background: var(--glass-bg); }
  .pl-img-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2);
    width: 100%; height: 100%; padding: var(--space-2); text-align: center;
  }
  .pl-img-initial { display: inline-flex; font-size: 1rem; font-weight: 700; color: var(--text-secondary); }
  .pl-img--panel .pl-img-initial { font-size: 2rem; }
  .pl-img-label { font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); }

  .pl-zoom {
    position: fixed; inset: 0; z-index: 80;
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-4);
    background: rgba(0, 0, 0, 0.92);
  }
  .pl-zoom-img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .pl-zoom-close {
    position: absolute; top: var(--space-4); right: var(--space-4);
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; padding: 0;
    background: var(--glass-bg-strong); color: var(--text);
    border: 1px solid var(--border-light); border-radius: var(--radius); cursor: pointer;
  }
  .pl-zoom-close:hover { background: var(--hover-strong); }
  .pl-zoom-close:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-hold { flex-direction: column; gap: var(--space-4); padding-top: 72px; }
  .pl-hold .pl-zoom-img { max-height: calc(100% - 120px); }
  .pl-hold-foot { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); text-align: center; }
  .pl-hold-text { margin: 0; font-size: 1.0625rem; font-weight: 700; color: var(--text); }

  .pl-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: 0 0 10px; }
  .pl-dot--idle, .pl-dot--ok { background: var(--text-muted); }
  .pl-dot--wait { background: var(--brand-light); }
  .pl-dot--live { background: var(--success); }
  .pl-dot--done { background: var(--text-faint); }

  /* Rows. Not a card inside a card: one bordered row, one button. */
  .pl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
  .pl-row, .pl-idea {
    display: flex; align-items: center; gap: var(--space-4); width: 100%;
    padding: var(--space-3) var(--space-4); text-align: left;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  }
  .pl-row { cursor: pointer; transition: border-color 0.2s, transform 0.2s; }
  .pl-row:hover { border-color: var(--border-light); transform: translateY(-1px); }
  .pl-row:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-row-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
  .pl-row-when { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); }
  .pl-row-title { font-size: 0.9375rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-row-sub { font-size: 0.9375rem; color: var(--text-secondary); }
  .pl-row-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .pl-row-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .pl-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); border: 1px solid var(--border); }
  .pl-idea { flex-direction: column; align-items: flex-start; gap: 6px; }
  .pl-idea .pl-row-title { white-space: normal; }
  .pl-idea-note { display: flex; flex-direction: column; gap: 4px; margin-top: var(--space-1); padding: var(--space-3); width: 100%; background: var(--glass-bg-brand); border-radius: var(--radius); font-size: 0.9375rem; line-height: 1.55; color: var(--text-secondary); }

  .pl-pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 999px;
    background: var(--glass-bg); color: var(--text-secondary);
    font-size: 0.75rem; font-weight: 600; white-space: nowrap;
  }
  .pl-pill--kind { background: none; border: 1px solid var(--border-light); color: var(--text); }
  .pl-pill--wait { background: var(--glass-bg-brand); color: var(--brand-text); }
  .pl-pill--live { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); }
  .pl-pill--done { color: var(--text-muted); }
  .pl-pill-help { font-size: 0.8125rem; color: var(--text-muted); align-self: center; }

  .pl-empty { margin-top: var(--space-4); padding: var(--space-10) var(--space-6); display: flex; flex-direction: column; align-items: center; gap: var(--space-2); text-align: center; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); }
  .pl-empty-title { margin: 0; font-size: 1.0625rem; font-weight: 700; color: var(--text); }
  .pl-empty-sub { margin: 0; font-size: 0.9375rem; color: var(--text-secondary); max-width: 40ch; }
  .pl-empty .pl-btn { margin-top: var(--space-3); }

  /* The detail and the Suggest sheet: a bottom sheet on a phone, a side
     panel from 768 up. */
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
  .pl-panel-title { font-size: 1rem; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-panel-body { display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-5); overflow-y: auto; }
  .pl-pills { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
  .pl-label { display: inline-block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .pl-opt { font-weight: 500; text-transform: none; letter-spacing: 0; }
  .pl-fact { display: flex; flex-direction: column; gap: var(--space-2); }
  .pl-fact-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 24px; }
  .pl-fact-body { font-size: 1rem; line-height: 1.6; color: var(--text); overflow-wrap: anywhere; }
  .pl-fact-line { margin: 0; }
  .pl-results { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .pl-video { width: 100%; max-height: 70vh; border-radius: var(--radius); background: var(--surface); }
  .pl-soon { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-5); text-align: center; background: var(--glass-bg-strong); border: 1px dashed var(--border-light); border-radius: var(--radius); color: var(--text-secondary); }
  .pl-soon-title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text); }
  .pl-soon-body { margin: 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.9375rem; line-height: 1.55; }
  .pl-save { align-self: flex-start; }
  .pl-copy {
    display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 var(--space-3);
    background: var(--glass-bg); border: 1px solid var(--border-light); border-radius: var(--radius); cursor: pointer;
    font: inherit; font-size: 0.8125rem; font-weight: 600; color: var(--text);
  }
  .pl-copy:hover { background: var(--hover-soft); }
  .pl-copy:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-tags { margin: 0; font-size: 0.9375rem; line-height: 1.6; color: var(--text-muted); overflow-wrap: anywhere; }
  .pl-caption-body { margin: 0; font-size: 1rem; line-height: 1.65; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; }
  .pl-note { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); background: var(--glass-bg); border-radius: var(--radius); }
  .pl-note--rob { background: var(--glass-bg-brand); }
  .pl-note-body { margin: 0; font-size: 0.9375rem; line-height: 1.6; color: var(--text-secondary); overflow-wrap: anywhere; }
  .pl-ask, .pl-field { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; border: 0; min-width: 0; }
  .pl-textarea, .pl-input {
    width: 100%; padding: var(--space-3) var(--space-4);
    background: var(--bg-card); color: var(--text);
    border: 1px solid var(--border); border-radius: var(--radius);
    font: inherit; font-size: 1rem; line-height: 1.6;
  }
  .pl-textarea { min-height: 110px; resize: vertical; }
  .pl-textarea--short { min-height: 84px; }
  .pl-input { min-height: 48px; }
  .pl-textarea:focus-visible, .pl-input:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-hint { margin: 0; display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; font-size: 0.8125rem; color: var(--text-muted); }
  .pl-hint .pl-link { font-size: 0.8125rem; }
  .pl-formerr { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--brand-light); }
  .pl-panel-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--border); flex-wrap: wrap; }
  .pl-foot-note { margin: 0; font-size: 0.9375rem; color: var(--text-secondary); flex: 1; min-width: 0; }

  /* The Suggest sheet: three big kinds, then one field per question. */
  .pl-kinds { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
  .pl-kind {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    min-height: 72px; padding: var(--space-3);
    background: var(--bg-card); color: var(--text-secondary);
    border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;
    font: inherit; font-size: 0.9375rem; font-weight: 600;
    transition: border-color 0.2s, background 0.2s, color 0.2s;
  }
  .pl-kind.is-on { background: var(--glass-bg-brand); border-color: var(--glass-border-brand); color: var(--text); }
  .pl-kind:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-chips { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .pl-chipbtn {
    min-height: 44px; padding: 0 var(--space-4);
    background: var(--bg-card); color: var(--text-secondary);
    border: 1px solid var(--border); border-radius: 999px; cursor: pointer;
    font: inherit; font-size: 0.875rem; font-weight: 600;
  }
  .pl-chipbtn.is-on { background: var(--glass-bg-brand); border-color: var(--glass-border-brand); color: var(--text); }
  .pl-chipbtn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-photos { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .pl-photo { position: relative; width: 72px; height: 72px; border-radius: var(--radius); overflow: hidden; background: var(--glass-bg); }
  .pl-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pl-photo-x { position: absolute; top: 2px; right: 2px; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: var(--chrome-solid); color: var(--text); cursor: pointer; }
  .pl-photo--add { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: auto; min-width: 72px; height: 72px; padding: 0 var(--space-3); border: 1px dashed var(--border-light); color: var(--text-secondary); cursor: pointer; font: inherit; font-size: 0.75rem; font-weight: 600; }
  .pl-photo--add:focus-visible, .pl-photo-x:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pl-sent { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-8) var(--space-4); text-align: center; color: var(--success); }
  .pl-sent-text { margin: 0; font-size: 1.0625rem; font-weight: 600; color: var(--text); line-height: 1.55; }

  .pl-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 44px; padding: 0 var(--space-5);
    background: linear-gradient(135deg, rgba(212, 76, 67, 0.85) 0%, rgba(168, 58, 50, 0.85) 100%);
    color: var(--text); border: 1px solid var(--glass-border-brand); border-radius: var(--radius);
    font: inherit; font-size: 0.9375rem; font-weight: 700; cursor: pointer; text-decoration: none;
    transition: background 0.2s, transform 0.2s, opacity 0.2s;
  }
  .pl-btn:hover { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%); }
  .pl-btn:focus-visible { outline: 2px solid var(--brand-light); outline-offset: 3px; }
  .pl-btn[disabled] { opacity: 0.7; cursor: default; }
  .pl-btn--ghost { background: var(--glass-bg); border-color: var(--border-light); color: var(--text); }
  .pl-btn--ghost:hover { background: var(--hover-soft); }

  .pl-toast {
    position: fixed; left: 50%; bottom: calc(var(--space-6) + 64px); transform: translateX(-50%);
    z-index: 70; margin: 0; max-width: min(92vw, 460px);
    padding: var(--space-3) var(--space-5);
    background: var(--chrome-solid); color: var(--text);
    border: 1px solid var(--border-light); border-radius: var(--radius);
    font-size: 0.9375rem; box-shadow: var(--shadow-chrome-strong);
  }
  @media (min-width: 768px) { .pl-toast { bottom: var(--space-6); } }

  .pl-error { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); }

  .pl-skel { display: flex; flex-direction: column; gap: var(--space-4); }
  .pl-skel-line { display: block; height: 20px; border-radius: var(--radius); background: var(--glass-bg-strong); }
  .pl-skel-line--title { width: min(60%, 340px); height: 44px; }
  .pl-skel-line--lead { width: min(80%, 480px); }
  .pl-skel-line--strip { height: 76px; border-radius: var(--radius-lg); background: var(--glass-bg); margin-top: var(--space-2); }
  .pl-skel-rows { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-6); }
  .pl-skel-row { display: block; height: 98px; border-radius: var(--radius-lg); background: var(--glass-bg); }
  @media (prefers-reduced-motion: no-preference) {
    .pl-skel-line, .pl-skel-row { animation: plPulse 1.6s ease-in-out infinite; }
    @keyframes plPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  }
`;
