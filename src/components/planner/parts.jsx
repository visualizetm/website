import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Home02 from '@untitled-ui/icons-react/build/esm/Home02';
import CalendarDate from '@untitled-ui/icons-react/build/esm/CalendarDate';
import Announcement01 from '@untitled-ui/icons-react/build/esm/Announcement01';
import Lightbulb02 from '@untitled-ui/icons-react/build/esm/Lightbulb02';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Play from '@untitled-ui/icons-react/build/esm/Play';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import LayersThree01 from '@untitled-ui/icons-react/build/esm/LayersThree01';
import { slidesOf, carouselAllowed, isCarousel } from '../../shared/slides';
import { viewing } from '../../lib/carousel';
import { motionReduced } from '../../ui/motion';
import { COPY } from '../../shared/copy';
import { statusKey, STATUS_TONE, kindOf, shortDate } from '../../lib/plannerView';
import { formatOf } from '../../lib/posts';

/* The client planner's own small kit (Planner v2, part 1). The planner is a
 * public page, so it does not load the admin shell or the admin kit; these
 * are copies of the CRM's look built on the same --v-* tokens (Card, Pill,
 * Button, SegmentedControl, Sheet, the glass TabBar), scoped under the
 * planner's .lay-root. Every value in plannerStyles reads var(--v-...). */

const C = () => COPY.planner;

/* Every layer that means "the screen" (the tab bar, a sheet, the toast) is portaled to the body, inside its own .lay-root so it keeps the
 * tokens: main.page-fade animates a transform for half a second, and a fixed layer inside a transformed ancestor is fixed to that
 * ancestor, not the screen. */
export function Layer({ children }) {
  if (typeof document === 'undefined') return children;
  return createPortal(<div className="lay-root pl-layer">{children}</div>, document.body);
}

/** The status pill in the client's words, coloured from the --v-status-* set. */
export function StatusPill({ item }) {
  const key = statusKey(item);
  const s = C().status;
  const label = key === 'done' ? s.done[kindOf(item)] : key === 'making' ? s.making[kindOf(item)] : s[key];
  return <span className={`pl-pill pl-pill--${STATUS_TONE[key]}`}><span className="pl-pill-dot" aria-hidden="true" />{label}</span>;
}

/** Post, Reel, Story or Ad: what kind of thing it is. */
export function KindPill({ item }) {
  const k = C().kinds;
  const f = formatOf(item);
  const label = kindOf(item) === 'ad' ? k.ad : f === 'video' ? k.reel : f === 'story' ? k.story : k.post;
  return <span className="pl-pill pl-pill--outline">{label}</span>;
}

const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', other: 'Other' };
/** Where it goes, in words. */
export const platformNames = (item) => (Array.isArray(item?.platforms) && item.platforms.length ? item.platforms : ['instagram']).map(id => PLATFORM_LABEL[id] || 'Other');
/** What to call an item: an ad's name, a post's first line, else the post's day. */
export function titleOf(item) {
  if (kindOf(item) === 'ad') return item?.ad?.name || C().kinds.ad;
  const first = String(item?.caption || '').trim().split('\n')[0].trim();
  if (first) return first;
  const d = shortDate(item?.date);
  return d ? `${C().kinds.post}, ${d}` : C().kinds.post;
}

/* The cover (carousel job): a carousel's first slide, a single picture, else a video's poster. */
export const pictureOf = (item) => slidesOf(item)[0]?.url || item?.video?.poster || '';
const isVideo = (item) => formatOf(item) === 'video';

/** The creative at its own format (4:5 for a feed post, 9:16 for a story or a video). A video with a file plays inline; a missing or
 *  broken picture is a labelled tile, never an empty box. `crop` draws a square glance instead (thumbnails, the feed). */
