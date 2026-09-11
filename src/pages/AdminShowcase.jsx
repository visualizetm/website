import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Button, IconButton, Pill, Menu, InlineEdit, ListRow, Sheet, Input, Select, Textarea, Toggle, Collapsible, EmptyState, SkeletonText, Icon, ProgressBar, Chip, useToast, useConfirm, useMediaQuery,
} from '../ui';
import { COPY } from '../shared/copy';
import { industryKey, REVIEW_CHANNELS, TESTIMONIAL_SOURCES, TESTIMONIAL_SOURCE_IDS } from '../shared/semantics';
import { fmtDate } from '../shared/dates';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../lib/cloudinary';
import { uid, today, isHex } from '../lib/projects';
import SaveBar, { saveBarStyles } from '../components/SaveBar';
import ImageField, { imageFieldStyles } from '../components/ImageField';
import { instagramHandle } from '../lib/socials';

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
  instagram: { enabled: false, handle: '', url: '', profileImage: '', posts: [], highlights: [], notes: '' },
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
/* A fact whose source is somewhere else (UX audit, D1, D3, D4): read only
 * here with the way to the place it is edited. A record that already holds
 * its own value shows it as an override with one Clear button, never a
 * second input, so nothing written before this rule stops reading. */
function DerivedRow({ label, value, placeholder, override, onClear, onEdit, editLabel = 'Edit in Overview', readOnly }) {
  return (
    <div className="cw-brand-row sc-derived">
      <span className="dt-fact-label">{label}</span>
      <span className="dt-fact-ro lay-truncate">{override || value || placeholder}</span>
      {override
        ? (!readOnly && <Button variant="ghost" size="md" onClick={onClear} className="sc-derived-btn">Clear override</Button>)
        : (onEdit && !readOnly && <Button variant="ghost" size="md" onClick={onEdit} className="sc-derived-btn">{editLabel}</Button>)}
    </div>
  );
}

function EditableText({ value, onSave, placeholder, label, multiline, readOnly, className }) {
  return readOnly
    ? <span className={`dt-fact-ro${multiline ? '' : ' lay-truncate'}`}>{value || placeholder}</span>
    : <InlineEdit value={value || ''} onSave={onSave} placeholder={placeholder} label={label} multiline={multiline} className={className} />;
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
function ShowcaseBlock({ title, enabled, onEnabled, summary, readOnly, children, openSignal }) {
  /* UX audit, item 7: closed until asked for, so the page reads as a
     checklist; the completeness meter opens a block by bumping openSignal. */
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  return (
    <Card className="dt-block">
      <Row gap={2} align="center" className="dt-block-head">
        <button type="button" className="dt-block-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} data-block={title}>
          <span className="pb-card-h" style={{ margin: 0 }}>{title}</span>
          {!open && <span className="dt-block-sum lay-truncate">{summary}</span>}
        </button>
        <Toggle size="sm" checked={enabled} onChange={onEnabled} label="Enabled" disabled={readOnly} />
      </Row>
      <Collapsible open={open}>{children}</Collapsible>
    </Card>
  );
}

/* The completeness meter (UX audit, item 7): what the public page will
 * have and what it is still missing, so the editor reads as a checklist.
 * Each missing item is a chip that opens the block it lives in. Items that
 * are switched off do not count against the page. */
function completeness(sh, lead) {
  const b = sh.brand || {}; const w = sh.website || {}; const ig = sh.instagram || {}; const c = sh.cards || {}; const p = sh.print || {};
  const logo = sh.logoUrl || b.logo?.dark || b.logo?.light;
  const items = [
    { id: 'cover', label: 'Cover image', ok: !!sh.cover, block: 'fields' },
    { id: 'blurb', label: 'Blurb', ok: !!sh.blurb, block: 'fields' },
    { id: 'type', label: 'Type', ok: !!(sh.type || lead.industry), block: 'fields' },
    ...(b.enabled !== false ? [
      { id: 'logo', label: 'Logo', ok: !!logo, block: 'Brand identity' },
      { id: 'gallery', label: 'Brand images', ok: (b.images || []).length > 0, block: 'Brand identity' },
    ] : []),
    ...(w.enabled !== false ? [
      { id: 'site', label: 'Website URL', ok: !!(w.url || lead.socials?.website || lead.links?.website), block: 'Website' },
      { id: 'shots', label: 'Website screenshots', ok: (w.screenshots || []).length > 0, block: 'Website' },
    ] : []),
    ...(ig.enabled ? [
      { id: 'ig', label: 'Instagram posts', ok: (ig.posts || []).length > 0, block: 'Instagram' },
    ] : []),
    ...(c.enabled !== false ? [{ id: 'cards', label: 'Card front', ok: !!c.front, block: 'Business cards' }] : []),
    ...(p.enabled !== false ? [{ id: 'print', label: 'Print items', ok: (p.items || []).length > 0, block: 'Print and product' }] : []),
    { id: 'quote', label: 'A testimonial', ok: (lead.reviews?.testimonials || []).some(t => t.published), block: 'testimonials' },
  ];
  return { items, done: items.filter(i => i.ok).length, total: items.length };
}

function CompletenessCard({ sh, lead, onOpen }) {
  const { items, done, total } = completeness(sh, lead);
  const missing = items.filter(i => !i.ok);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Card className="sc-meter">
      <Row gap={2} align="center" justify="between" wrap>
        <p className="pb-card-h" style={{ margin: 0 }}>What the page will have</p>
        <span className="dt-muted">{done} of {total} filled</span>
      </Row>
      <ProgressBar value={pct} tone={pct === 100 ? 'booked' : 'callback'} size="sm" />
      {missing.length
        ? <Row gap={1} wrap className="sc-meter-missing" aria-label="Still missing">{missing.map(i => <Chip key={i.id} label={i.label} onClick={() => onOpen(i.block)} />)}</Row>
        : <p className="dt-muted">Everything the page shows is filled in.</p>}
    </Card>
  );
}

