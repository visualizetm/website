import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Button, IconButton, Pill, Input, Textarea, Select, InlineEdit, Tabs, Menu,
  EmptyState, ErrorState, Stagger, SkeletonText, useConfirm, useDelayedLoading, useToast, useMediaQuery, Icon,
} from '../ui';
import { COPY } from '../shared/copy';
import { CONCEPT_ITEM_KINDS, conceptSetStatusOf, conceptFeedbackActionOf } from '../shared/semantics';
import { relativeTime, fmtDateTime } from '../shared/dates';
import { projectsOf, activeProject, revisionsUsed, revisionsMax, extraRoundFeeFor, roundLogPatch, money } from '../lib/projects';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../lib/cloudinary';
import { safeHref } from '../lib/safeUrl';
import {
  MAX_DIRECTIONS, MAX_ITEMS, letterOf, statusOf, setsOf, directionsOf, itemsOf, sendBlockReason, publicUrl, timelineOf,
  directionLabel, blankDirection, blankItem, nextRoundOf, draftOf, sameDraft,
} from '../lib/concepts';
import { useTopBar } from '../shell/ShellContext';
import SaveBar, { saveBarStyles } from '../components/SaveBar';
import { imageFieldStyles } from '../components/ImageField';

/* The Concepts editor (Concepts rebuild, Part 3), one page per lead at
 * /leads/:id/concepts, reachable from a lead, a booked record or a client
 * record, built on the pattern the Showcase and Planner editors set: the
 * set held here as a draft, an explicit save, the shared save bar, Cmd+S,
 * the browser's own leave guard.
 *
 * Drafted: title, intro, the linked project and every direction and item.
 * Immediate: creating a set, starting the next round, sending, a new link,
 * archiving, and logging a round on the project, because each of those is
 * a thing that happened rather than a field. A dirty draft saves first.
 * The server owns token, tokenCreatedAt, sentAt, lastViewedAt, status
 * changes the client makes and every feedback entry; nothing here sends
 * them, and there is no field that takes a token value. */

const KIND_OPTIONS = CONCEPT_ITEM_KINDS.map(k => ({ id: k.id, label: k.label }));

/* ── One item in a direction ──────────────────────────────────────── */
function ItemCard({ item, letter, index, count, readOnly, onWrite, onMove, onDelete, dragProps }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [item.image]);
  const src = safeHref(item.image);
  return (
    <div className="ce-item" {...dragProps}>
      <span className="img-fit ce-item-img">
        {src && !broken
          ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
          : <span className="ce-item-empty" aria-hidden="true"><Icon icon={broken ? 'AlertTriangle' : 'Image01'} size="var(--v-icon-md)" /></span>}
        {broken && <span className="visually-hidden">This image did not load.</span>}
      </span>
      <Stack gap={2}>
        <Row gap={2} align="center" justify="between" wrap={false}>
          <span className="ce-item-n">{letter}{index + 1}</span>
          {!readOnly && (
            <Menu label={`Item ${letter}${index + 1} actions`} items={[
              { id: 'up', label: 'Move up', icon: 'ChevronLeft', disabled: index === 0, onSelect: () => onMove(-1) },
              { id: 'down', label: 'Move down', icon: 'ChevronDown', disabled: index === count - 1, onSelect: () => onMove(1) },
              'divider',
              { id: 'del', label: 'Delete image', icon: 'Trash01', danger: true, onSelect: onDelete },
            ]} />
          )}
        </Row>
        <Select label="Kind" options={KIND_OPTIONS} value={item.kind || 'other'} disabled={readOnly} onChange={(e) => onWrite({ kind: e.target.value })} />
        <Input label="Caption" value={item.caption} maxLength={200} disabled={readOnly} placeholder="One line under it"
          onChange={(e) => onWrite({ caption: e.target.value.slice(0, 200) })} />
        <InlineEdit value={item.image || ''} onSave={(v) => onWrite({ image: String(v || '').trim().slice(0, 600) })} label={`Image link for ${letter}${index + 1}`} placeholder="Image link" readOnly={readOnly} className="ce-item-link" />
      </Stack>
    </div>
  );
}