export function Media({ item, crop = '', src: srcOverride }) {
  const [broken, setBroken] = useState(false);
  const src = srcOverride !== undefined ? srcOverride : pictureOf(item);
  useEffect(() => { setBroken(false); }, [src]);
  const P = C().post;
  const ratio = crop || (formatOf(item) === 'portrait' ? '4x5' : '9x16');
  if (!crop && srcOverride === undefined && isVideo(item) && item?.video?.url) {
    return <span className="pl-media pl-media--9x16 img-fit"><video className="pl-media-el" src={item.video.url} poster={item.video.poster || undefined} controls playsInline preload="metadata" /></span>;
  }
  if (src && !broken) {
    return (
      <span className={`pl-media pl-media--${ratio} img-fit`}>
        <img className="pl-media-el" src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
        {crop && isVideo(item) && <span className="pl-media-play" aria-hidden="true"><Play width={12} height={12} /></span>}
        {crop && srcOverride === undefined && isCarousel(item) && <span className="pl-media-stack" role="img" aria-label={COPY.carousel.stack(slidesOf(item).length)}><LayersThree01 width={12} height={12} aria-hidden="true" /><span aria-hidden="true">{slidesOf(item).length}</span></span>}
      </span>
    );
  }
  const text = broken ? P.imageBroken : isVideo(item) ? P.videoSoon : P.imageSoon;
  return (
    <span className={`pl-media pl-media--${ratio} pl-media--empty`}>
      <span className="pl-media-empty">
        {isVideo(item) ? <Play width={18} height={18} aria-hidden="true" /> : null}
        {crop ? <span className="v-sr-only">{text}</span> : <span className="pl-media-text">{text}</span>}
      </span>
    </span>
  );
}

/** The client's mark: their logo, else a red circle with the business's first character. */
export function Avatar({ client, size = 36 }) {
  const [broken, setBroken] = useState(false);
  const name = client?.displayName || '';
  const style = { width: size, height: size };
  if (client?.logoUrl && !broken) return <span className="pl-avatar pl-avatar--logo img-fit img-fit--contain" style={style}><img src={client.logoUrl} alt="" onError={() => setBroken(true)} /></span>;
  return <span className="pl-avatar" style={style} aria-hidden="true">{(name.trim()[0] || 'V').toUpperCase()}</span>;
}

/** A handle for the preview: the business name, lowercase, letters and digits only. A picture of their profile, not their real handle. */
export const handleOf = (client) => (String(client?.displayName || 'yourbusiness').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'yourbusiness');

/** A carousel (carousel job): the pictures side by side on native scroll snap, no library and no autoplay. A finger swipes; the 44px
 *  Previous and Next show on wider screens; the arrow keys move it once it has focus. "3 / 7" sits in a live region beside the
 *  dots. Every slide's box is reserved at 4:5 and the ones after the first load lazily, so nothing shifts. The track keeps its
 *  sideways drag to itself (overscroll contained), so a swipe at its edge is never taken for Back. onIndex hears the slide on
 *  view (a change note names it). */
export function Carousel({ slides, onIndex }) {
  const K = COPY.carousel;
  const ref = useRef(null);
  const raf = useRef(0);
  const [at, setAt] = useState(0);
  const n = slides.length;
  useEffect(() => { onIndex?.(at); }, [at, onIndex]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const onScroll = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => { const el = ref.current; if (el) setAt(viewing(el.scrollLeft, el.clientWidth, n)); }); };
  const go = (k) => {
    const el = ref.current; if (!el) return;
    const t = Math.max(0, Math.min(n - 1, k));
    el.scrollTo({ left: t * el.clientWidth, behavior: motionReduced() ? 'auto' : 'smooth' });
    setAt(t);
  };
  const onKey = (e) => {
    const k = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: n - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    go(k);
  };
  return (
    <div className="pl-car" role="group" aria-roledescription="carousel" aria-label={K.label(n)}>
      <div className="pl-car-track" ref={ref} onScroll={onScroll} onKeyDown={onKey} tabIndex={0} aria-label={K.label(n)}>
        {slides.map((s, k) => (
          <div key={`${s.url}#${k}`} className="pl-car-slide pl-media pl-media--4x5 img-fit" role="group" aria-roledescription="slide" aria-label={K.slideAlt(k + 1, n)}>
            <img className="pl-media-el" src={s.url} alt={s.alt || K.slideAlt(k + 1, n)} width={1080} height={1350} loading={k === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
          </div>
        ))}
      </div>
      <button type="button" className="pl-car-btn pl-car-prev" onClick={() => go(at - 1)} disabled={at === 0} aria-label={K.prev}><ChevronLeft width={20} height={20} aria-hidden="true" /></button>
      <button type="button" className="pl-car-btn pl-car-next" onClick={() => go(at + 1)} disabled={at === n - 1} aria-label={K.next}><ChevronRight width={20} height={20} aria-hidden="true" /></button>
      <div className="pl-car-foot">
        <span className="pl-car-count" aria-live="polite">{K.counter(at + 1, n)}</span>
        <span className="pl-car-dots" aria-hidden="true">{slides.map((s, k) => <span key={k} className={`pl-car-dot${k === at ? ' is-on' : ''}`} />)}</span>
      </div>
    </div>
  );
}

