import { useRef, useState } from 'react';
import { Row, Button, IconButton, Input, Pill, useToast, useMediaQuery } from '../ui';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../lib/cloudinary';
import { safeHref } from '../lib/safeUrl';
import { COPY } from '../shared/copy';
import { SLIDES_MAX } from '../shared/slides';
import { moveSlide, removeSlide, addSlides, counterLine, ratioWarning } from '../lib/carousel';

/* The editor's slide strip (carousel job): a carousel's pictures as 4:5 thumbnails in order, each numbered, slide 1 carrying
 * Cover. Move left and Move right on each thumbnail are the primary reorder (44px); a mouse (pointer: fine) can also drag a
 * thumbnail, a finger never can, since the strip is a sideways scroller. The X removes a slide with Undo on the toast. Upload
 * takes several files, uploaded in the order picked and added to the end; a link adds one slide. The counter says how many
 * and which is the cover; at 20 the adds are off. A slide whose shape differs from slide 1 gets one soft line, never a block.
 * Every change is one onChange(slides); the sheet writes { slides, imageUrl: slides[0].url } through its draft. */
const C = COPY.carousel;
/* A key that stays with the picture when it moves (the url, and which copy of it this is), so a moved slide keeps its node. */
const keyOf = (slides, i) => `${slides[i].url}#${slides.slice(0, i).filter(x => x.url === slides[i].url).length}`;

export function useSlideUploads({ slides, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null); // { done, of } while uploading
  const upload = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    const room = Math.max(0, SLIDES_MAX - slides.length);
    if (files.length > room) toast.info(C.tooMany(room));
    const take = files.slice(0, room);
    let list = slides;
    let added = 0;
    setBusy({ done: 0, of: take.length });
    for (let k = 0; k < take.length; k++) {
      const r = await uploadToCloudinary(take[k]);
      if (r.url) { list = addSlides(list, [r.url]).slides; added++; onChange(list); } else toast.error(C.uploadFailed(k + 1, r.error));
      setBusy({ done: k + 1, of: take.length });
    }
    setBusy(null);
    if (added) toast.success(C.uploaded(added));
  };
  return { busy, upload };
}