/* ── One direction ────────────────────────────────────────────────── */
function DirectionCard({ d, index, count, readOnly, desktop, onWrite, onMove, onDuplicate, onDelete }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const drag = useRef(null);
  const [progress, setProgress] = useState(null); // { done, total } while a batch uploads
  const letter = letterOf(index);
  const items = itemsOf(d);
  const room = MAX_ITEMS - items.length;

  const writeItems = (next) => onWrite({ items: next.map((it, k) => ({ ...it, order: k })) });
  const addImages = (urls, kind) => {
    const fresh = urls.slice(0, Math.max(0, room)).map((u, k) => blankItem(u, items.length + k, kind));
    if (fresh.length) writeItems([...items, ...fresh]);
    return fresh.length;
  };
  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const batch = files.slice(0, Math.max(0, room));
    if (!batch.length) { toast.error(`A direction holds ${MAX_ITEMS} images.`); return; }
    const urls = [];
    for (let i = 0; i < batch.length; i += 1) {
      setProgress({ done: i, total: batch.length });
      const res = await uploadToCloudinary(batch[i]); // eslint-disable-line no-await-in-loop
      if (res.url) urls.push(res.url); else toast.error(res.error);
    }
    setProgress(null);
    const n = addImages(urls);
    if (n) toast.success(n === 1 ? 'Image added.' : `${n} images added.`);
  };
  const moveItem = (i, by) => {
    const j = i + by; if (j < 0 || j >= items.length) return;
    const next = [...items]; const [it] = next.splice(i, 1); next.splice(j, 0, it);
    writeItems(next);
  };

  return (
    <Card className="ce-dir">
      <Row gap={2} align="center" justify="between" wrap={false}>
        <Row gap={2} align="center" wrap={false} style={{ minWidth: 0 }}>
          <span className="ce-letter" aria-hidden="true">{letter}</span>
          <p className="pb-card-h ce-dir-h lay-truncate">Direction {letter}{d.name ? `, ${d.name}` : ''}</p>
        </Row>
        {!readOnly && (
          <Menu label={`Direction ${letter} actions`} items={[
            { id: 'up', label: 'Move up', icon: 'ChevronLeft', disabled: index === 0, onSelect: () => onMove(-1) },
            { id: 'down', label: 'Move down', icon: 'ChevronDown', disabled: index === count - 1, onSelect: () => onMove(1) },
            { id: 'dup', label: 'Duplicate', icon: 'Copy01', disabled: count >= MAX_DIRECTIONS, onSelect: onDuplicate },
            'divider',
            { id: 'del', label: 'Delete direction', icon: 'Trash01', danger: true, onSelect: onDelete },
          ]} />
        )}
      </Row>
      <Input label="Name" value={d.name} maxLength={80} disabled={readOnly} placeholder="Warm and hand drawn"
        hint="What they will call it when they text you back." onChange={(e) => onWrite({ name: e.target.value.slice(0, 80) })} />
      <Textarea label="Why this one" rows={3} maxLength={600} value={d.rationale} disabled={readOnly}
        placeholder="Two or three lines on what this direction does for them."
        hint={`They read this before the images. ${d.rationale.length} of 600.`} onChange={(e) => onWrite({ rationale: e.target.value.slice(0, 600) })} />
      <div className="v-field">
        <Row gap={2} align="center" justify="between" wrap>
          <span className="v-field-label">Images ({items.length} of {MAX_ITEMS})</span>
          {!readOnly && (
            <Row gap={2} align="center" wrap>
              {cloudinaryEnabled && (
                <>
                  <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={pick} aria-label={`Add images to Direction ${letter}`} />
                  <Button size="md" variant="secondary" icon="Upload01" loading={!!progress} disabled={room <= 0} onClick={() => fileRef.current?.click()}>
                    {progress ? `${progress.done + 1} of ${progress.total}` : 'Add images'}
                  </Button>
                </>
              )}
              <InlineEdit value="" onSave={(v) => { const u = String(v || '').trim(); if (u && addImages([u])) toast.success('Image added.'); }} label={`Paste an image link for Direction ${letter}`} placeholder="Paste a link" className="ce-paste" />
            </Row>
          )}
        </Row>
        {items.length ? (
          <div className="ce-items">
            {items.map((it, i) => (
              <ItemCard key={it.id} item={it} letter={letter} index={i} count={items.length} readOnly={readOnly}
                onWrite={(next) => writeItems(items.map(x => (x.id === it.id ? { ...x, ...next } : x)))}
                onMove={(by) => moveItem(i, by)}
                onDelete={() => writeItems(items.filter(x => x.id !== it.id))}
                dragProps={!readOnly && desktop ? {
                  draggable: true,
                  onDragStart: () => { drag.current = i; },
                  onDragOver: (e) => e.preventDefault(),
                  onDrop: () => { const from = drag.current; drag.current = null; if (from == null || from === i) return; moveItem(from, i - from); },
                } : {}} />
            ))}
          </div>
        ) : <p className="ce-note">{COPY.concepts.editor.noImages}</p>}
      </div>
    </Card>
  );
}