/** The post drawn as it will look on Instagram: the avatar and handle, the date and kind, the creative at its format, the caption and
 *  the hashtags. `draft` swaps in an earlier version's picture and words. A carousel draws as one (carousel job). */
export function IgPost({ item, client, draft = null, onSlide }) {
  const caption = draft ? draft.caption : item.caption;
  const tags = draft ? '' : item.hashtags;
  const pics = draft ? slidesOf(draft) : slidesOf(item);
  const carousel = carouselAllowed(item) && pics.length > 1;
  return (
    <article className="pl-ig" aria-label="How the post will look">
      <header className="pl-ig-head">
        <Avatar client={client} size={32} />
        <span className="pl-ig-who">
          <span className="pl-ig-handle">{handleOf(client)}</span>
          <span className="pl-ig-date">{shortDate(item.date) || C().post.noDate}{item.time ? `, ${item.time}` : ''}</span>
        </span>
        <KindPill item={item} />
      </header>
      {carousel ? <Carousel key={draft ? 'first' : 'new'} slides={pics} onIndex={onSlide} /> : draft ? <Media item={item} src={draft.imageUrl || ''} /> : <Media item={item} />}
      {isVideo(item) && !item.video?.url && item.video?.concept && !draft && (
        <p className="pl-ig-concept"><span className="pl-label">{C().post.concept}</span>{item.video.concept}</p>
      )}
      {(caption || tags) && (
        <div className="pl-ig-body">
          {caption && <p className="pl-ig-caption"><strong>{handleOf(client)}</strong> {caption}</p>}
          {tags && <p className="pl-ig-tags">{tags}</p>}
        </div>
      )}
    </article>
  );
}

