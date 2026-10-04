import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, Stack, Row, Grid, Card, Button, Input, Textarea, Select, ChipGroup, Pill, Toggle, SegmentedControl, Icon } from '../ui';
import { PLATFORMS, POST_FORMATS, POST_KINDS, AD_GOALS, AD_PLACEMENTS, postStatusOf, postFormatOf } from '../shared/semantics';
import { fmtDateTime } from '../shared/dates';
import { postLabel, platformsOf, formatOf, kindOf, hashtagsOf, missingForReview, listPhrase, aspectNote } from '../lib/posts';
import ImageField from './ImageField';
import VideoField from './VideoField';

/* The post editor (planner prompt 2, part 3; planner dashboard, milestone
 * 4). Every field here is DRAFTED: onWrite puts the change in the page's
 * draft and the save bar is what writes it. Delete is the exception and
 * belongs to the page, since a deletion is immediate.
 *
 * One editor for a post and an ad: the kind toggle at the top decides the
 * status list, the ad section and the words. Video is a format, so a video
 * ad is kind ad, format video, and the creative field follows the format.
 *
 * The status words reach the client, so each one carries a line saying what
 * they will see. "Send for approval" rather than "Review" for the same
 * reason: it says what pressing it does to somebody else.
 */

const STATUS_OPTIONS = {
  post: [
    { id: 'making', label: 'Being made', icon: 'Edit02', tone: 'neutral' },
    { id: 'review', label: 'Send for approval', icon: 'Clock', tone: 'new' },
    { id: 'approved', label: 'Approved', icon: 'Check', tone: 'booked' },
    { id: 'posted', label: 'Posted', icon: 'Send01', tone: 'neutral' },
  ],
  ad: [
    { id: 'making', label: 'Planned', icon: 'Edit02', tone: 'neutral' },
    { id: 'review', label: 'Send for approval', icon: 'Clock', tone: 'new' },
    { id: 'approved', label: 'Approved', icon: 'Check', tone: 'booked' },
    { id: 'live', label: 'Live', icon: 'Play', tone: 'booked' },
    { id: 'finished', label: 'Finished', icon: 'Check', tone: 'neutral' },
  ],
};
const STATUS_MEANS = {
  post: {
    making: 'They see it as in progress. Nothing for them to do.',
    review: 'They can approve it or ask for a change.',
    approved: 'They see it as approved and post it on its date.',
    posted: 'They see it as done.',
  },
  ad: {
    making: 'They see it as planned. Nothing for them to do.',
    review: 'They can approve it or ask for a change.',
    approved: 'They see it as approved and wait for it to start.',
    live: 'They see it as running, with the results you enter.',
    finished: 'They see it as finished, with the results.',
  },
};
const CAPTION_MAX = 2200;
const AD_DEFAULT = { name: '', goal: 'calls', audience: '', placements: ['feed'], buttonText: '', link: '', startDate: '', endDate: '', budget: '', showBudget: false, results: { reach: '', clicks: '', messages: '', spend: '' } };
const RESULT_FIELDS = [
  { id: 'reach', label: 'People reached' }, { id: 'clicks', label: 'Clicks' }, { id: 'messages', label: 'Messages' }, { id: 'spend', label: 'Spent, $' },
];

/* The status picker (fix prompt, bug 3). Long labels do not fit a
 * SegmentedControl at 390: they overlapped and collided. A vertical list of
 * rows fits any width, and it has room for the "what the client sees" line
 * on the row itself, which is where that information belonged all along.
 *
 * Radio semantics by hand rather than buttons: one tab stop into the group,
 * arrow keys move and select, and the checked row is the tab stop. */
