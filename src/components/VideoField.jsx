import { useRef, useState } from 'react';
import { Row, Stack, Grid, Button, Input, Textarea, ProgressBar, useToast } from '../ui';
import { cloudinaryEnabled, uploadVideoToCloudinary, ACCEPT_VIDEO_ATTR, MAX_VIDEO_BYTES } from '../lib/cloudinary';

/* The video field (planner dashboard, milestone 4), for a post or an ad
 * whose format is video.
 *
 * Two states. With a file: the clip plays here (inline, never on its own)
 * and can be replaced or removed. Without one: "Video planned", the concept
 * and the length, which is a valid thing to send a client for approval
 * before a frame exists, and the Upload button with a progress bar once a
 * file is chosen. The link is also typed by hand, the same as an image.
 *
 * Every write goes through onWrite({ video }) or onWrite({ concept }) so the
 * page keeps drafting it like any other field.
 */
const MB = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));

export default function VideoField({ value, concept = '', readOnly = false, onWrite }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [pct, setPct] = useState(-1); // -1 idle, 0..100 uploading
  const v = value && typeof value === 'object' ? value : { url: '', durationSec: 0, poster: '' };
  const write = (patch) => onWrite({ video: { url: v.url || '', durationSec: Number(v.durationSec) || 0, poster: v.poster || '', ...patch } });

  const send = async (file) => {
    if (!file) return;
    setPct(0);
    const res = await uploadVideoToCloudinary(file, setPct);
    setPct(-1);
    if (res.url) {
      write({ url: res.url, poster: res.poster || v.poster || '', durationSec: res.durationSec || Number(v.durationSec) || 0 });
      toast.success('Video uploaded.');
    } else toast.error(res.error);
  };

  return (
    <div className="vf">
      {v.url ? (
        <Stack gap={2}>
          <video className="vf-player" src={v.url} poster={v.poster || undefined} controls playsInline preload="metadata" />
          {!readOnly && (
            <Row gap={2} wrap>
              <Button variant="secondary" size="md" icon="Upload01" onClick={() => fileRef.current?.click()} disabled={pct >= 0 || !cloudinaryEnabled}>Replace</Button>
              <Button variant="ghost" size="md" icon="XClose" onClick={() => write({ url: '', poster: '' })}>Remove the file</Button>
            </Row>
          )}
        </Stack>
      ) : (
        <Stack gap={2}>
          <div className="vf-planned">
            <span className="vf-planned-title">Video planned</span>
            <span className="vf-planned-sub">{cloudinaryEnabled ? `No file yet. Plan it with a concept and a length, upload the clip when it exists (up to ${MB}MB).` : 'No file yet. Plan it with a concept and a length, paste the link when it exists.'}</span>
          </div>
          {!readOnly && cloudinaryEnabled && pct < 0 && (
            <Row gap={2} wrap>
              <Button variant="secondary" size="md" icon="Upload01" onClick={() => fileRef.current?.click()}>Upload video</Button>
            </Row>
          )}
        </Stack>
      )}
      {pct >= 0 && <ProgressBar value={pct} tone="progress" size="sm" label="Uploading" />}
      {!readOnly && <input ref={fileRef} type="file" accept={ACCEPT_VIDEO_ATTR} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; send(f); }} />}
      <Input label="Video link" type="url" inputMode="url" value={v.url || ''} disabled={readOnly} placeholder="https://"
        onChange={(e) => write({ url: e.target.value })} hint="Paste a link, or upload above." />
      <Grid minColumnWidth={150} gap={2}>
        <Input label="Length, seconds" type="number" inputMode="numeric" min={0} max={3600} value={v.durationSec || ''} disabled={readOnly} placeholder="15"
          onChange={(e) => write({ durationSec: Math.max(0, Math.min(3600, Math.round(Number(e.target.value)) || 0)) })} />
        <Input label="Poster image link" type="url" inputMode="url" value={v.poster || ''} disabled={readOnly} placeholder="https://"
          onChange={(e) => write({ poster: e.target.value })} />
      </Grid>
      <Textarea label="Concept" rows={3} maxLength={600} value={concept || ''} disabled={readOnly}
        placeholder="What happens in it, start to finish"
        onChange={(e) => onWrite({ concept: e.target.value.slice(0, 600) })}
        hint={`The client reads this until the file exists. ${String(concept || '').length} of 600.`} />
    </div>
  );
}

export const videoFieldStyles = `
  .vf { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .vf-player { width: 100%; max-width: 320px; max-height: 420px; border-radius: var(--v-radius-md); background: var(--v-surface-3); border: 1px solid var(--v-border-1); }
  .vf-planned {
    display: flex; flex-direction: column; gap: var(--v-space-1);
    padding: var(--v-space-4); border: 1px dashed var(--v-border-2); border-radius: var(--v-radius-md);
    background: var(--v-surface-2);
  }
  .vf-planned-title { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .vf-planned-sub { font-size: var(--v-text-xs); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
