import { useRef } from 'react';
import { Sheet, Stack, Row, Grid, Card, Button, Input, Select, Textarea, Pill, Icon } from '../ui';
import { PLATFORMS, postStatusOf } from '../shared/semantics';
import { fmtDateTime } from '../shared/dates';
import { postLabel } from '../lib/posts';
import ImageField from './ImageField';

/* The post editor (planner prompt 2, part 3). Every field here is DRAFTED:
 * onWrite puts the change in the page's draft and the save bar is what
 * writes it. Delete is the exception and belongs to the page, since a
 * deletion is immediate.
 *
 * The status words reach the client, so each one carries a line saying what
 * they will see. "Send for approval" rather than "Review" for the same
 * reason: it says what pressing it does to somebody else.
 */

const STATUS_OPTIONS = [
  { id: 'making', label: 'Being made', icon: 'Edit02', tone: 'neutral' },
  { id: 'review', label: 'Send for approval', icon: 'Clock', tone: 'new' },
  { id: 'approved', label: 'Approved', icon: 'Check', tone: 'booked' },
  { id: 'posted', label: 'Posted', icon: 'Send01', tone: 'neutral' },
];
const STATUS_MEANS = {
  making: 'They see it as in progress. Nothing for them to do.',
  review: 'They can approve it or ask for a change.',
  approved: 'They see it as scheduled and are waiting for it to go up.',
  posted: 'They see it as done.',
};
const CAPTION_MAX = 2200;

/* The status picker (fix prompt, bug 3). Four long labels do not fit a
 * SegmentedControl at 390: they overlapped and collided. A vertical list of
 * rows fits any width, and it has room for the "what the client sees" line
 * on the row itself, which is where that information belonged all along.
 *
 * Radio semantics by hand rather than four buttons: one tab stop into the
 * group, arrow keys move and select, and the checked row is the tab stop. */
