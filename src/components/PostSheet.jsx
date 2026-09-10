import { Sheet, Stack, Row, Grid, Card, Button, Input, Select, Textarea, SegmentedControl, Pill, Icon } from '../ui';
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
  { id: 'making', label: 'Being made', icon: 'Edit02' },
  { id: 'review', label: 'Send for approval', icon: 'Clock' },
  { id: 'approved', label: 'Approved', icon: 'Check' },
  { id: 'posted', label: 'Posted', icon: 'Send01' },
];
const STATUS_MEANS = {
  making: 'They see it as in progress. Nothing for them to do.',
  review: 'They can approve it or ask for a change.',
  approved: 'They see it as scheduled and are waiting for it to go up.',
  posted: 'They see it as done.',
};
const CAPTION_MAX = 2200;

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

        <div className="v-field">
          <span className="v-field-label">Status</span>
          <SegmentedControl label="Post status" options={STATUS_OPTIONS} value={p.status || 'making'}
            onChange={readOnly ? () => {} : (v) => onWrite({ status: v })} full />
          <ul className="ps-means">
            {STATUS_OPTIONS.map(o => (
              <li key={o.id} className={o.id === p.status ? 'is-on' : ''}>
                <span className="ps-means-name">{o.label}</span>
                <span className="ps-means-text">{STATUS_MEANS[o.id]}</span>
              </li>
            ))}
          </ul>
        </div>
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
  .ps-means { list-style: none; margin: var(--v-space-2) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-1); }
  .ps-means li { display: flex; gap: var(--v-space-2); font-size: var(--v-text-xs); color: var(--v-text-3); }
  .ps-means li.is-on { color: var(--v-text-2); }
  .ps-means li.is-on .ps-means-name { color: var(--v-text-1); }
  .ps-means-name { flex: 0 0 11ch; font-weight: var(--v-weight-bold); }
  .ps-means-text { min-width: 0; }
`;