/** The segmented control (the kit's SegmentedControl look): a radio group of 44px options. */
export function Segmented({ label, options, value, onChange, full = false }) {
  const refs = useRef([]);
  const onKey = (e, i) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div className={`pl-seg${full ? ' pl-seg--full' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button key={o.id} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={value === o.id} tabIndex={value === o.id ? 0 : -1}
          className={`pl-seg-opt${value === o.id ? ' is-on' : ''}`} onClick={() => onChange(o.id)} onKeyDown={(e) => onKey(e, i)}>{o.label}</button>
      ))}
    </div>
  );
}

/** A sheet: a dialog from the bottom on a phone, centred on a computer. Labelled, focus held inside, Escape closes, focus goes back. */
export function Sheet({ title, onClose, children, foot, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const back = document.activeElement;
    const first = ref.current?.querySelector('button, input, textarea, a[href]');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = ref.current?.querySelectorAll('button:not(:disabled), input, textarea, a[href]');
      if (!f?.length) return;
      const a = f[0]; const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); try { back?.focus?.(); } catch { /* gone */ } };
  }, [onClose, busy]);
  return (
    <Layer>
      <div className="pl-sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="pl-scrim" aria-label={C().post.close} onClick={() => { if (!busy) onClose(); }} tabIndex={-1} />
        <div className="pl-sheet" ref={ref}>
          <div className="pl-sheet-head">
            <h2 className="pl-sheet-title">{title}</h2>
            <button type="button" className="pl-iconbtn" onClick={onClose} disabled={busy} aria-label={C().post.close}><XClose width={18} height={18} aria-hidden="true" /></button>
          </div>
          <div className="pl-sheet-body">{children}</div>
          {foot && <div className="pl-sheet-foot">{foot}</div>}
        </div>
      </div>
    </Layer>
  );
}

/** The top bar. On a tab root: the client's mark, the business and a quiet line. On a focused screen: Back, the title, nothing else. */
export function TopBar({ client, month, focused, title, onBack, portal = '', right = null }) {
  const P = C();
  if (focused) {
    return (
      <header className="pl-top pl-top--focused">
        <button type="button" className="pl-iconbtn pl-top-back" onClick={onBack} aria-label={P.back}><ChevronLeft width={20} height={20} aria-hidden="true" /></button>
        <h1 className="pl-top-title">{title}</h1>
        {right}
      </header>
    );
  }
  return (
    <header className="pl-top">
      {portal && <a className="pl-iconbtn pl-top-back" href={portal} aria-label={P.backToPortal}><ChevronLeft width={20} height={20} aria-hidden="true" /></a>}
      <Avatar client={client} size={36} />
      <span className="pl-top-who">
        <span className="pl-top-name">{client?.displayName || P.heading}</span>
        <span className="pl-top-line">{P.from(month)}</span>
      </span>
      {right}
    </header>
  );
}

const TAB_ICON = { home: Home02, plan: CalendarDate, ads: Announcement01, ideas: Lightbulb02 };
export const TABS = ['home', 'plan', 'ads', 'ideas'];
/** The glass tab bar (a copy of the CRM's src/shell/TabBar.jsx look): a floating pill, four icon-only tabs, a red dot on Home while
 *  anything needs them. Hidden on a focused screen. */
export function TabBar({ tab, onPick, needs, hidden }) {
  const P = C();
  return (
    <Layer>
      <nav className={`pl-tabs${hidden ? ' is-hidden' : ''}`} aria-label={P.tabsNav} inert={hidden ? '' : undefined} aria-hidden={hidden || undefined}>
        <div className="pl-tabs-glass">
          {TABS.map(id => {
            const Icon = TAB_ICON[id];
            const active = tab === id;
            const dot = id === 'home' && needs > 0;
            return (
              <button key={id} type="button" className={`pl-tab${active ? ' is-active' : ''}`} data-tab={id} onClick={() => onPick(id)} aria-current={active ? 'page' : undefined}
                aria-label={dot ? `${P.tabs[id]}, ${P.needsDot}` : P.tabs[id]}>
                <span className="pl-tab-icon"><Icon width={20} height={20} aria-hidden="true" />{dot && <span className="pl-tab-dot" aria-hidden="true" />}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </Layer>
  );
}

/** The toast: one polite live region, always mounted so a screen reader hears each message. */
export function Toast({ text }) {
  return <Layer><p className={`pl-toast${text ? ' is-on' : ''}`} role="status" aria-live="polite">{text}</p></Layer>;
}

/** A screen's skeleton: the shape it is about to draw. */
export function Skeleton({ kind = 'list' }) {
  const rows = kind === 'home' ? ['title', 'line', 'card', 'card', 'strip'] : kind === 'review' ? ['line', 'media', 'line'] : kind === 'grid' ? ['seg', 'grid'] : ['seg', 'row', 'row', 'row', 'row'];
  return (
    <div className="pl-skel" aria-busy="true" aria-label="Loading your planner">
      {rows.map((r, i) => <span key={i} className={`pl-skel-b pl-skel-b--${r}`} />)}
    </div>
  );
}

/** One empty state: a title, one line, at most one action. */
export function Empty({ title, body, action = null, kind = '' }) {
  return (
    <div className="pl-empty" data-state="empty" data-kind={kind}>
      <p className="pl-empty-title">{title}</p>
      <p className="pl-empty-body">{body}</p>
      {action}
    </div>
  );
}

/** The error with Retry. */
export function ErrorBox({ onRetry, title, body }) {
  const P = C().error;
  return (
    <div className="pl-error" role="alert">
      <AlertCircle width={24} height={24} aria-hidden="true" />
      <p className="pl-empty-title">{title || P.title}</p>
      <p className="pl-empty-body">{body || P.body}</p>
      <button type="button" className="pl-btn pl-btn--secondary" onClick={onRetry}>{P.retry}</button>
    </div>
  );
}

/** A row: one real control (the stretched button) over a thumbnail, a title, a line and the status. `sub` is a line under the title
 *  (the List's "Carousel, 7 slides"). */
export function ItemRow({ item, title, line, sub = '', onOpen }) {
  const label = [title, sub, line].filter(Boolean).join(', ');
  return (
    <div className="pl-row">
      <span className="pl-row-thumb"><Media item={item} crop="1x1" /></span>
      <span className="pl-row-main">
        <span className="pl-row-title">{title}</span>
        {sub && <span className="pl-row-line pl-row-sub">{sub}</span>}
        {line && <span className="pl-row-line">{line}</span>}
      </span>
      <StatusPill item={item} />
      <button type="button" className="pl-cover v-stretch" onClick={() => onOpen(item)} aria-label={label}>{title}</button>
    </div>
  );
}
