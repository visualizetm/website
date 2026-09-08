import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Button, IconButton, Pill, Menu, InlineEdit, ListRow, Sheet, Input, Select, Textarea, Toggle, Collapsible, EmptyState, SkeletonText, Icon, useToast, useConfirm, useMediaQuery,
} from '../ui';
import { COPY } from '../shared/copy';
import { industryKey, REVIEW_CHANNELS, TESTIMONIAL_SOURCES, TESTIMONIAL_SOURCE_IDS } from '../shared/semantics';
import { fmtDate } from '../shared/dates';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../lib/cloudinary';
import { uid, today, isHex } from '../lib/projects';

/* The Showcase editor (Site Prompt 7, Part 3), its own admin page at
 * /clients/:id/showcase rather than a tab inside the client record.
 *
 * The reason it moved is the save model. Every other admin field writes the
 * moment it loses focus, which is right for a CRM note and wrong for a page
 * that goes live: publishing, reordering and swapping images are edits you
 * want to make together and then commit. So this page holds a draft copy of
 * showcase and reviews.testimonials, every control edits the draft only, and
 * one Save writes both objects in a single PATCH (the full-replacement rule
 * from Site Prompt 2). Publish is part of the draft too: toggling it changes
 * nothing on the public site until Save.
 *
 * Leaving with unsaved work is guarded three ways: the in-app Back and the
 * browser's own beforeunload, plus Cmd+S / Ctrl+S to save without reaching
 * for the bar.
 */

const copyText = async (toast, text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error(COPY.error.copy); } };

const DEFAULT_SHOWCASE = {
  published: false, slug: '', displayName: '', type: '', blurb: '', cover: '', year: '',
  // One logo (Site Prompt 7, Part 5). brand.logo's old light/dark pair is
  // still read for records written before the change, and blanked the first
  // time this editor saves, which is what lets logoUrl win at the endpoint.
  logoUrl: '',
  brand: { enabled: true, logo: { light: '', dark: '' }, images: [], notes: '' },
  website: { enabled: true, url: '', screenshots: [], notes: '' },
  instagram: { enabled: false, handle: '', url: '', profileImage: '', posts: [], notes: '' },
  cards: { enabled: true, front: '', back: '', notes: '' },
  print: { enabled: true, items: [], notes: '' },
  featured: { landing: false, logoStrip: false, work: false, order: 0 },
};
const DEFAULT_REVIEWS = { nfcCard: false, nfcGivenAt: '', googleLink: '', baseline: null, latest: null, asks: [], testimonials: [] };
/* Mirrors api/_routes/call-leads.js's slugify(): a-z0-9 and single hyphens,
 * no leading/trailing hyphen. Client-side only so the Publish toggle can
 * show a sane URL immediately; the server is the real source of truth and
 * auto-suffixes on a rare collision. */
const clientSlugify = (v) => String(v ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/* A value shown as plain text in read-only mode, an InlineEdit otherwise.
 * Centralizes the ternary every other read-only field in this file repeats. */
function EditableText({ value, onSave, placeholder, label, multiline, readOnly, className }) {
  return readOnly
    ? <span className={`dt-fact-ro${multiline ? '' : ' lay-truncate'}`}>{value || placeholder}</span>
    : <InlineEdit value={value || ''} onSave={onSave} placeholder={placeholder} label={label} multiline={multiline} className={className} />;
}

/* An image URL field: the link itself (InlineEdit, or plain text when read
 * only), an Upload button when Cloudinary is configured, and a live preview
 * in the exact box the public page will use, so a tall or panoramic upload
 * shows its crop here rather than at publish.
 *
 * Pasting a link always works and is never hidden behind the upload path;
 * the button is the shortcut, not the requirement. Uploading calls the same
 * onSave the manual link uses, so the full-replacement write rule still
 * applies and the draft/save model is untouched.
 *
 * The preview box is also a drop target on a desktop. */
function ImageField({ value, label, placeholder, onSave, readOnly, ratio = 'img-fit--16x10' }) {
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
        <EditableText value={value} onSave={onSave} placeholder={placeholder} label={label} readOnly={readOnly || uploading} className="sc-imgfield-edit" />
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
          : <span className={`img-fit ${ratio} sc-thumb`}>
              <img src={value} alt="" width={320} height={200} loading="lazy" decoding="async" onError={() => setBroken(true)} />
            </span>
        ) : (!readOnly && cloudinaryEnabled ? <p className="sc-drop-hint">Drop an image here, or paste a link above.</p> : null)}
        {dropping && <span className="sc-drop-over">Drop to upload</span>}
      </div>

      {!readOnly && value && <p className="sc-imgfield-note">Clearing this field removes the link from the record. The file stays in Cloudinary.</p>}
    </div>
  );
}

/* Site Prompt "upload flow", check 4: the same upload, for a list.
 *
 * Takes several files at once, sends them one after another (Cloudinary's
 * unsigned endpoint is per-file, and a burst of parallel POSTs from a phone
 * is how you get half of them dropped), and reports progress as it goes.
 * Every file that succeeds is appended, whatever happened to the others;
 * the failures are named in one toast at the end rather than swallowed.
 * Stops at the list's own cap and says so. */
