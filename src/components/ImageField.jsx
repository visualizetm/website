import { useEffect, useRef, useState } from 'react';
import { Row, Button, InlineEdit, useToast } from '../ui';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../lib/cloudinary';

/* One image field, lifted out of AdminShowcase so the Planner editor uses the
 * same upload path rather than a second one.
 *
 * The link itself is always editable by hand; the Upload button is the
 * shortcut, and it only appears when the two VITE_CLOUDINARY_ variables are
 * in the build. Uploading calls the same onSave a pasted link does, so a page
 * that drafts its edits keeps drafting them.
 *
 * The preview is an .img-fit box at the ratio the image will appear at
 * publicly, so a bad crop shows here rather than after publishing, and the
 * box doubles as a drop target on a desktop.
 */
export default function ImageField({ value, label, placeholder, onSave, readOnly, ratio = 'img-fit--16x10', thumbClass = '' }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [broken, setBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dropping, setDropping] = useState(false);
  useEffect(() => { setBroken(false); }, [value]);

  const send = async (file) => {
    if (!file) return;
    setUploading(true);
    const res = await uploadToCloudinary(file);
    setUploading(false);
    if (res.url) { await onSave(res.url); toast.success('Image uploaded.'); }
    else toast.error(res.error);
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await send(file);
  };

  const dropProps = (!readOnly && cloudinaryEnabled && !uploading) ? {
    onDragOver: (e) => { e.preventDefault(); setDropping(true); },
    onDragLeave: () => setDropping(false),
    onDrop: async (e) => { e.preventDefault(); setDropping(false); await send(e.dataTransfer?.files?.[0]); },
  } : {};

  return (
    <div className="sc-imgfield">
      <Row gap={2} align="center" wrap>
        {readOnly
          ? <span className="dt-fact-ro lay-truncate">{value || placeholder}</span>
          : <InlineEdit value={value || ''} onSave={onSave} placeholder={placeholder} label={label} className="sc-imgfield-edit" />}
        {!readOnly && cloudinaryEnabled && (
          <>
            <Button variant="secondary" size="md" icon="Upload01" loading={uploading} disabled={uploading}
              onClick={() => fileRef.current?.click()} aria-label={uploading ? `Uploading ${label}` : `Upload ${label}`}>
              Upload
            </Button>
            {uploading && <span className="sc-upload-progress" role="status" aria-live="polite">Uploading</span>}
            {/* No capture attribute: with one, a phone opens the camera and
                nothing else. Without it, iOS and Android both offer the
                photo library, Files, and the camera. */}
            <input ref={fileRef} type="file" accept={ACCEPT_ATTR} style={{ display: 'none' }}
              onChange={onPick} aria-hidden="true" tabIndex={-1} />
          </>
        )}
      </Row>

      <div className={`sc-drop${dropping ? ' is-over' : ''}`} {...dropProps}>
        {value ? (broken
          ? <p className="sc-thumb-warn">Image not reachable.</p>
          : <span className={`img-fit ${ratio} sc-thumb ${thumbClass}`.trim()}>
              <img src={value} alt="" width={320} height={200} loading="lazy" decoding="async" onError={() => setBroken(true)} />
            </span>
        ) : (!readOnly && cloudinaryEnabled ? <p className="sc-drop-hint">Drop an image here, or paste a link above.</p> : null)}
        {dropping && <span className="sc-drop-over">Drop to upload</span>}
      </div>

      {!readOnly && value && <p className="sc-imgfield-note">Clearing this field removes the link from the record. The file stays in Cloudinary.</p>}
    </div>
  );
}

/* The field's own rules. They keep the sc- prefix they were written with, so
 * the audits and the site regression that already select .sc-thumb and
 * .sc-imgfield keep pointing at the same thing after the move. */
export const imageFieldStyles = `
  .lay-root .img-fit { background: var(--v-surface-3); border-radius: var(--v-radius-md); }
  /* ...except the round ones. .img-fit--circle sets 50% at one class of
     specificity, which the rule above outranked. */
  .lay-root .img-fit--circle { border-radius: 50%; }
  .sc-thumb { width: 200px; max-width: 100%; border: 1px solid var(--v-border); }
  .sc-thumb-warn { margin: var(--v-space-1) 0 0; font-size: var(--v-text-xs); color: var(--v-status-danger-text); }
  .sc-imgfield-note { margin: var(--v-space-1) 0 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .sc-upload-progress { font-size: var(--v-text-sm); font-weight: 600; color: var(--v-text-2); }
  /* The preview doubles as a drop target on a desktop. It keeps its own
     dashed outline only while there is nothing in it, so a field with an
     image does not grow a second border around the thumbnail. */
  .sc-drop { position: relative; margin-top: var(--v-space-2); border-radius: var(--v-radius-md); }
  .sc-drop:not(:has(.sc-thumb)) { border: 1px dashed var(--v-border); padding: var(--v-space-3); }
  .sc-drop.is-over { outline: 2px solid var(--v-border-focus); outline-offset: 2px; background: var(--v-surface-3); }
  .sc-drop-hint { margin: 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .sc-drop-over {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    border-radius: var(--v-radius-md); background: var(--v-surface-2);
    font-size: var(--v-text-sm); font-weight: 600; color: var(--v-text-1);
  }
`;