function StatusPicker({ value, onChange, readOnly, canReview }) {
  const ref = useRef(null);
  const usable = STATUS_OPTIONS.filter(o => o.id !== 'review' || canReview);

  const move = (dir) => {
    const i = usable.findIndex(o => o.id === value);
    const next = usable[(i + dir + usable.length) % usable.length];
    if (!next) return;
    onChange(next.id);
    ref.current?.querySelector(`[data-status="${next.id}"]`)?.focus();
  };
  const onKeyDown = (e) => {
    if (readOnly) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
  };

  /* The tab stop is the checked row, unless that row is the blocked one (a
     post already in review that lost its image), in which case it moves to
     the first row somebody can actually pick, so the group is never a dead
     stop in the tab order. */
  const tabStop = (usable.find(o => o.id === value) || usable[0])?.id;

  return (
    <div className="v-field">
      <span className="v-field-label" id="ps-status-label">Status</span>
      <div ref={ref} className="ps-status" role="radiogroup" aria-labelledby="ps-status-label" onKeyDown={onKeyDown}>
        {STATUS_OPTIONS.map(o => {
          const on = o.id === value;
          const blocked = o.id === 'review' && !canReview;
          return (
            <button
              key={o.id}
              type="button"
              data-status={o.id}
              role="radio"
              aria-checked={on}
              aria-disabled={readOnly || blocked ? 'true' : undefined}
              tabIndex={o.id === tabStop ? 0 : -1}
              disabled={readOnly || blocked}
              className={`ps-status-opt${on ? ' is-on' : ''}${blocked ? ' is-blocked' : ''} ps-status-opt--${o.tone}`}
              onClick={() => !readOnly && !blocked && onChange(o.id)}
            >
              <span className="ps-status-icon" aria-hidden="true"><Icon icon={o.icon} size={16} /></span>
              <span className="ps-status-text">
                <span className="ps-status-name">{o.label}</span>
                <span className="ps-status-means">{blocked ? 'Add an image before sending this for approval.' : STATUS_MEANS[o.id]}</span>
              </span>
              {on && <span className="ps-status-tick" aria-hidden="true"><Icon icon="Check" size={16} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PostSheet({ post, draft = {}, client, readOnly = false, onWrite, onDelete, onClose }) {
  const p = { ...post, ...draft };
  const st = postStatusOf(p.status);
  const captionLen = String(p.caption || '').length;
  /* A note stops being news the moment the post goes back up for approval,
   * but it stays on the record: it is what they asked for, and Rob needs it
   * while the post is being redone. */
  const noteIsNew = post.clientNote && post.status === 'making';

  return (
    <Sheet
      open
      onClose={onClose}
      title={postLabel(p)}
      description={`${client}, ${st.label.toLowerCase()}`}
      tall
      width={520}
      className="ps-sheet"
      footer={readOnly ? undefined : (
        <Row gap={2} justify="between" align="center" wrap>
          <Button variant="ghost" icon="Trash01" danger onClick={onDelete} className="ps-delete">Delete post</Button>
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </Row>
      )}
    >
      <Stack gap={4}>
        {post.clientNote && (
          <Card level={2} padding={3} className={`ps-note${noteIsNew ? ' is-new' : ''}`}>
            <Row gap={2} align="center" wrap>
              <Icon icon="MessageCircle01" size={14} />
              <span className="ps-note-who">{client} asked for a change</span>
              {post.clientNoteAt && <span className="dt-muted">{fmtDateTime(post.clientNoteAt)}</span>}
              {!noteIsNew && <Pill tone="neutral" label="Handled" size="sm" variant="soft" icon={false} />}
            </Row>
            <p className="ps-note-body">{post.clientNote}</p>
            {!noteIsNew && <p className="ps-note-foot">Kept as history. It stops showing as new once the post goes back up for approval.</p>}
          </Card>
        )}

        <div className="v-field">
          <span className="v-field-label">Image</span>
          <ImageField value={p.imageUrl} label="Post image" placeholder="Image URL"
            ratio="img-fit--1x1" thumbClass="ps-thumb" readOnly={readOnly}
            onSave={(v) => onWrite({ imageUrl: v })} />
        </div>

        <Textarea label="Caption" rows={8} maxLength={CAPTION_MAX} value={p.caption || ''} disabled={readOnly}
          placeholder="What goes with the picture"
          onChange={(e) => onWrite({ caption: e.target.value.slice(0, CAPTION_MAX) })}
          hint={`${captionLen} of ${CAPTION_MAX}`} />

        <Grid minColumnWidth={150} gap={2}>
          <Select label="Platform" value={p.platform || 'instagram'} disabled={readOnly}
            options={PLATFORMS.map(x => ({ id: x.id, label: x.label }))}
            onChange={(e) => onWrite({ platform: e.target.value })} />
          <Input label="Date" type="date" value={p.date || ''} disabled={readOnly}
            onChange={(e) => onWrite({ date: e.target.value })} />
          <Input label="Time" type="time" value={p.time || ''} disabled={readOnly}
            onChange={(e) => onWrite({ time: e.target.value })} />
        </Grid>

        <Textarea label="Note to the client" rows={2} maxLength={500} value={p.note || ''} disabled={readOnly}
          placeholder="Anything you want them to know about this one"
          onChange={(e) => onWrite({ note: e.target.value.slice(0, 500) })}
          hint={`They read this under the caption. ${String(p.note || '').length} of 500.`} />

        {/* An image is what the client is being asked to approve, so a post
            cannot go up for approval without one. A caption can follow. */}
        <StatusPicker value={p.status || 'making'} readOnly={readOnly} canReview={!!p.imageUrl}
          onChange={(v) => onWrite({ status: v })} />
      </Stack>
    </Sheet>
  );
}

export const postSheetStyles = `
  .ps-thumb { width: 200px; }
  .ps-note { gap: var(--v-space-1); }
  .ps-note.is-new { border-color: var(--v-status-danger-text); background: var(--v-status-danger-soft); }
  .ps-note-who { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .ps-note-body { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .ps-note-foot { margin: 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  /* One row per status, so four long labels never have to share a line. */
  .ps-status { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ps-status-opt {
    display: flex; align-items: flex-start; gap: var(--v-space-3);
    width: 100%; min-height: var(--v-tap); padding: var(--v-space-3);
    text-align: left; cursor: pointer;
    background: var(--v-surface-2); color: var(--v-text-2);
    border: 1px solid var(--v-border-1); border-radius: var(--v-radius-md);
    font-family: var(--v-font-body);
    transition: border-color var(--v-dur-fast) var(--v-ease-out), background var(--v-dur-fast) var(--v-ease-out);
  }
  .ps-status-opt:hover:not(:disabled) { border-color: var(--v-border-2); background: var(--v-surface-3); }
  .ps-status-opt:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .ps-status-opt.is-on { border-color: var(--sc, var(--v-border-2)); background: var(--v-surface-3); }
  .ps-status-opt--neutral.is-on { --sc: var(--v-status-neutral-text); }
  .ps-status-opt--new.is-on { --sc: var(--v-status-new-text); }
  .ps-status-opt--booked.is-on { --sc: var(--v-status-booked-text); }
  .ps-status-opt.is-blocked { opacity: 0.6; cursor: not-allowed; }
  .ps-status-icon { display: inline-flex; color: var(--sc, var(--v-text-3)); padding-top: 2px; }
  .ps-status-opt.is-on .ps-status-icon { color: var(--sc); }
  .ps-status-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .ps-status-name { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .ps-status-means { font-size: var(--v-text-xs); line-height: var(--v-lh-sm); color: var(--v-text-3); overflow-wrap: anywhere; }
  .ps-status-tick { display: inline-flex; color: var(--sc); padding-top: 2px; }
`;