function UploadMany({ label, count, cap, onUploaded, readOnly }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(null); // { at, of }
  if (readOnly || !cloudinaryEnabled) return null;
  const room = Math.max(0, cap - count);

  const onPick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    let list = files;
    if (files.length > room) {
      list = files.slice(0, room);
      toast.error(`Room for ${room} more (the limit is ${cap}). Uploading the first ${room}.`);
    }
    const urls = [];
    const failed = [];
    for (let i = 0; i < list.length; i++) {
      setProgress({ at: i + 1, of: list.length });
      const res = await uploadToCloudinary(list[i]); // eslint-disable-line no-await-in-loop
      if (res.url) urls.push(res.url); else failed.push(res.error);
    }
    setProgress(null);
    if (urls.length) await onUploaded(urls);
    if (failed.length) toast.error(failed.length === 1 ? failed[0] : `${failed.length} of ${list.length} did not upload. ${failed[0]}`);
    else if (urls.length) toast.success(urls.length === 1 ? 'Image uploaded.' : `${urls.length} images uploaded.`);
  };

  return (
    <Row gap={2} align="center" wrap>
      <Button variant="secondary" size="md" icon="Upload01" loading={!!progress}
        disabled={!!progress || room === 0}
        onClick={() => (room === 0 ? toast.error(`That is the limit of ${cap}.`) : fileRef.current?.click())}
        aria-label={`Upload ${label}`}>
        Upload {label}
      </Button>
      {/* The kit's loading Button swaps its label for a spinner, so the
          count lives beside it rather than inside it. aria-live so a screen
          reader hears each file land instead of watching a spinner. */}
      {progress && (
        <span className="sc-upload-progress" role="status" aria-live="polite">
          Uploading {progress.at} of {progress.of}
        </span>
      )}
      {room === 0 && <span className="dt-muted">Limit of {cap} reached.</span>}
      <input ref={fileRef} type="file" multiple accept={ACCEPT_ATTR} style={{ display: 'none' }}
        onChange={onPick} aria-hidden="true" tabIndex={-1} />
    </Row>
  );
}

/* Star rating: a static 1-5 display when `onChange` is omitted, an
 * interactive 1-5 picker (tap the same star again to clear it) otherwise. */
function StarRating({ value, onChange, size = 16 }) {
  if (!onChange && !value) return <span className="dt-muted">No rating</span>;
  if (!onChange) {
    return (
      <span className="sc-stars" aria-label={`${value} of 5 stars`}>
        {[1, 2, 3, 4, 5].map(n => <Icon key={n} icon="Star01" size={size} className={n <= value ? 'sc-star-on' : 'sc-star-off'} />)}
      </span>
    );
  }
  return (
    <span className="sc-stars" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" className={`sc-star${n <= (value || 0) ? ' is-on' : ''}`} onClick={() => onChange(n === value ? null : n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-pressed={n <= (value || 0)}>
          <Icon icon="Star01" size={size} />
        </button>
      ))}
    </span>
  );
}

/* A list of object rows with add, edit (via renderRow), remove, and reorder
 * (drag on desktop, a Menu's Move up/down on mobile) - the ListEditor
 * pattern above, generalized to rows that are objects instead of strings. */
function ObjectListEditor({ items, onReorder, onRemove, onAdd, canAdd, addLabel = 'Add', readOnly, renderRow }) {
  const drag = useRef(null);
  const desktop = useMediaQuery('(hover: hover) and (pointer: fine)');
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; onReorder(n); };
  return (
    <Stack gap={2}>
      {items.map((it, i) => (
        <Card key={i} level={2} padding={3} className="sc-objrow" draggable={!readOnly && desktop}
          onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (drag.current == null || drag.current === i) return; const n = [...items]; const [x] = n.splice(drag.current, 1); n.splice(i, 0, x); drag.current = null; onReorder(n); }}>
          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>{renderRow(it, i)}</Stack>
          {!readOnly && (
            <Menu label={`Row ${i + 1} actions`} items={[
              { id: 'up', label: 'Move up', icon: 'ChevronLeft', disabled: i === 0, onSelect: () => move(i, -1) },
              { id: 'down', label: 'Move down', icon: 'ChevronDown', disabled: i === items.length - 1, onSelect: () => move(i, 1) },
              'divider',
              { id: 'rm', label: 'Remove', icon: 'Trash01', danger: true, onSelect: () => onRemove(i) },
            ]} />
          )}
        </Card>
      ))}
      {canAdd && <Button variant="ghost" icon={Plus} onClick={onAdd}>{addLabel}</Button>}
    </Stack>
  );
}

/* A card that collapses to a one-line summary, with an `enabled` Toggle in
 * its header that stays visible either way (the Deliverables/Playbook
 * `Block` pattern in LeadDetail.jsx, reusing its dt-block* classes; kept
 * local here to avoid a circular import between the two files). */
function ShowcaseBlock({ title, enabled, onEnabled, summary, readOnly, children }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="dt-block">
      <Row gap={2} align="center" className="dt-block-head">
        <button type="button" className="dt-block-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className="pb-card-h" style={{ margin: 0 }}>{title}</span>
          {!open && <span className="dt-block-sum lay-truncate">{summary}</span>}
        </button>
        <Toggle size="sm" checked={enabled} onChange={onEnabled} label="Enabled" disabled={readOnly} />
      </Row>
      <Collapsible open={open}>{children}</Collapsible>
    </Card>
  );
}

function PublishCard({ sh, write, writeRaw, readOnly }) {
  const toast = useToast();
  const url = sh.slug ? `https://visualizestudio.org/clients/${sh.slug}` : '';
  const setPublished = (v) => {
    // First publish with no slug yet: mirror the server's own slugify() so the
    // URL shown here matches what will be stored (barring a rare collision,
    // which the server resolves by auto-suffixing, see the PATCH handler).
    if (v && !sh.slug) return write({ published: v, slug: clientSlugify(sh.displayName) || clientSlugify(sh.type) || uid() });
    return write({ published: v });
  };
  return (
    <Card className="sc-publish">
      <Row gap={2} align="center" justify="between" wrap>
        <p className="pb-card-h" style={{ margin: 0 }}>Publish</p>
        <Pill tone={sh.published ? 'booked' : 'neutral'} label={sh.published ? 'Published' : 'Draft'} size="sm" variant={sh.published ? 'solid' : 'soft'} icon={false} />
      </Row>
      <Toggle checked={sh.published} onChange={setPublished} label="Published" description="Live on the public showcase once a slug is set." disabled={readOnly} />
      <div className="v-field">
        <span className="v-field-label">Public URL slug</span>
        <EditableText value={sh.slug} onSave={(v) => writeRaw({ slug: v })} placeholder="Auto-generated on publish" label="Slug" readOnly={readOnly} className="sc-slug-edit" />
        {url && (
          <Row gap={1} align="center" wrap>
            <a href={url} target="_blank" rel="noopener noreferrer" className="sc-url lay-truncate">{url}</a>
            <IconButton icon="Copy01" label="Copy showcase URL" variant="ghost" onClick={() => copyText(toast, url, 'Showcase URL')} />
          </Row>
        )}
      </div>
      <Row gap={2} wrap>
        <Button variant="secondary" icon="LinkExternal01" disabled={!sh.slug} onClick={() => window.open(`https://visualizestudio.org/clients/${encodeURIComponent(sh.slug)}`, '_blank', 'noopener')}>Preview</Button>
      </Row>
    </Card>
  );
}