function StatusPicker({ kind, value, onChange, readOnly, missing }) {
  const ref = useRef(null);
  const options = STATUS_OPTIONS[kind] || STATUS_OPTIONS.post;
  const means = STATUS_MEANS[kind] || STATUS_MEANS.post;
  const canReview = missing.length === 0;
  const usable = options.filter(o => o.id !== 'review' || canReview);

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
        {options.map(o => {
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
                <span className="ps-status-means">{blocked ? `Add ${listPhrase(missing)} before sending this for approval.` : means[o.id]}</span>
              </span>
              {on && <span className="ps-status-tick" aria-hidden="true"><Icon icon="Check" size={16} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* The ad section: what the client reads under What it says, Who sees it,
 * Where it shows, When it runs, Cost and Results. The budget stays with Rob
 * unless the switch says otherwise; the server strips it on the public
 * endpoint, this switch is what tells it to send it. */
function AdSection({ ad, readOnly, onWrite }) {
  const a = { ...AD_DEFAULT, ...(ad || {}), results: { ...AD_DEFAULT.results, ...(ad?.results || {}) } };
  const write = (patch) => onWrite({ ad: { ...a, ...patch } });
  const num = (v) => (v === '' ? '' : Math.max(0, Math.round(Number(v)) || 0));
  return (
    <Card level={2} padding={3} className="ps-ad">
      <Stack gap={3}>
        <p className="pb-card-h">The ad</p>
        <Input label="Ad name" value={a.name} maxLength={120} disabled={readOnly} placeholder="October interior offer" required
          onChange={(e) => write({ name: e.target.value.slice(0, 120) })} hint="The client sees this as the title." />
        <Select label="Goal" value={a.goal} disabled={readOnly} options={AD_GOALS.map(g => ({ id: g.id, label: g.label }))}
          onChange={(e) => write({ goal: e.target.value })} hint="They read it in plain words: More calls, Promote an offer." />
        <Textarea label="Who sees it" rows={2} maxLength={300} value={a.audience} disabled={readOnly}
          placeholder="Car owners within 15 miles, 25 to 55"
          onChange={(e) => write({ audience: e.target.value.slice(0, 300) })} hint={`One sentence. ${a.audience.length} of 300.`} />
        <div className="v-field">
          <span className="v-field-label">Where it shows</span>
          <ChipGroup label="Placements" multi allWhenEmpty={false}
            options={AD_PLACEMENTS.map(x => ({ id: x.id, label: x.label }))}
            value={new Set(a.placements)}
            onChange={(next) => { if (readOnly) return; write({ placements: AD_PLACEMENTS.map(x => x.id).filter(id => next.has(id)) }); }} />
        </div>
        <Grid minColumnWidth={150} gap={2}>
          <Input label="Button text" value={a.buttonText} maxLength={40} disabled={readOnly} placeholder="Call now"
            onChange={(e) => write({ buttonText: e.target.value.slice(0, 40) })} />
          <Input label="Link" type="url" inputMode="url" value={a.link} disabled={readOnly} placeholder="https://"
            onChange={(e) => write({ link: e.target.value })} />
        </Grid>
        <Grid minColumnWidth={150} gap={2}>
          <Input label="Starts" type="date" value={a.startDate} disabled={readOnly} onChange={(e) => write({ startDate: e.target.value })} />
          <Input label="Ends" type="date" value={a.endDate} disabled={readOnly} onChange={(e) => write({ endDate: e.target.value })} />
        </Grid>
        <Grid minColumnWidth={150} gap={2}>
          <Input label="Budget, $" type="number" inputMode="numeric" min={0} value={a.budget} disabled={readOnly} placeholder="300"
            onChange={(e) => write({ budget: num(e.target.value) })} hint="Stays with you unless the switch is on." />
        </Grid>
        <Toggle label="Show the budget to the client" description="Off: they see the ad without a Cost section. On: they see the budget and what has been spent."
          checked={!!a.showBudget} disabled={readOnly} onChange={(v) => write({ showBudget: v })} />
        <div className="v-field">
          <span className="v-field-label">Results</span>
          <Grid minColumnWidth={120} gap={2}>
            {RESULT_FIELDS.map(f => (
              <Input key={f.id} label={f.label} type="number" inputMode="numeric" min={0} value={a.results[f.id]} disabled={readOnly} placeholder="0"
                onChange={(e) => write({ results: { ...a.results, [f.id]: num(e.target.value) } })} />
            ))}
          </Grid>
          <p className="ps-hint">They see results only once something is entered. Spend shows under Cost, and only with the budget.</p>
        </div>
      </Stack>
    </Card>
  );
}

export default function PostSheet({ post, draft = {}, client, readOnly = false, onWrite, onDelete, onClose, lastHashtags = '', focusImage = false }) {
  const p = { ...post, ...draft };
  const kind = kindOf(p);
  const st = postStatusOf(p.status);
  const format = formatOf(p);
  const fmt = postFormatOf(format);
  const platforms = useMemo(() => platformsOf(p), [p.platforms, p.platform]); // eslint-disable-line react-hooks/exhaustive-deps
  const tagCount = hashtagsOf(p).length;
  const missing = missingForReview(p);
  const lastSet = lastHashtags;
  const captionLen = String(p.caption || '').length;
  const formatRef = useRef(null);
  /* The image's real shape, measured when it loads. A mismatch with the
     declared format is a note for Rob, never a block: he may have meant it. */
  const [natural, setNatural] = useState(null);
  useEffect(() => { setNatural(null); }, [p.imageUrl]);
  const mismatch = natural && format !== 'video' ? aspectNote(format, natural.w, natural.h) : '';
  const onFormatKey = (e) => {
    if (readOnly) return;
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    const i = POST_FORMATS.findIndex(f => f.id === format);
    const next = POST_FORMATS[(i + dir + POST_FORMATS.length) % POST_FORMATS.length];
    onWrite({ format: next.id });
    formatRef.current?.querySelector(`[data-format="${next.id}"]`)?.focus();
  };
  /* Switching kind: an ad status a post cannot carry goes back to making,
     and a new ad gets the default ad block so the section has something to
     edit. */
  const setKind = (k) => {
    if (readOnly || k === kind) return;
    const patch = { kind: k };
    if (k === 'post' && (p.status === 'live' || p.status === 'finished')) patch.status = 'making';
    if (k === 'ad' && !p.ad) patch.ad = { ...AD_DEFAULT, name: p.ad?.name || '' };
    onWrite(patch);
  };
  /* A note stops being news the moment the post goes back up for approval,
   * but it stays on the record: it is what they asked for, and Rob needs it
   * while the post is being redone. */
  const noteIsNew = post.clientNote && post.status === 'making';
  const noun = kind === 'ad' ? 'ad' : 'post';

  return (
    <Sheet
      open
      onClose={onClose}
      title={kind === 'ad' && p.ad?.name ? p.ad.name : postLabel(p)}
      description={`${client}, ${kind === 'ad' ? 'ad, ' : ''}${st.label.toLowerCase()}`}
      tall
      width={520}
      className="ps-sheet"
      footer={readOnly ? undefined : (
        <Row gap={2} justify="between" align="center" wrap>
          <Button variant="ghost" icon="Trash01" danger onClick={onDelete} className="ps-delete">Delete {noun}</Button>
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
            {!noteIsNew && <p className="ps-note-foot">Kept as history. It stops showing as new once the {noun} goes back up for approval.</p>}
          </Card>
        )}

        {/* Kind first: a post the client puts up, or an ad Rob runs for them. */}
        <div className="v-field">
          <span className="v-field-label">Kind</span>
          <SegmentedControl label="Post or ad" full value={kind} onChange={setKind}
            options={POST_KINDS.map(k => ({ id: k.id, label: k.label, icon: k.icon }))} />
          <p className="ps-hint">{kind === 'ad' ? 'They read: I run this for you.' : 'They read: You post this.'}</p>
        </div>

        {/* Format next: it decides what the creative field is and what the
            rest of this form requires. */}
        <div className="v-field">
          <span className="v-field-label" id="ps-format-label">Format</span>
          <div className="ps-status" role="radiogroup" aria-labelledby="ps-format-label" ref={formatRef} onKeyDown={onFormatKey}>
            {POST_FORMATS.map(f => {
              const on = f.id === format;
              return (
                <button key={f.id} type="button" data-format={f.id} role="radio" aria-checked={on}
                  tabIndex={on ? 0 : -1} disabled={readOnly}
                  className={`ps-status-opt${on ? ' is-on' : ''} ps-status-opt--progress`}
                  onClick={() => !readOnly && onWrite({ format: f.id })}>
                  <span className="ps-status-icon" aria-hidden="true"><Icon icon={f.icon} size={16} /></span>
                  <span className="ps-status-text">
                    <span className="ps-status-name">{f.label}</span>
                    <span className="ps-status-means">{f.blurb} Previews at {f.ratio}.</span>
                  </span>
                  {on && <span className="ps-status-tick" aria-hidden="true"><Icon icon="Check" size={16} /></span>}
                </button>
              );
            })}
          </div>
        </div>

        {format === 'video' ? (
          <div className="v-field">
            <span className="v-field-label">Video</span>
            <VideoField value={p.video} concept={p.concept || ''} readOnly={readOnly} onWrite={onWrite} />
          </div>
        ) : (
          <div className="v-field">
            <span className="v-field-label">{kind === 'ad' ? 'Creative' : 'Image'}</span>
            <ImageField value={p.imageUrl} label={`${kind === 'ad' ? 'Ad' : 'Post'} image`} placeholder="Image URL"
              ratio={fmt.aspect} thumbClass="ps-thumb" readOnly={readOnly} whole autoFocus={focusImage}
              onNatural={(w, h) => setNatural({ w, h })}
              onSave={(v) => onWrite({ imageUrl: v })} />
            {mismatch && <p className="ps-mismatch">{mismatch}</p>}
          </div>
        )}

        <Textarea label={kind === 'ad' ? 'What it says' : 'Caption'} rows={kind === 'ad' ? 4 : 8} maxLength={CAPTION_MAX} value={p.caption || ''} disabled={readOnly}
          placeholder={kind === 'ad' ? 'The words on the ad' : 'What goes with the picture'}
          onChange={(e) => onWrite({ caption: e.target.value.slice(0, CAPTION_MAX) })}
          hint={`${captionLen} of ${CAPTION_MAX}`} />

        {kind === 'ad' && <AdSection ad={p.ad} readOnly={readOnly} onWrite={onWrite} />}

        <div className="v-field">
          <span className="v-field-label">Platforms</span>
          <ChipGroup label="Platforms" multi allWhenEmpty={false}
            options={PLATFORMS.map(x => ({ id: x.id, label: x.label, icon: x.icon }))}
            value={new Set(platforms)}
            onChange={(next) => {
              if (readOnly) return;
              // At least one, always: deselecting the last one is refused.
              const list = PLATFORMS.map(x => x.id).filter(id => next.has(id));
              if (!list.length) return;
              onWrite({ platforms: list, platform: list[0] });
            }} />
          <p className="ps-hint">{kind === 'ad' ? 'Where the ad runs. At least one.' : 'One post, every place it goes. At least one.'}</p>
        </div>

        <Grid minColumnWidth={150} gap={2}>
          <Input label={kind === 'ad' ? 'Date (calendar)' : 'Date'} type="date" value={p.date || ''} disabled={readOnly}
            onChange={(e) => onWrite({ date: e.target.value })} />
          <Input label="Time" type="time" value={p.time || ''} disabled={readOnly}
            onChange={(e) => onWrite({ time: e.target.value })} />
        </Grid>

        {/* Hashtags belong to a feed post or a video. A story does not carry
            them, so the field is not there to be filled in by mistake. */}
        {format !== 'story' && kind === 'post' && (
          <div className="v-field">
            <Textarea label="Hashtags" rows={3} maxLength={500} value={p.hashtags || ''} disabled={readOnly}
              placeholder="#phillydetailing #ceramiccoating"
              onChange={(e) => onWrite({ hashtags: e.target.value.slice(0, 500) })}
              hint={`These get copied with the caption. ${tagCount} tag${tagCount === 1 ? '' : 's'}, ${String(p.hashtags || '').length} of 500.`} />
            {!readOnly && lastSet && lastSet !== (p.hashtags || '') && (
              <Row gap={2} wrap>
                <Button variant="secondary" size="md" icon="Copy01" className="ps-lastset"
                  onClick={() => onWrite({ hashtags: lastSet })}>Use last set</Button>
                <span className="dt-muted ps-lastset-peek lay-truncate">{lastSet}</span>
              </Row>
            )}
          </div>
        )}

        <Textarea label="Note to the client" rows={2} maxLength={500} value={p.note || ''} disabled={readOnly}
          placeholder="Anything you want them to know about this one"
          onChange={(e) => onWrite({ note: e.target.value.slice(0, 500) })}
          hint={`They read this under the ${kind === 'ad' ? 'ad' : 'caption'}. ${String(p.note || '').length} of 500.`} />

        <Toggle label="Download allowed" description="On: they get a Save to photos button for the picture or the video. Off: they can look but not save."
          checked={p.allowDownload !== false} disabled={readOnly} onChange={(v) => onWrite({ allowDownload: v })} />

        {/* A feed post needs something to look at, words and tags before a
            client is asked to approve it; a story needs the picture; a video
            needs a concept or the file; an ad needs a name. The row names
            whichever of those is still missing. */}
        <StatusPicker kind={kind} value={p.status || 'making'} readOnly={readOnly} missing={missing}
          onChange={(v) => onWrite({ status: v })} />
      </Stack>
    </Sheet>
  );
}

export const postSheetStyles = `
  .ps-thumb { width: 200px; }
  .ps-hint { margin: 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .ps-mismatch { margin: var(--v-space-2) 0 0; font-size: var(--v-text-xs); color: var(--v-status-new-text); }
  .ps-lastset-peek { min-width: 0; font-size: var(--v-text-xs); }
  .ps-note { gap: var(--v-space-1); }
  .ps-note.is-new { border-color: var(--v-status-danger-text); background: var(--v-status-danger-soft); }
  .ps-note-who { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .ps-note-body { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .ps-note-foot { margin: 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .ps-ad { gap: 0; }
  /* One row per status, so long labels never have to share a line. */
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