export default function SlideStrip({ slides, onChange, readOnly = false }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const fine = useMediaQuery('(pointer: fine)');
  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [sizes, setSizes] = useState({}); // url -> { w, h }
  const [dragFrom, setDragFrom] = useState(-1);
  const { busy, upload } = useSlideUploads({ slides, onChange });
  const n = slides.length;
  const full = n >= SLIDES_MAX;
  const warn = ratioWarning(slides.map(s => sizes[s.url]));

  /* Focus follows the slide that moved: the same direction's button when it can still go that way, else its first live control. */
  const focusSlide = (j, dir) => requestAnimationFrame(() => {
    const item = listRef.current?.querySelector(`[data-slide="${j}"]`);
    const same = item?.querySelector(`[data-move="${dir}"]`);
    (same && !same.disabled ? same : item?.querySelector('button:not(:disabled)'))?.focus();
  });
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= n) return;
    onChange(moveSlide(slides, i, j));
    focusSlide(j, d < 0 ? 'left' : 'right');
  };
  const remove = (i) => {
    const before = slides;
    onChange(removeSlide(slides, i));
    toast.undo(C.removed(i + 1), () => onChange(before));
  };
  const addLink = () => {
    const url = safeHref(link.trim());
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) { setLinkErr(C.badLink); return; }
    onChange(addSlides(slides, [url]).slides);
    setLink(''); setLinkErr('');
  };
  const drop = (to) => { if (dragFrom >= 0 && dragFrom !== to) onChange(moveSlide(slides, dragFrom, to)); setDragFrom(-1); };

  return (
    <div className="ss">
      <p className="ss-count" role="status" aria-live="polite">{counterLine(n)}</p>
      <ol className="ss-strip" ref={listRef} aria-label={C.strip}>
        {slides.map((s, i) => (
          <li key={keyOf(slides, i)} className={`ss-item${dragFrom === i ? ' is-dragging' : ''}`} data-slide={i}
            draggable={!readOnly && fine ? true : undefined}
            onDragStart={!readOnly && fine ? (e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; } : undefined}
            onDragOver={!readOnly && fine ? (e) => e.preventDefault() : undefined}
            onDrop={!readOnly && fine ? (e) => { e.preventDefault(); drop(i); } : undefined}
            onDragEnd={() => setDragFrom(-1)}>
            <span className="img-fit img-fit--4x5 ss-thumb">
              <img src={s.url} alt={s.alt || C.number(i + 1)} width={120} height={150} loading="lazy" decoding="async" draggable={false}
                onLoad={(e) => { const w = e.currentTarget.naturalWidth; const h = e.currentTarget.naturalHeight; setSizes(m => (m[s.url]?.w === w ? m : { ...m, [s.url]: { w, h } })); }} />
            </span>
            <span className="ss-num" aria-hidden="true">{i + 1}</span>
            {i === 0 && <Pill tone="neutral" label={C.cover} size="sm" icon={false} className="ss-cover" />}
            {!readOnly && (
              <Row gap={1} className="ss-ctl" wrap={false}>
                <IconButton icon="ChevronLeft" label={C.moveLeft(i + 1)} tooltip={false} data-move="left" disabled={i === 0} onClick={() => move(i, -1)} />
                <IconButton icon="ChevronRight" label={C.moveRight(i + 1)} tooltip={false} data-move="right" disabled={i === n - 1} onClick={() => move(i, 1)} />
                <IconButton icon="XClose" label={C.remove(i + 1)} tooltip={false} variant="danger" onClick={() => remove(i)} />
              </Row>
            )}
          </li>
        ))}
      </ol>
      {warn && <p className="ss-warn">{C.ratio(warn.n, warn.label)}</p>}
      {!readOnly && (
        <Row gap={2} align="end" wrap className="ss-add">
          {cloudinaryEnabled && (
            <>
              <Button variant="secondary" size="md" icon="Upload01" loading={!!busy} disabled={!!busy || full} onClick={() => fileRef.current?.click()} className="ss-upload">{C.uploadMore}</Button>
              <input ref={fileRef} type="file" multiple accept={ACCEPT_ATTR} style={{ display: 'none' }} aria-hidden="true" tabIndex={-1}
                onChange={(e) => { const f = e.target.files; upload(f).finally(() => { e.target.value = ''; }); }} />
            </>
          )}
          {busy && <span className="ss-busy" role="status" aria-live="polite">{C.uploading(busy.done, busy.of)}</span>}
          <Input label={C.linkLabel} placeholder={C.linkPlaceholder} value={link} disabled={full} className="ss-link"
            onChange={(e) => { setLink(e.target.value.slice(0, 600)); setLinkErr(''); }} error={linkErr || undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
          <Button variant="secondary" size="md" icon="Plus" disabled={full || !link.trim()} onClick={addLink} className="ss-add-link">{C.add}</Button>
        </Row>
      )}
    </div>
  );
}

export const slideStripStyles = `
  .ss { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .ss-count { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .ss-strip { display: flex; gap: var(--v-space-3); margin: 0; padding: 0 0 var(--v-space-2); list-style: none; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; min-width: 0; }
  .ss-item { position: relative; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: var(--v-space-1); width: 140px; scroll-snap-align: start; }
  .ss-item.is-dragging { opacity: 0.5; }
  .ss-item[draggable="true"] { cursor: grab; }
  .ss-thumb { width: 120px; border: 1px solid var(--v-border); }
  .ss-thumb > img { object-fit: cover; }
  .ss-num { position: absolute; top: var(--v-space-1); left: calc(50% - 60px + var(--v-space-1)); min-width: 22px; height: 22px; padding: 0 var(--v-space-1); border-radius: var(--v-radius-pill); background: var(--v-surface-1); color: var(--v-text); font-size: var(--v-text-xs); font-weight: var(--v-weight-semibold); display: inline-flex; align-items: center; justify-content: center; }
  .ss-cover { position: absolute; top: var(--v-space-1); right: calc(50% - 60px + var(--v-space-1)); }
  .ss-ctl { justify-content: center; }
  .ss-warn { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-status-new-text); }
  .ss-add .ss-link { flex: 1 1 200px; min-width: 0; }
  .ss-busy { font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); }
`;