/* ── The page ─────────────────────────────────────────────────────── */
export default function AdminConceptsEditor({
  lead, sets = [], projects = [], loading = false, error = false, onRetry, onCreate, onPatch, onPatchProject, onBack, setId: setIdProp = '', readOnly = false,
}) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const showSkel = useDelayedLoading(loading);
  const desktop = useMediaQuery('(hover: hover) and (pointer: fine)');
  useTopBar(null);

  const mine = useMemo(() => setsOf(sets, lead?._id), [sets, lead]);
  const byRound = useMemo(() => [...mine].sort((a, b) => (a.round || 0) - (b.round || 0)), [mine]);
  const [activeId, setActiveId] = useState(setIdProp);
  const active = mine.find(s => String(s._id) === String(activeId)) || mine.find(s => !s.archived) || mine[0] || null;
  useEffect(() => { if (setIdProp) setActiveId(setIdProp); }, [setIdProp]);

  const saved = useMemo(() => draftOf(active), [active]);
  const [draft, setDraft] = useState(saved);
  const dirty = !!active && !sameDraft(draft, saved);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const dragDir = useRef(null);

  /* Re-seed against the set the draft was seeded FROM (the Planner's
     lesson): a switch of set, or a record that changed underneath with no
     local edits, takes the stored copy; local edits stay. */
  const seededFrom = useRef(saved);
  const seededId = useRef(active?._id);
  useEffect(() => {
    if (seededFrom.current === saved && seededId.current === active?._id) return;
    const prev = seededFrom.current; const same = seededId.current === active?._id;
    seededFrom.current = saved; seededId.current = active?._id;
    setDraft(d => (!same || sameDraft(d, prev) ? saved : d));
  }, [saved, active]);

  const write = useCallback((next) => setDraft(d => ({ ...d, ...next })), []);
  const writeDirections = useCallback((next) => setDraft(d => ({ ...d, directions: next.map((x, i) => ({ ...x, order: i })) })), []);

  const save = useCallback(async () => {
    if (saving || !active) return false;
    setSaving(true);
    const ok = await onPatch(active._id, draft);
    setSaving(false);
    if (ok) toast.success('Saved.'); else toast.error(COPY.error.save);
    return ok;
  }, [saving, active, draft, onPatch, toast]);
  const saveFirst = useCallback(async () => (dirtyRef.current ? save() : true), [save]);

  const discard = useCallback(async () => {
    const yes = await confirm({ title: 'Discard changes?', body: 'Everything you changed since the last save goes back to what is stored.', confirmLabel: 'Discard', danger: true });
    if (yes) setDraft(saved);
  }, [confirm, saved]);
  const leave = useCallback(async () => {
    if (!dirtyRef.current) { onBack(); return; }
    const yes = await confirm({ title: 'Leave without saving?', body: 'Your changes to these concepts have not been saved yet.', confirmLabel: 'Leave', danger: true });
    if (yes) onBack();
  }, [confirm, onBack]);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (dirtyRef.current) save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);
  useEffect(() => {
    const onUnload = (e) => { if (!dirtyRef.current) return undefined; e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  /* Immediate actions. */
  const switchTo = useCallback(async (id) => {
    if (String(id) === String(active?._id)) return;
    if (dirtyRef.current) {
      const yes = await confirm({ title: 'Switch sets without saving?', body: 'Your changes to this set have not been saved yet.', confirmLabel: 'Switch', danger: true });
      if (!yes) return;
    }
    setActiveId(String(id));
  }, [active, confirm]);
  const newSet = useCallback(async () => {
    if (!lead || busy) return;
    if (!(await saveFirst())) return;
    setBusy(true);
    const item = await onCreate({ leadId: String(lead._id), title: '', round: 1, intro: '', directions: [blankDirection(0)] });
    setBusy(false);
    if (item) { setActiveId(String(item._id)); toast.success('New set started.'); } else toast.error(COPY.error.save);
  }, [lead, busy, saveFirst, onCreate, toast]);
  const nextRound = useCallback(async () => {
    if (!active || busy) return;
    if (!(await saveFirst())) return;
    setBusy(true);
    const item = await onCreate(nextRoundOf({ ...active, ...draft }));
    setBusy(false);
    if (item) { setActiveId(String(item._id)); toast.success(`Round ${item.round} started from round ${active.round}. It is a draft until you send it.`); }
    else toast.error(COPY.error.save);
  }, [active, busy, draft, saveFirst, onCreate, toast]);
  const send = useCallback(async () => {
    if (!active || busy) return;
    if (!(await saveFirst())) return;
    setBusy(true);
    const ok = await onPatch(active._id, { status: 'sent' });
    setBusy(false);
    if (ok) toast.success(COPY.concepts.editor.sent); else toast.error(COPY.error.save);
  }, [active, busy, saveFirst, onPatch, toast]);
  const regenerate = useCallback(async () => {
    if (!active) return;
    const yes = await confirm({ title: 'Make a new link?', body: 'The link they have stops working immediately. Anyone still holding the old one gets a not active page, and you will need to send them the new one.', confirmLabel: 'Make a new link', danger: true });
    if (!yes) return;
    const ok = await onPatch(active._id, { regenerate: true });
    if (ok) toast.success('New link made. The old one stopped working.'); else toast.error(COPY.error.save);
  }, [active, confirm, onPatch, toast]);
  const archive = useCallback(async () => {
    if (!active) return;
    const yes = await confirm({ title: 'Archive this set?', body: 'Their link stops working and the set leaves the list. Nothing is deleted; the feedback stays on the record.', confirmLabel: 'Archive', danger: true });
    if (!yes) return;
    const ok = await onPatch(active._id, { archived: true });
    if (ok) toast.success('Set archived.'); else toast.error(COPY.error.save);
  }, [active, confirm, onPatch, toast]);
  const copyLink = useCallback(async (url) => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copied.'); } catch { toast.error(COPY.error.copy); }
  }, [toast]);

  /* Directions. */
  const addDirection = () => { if (draft.directions.length < MAX_DIRECTIONS) writeDirections([...draft.directions, blankDirection(draft.directions.length)]); };
  const moveDirection = (i, by) => { const j = i + by; if (j < 0 || j >= draft.directions.length) return; const next = [...draft.directions]; const [d] = next.splice(i, 1); next.splice(j, 0, d); writeDirections(next); };
  const duplicateDirection = (i) => {
    if (draft.directions.length >= MAX_DIRECTIONS) return;
    const d = draft.directions[i];
    const copy = { ...d, id: blankDirection().id, name: d.name ? `${d.name} copy` : '', items: d.items.map((it, k) => ({ ...it, id: blankItem('').id, order: k })) };
    const next = [...draft.directions]; next.splice(i + 1, 0, copy); writeDirections(next);
  };
  const deleteDirection = async (i) => {
    const d = draft.directions[i];
    const yes = await confirm({ title: `Delete Direction ${letterOf(i)}?`, body: d.items.length ? `Its ${d.items.length} image${d.items.length === 1 ? '' : 's'} go with it. This is part of your draft until you save.` : 'This is part of your draft until you save.', confirmLabel: 'Delete', danger: true });
    if (yes) writeDirections(draft.directions.filter((_, k) => k !== i));
  };

  /* Revision awareness: the linked project, else the client's active one. */
  const leadProjects = useMemo(() => projectsOf(projects, lead?._id), [projects, lead]);
  const project = leadProjects.find(p => String(p._id) === String(draft.projectId)) || activeProject(projects, lead?._id);
  const logExtraRound = useCallback(async () => {
    if (!project) return;
    const fee = extraRoundFeeFor(project);
    const yes = await confirm({ title: 'Log an extra round?', body: `${money(fee)} lands on ${project.name}'s schedule as an unpaid line, and the round is written to its log.`, confirmLabel: 'Log the round' });
    if (!yes) return;
    const ok = await onPatchProject(project._id, roundLogPatch(project, { note: `Concepts round ${active?.round || 1}, from the editor`, extra: true }));
    if (ok) toast.success(`Extra round logged. ${money(fee)} added to the schedule.`); else toast.error(COPY.error.save);
  }, [project, confirm, onPatchProject, active, toast]);

  if (!lead) {
    return (
      <PageShell className="aa-main aa-main--wide">
        <ScrollArea wide>
          {loading
            ? <Section title="Concepts" description=" " loading><Stack gap={3}>{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={3} /></Card>)}</Stack></Section>
            : <EmptyState icon="LayersThree01" title="Record not found" description="That record is not in the list any more." action={<Button onClick={onBack}>Back</Button>} />}
        </ScrollArea>
      </PageShell>
    );
  }

  const name = lead.showcase?.displayName || lead.business || 'Client';
  const status = active ? statusOf(active) : null;
  const st = status ? conceptSetStatusOf(status) : null;
  const url = active ? publicUrl(active) : '';
  const isDraft = status === 'draft';
  const blocked = active ? sendBlockReason({ ...active, ...draft }) : 'No set yet.';
  const timeline = active ? timelineOf(active) : [];
  const approvedId = active?.approvedDirectionId || '';
  const used = project ? revisionsUsed(project) : 0;
  const max = project ? revisionsMax(project) : 0;
  const C = COPY.concepts.editor;

  return (
    <PageShell className="aa-main aa-main--wide pl-page sb-host">
      <ScrollArea wide className="pl-scroll">
        <div className="pl-topbar">
          <Row gap={2} align="center" justify="between" wrap>
            <Row gap={2} align="center" wrap style={{ minWidth: 0 }}>
              <Button variant="ghost" icon="ArrowLeft" onClick={leave}>Back</Button>
              <h1 className="pl-page-title lay-truncate">{name}</h1>
              {st && <Pill tone={st.tone} label={st.label} size="sm" icon={false} variant={status === 'approved' || status === 'changes' ? 'solid' : 'soft'} />}
            </Row>
            <Row gap={2} align="center" wrap>
              <Button variant="secondary" icon="LinkExternal01" disabled={!url || isDraft} title={isDraft ? C.previewDraft : undefined}
                onClick={() => window.open(url, '_blank', 'noopener')}>Preview</Button>
              <Button variant="secondary" icon="Monitor01" disabled={!url || isDraft} title={isDraft ? C.previewDraft : 'Opens the client page with the approve and feedback controls hidden, for showing in a meeting.'}
                onClick={() => window.open(`${url}?present=1`, '_blank', 'noopener')}>Present</Button>
            </Row>
          </Row>
        </div>

        <div className="pl-page-body">
          {error && !mine.length ? (
            <Card><ErrorState title={COPY.error.sets.title} description={COPY.error.sets.description} onRetry={onRetry} /></Card>
          ) : showSkel ? (
            <Stack gap={3} aria-busy="true">{[1, 2, 3].map(i => <Card key={i}><SkeletonText lines={3} /></Card>)}</Stack>
          ) : !active ? (
            <Card><EmptyState icon="LayersThree01" title={COPY.empty['concepts.lead'].title} description={COPY.empty['concepts.lead'].description}
              action={readOnly ? undefined : { label: COPY.empty['concepts.lead'].action, onClick: newSet }} /></Card>
          ) : (
            <Stagger className="v-stack" style={{ gap: 'var(--v-space-4)' }}>
              <Card className="ce-sets">
                <Row gap={2} align="center" justify="between" wrap>
                  <Tabs label="Sets" value={String(active._id)} onChange={switchTo}
                    tabs={byRound.map(s => ({ id: String(s._id), label: `Round ${s.round || 1}${s.archived ? ', archived' : ''}` }))} />
                  {!readOnly && (
                    <Row gap={2} align="center" wrap>
                      <Button size="md" variant="secondary" icon="Plus" onClick={newSet} loading={busy}>New set</Button>
                      <Button size="md" variant="secondary" icon="RefreshCw01" onClick={nextRound} loading={busy} disabled={!draft.directions.length}>Start next round</Button>
                    </Row>
                  )}
                </Row>
              </Card>

              <Card className="ce-setup">
                <p className="pb-card-h">Setup</p>
                <Input label="Title" value={draft.title} maxLength={120} disabled={readOnly} placeholder={`Concepts for ${name}`}
                  hint="The page heading. Leave it empty for the default." onChange={(e) => write({ title: e.target.value.slice(0, 120) })} />
                <Textarea label="Intro" rows={3} maxLength={600} value={draft.intro} disabled={readOnly}
                  placeholder="Here are three directions for the new look. Each one comes from what you told me on the call."
                  hint={`This is the first thing they read. ${draft.intro.length} of 600.`} onChange={(e) => write({ intro: e.target.value.slice(0, 600) })} />
                {leadProjects.length > 0 && (
                  <Select label="Linked project" hint="Optional. Revision rounds count against it." disabled={readOnly} value={draft.projectId}
                    options={[{ id: '', label: 'None' }, ...leadProjects.map(p => ({ id: String(p._id), label: p.name || 'Project' }))]}
                    onChange={(e) => write({ projectId: e.target.value })} />
                )}
              </Card>

              {draft.directions.map((d, i) => (
                <DirectionCard key={d.id} d={d} index={i} count={draft.directions.length} readOnly={readOnly} desktop={desktop}
                  onWrite={(next) => writeDirections(draft.directions.map(x => (x.id === d.id ? { ...x, ...next } : x)))}
                  onMove={(by) => moveDirection(i, by)} onDuplicate={() => duplicateDirection(i)} onDelete={() => deleteDirection(i)} />
              ))}
              {!readOnly && (
                <Row gap={2} align="center" wrap>
                  <Button variant="secondary" icon="Plus" onClick={addDirection} disabled={draft.directions.length >= MAX_DIRECTIONS} className="ce-add-dir">Add direction</Button>
                  {draft.directions.length >= MAX_DIRECTIONS && <span className="dt-muted">Six is the most a client can weigh at once.</span>}
                </Row>
              )}

              <Card className="ce-send">
                <p className="pb-card-h">Send</p>
                {isDraft ? (
                  <>
                    <Row gap={2} align="center" wrap>
                      <Button icon="Send01" onClick={send} disabled={!!blocked || readOnly} loading={busy}>Send to client</Button>
                      {blocked && <span className="ce-note">{blocked}</span>}
                    </Row>
                    <p className="ce-note">{C.sendHelp}</p>
                  </>
                ) : (
                  <>
                    <div className="v-field">
                      <span className="v-field-label">Their link</span>
                      <Row gap={1} align="center" wrap>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="sc-url lay-truncate">{url}</a>
                        <IconButton icon="Copy01" label="Copy concepts link" variant="ghost" onClick={() => copyLink(url)} />
                      </Row>
                      <p className="ce-note">{C.textIt}</p>
                    </div>
                    <Row gap={2} align="center" wrap>
                      <span className="dt-muted">{active.sentAt ? `Sent ${relativeTime(active.sentAt)}.` : ''} {active.lastViewedAt ? `Last opened ${relativeTime(active.lastViewedAt)}.` : 'Not opened yet.'}</span>
                    </Row>
                    {!readOnly && !active.archived && (
                      <Row gap={2} wrap>
                        <Button variant="secondary" size="md" icon="RefreshCw01" onClick={regenerate}>Make a new link</Button>
                        <Button variant="ghost" size="md" icon="Archive" onClick={archive}>Archive this set</Button>
                      </Row>
                    )}
                  </>
                )}
              </Card>

              <Card className="ce-feedback">
                <p className="pb-card-h">Feedback</p>
                {approvedId && (
                  <div className="ce-approved">
                    <Icon icon="Check" size={16} />
                    <span>{name} picked {directionLabel(active, approvedId)}{active.approvedAt ? `, ${relativeTime(active.approvedAt)}` : ''}.</span>
                  </div>
                )}
                {timeline.length ? (
                  <ol className="ce-timeline">
                    {timeline.map((f, i) => {
                      const a = conceptFeedbackActionOf(f.action);
                      return (
                        <li key={`${f.at}-${i}`} className={`ce-fb ce-fb--${f.action}`}>
                          <Row gap={2} align="center" wrap>
                            <Pill tone={a.tone} label={a.label} size="sm" icon={a.icon} variant={f.action === 'note' ? 'soft' : 'solid'} />
                            {f.directionId && <span className="ce-fb-dir">{directionLabel(active, f.directionId)}</span>}
                            <span className="dt-muted">{f.name ? `${f.name}, ` : ''}{fmtDateTime(f.at)}</span>
                          </Row>
                          {f.note && <p className="ce-fb-body">{f.note}</p>}
                        </li>
                      );
                    })}
                  </ol>
                ) : <p className="ce-note">{isDraft ? C.feedbackDraft : C.feedbackNone}</p>}
                {project && (
                  <div className={`ce-rounds${used >= max ? ' is-over' : ''}`}>
                    <Row gap={2} align="center" justify="between" wrap>
                      <span className="ce-rounds-h">Revision rounds on {project.name}: {used} of {max} used</span>
                      {!readOnly && <Button size="md" variant={used >= max ? 'primary' : 'secondary'} onClick={logExtraRound}>Log extra round on the project</Button>}
                    </Row>
                    {used >= max
                      ? <p className="ce-note">Both included rounds are used. The next one is {money(extraRoundFeeFor(project))} and lands on the schedule as an unpaid line. Never discount by cutting price.</p>
                      : <p className="ce-note">Each change request the client sends is usually one round. Log it on the project so the count stays honest.</p>}
                  </div>
                )}
              </Card>
            </Stagger>
          )}
        </div>
      </ScrollArea>

      <SaveBar open={dirty} saving={saving} onSave={save} onDiscard={discard} />
      {confirmDialog}
      <style>{saveBarStyles + imageFieldStyles + ceStyles}</style>
    </PageShell>
  );
}