function PublishCard({ sh, write, writeRaw, lead, readOnly }) {
  const toast = useToast();
  const url = sh.slug ? `https://visualizestudio.org/clients/${sh.slug}` : '';
  /* The review prompt, part 4: the link to text them after a delivery. The
     same slug as the showcase URL, so it exists the moment this client is
     published, and the form on the other end fills in the business name and
     offers Google afterwards. */
  const reviewUrl = sh.slug ? `https://visualizestudio.org/review/${sh.slug}` : '';
  const f = sh.featured || {};
  const setF = (next) => write({ featured: { ...f, ...next } });
  const setPublished = (v) => {
    // First publish with no slug yet: mirror the server's own slugify() so the
    // URL shown here matches what will be stored (barring a rare collision,
    // which the server resolves by auto-suffixing, see the PATCH handler).
    if (v && !sh.slug) return write({ published: v, slug: clientSlugify(sh.displayName || lead?.business) || clientSlugify(sh.type) || uid() });
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
      <div className="v-field">
        <span className="v-field-label">Review link</span>
        {reviewUrl ? (
          <>
            <Row gap={1} align="center" wrap>
              <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="sc-url lay-truncate">{reviewUrl}</a>
              <IconButton icon="Copy01" label="Copy review link" variant="ghost" onClick={() => copyText(toast, reviewUrl, 'Review link')} />
            </Row>
            <p className="sc-review-note">Text this to them once the work is delivered. Their name and business are filled in for them.</p>
          </>
        ) : <p className="sc-review-note">Set a slug and the review link appears here.</p>}
      </div>
      {/* UX audit, item 8: publishing and featuring always happen together,
          so the landing toggles sit here, in the same save. */}
      <div className="v-field">
        <span className="v-field-label">On the landing page</span>
        <Stack gap={0}>
          <Toggle checked={f.landing} onChange={(v) => setF({ landing: v })} label="Feature on landing page" disabled={readOnly || !sh.published} />
          <Toggle checked={f.logoStrip} onChange={(v) => setF({ logoStrip: v })} label="Show logo in the logo strip" disabled={readOnly || !sh.published} />
          <Toggle checked={f.work} onChange={(v) => setF({ work: v })} label="Feature in the work row" disabled={readOnly || !sh.published} />
        </Stack>
        {!sh.published && <p className="sc-review-note">Publish first; the landing page only shows published clients.</p>}
        <OrderField label="Display order" value={f.order} onSave={(n) => setF({ order: n })} readOnly={readOnly} hint="Lower numbers show first." />
      </div>
      <Row gap={2} wrap>
        <Button variant="secondary" icon="LinkExternal01" disabled={!sh.slug} onClick={() => window.open(`https://visualizestudio.org/clients/${encodeURIComponent(sh.slug)}`, '_blank', 'noopener')}>Preview</Button>
      </Row>
    </Card>
  );
}