function CardFieldsCard({ sh, writeRaw, lead, readOnly }) {
  return (
    <Card className="sc-fields">
      <p className="pb-card-h">Card fields</p>
      <Stack gap={2}>
        <div className="cw-brand-row"><span className="dt-fact-label">Display name</span><EditableText value={sh.displayName} onSave={(v) => writeRaw({ displayName: v.slice(0, 200) })} placeholder={lead.business} label="Display name" readOnly={readOnly} className="dt-fact-edit" /></div>
        <div className="cw-brand-row"><span className="dt-fact-label">Type</span><EditableText value={sh.type} onSave={(v) => writeRaw({ type: v.slice(0, 80) })} placeholder={industryKey(lead.industry) || 'Industry'} label="Type" readOnly={readOnly} className="dt-fact-edit" /></div>
        <div className="v-field">
          <span className="v-field-label">Blurb</span>
          <EditableText value={sh.blurb} onSave={(v) => writeRaw({ blurb: v.slice(0, 200) })} multiline placeholder="One line about the work" label="Blurb" readOnly={readOnly} />
          <span className="dt-muted">{(sh.blurb || '').length}/200</span>
        </div>
        <div className="v-field"><span className="v-field-label">Cover image</span><ImageField value={sh.cover} label="Cover image" placeholder="Cover image URL" ratio="img-fit--16x9" onSave={(v) => writeRaw({ cover: v })} readOnly={readOnly} /></div>
        <div className="cw-brand-row"><span className="dt-fact-label">Year</span><EditableText value={sh.year} onSave={(v) => writeRaw({ year: v.slice(0, 10) })} placeholder="2026" label="Year" readOnly={readOnly} className="dt-fact-edit" /></div>
      </Stack>
    </Card>
  );
}