export const ceStyles = `
  .pl-scroll { --v-scroll-extra: var(--sb-scroll-extra); }
  .pl-topbar { position: sticky; top: 0; z-index: 5; padding: var(--v-space-3) 0; background: var(--v-surface-1); border-bottom: 1px solid var(--v-border-1); }
  .pl-page-title { font-size: var(--v-text-lg); font-weight: 700; color: var(--v-text-1); margin: 0; min-width: 0; }
  .pl-page-body { padding-top: var(--v-space-4); }
  .ce-note { margin: var(--v-space-1) 0 0; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .ce-sets .v-tabs { border-bottom: 0; }
  .ce-letter {
    display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
    width: 32px; height: 32px; border-radius: var(--v-radius-md);
    background: var(--v-status-callback-soft); color: var(--v-status-callback-text); font-weight: var(--v-weight-bold); font-size: var(--v-text-sm);
  }
  .ce-dir-h { margin: 0; min-width: 0; }
  .ce-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--v-space-3); margin-top: var(--v-space-2); }
  @media (min-width: 768px) { .ce-items { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); } }
  .ce-item { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; padding: var(--v-space-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); background: var(--v-surface-2); }
  .ce-item-img { aspect-ratio: 1 / 1; background: var(--v-surface-3); border: 1px solid var(--v-border); }
  .ce-item-img img { object-fit: contain; }
  .ce-item-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--v-text-3); }
  .ce-item-n { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .ce-item-link { max-width: 100%; min-width: 0; }
  .ce-item-link .v-inline-text, .ce-paste .v-inline-text { font-size: var(--v-text-xs); }
  .ce-item-link .v-inline-text { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ce-approved {
    display: flex; align-items: center; gap: var(--v-space-2);
    padding: var(--v-space-2) var(--v-space-3); border-radius: var(--v-radius-md);
    background: var(--v-status-booked-soft); color: var(--v-status-booked-text); font-weight: var(--v-weight-bold); font-size: var(--v-text-sm);
  }
  .ce-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ce-fb { padding: var(--v-space-2) var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-surface-3); }
  .ce-fb--change { background: var(--v-status-danger-soft); }
  .ce-fb--approve { background: var(--v-status-booked-soft); }
  .ce-fb-dir { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .ce-fb-body { margin: var(--v-space-1) 0 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); overflow-wrap: anywhere; }
  .ce-rounds { padding: var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-surface-2); border: 1px solid var(--v-border); }
  .ce-rounds.is-over { border-color: var(--v-status-danger-text); }
  .ce-rounds-h { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
`;