function CardFieldsCard({ sh, writeRaw, lead, readOnly }) {
  /* UX audit, D1: the business name is the public name. The override input
     only appears when asked for, or when a record already holds one. */
  const override = sh.displayName && sh.displayName !== lead.business ? sh.displayName : '';
  const [renaming, setRenaming] = useState(false);
  const showInput = !readOnly && (renaming || !!override);
  return (
    <Card className="sc-fields">
      <p className="pb-card-h">Card fields</p>
      <Stack gap={2}>
        {showInput
          ? <div className="cw-brand-row sc-derived"><span className="dt-fact-label">Public name</span><EditableText value={sh.displayName} onSave={(v) => writeRaw({ displayName: v.slice(0, 200) })} placeholder={lead.business} label="Public name" className="dt-fact-edit" />{override && <Button variant="ghost" size="md" onClick={() => { writeRaw({ displayName: '' }); setRenaming(false); }} className="sc-derived-btn">Use the business name</Button>}</div>
          : <DerivedRow label="Public name" value={lead.business} placeholder="Set the business name in Overview" onEdit={readOnly ? undefined : () => setRenaming(true)} editLabel="Use a different name" readOnly={readOnly} />}
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

function BrandBlock({ sh, write, writeRaw, lead, readOnly, jump, openSignal }) {
  const b = sh.brand;
  const logo = sh.logoUrl || b.logo?.dark || b.logo?.light || '';
  const images = b.images || [];
  const summary = !b.enabled ? 'Off' : ([images.length ? `${images.length} image${images.length === 1 ? '' : 's'}` : '', b.notes ? 'notes' : ''].filter(Boolean).join(', ') || 'Not set up yet');
  const brandProfile = { primary: '', colors: [], fontDisplay: '', fontBody: '', ...(lead.brand || {}) };
  const chips = [brandProfile.primary, ...(brandProfile.colors || [])].filter(Boolean);
  return (
    <ShowcaseBlock title="Brand identity" openSignal={openSignal} enabled={b.enabled} onEnabled={(v) => write({ brand: { ...b, enabled: v } })} summary={summary} readOnly={readOnly}>
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

function WebsiteBlock({ sh, write, writeRaw, lead, readOnly, jump, openSignal }) {
  const w = sh.website;
  // UX audit, D3: the lead's socials.website is the one place a website is typed.
  const siteUrl = lead.socials?.website || lead.links?.website || '';
  const shots = w.screenshots || [];
  const summary = !w.enabled ? 'Off' : ([shots.length ? `${shots.length} screenshot${shots.length === 1 ? '' : 's'}` : '', w.notes ? 'notes' : ''].filter(Boolean).join(', ') || 'Not set up yet');
  return (
    <ShowcaseBlock title="Website" openSignal={openSignal} enabled={w.enabled} onEnabled={(v) => write({ website: { ...w, enabled: v } })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <DerivedRow label="URL" value={siteUrl} placeholder="Add the website in Overview" override={w.url && w.url !== siteUrl ? w.url : ''} onClear={() => write({ website: { ...w, url: '' } })} onEdit={jump} readOnly={readOnly} />
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
function InstagramBlock({ sh, write, writeRaw, lead, readOnly, jump, openSignal }) {
  const ig = sh.instagram;
  /* UX audit, D4: the lead's socials.instagram is the one place it is typed;
     the URL and the handle both derive from it. */
  const derivedUrl = lead.socials?.instagram || '';
  const derivedHandle = instagramHandle(derivedUrl);
  const handle = ig.handle || derivedHandle;
  const posts = ig.posts || [];
  const highlights = ig.highlights || [];
  const summary = !ig.enabled ? 'Off' : ([handle ? `@${handle}` : '', posts.length ? `${posts.length} post${posts.length === 1 ? '' : 's'}` : '', highlights.length ? `${highlights.length} highlight${highlights.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ') || 'Not set up yet');
  const setIg = (next) => write({ instagram: { ...ig, ...next } });
  const setIgRaw = (next) => writeRaw({ instagram: { ...ig, ...next } });
  return (
    <ShowcaseBlock title="Instagram" openSignal={openSignal} enabled={ig.enabled} onEnabled={(v) => setIg({ enabled: v })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <Grid minColumnWidth={180} gap={2}>
          <DerivedRow label="Handle" value={derivedHandle ? `@${derivedHandle}` : ''} placeholder="Add the Instagram link in Overview" override={ig.handle && ig.handle !== derivedHandle ? `@${ig.handle}` : ''} onClear={() => setIg({ handle: '' })} onEdit={jump} readOnly={readOnly} />
          <DerivedRow label="Profile URL" value={derivedUrl} placeholder="Add the Instagram link in Overview" override={ig.url && ig.url !== derivedUrl ? ig.url : ''} onClear={() => setIg({ url: '' })} onEdit={jump} readOnly={readOnly} />
        </Grid>
        <div className="v-field"><span className="v-field-label">Profile image</span><ImageField value={ig.profileImage} label="Profile image" placeholder="Profile image URL" ratio="img-fit--1x1 img-fit--circle sc-thumb-round" onSave={(v) => setIgRaw({ profileImage: v })} readOnly={readOnly} /></div>
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
        {/* Story highlights: the row of circles at the top of a profile.
            The cover preview is a circle at the size the public page draws
            it, so a face cropped out of frame is obvious here rather than
            after publishing. The link is optional; a highlight without one
            simply is not tappable on the site. */}
        <div className="v-field">
          <span className="v-field-label">Highlights ({highlights.length} of 10)</span>
          <UploadMany label="highlight covers" count={highlights.length} cap={10} readOnly={readOnly}
            onUploaded={(urls) => setIg({ highlights: [...highlights, ...urls.map(image => ({ id: uid(), label: '', image, link: '' }))] })} />
          <ObjectListEditor items={highlights} readOnly={readOnly} canAdd={!readOnly && highlights.length < 10} addLabel="Add highlight"
            onReorder={(next) => setIg({ highlights: next })}
            onRemove={(i) => setIg({ highlights: highlights.filter((_, j) => j !== i) })}
            onAdd={() => setIg({ highlights: [...highlights, { id: uid(), label: '', image: '', link: '' }] })}
            renderRow={(it, i) => (<>
              <ImageField value={it.image} label={`Highlight ${i + 1} cover`} placeholder="Cover image URL" ratio="img-fit--1x1 img-fit--circle sc-thumb-highlight" onSave={(v) => setIgRaw({ highlights: highlights.map((x, j) => (j === i ? { ...x, image: v } : x)) })} readOnly={readOnly} />
              <EditableText value={it.label} onSave={(v) => setIgRaw({ highlights: highlights.map((x, j) => (j === i ? { ...x, label: v.slice(0, 40) } : x)) })} placeholder="Label (up to 40 characters)" label={`Highlight ${i + 1} label`} readOnly={readOnly} />
              <EditableText value={it.link} onSave={(v) => setIgRaw({ highlights: highlights.map((x, j) => (j === i ? { ...x, link: v.slice(0, 400) } : x)) })} placeholder="Highlight URL (optional)" label={`Highlight ${i + 1} link`} readOnly={readOnly} />
            </>)} />
        </div>
        <div className="v-field"><span className="v-field-label">Notes</span><EditableText value={ig.notes} onSave={(v) => setIgRaw({ notes: v.slice(0, 600) })} multiline placeholder="Notes for the showcase page" label="Instagram notes" readOnly={readOnly} /></div>
      </Stack>
    </ShowcaseBlock>
  );
}

function CardsBlock({ sh, write, writeRaw, readOnly, openSignal }) {
  const c = sh.cards;
  const summary = !c.enabled ? 'Off' : ([c.front && 'front', c.back && 'back', c.notes && 'notes'].filter(Boolean).join(', ') || 'Not set up yet');
  return (
    <ShowcaseBlock title="Business cards" openSignal={openSignal} enabled={c.enabled} onEnabled={(v) => write({ cards: { ...c, enabled: v } })} summary={summary} readOnly={readOnly}>
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

function PrintBlock({ sh, write, writeRaw, readOnly, openSignal }) {
  const p = sh.print;
  const items = p.items || [];
  const summary = !p.enabled ? 'Off' : ([items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : '', p.notes && 'notes'].filter(Boolean).join(', ') || 'Not set up yet');
  return (
    <ShowcaseBlock title="Print and product" openSignal={openSignal} enabled={p.enabled} onEnabled={(v) => write({ print: { ...p, enabled: v } })} summary={summary} readOnly={readOnly}>
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
  const [signals, setSignals] = useState({});
  const [draft, setDraft] = useState(() => draftOf(lead));
  const [saving, setSaving] = useState(false);
  const saved = useMemo(() => draftOf(lead), [lead]);
  const dirty = !same(draft, saved);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  /* A save, or an edit made elsewhere while this page sat open, re-seeds the
   * draft; a change the person made here is never thrown away.
   *
   * "Never thrown away" cannot be decided by `dirty`, which is only ever
   * "the draft differs from the record". A deep link to this URL mounts
   * before the client list has loaded: the draft seeds from a null lead, so
   * it is the blank default, and the moment the real record arrives the
   * draft differs from it. Reading that as unsaved work meant the editor sat
   * on the blank default forever, showing Draft with an empty slug and an
   * open save bar for a client that is actually published, and one press of
   * Save would have written those blanks over the real showcase.
   *
   * What actually distinguishes the two is whether the draft still matches
   * the record it was seeded from. Compare against the PREVIOUS saved value,
   * not the new one, and re-seed when they match. A different client id
   * always re-seeds: that is a different record, not an edit. */
  const seededFrom = useRef(saved);
  const seededId = useRef(lead?._id);
  useEffect(() => {
    if (seededFrom.current === saved && seededId.current === lead?._id) return;
    const prev = seededFrom.current;
    const sameLead = seededId.current === lead?._id;
    seededFrom.current = saved;
    seededId.current = lead?._id;
    setDraft(d => (!sameLead || same(d, prev) ? saved : d));
  }, [saved, lead]);

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
  /* The meter opens a block by bumping its signal; a chip for a card that is
     always open (fields, testimonials) scrolls to it instead. */
  const openBlock = (block) => {
    if (block === 'fields' || block === 'testimonials') { document.querySelector(block === 'fields' ? '.sc-fields' : '.sc-testimonials')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    setSignals(prev => ({ ...prev, [block]: (prev[block] || 0) + 1 }));
    requestAnimationFrame(() => document.querySelector(`[data-block="${block}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const name = sh.displayName || lead.business || 'Client';

  return (
    <PageShell className="aa-main aa-main--wide sc-page sb-host">
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
          <CompletenessCard sh={sh} lead={lead} onOpen={openBlock} />
          <PublishCard sh={sh} write={write} writeRaw={write} lead={lead} readOnly={readOnly} />
          <CardFieldsCard sh={sh} writeRaw={write} lead={lead} readOnly={readOnly} />
          <BrandBlock sh={sh} write={write} writeRaw={write} lead={lead} readOnly={readOnly} jump={onBack} openSignal={signals['Brand identity']} />
          <WebsiteBlock sh={sh} write={write} writeRaw={write} lead={lead} readOnly={readOnly} jump={onBack} openSignal={signals.Website} />
          <InstagramBlock sh={sh} write={write} writeRaw={write} lead={lead} readOnly={readOnly} jump={onBack} openSignal={signals.Instagram} />
          <CardsBlock sh={sh} write={write} writeRaw={write} readOnly={readOnly} openSignal={signals['Business cards']} />
          <PrintBlock sh={sh} write={write} writeRaw={write} readOnly={readOnly} openSignal={signals['Print and product']} />
          <TestimonialsCard lead={lead} testimonials={draft.testimonials} writeTestimonials={writeTestimonials} submissions={submissions} readOnly={readOnly} />
        </Section>
      </div>

      </ScrollArea>

      {/* The save bar rises the moment the draft differs from what is live.
          It sits outside the ScrollArea: it is a fixed overlay belonging to
          the page, not scroll content, and leaving it inside the scroller
          meant the scroller reserved no room for it. The space it needs is
          reserved through the kit's own --v-scroll-extra hook above. */}
      <SaveBar open={dirty} saving={saving} onSave={save} onDiscard={discard} />
      {confirmDialog}
      <style>{saveBarStyles + imageFieldStyles + scStyles}</style>
    </PageShell>
  );
}

const scStyles = `
  .sc-meter-missing { margin-top: var(--v-space-1); }
  /* --v-scroll-extra is the kit's own hook for "reserve room at the bottom
     of this scroller": ScrollArea folds it into both padding-bottom and
     scroll-padding-bottom. Setting padding-bottom here instead lost to
     .lay-scroll's own padding shorthand, so the last card sat under the
     save bar and, on a phone, under the tab bar too.
     What has to be reserved is the save bar plus the gap under it. The tab
     bar and the home indicator inset are NOT added here because the shell
     already keeps the scroller above both: measured at 390 by 844, the
     scroller's own bottom edge is the tab bar's top edge, so adding the tab
     bar again would leave 92px of dead space under the last card. The bar
     is two rows tall on a phone and one on a desktop, hence the two
     values. */
  .sc-scroll { --v-scroll-extra: var(--sb-scroll-extra); }
  .sc-topbar {
    position: sticky; top: 0; z-index: 5;
    padding: var(--v-space-3) 0;
    background: var(--v-surface-1);
    border-bottom: 1px solid var(--v-border-1);
  }
  .sc-page-title { font-size: var(--v-text-lg); font-weight: 700; color: var(--v-text-1); margin: 0; min-width: 0; }
  .sc-page-body { padding-top: var(--v-space-4); }

  .sc-review-note { margin: var(--v-space-1) 0 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .sc-thumb-logo { height: 72px; width: 160px; background: none; }
  .sc-thumb-round { width: 96px; }
  /* The public page draws a highlight at 88px on a desktop, so the preview
     is 88px and round: the crop you see here is the crop that ships. */
  .sc-thumb-highlight { width: 88px; }

`;