function BrandBlock({ sh, write, writeRaw, lead, readOnly, jump }) {
  const b = sh.brand;
  const logo = sh.logoUrl || b.logo?.dark || b.logo?.light || '';
  const images = b.images || [];
  const summary = !b.enabled ? 'Off' : ([images.length ? `${images.length} image${images.length === 1 ? '' : 's'}` : '', b.notes ? 'notes' : ''].filter(Boolean).join(', ') || 'Not set up yet');
  const brandProfile = { primary: '', colors: [], fontDisplay: '', fontBody: '', ...(lead.brand || {}) };
  const chips = [brandProfile.primary, ...(brandProfile.colors || [])].filter(Boolean);
  return (
    <ShowcaseBlock title="Brand identity" enabled={b.enabled} onEnabled={(v) => write({ brand: { ...b, enabled: v } })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        {/* One logo now that the public site is dark only. Saving blanks
            the old light/dark pair, which is how the new value wins at the
            endpoint, whose read order is dark, then light, then this. */}
        <div className="v-field">
          <span className="v-field-label">Logo</span>
          <ImageField value={logo} label="Logo" placeholder="Logo image URL" ratio="img-fit--contain sc-thumb-logo"
            onSave={(v) => writeRaw({ logoUrl: v, brand: { ...b, logo: { light: '', dark: '' } } })} readOnly={readOnly} />
        </div>
        <div className="v-field">
          <span className="v-field-label">Gallery images ({images.length} of 12)</span>
          <UploadMany label="gallery images" count={images.length} cap={12} readOnly={readOnly}
            onUploaded={(urls) => write({ brand: { ...b, images: [...images, ...urls.map(link => ({ link, caption: '' }))] } })} />
          <ObjectListEditor items={images} readOnly={readOnly} canAdd={!readOnly && images.length < 12} addLabel="Add image"
            onReorder={(next) => write({ brand: { ...b, images: next } })}
            onRemove={(i) => write({ brand: { ...b, images: images.filter((_, j) => j !== i) } })}
            onAdd={() => write({ brand: { ...b, images: [...images, { link: '', caption: '' }] } })}
            renderRow={(it, i) => (<>
              <ImageField value={it.link} label={`Image ${i + 1} link`} placeholder="Image URL" onSave={(v) => writeRaw({ brand: { ...b, images: images.map((x, j) => (j === i ? { ...x, link: v } : x)) } })} readOnly={readOnly} />
              <EditableText value={it.caption} onSave={(v) => writeRaw({ brand: { ...b, images: images.map((x, j) => (j === i ? { ...x, caption: v } : x)) } })} placeholder="Caption (optional)" label={`Image ${i + 1} caption`} readOnly={readOnly} />
            </>)} />
        </div>
        <div className="v-field"><span className="v-field-label">Notes</span><EditableText value={b.notes} onSave={(v) => writeRaw({ brand: { ...b, notes: v.slice(0, 600) } })} multiline placeholder="Notes for the showcase page" label="Brand notes" readOnly={readOnly} /></div>
        <Card level={2} padding={3}>
          <Row gap={2} justify="between" align="center" wrap><span className="dt-fact-label">Palette and type (from Overview)</span><Button variant="ghost" size="md" onClick={() => jump('overview')}>Edit in Overview</Button></Row>
          <Row gap={1} wrap align="center">{chips.length ? chips.map((c, i) => <span key={i} className="sc-chip" style={isHex(c) ? { background: c } : undefined} title={c} />) : <span className="dt-muted">No colors set</span>}</Row>
          <span className="dt-muted">{[brandProfile.fontDisplay, brandProfile.fontBody].filter(Boolean).join(' / ') || 'No fonts set'}</span>
        </Card>
      </Stack>
    </ShowcaseBlock>
  );
}

function WebsiteBlock({ sh, write, writeRaw, lead, readOnly }) {
  const w = sh.website;
  const shots = w.screenshots || [];
  const summary = !w.enabled ? 'Off' : ([shots.length ? `${shots.length} screenshot${shots.length === 1 ? '' : 's'}` : '', w.notes ? 'notes' : ''].filter(Boolean).join(', ') || 'Not set up yet');
  return (
    <ShowcaseBlock title="Website" enabled={w.enabled} onEnabled={(v) => write({ website: { ...w, enabled: v } })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <div className="cw-brand-row"><span className="dt-fact-label">URL</span><EditableText value={w.url} onSave={(v) => writeRaw({ website: { ...w, url: v.slice(0, 400) } })} placeholder={lead.links?.website || 'https://...'} label="Website URL" readOnly={readOnly} className="dt-fact-edit" /></div>
        <div className="v-field">
          <span className="v-field-label">Screenshots ({shots.length} of 8)</span>
          <UploadMany label="screenshots" count={shots.length} cap={8} readOnly={readOnly}
            onUploaded={(urls) => write({ website: { ...w, screenshots: [...shots, ...urls.map(link => ({ link, caption: '' }))] } })} />
          <ObjectListEditor items={shots} readOnly={readOnly} canAdd={!readOnly && shots.length < 8} addLabel="Add screenshot"
            onReorder={(next) => write({ website: { ...w, screenshots: next } })}
            onRemove={(i) => write({ website: { ...w, screenshots: shots.filter((_, j) => j !== i) } })}
            onAdd={() => write({ website: { ...w, screenshots: [...shots, { link: '', caption: '' }] } })}
            renderRow={(it, i) => (<>
              <ImageField value={it.link} label={`Screenshot ${i + 1} link`} placeholder="Screenshot URL" onSave={(v) => writeRaw({ website: { ...w, screenshots: shots.map((x, j) => (j === i ? { ...x, link: v } : x)) } })} readOnly={readOnly} />
              <EditableText value={it.caption} onSave={(v) => writeRaw({ website: { ...w, screenshots: shots.map((x, j) => (j === i ? { ...x, caption: v } : x)) } })} placeholder="Caption (optional)" label={`Screenshot ${i + 1} caption`} readOnly={readOnly} />
            </>)} />
        </div>
        <div className="v-field"><span className="v-field-label">Notes</span><EditableText value={w.notes} onSave={(v) => writeRaw({ website: { ...w, notes: v.slice(0, 600) } })} multiline placeholder="Notes for the showcase page" label="Website notes" readOnly={readOnly} /></div>
      </Stack>
    </ShowcaseBlock>
  );
}

/* Site Prompt 7, Part 2: the Instagram block. The handle is stored without
 * the @ (typing one is stripped on save), and the URL falls back to the
 * lead's own Instagram link when left blank, so the common case is one
 * field and a toggle. Nine posts, because the public grid is 3 by 3. */
function InstagramBlock({ sh, write, writeRaw, lead, readOnly }) {
  const ig = sh.instagram;
  const posts = ig.posts || [];
  const summary = !ig.enabled ? 'Off' : ([ig.handle ? `@${ig.handle}` : '', posts.length ? `${posts.length} post${posts.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ') || 'Not set up yet');
  const setIg = (next) => write({ instagram: { ...ig, ...next } });
  const setIgRaw = (next) => writeRaw({ instagram: { ...ig, ...next } });
  return (
    <ShowcaseBlock title="Instagram" enabled={ig.enabled} onEnabled={(v) => setIg({ enabled: v })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <Grid minColumnWidth={180} gap={2}>
          <div className="cw-brand-row"><span className="dt-fact-label">Handle</span><EditableText value={ig.handle} onSave={(v) => setIgRaw({ handle: v.replace(/^@+/, '').slice(0, 60) })} placeholder="visualizetm" label="Instagram handle" readOnly={readOnly} className="dt-fact-edit" /></div>
          <div className="cw-brand-row"><span className="dt-fact-label">Profile URL</span><EditableText value={ig.url} onSave={(v) => setIgRaw({ url: v.slice(0, 400) })} placeholder={lead.socials?.instagram || 'https://instagram.com/...'} label="Instagram URL" readOnly={readOnly} className="dt-fact-edit" /></div>
        </Grid>
        <div className="v-field"><span className="v-field-label">Profile image</span><ImageField value={ig.profileImage} label="Profile image" placeholder="Profile image URL" ratio="img-fit--1x1 sc-thumb-round" onSave={(v) => setIgRaw({ profileImage: v })} readOnly={readOnly} /></div>
        <div className="v-field">
          <span className="v-field-label">Posts ({posts.length} of 9)</span>
          <UploadMany label="posts" count={posts.length} cap={9} readOnly={readOnly}
            onUploaded={(urls) => setIg({ posts: [...posts, ...urls.map(image => ({ link: '', image, caption: '' }))] })} />
          <ObjectListEditor items={posts} readOnly={readOnly} canAdd={!readOnly && posts.length < 9} addLabel="Add post"
            onReorder={(next) => setIg({ posts: next })}
            onRemove={(i) => setIg({ posts: posts.filter((_, j) => j !== i) })}
            onAdd={() => setIg({ posts: [...posts, { link: '', image: '', caption: '' }] })}
            renderRow={(it, i) => (<>
              <EditableText value={it.link} onSave={(v) => setIgRaw({ posts: posts.map((x, j) => (j === i ? { ...x, link: v.slice(0, 400) } : x)) })} placeholder="Post URL" label={`Post ${i + 1} link`} readOnly={readOnly} />
              <ImageField value={it.image} label={`Post ${i + 1} image`} placeholder="Image URL" ratio="img-fit--1x1" onSave={(v) => setIgRaw({ posts: posts.map((x, j) => (j === i ? { ...x, image: v } : x)) })} readOnly={readOnly} />
              <EditableText value={it.caption} onSave={(v) => setIgRaw({ posts: posts.map((x, j) => (j === i ? { ...x, caption: v.slice(0, 200) } : x)) })} placeholder="Caption (optional)" label={`Post ${i + 1} caption`} readOnly={readOnly} />
            </>)} />
        </div>
        <div className="v-field"><span className="v-field-label">Notes</span><EditableText value={ig.notes} onSave={(v) => setIgRaw({ notes: v.slice(0, 600) })} multiline placeholder="Notes for the showcase page" label="Instagram notes" readOnly={readOnly} /></div>
      </Stack>
    </ShowcaseBlock>
  );
}

function CardsBlock({ sh, write, writeRaw, readOnly }) {
  const c = sh.cards;
  const summary = !c.enabled ? 'Off' : ([c.front && 'front', c.back && 'back', c.notes && 'notes'].filter(Boolean).join(', ') || 'Not set up yet');
  return (
    <ShowcaseBlock title="Business cards" enabled={c.enabled} onEnabled={(v) => write({ cards: { ...c, enabled: v } })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <Grid minColumnWidth={180} gap={2}>
          <div className="v-field"><span className="v-field-label">Front</span><ImageField value={c.front} label="Card front" placeholder="Front image URL" ratio="img-fit--7x4" onSave={(v) => writeRaw({ cards: { ...c, front: v } })} readOnly={readOnly} /></div>
          <div className="v-field"><span className="v-field-label">Back</span><ImageField value={c.back} label="Card back" placeholder="Back image URL" ratio="img-fit--7x4" onSave={(v) => writeRaw({ cards: { ...c, back: v } })} readOnly={readOnly} /></div>
        </Grid>
        <div className="v-field"><span className="v-field-label">Notes</span><EditableText value={c.notes} onSave={(v) => writeRaw({ cards: { ...c, notes: v.slice(0, 600) } })} multiline placeholder="Notes for the showcase page" label="Cards notes" readOnly={readOnly} /></div>
      </Stack>
    </ShowcaseBlock>
  );
}

function PrintBlock({ sh, write, writeRaw, readOnly }) {
  const p = sh.print;
  const items = p.items || [];
  const summary = !p.enabled ? 'Off' : ([items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : '', p.notes && 'notes'].filter(Boolean).join(', ') || 'Not set up yet');
  return (
    <ShowcaseBlock title="Print and product" enabled={p.enabled} onEnabled={(v) => write({ print: { ...p, enabled: v } })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <div className="v-field">
          <span className="v-field-label">Items ({items.length} of 12)</span>
          <UploadMany label="print items" count={items.length} cap={12} readOnly={readOnly}
            onUploaded={(urls) => write({ print: { ...p, items: [...items, ...urls.map(image => ({ label: '', image, caption: '' }))] } })} />
          <ObjectListEditor items={items} readOnly={readOnly} canAdd={!readOnly && items.length < 12} addLabel="Add item"
            onReorder={(next) => write({ print: { ...p, items: next } })}
            onRemove={(i) => write({ print: { ...p, items: items.filter((_, j) => j !== i) } })}
            onAdd={() => write({ print: { ...p, items: [...items, { label: '', image: '', caption: '' }] } })}
            renderRow={(it, i) => (<>
              <EditableText value={it.label} onSave={(v) => writeRaw({ print: { ...p, items: items.map((x, j) => (j === i ? { ...x, label: v } : x)) } })} placeholder="Label, e.g. Sticker sheet" label={`Item ${i + 1} label`} readOnly={readOnly} />
              <ImageField value={it.image} label={`Item ${i + 1} image`} placeholder="Image URL" ratio="img-fit--1x1" onSave={(v) => writeRaw({ print: { ...p, items: items.map((x, j) => (j === i ? { ...x, image: v } : x)) } })} readOnly={readOnly} />
              <EditableText value={it.caption} onSave={(v) => writeRaw({ print: { ...p, items: items.map((x, j) => (j === i ? { ...x, caption: v } : x)) } })} placeholder="Caption (optional)" label={`Item ${i + 1} caption`} readOnly={readOnly} />
            </>)} />
        </div>
        <div className="v-field"><span className="v-field-label">Notes</span><EditableText value={p.notes} onSave={(v) => writeRaw({ print: { ...p, notes: v.slice(0, 600) } })} multiline placeholder="Notes for the showcase page" label="Print notes" readOnly={readOnly} /></div>
      </Stack>
    </ShowcaseBlock>
  );
}

/* A number field that commits on blur rather than every keystroke. */
function OrderField({ label, value, onSave, readOnly, hint }) {
  const [v, setV] = useState(String(value ?? 0));
  useEffect(() => { setV(String(value ?? 0)); }, [value]);
  return <Input label={label} type="number" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = Math.round(Number(v)) || 0; if (n !== value) onSave(n); }} disabled={readOnly} hint={hint} />;
}

function LandingCard({ sh, write, readOnly }) {
  const f = sh.featured;
  const setF = (next) => write({ featured: { ...f, ...next } });
  return (
    <Card className="sc-landing">
      <p className="pb-card-h">Landing page</p>
      <Stack gap={0}>
        <Toggle checked={f.landing} onChange={(v) => setF({ landing: v })} label="Feature on landing page" disabled={readOnly} />
        <Toggle checked={f.logoStrip} onChange={(v) => setF({ logoStrip: v })} label="Show logo in the logo strip" disabled={readOnly} />
        <Toggle checked={f.work} onChange={(v) => setF({ work: v })} label="Feature in the work row" disabled={readOnly} />
      </Stack>
      <OrderField label="Display order" value={f.order} onSave={(n) => setF({ order: n })} readOnly={readOnly} hint="Lower numbers show first." />
    </Card>
  );
}

/* Add from asks (Site Prompt 2): review-channel ids (nfc/text/email/in-person)
 * map 1:1 onto testimonial-source ids for those four, so an ask's channel
 * carries straight over; website/google have no matching ask channel. */
function AskPicker({ asks, onPick, onClose }) {
  return (
    <Sheet open onClose={onClose} title="Add from asks" description="Review asks logged as left." width={460}>
      {asks.length ? (
        <Stack gap={1}>{asks.map((a, i) => (
          <ListRow key={i} title={fmtDate(a.at) || 'Unknown date'} subtitle={[REVIEW_CHANNELS.find(c => c.id === a.channel)?.label, a.note].filter(Boolean).join(', ') || 'No note'} onClick={() => onPick(a)} />
        ))}</Stack>
      ) : <EmptyState size="sm" icon="Star01" title="No asks marked left" description="Log an ask and mark it Left on the Reviews screen first." />}
    </Sheet>
  );
}

/* Add from website reviews (Site Prompt 2): a 'review' submission only ever
 * carries fields.rating and fields.text (api/submissions.js) - no separate
 * author, so the submission's name pre-fills the quote's author and the
 * admin fills in the rest. Matches by business name sort first, not filter,
 * since a review might arrive under a slightly different business spelling. */
function SubmissionReviewPicker({ subs, onPick, onClose }) {
  return (
    <Sheet open onClose={onClose} title="Add from website reviews" description="Review-type submissions from the site." width={460}>
      {subs.length ? (
        <Stack gap={1}>{subs.map(s => (
          <ListRow key={s._id} title={s.business || s.name} subtitle={[s.fields?.rating ? `${s.fields.rating} stars` : '', s.fields?.text ? String(s.fields.text).slice(0, 80) : ''].filter(Boolean).join(', ') || 'No review text'} meta={fmtDate(s.createdAt)} onClick={() => onPick(s)} />
        ))}</Stack>
      ) : <EmptyState size="sm" icon="Inbox01" title="No review submissions" description="Website review-form submissions will show up here." />}
    </Sheet>
  );
}

function TestimonialSheet({ testimonial, onClose, onSave, onDelete, busy }) {
  const [draft, setDraft] = useState(testimonial);
  const set = (next) => setDraft(d => ({ ...d, ...next }));
  return (
    <Sheet open onClose={onClose} title={onDelete ? 'Edit testimonial' : 'Add testimonial'} tall width={520}
      footer={
        <Row gap={2} justify="between" style={{ width: '100%' }}>
          <span>{onDelete && <Button variant="danger" onClick={onDelete} disabled={busy}>Remove</Button>}</span>
          <Row gap={2}><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} onClick={() => onSave(draft)}>Save</Button></Row>
        </Row>
      }>
      <Stack gap={3}>
        <div>
          <Textarea label="Quote" rows={4} value={draft.quote} onChange={(e) => set({ quote: e.target.value.slice(0, 400) })} data-autofocus />
          <span className="dt-muted">{(draft.quote || '').length}/400</span>
        </div>
        <Grid minColumnWidth={160} gap={2}>
          <Input label="Author" value={draft.author} onChange={(e) => set({ author: e.target.value.slice(0, 120) })} />
          <Input label="Role" value={draft.role} onChange={(e) => set({ role: e.target.value.slice(0, 120) })} placeholder="Owner" />
        </Grid>
        <div className="v-field"><span className="v-field-label">Rating</span><StarRating value={draft.rating} onChange={(v) => set({ rating: v })} size={22} /></div>
        <Select label="Source" value={draft.source} onChange={(e) => set({ source: e.target.value })} options={TESTIMONIAL_SOURCES.map(s => ({ id: s.id, label: s.label }))} />
        <Grid minColumnWidth={140} gap={2}>
          <Toggle checked={!!draft.published} onChange={(v) => set({ published: v })} label="Published" />
          <Toggle checked={!!draft.featured} onChange={(v) => set({ featured: v })} label="Featured" />
        </Grid>
        <Grid minColumnWidth={140} gap={2}>
          <Input label="Order" type="number" inputMode="numeric" value={draft.order} onChange={(e) => set({ order: Number(e.target.value) || 0 })} />
          <Input label="Date" type="date" value={(draft.at || '').slice(0, 10)} onChange={(e) => set({ at: e.target.value })} />
        </Grid>
      </Stack>
    </Sheet>
  );
}

function TestimonialsCard({ lead, testimonials, writeTestimonials, submissions, readOnly }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [askPicker, setAskPicker] = useState(false);
  const [subPicker, setSubPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = () => ({ id: uid(), quote: '', author: '', role: '', rating: null, source: 'text', published: false, featured: false, order: testimonials.length, at: today() });
  const save = async (draft) => {
    setBusy(true);
    const exists = testimonials.some(x => x.id === draft.id);
    const next = exists ? testimonials.map(x => (x.id === draft.id ? draft : x)) : [...testimonials, draft];
    const ok = await writeTestimonials(next);
    setBusy(false);
    if (ok) { setEditing(null); toast.success('Testimonial saved.'); }
  };
  const remove = (id) => { writeTestimonials(testimonials.filter(x => x.id !== id)); setEditing(null); };
  const toggle = (id, next) => writeTestimonials(testimonials.map(x => (x.id === id ? { ...x, ...next } : x)));
  const asksLeft = (lead.reviews?.asks || []).filter(a => a.result === 'left');
  const reviewSubs = useMemo(() => {
    const bizMatch = (s) => (String(s.business || '').trim().toLowerCase() === String(lead.business || '').trim().toLowerCase() ? 0 : 1);
    return submissions.filter(s => s.type === 'review' && !s.deleted).sort((a, b) => bizMatch(a) - bizMatch(b) || new Date(b.createdAt) - new Date(a.createdAt));
  }, [submissions, lead.business]);
  const sorted = useMemo(() => [...testimonials].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [testimonials]);
  return (
    <Card className="sc-testimonials">
      <Row gap={2} justify="between" align="center" wrap>
        <p className="pb-card-h" style={{ margin: 0 }}>Testimonials</p>
        {!readOnly && (
          <Row gap={1} wrap>
            <Button variant="ghost" size="md" icon={Plus} onClick={() => setEditing(blank())}>Add by hand</Button>
            <Button variant="ghost" size="md" onClick={() => setAskPicker(true)}>Add from asks</Button>
            <Button variant="ghost" size="md" onClick={() => setSubPicker(true)}>Add from website reviews</Button>
          </Row>
        )}
      </Row>
      {sorted.length ? (
        <Stack gap={2}>
          {sorted.map(t => (
            <Card key={t.id} level={2} padding={3} className="sc-testi-row">
              {!readOnly && <button type="button" className="v-stretch" onClick={() => setEditing(t)} aria-label={`Edit testimonial${t.author ? ` from ${t.author}` : ''}`} />}
              <Row gap={2} align="start" wrap className="v-above">
                <Stack gap={1} style={{ flex: 1, minWidth: 200 }}>
                  <p className="sc-testi-quote lay-truncate">{t.quote || 'No quote yet'}</p>
                  <Row gap={2} wrap align="center">
                    <span className="sc-testi-author">{t.author || 'Unnamed'}{t.role ? `, ${t.role}` : ''}</span>
                    <StarRating value={t.rating} />
                    <Pill id={t.source} list={TESTIMONIAL_SOURCES} size="sm" variant="outline" />
                    <span className="dt-muted">#{t.order ?? 0}</span>
                  </Row>
                </Stack>
                <Row gap={2} wrap align="center">
                  <Toggle size="sm" checked={!!t.published} onChange={(v) => toggle(t.id, { published: v })} label="Published" disabled={readOnly} />
                  <Toggle size="sm" checked={!!t.featured} onChange={(v) => toggle(t.id, { featured: v })} label="Featured" disabled={readOnly} />
                </Row>
              </Row>
            </Card>
          ))}
        </Stack>
      ) : <p className="dt-muted">No testimonials yet.</p>}
      {editing && (
        <TestimonialSheet testimonial={editing} busy={busy} onClose={() => setEditing(null)} onSave={save}
          onDelete={testimonials.some(x => x.id === editing.id) ? () => remove(editing.id) : undefined} />
      )}
      {askPicker && (
        <AskPicker asks={asksLeft} onClose={() => setAskPicker(false)}
          onPick={(a) => { setAskPicker(false); setEditing({ ...blank(), source: TESTIMONIAL_SOURCE_IDS.includes(a.channel) ? a.channel : 'text', at: (a.at || today()).slice(0, 10) }); }} />
      )}
      {subPicker && (
        <SubmissionReviewPicker subs={reviewSubs} onClose={() => setSubPicker(false)}
          onPick={(s) => { setSubPicker(false); setEditing({ ...blank(), quote: String(s.fields?.text || '').slice(0, 400), author: s.name || '', rating: s.fields?.rating ? Math.max(1, Math.min(5, Math.round(Number(s.fields.rating)))) : null, source: 'website', at: (s.createdAt ? new Date(s.createdAt).toISOString() : today()).slice(0, 10) }); }} />
      )}
    </Card>
  );
}

/* ── The page ────────────────────────────────────────────────────── */

/** Deep-equal enough for a draft: both sides are plain JSON. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The saved record, merged onto the defaults, as one draft-shaped object. */
function draftOf(lead) {
  const sh = lead?.showcase || {};
  return {
    showcase: {
      ...DEFAULT_SHOWCASE, ...sh,
      brand: { ...DEFAULT_SHOWCASE.brand, ...(sh.brand || {}), logo: { ...DEFAULT_SHOWCASE.brand.logo, ...(sh.brand?.logo || {}) } },
      website: { ...DEFAULT_SHOWCASE.website, ...(sh.website || {}) },
      instagram: { ...DEFAULT_SHOWCASE.instagram, ...(sh.instagram || {}) },
      cards: { ...DEFAULT_SHOWCASE.cards, ...(sh.cards || {}) },
      print: { ...DEFAULT_SHOWCASE.print, ...(sh.print || {}) },
      featured: { ...DEFAULT_SHOWCASE.featured, ...(sh.featured || {}) },
    },
    testimonials: (lead?.reviews?.testimonials || []).map(t => ({ ...t })),
  };
}

/**
 * The Showcase editor page (Site Prompt 7, Part 3), routed at
 * /clients/:id/showcase.
 * @param {object} props
 * @param {object} props.lead the client being edited
 * @param {Function} props.onPatch (id, set) => Promise<boolean>
 * @param {Function} props.onBack () => void, back to the client record
 * @param {Array} [props.submissions] every submission, filtered to reviews here
 */
export default function AdminShowcase({ lead, loading = false, onPatch, onBack, submissions = [], readOnly = false }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [draft, setDraft] = useState(() => draftOf(lead));
  const [saving, setSaving] = useState(false);
  const saved = useMemo(() => draftOf(lead), [lead]);
  const dirty = !same(draft, saved);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // A save (or an edit made elsewhere while this page sat open) re-seeds the
  // draft, but only when there is nothing unsaved to lose.
  useEffect(() => { setDraft(d => (same(d, saved) ? d : (dirtyRef.current ? d : saved))); }, [saved]);

  const sh = draft.showcase;
  const write = useCallback((next) => { setDraft(d => ({ ...d, showcase: { ...d.showcase, ...next } })); return Promise.resolve(true); }, []);
  const writeTestimonials = useCallback((next) => { setDraft(d => ({ ...d, testimonials: next })); return Promise.resolve(true); }, []);

  const save = useCallback(async () => {
    if (saving) return false;
    setSaving(true);
    const reviews = { ...DEFAULT_REVIEWS, ...(lead.reviews || {}), testimonials: draft.testimonials };
    const ok = await onPatch(lead._id, { showcase: draft.showcase, reviews });
    setSaving(false);
    if (ok) toast.success(draft.showcase.published ? 'Showcase saved and published.' : 'Showcase saved.');
    else toast.error(COPY.error.save);
    return ok;
  }, [saving, lead, draft, onPatch, toast]);

  const discard = useCallback(async () => {
    const yes = await confirm({ title: 'Discard changes?', body: 'Everything you changed since the last save goes back to what is live.', confirmLabel: 'Discard', danger: true });
    if (yes) setDraft(saved);
  }, [confirm, saved]);

  const leave = useCallback(async () => {
    if (!dirtyRef.current) { onBack(); return; }
    const yes = await confirm({ title: 'Leave without saving?', body: 'Your changes to this showcase have not been saved yet.', confirmLabel: 'Leave', danger: true });
    if (yes) onBack();
  }, [confirm, onBack]);

  // Cmd+S / Ctrl+S, and the browser's own guard for closing the tab.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (dirtyRef.current) save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);
  useEffect(() => {
    const onUnload = (e) => { if (!dirtyRef.current) return undefined; e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  /* A deep link to this URL lands before the client list has loaded, so
   * "not found" has to wait for the list to actually be in. */
  if (!lead) {
    return (
      <PageShell className="aa-main aa-main--wide">
        <ScrollArea wide>
          {loading
            ? <Section title="Showcase" description=" " loading><Stack gap={3}>{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={3} /></Card>)}</Stack></Section>
            : <EmptyState icon="Image01" title="Client not found" description="That client is not in the list any more." action={<Button onClick={onBack}>Back to clients</Button>} />}
        </ScrollArea>
      </PageShell>
    );
  }

  const publicUrl = sh.slug ? `https://visualizestudio.org/clients/${encodeURIComponent(sh.slug)}` : '';
  const name = sh.displayName || lead.business || 'Client';

  return (
    <PageShell className="aa-main aa-main--wide sc-page">
      <ScrollArea wide className="sc-scroll">
      <div className="sc-topbar">
        <Row gap={2} align="center" justify="between" wrap>
          <Row gap={2} align="center" wrap style={{ minWidth: 0 }}>
            <Button variant="ghost" icon="ArrowLeft" onClick={leave}>Back</Button>
            <h1 className="sc-page-title lay-truncate">{name}</h1>
            <Pill tone={sh.published ? 'booked' : 'neutral'} label={sh.published ? 'Published' : 'Draft'} size="sm" variant={sh.published ? 'solid' : 'soft'} icon={false} />
          </Row>
          <Button variant="secondary" icon="LinkExternal01" disabled={!publicUrl} onClick={() => window.open(publicUrl, '_blank', 'noopener')}>Preview</Button>
        </Row>
      </div>

      <div className="sc-page-body">
        <Section title="Showcase" description="What shows on the public work page. Nothing here is live until you save.">
          <PublishCard sh={sh} write={write} writeRaw={write} readOnly={readOnly} />
          <CardFieldsCard sh={sh} writeRaw={write} lead={lead} readOnly={readOnly} />
          <BrandBlock sh={sh} write={write} writeRaw={write} lead={lead} readOnly={readOnly} jump={onBack} />
          <WebsiteBlock sh={sh} write={write} writeRaw={write} lead={lead} readOnly={readOnly} />
          <InstagramBlock sh={sh} write={write} writeRaw={write} lead={lead} readOnly={readOnly} />
          <CardsBlock sh={sh} write={write} writeRaw={write} readOnly={readOnly} />
          <PrintBlock sh={sh} write={write} writeRaw={write} readOnly={readOnly} />
          <LandingCard sh={sh} write={write} readOnly={readOnly} />
          <TestimonialsCard lead={lead} testimonials={draft.testimonials} writeTestimonials={writeTestimonials} submissions={submissions} readOnly={readOnly} />
        </Section>
      </div>

      </ScrollArea>

      {/* The save bar rises the moment the draft differs from what is live.
          It sits outside the ScrollArea: it is a fixed overlay belonging to
          the page, not scroll content, and leaving it inside the scroller
          meant the scroller reserved no room for it. The space it needs is
          reserved through the kit's own --v-scroll-extra hook above. */}
      <div className={`sc-savebar${dirty ? ' is-open' : ''}`} role="status" aria-hidden={dirty ? undefined : 'true'}>
        <Row gap={2} align="center" wrap>
          <span className="sc-savebar-msg">You have unsaved changes</span>
          <Row gap={2}>
            <Button variant="ghost" onClick={discard} disabled={saving || !dirty}>Discard</Button>
            <Button onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
          </Row>
        </Row>
      </div>
      {confirmDialog}
      <style>{scStyles}</style>
    </PageShell>
  );
}

const scStyles = `
  /* --v-scroll-extra is the kit's own hook for "reserve room at the bottom
     of this scroller": ScrollArea folds it into both padding-bottom and
     scroll-padding-bottom. Setting padding-bottom here instead lost to
     .lay-scroll's own padding shorthand, so the last card sat under the
     save bar and, on a phone, under the tab bar too. The shell already
     reserves the tab bar itself; this is the save bar's own height. */
  .sc-scroll { --v-scroll-extra: 104px; }
  .sc-topbar {
    position: sticky; top: 0; z-index: 5;
    padding: var(--v-space-3) 0;
    background: var(--v-surface-1);
    border-bottom: 1px solid var(--v-border-1);
  }
  .sc-page-title { font-size: var(--v-text-lg); font-weight: 700; color: var(--v-text-1); margin: 0; min-width: 0; }
  .sc-page-body { padding-top: var(--v-space-4); }

  /* Admin surfaces, not the marketing ones: .img-fit is shared with the
     public site, so its ground is re-pointed here. */
  .lay-root .img-fit { background: var(--v-surface-3); border-radius: var(--v-radius-md); }
  .sc-thumb { width: 200px; max-width: 100%; border: 1px solid var(--v-border); }
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
  .sc-thumb-logo { height: 72px; width: 160px; background: none; }
  .sc-thumb-round { width: 96px; border-radius: 50%; }

  .sc-savebar {
    position: fixed; right: var(--v-space-4); bottom: var(--v-space-4); z-index: 40;
    padding: var(--v-space-3) var(--v-space-4);
    background: var(--v-surface-2); border: 1px solid var(--v-border-2);
    border-radius: var(--v-radius-lg); box-shadow: var(--v-shadow-lg);
    transform: translateY(140%); opacity: 0;
    transition: transform var(--v-dur-enter) var(--v-ease-out), opacity var(--v-dur-enter) var(--v-ease-out);
    pointer-events: none;
  }
  .sc-savebar.is-open { transform: none; opacity: 1; pointer-events: auto; }
  .sc-savebar-msg { font-size: var(--v-text-sm); font-weight: 600; color: var(--v-text-1); }
  @media (max-width: 900px) {
    .sc-savebar { left: var(--v-space-3); right: var(--v-space-3); bottom: calc(var(--v-tabbar-h, 64px) + var(--v-space-3)); }
    .sc-savebar > .v-row { justify-content: space-between; }
  }
`;
