import { useEffect, useMemo, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import {
  PageShell, ScrollArea, Section, Stack, Row, Grid, Card, Chip, Pill, Avatar, Input, Textarea, Select, Button, IconButton, InlineEdit, Collapsible, ListRow, Sheet, EmptyState, Stagger, IconTile, SkeletonBlock, SkeletonText, useDelayedLoading, useMediaQuery, useToast,
} from '../ui';
import { useTopBar, useShell } from '../shell/ShellContext';
import LeadPicker from '../components/LeadPicker';
import { CONCEPT_KINDS, industryKey, displayIndustry } from '../shared/semantics';
import { relativeTime } from '../shared/dates';
import { uid } from '../lib/projects';

/* Concepts library (Prompt 11): packs of prompts and image links Rob copies
 * into ChatGPT before a meeting. Grid of PackCards; detail in a right panel
 * on desktop and a Sheet on mobile. */

const IMG_RX = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i;
export const isImageLink = (u) => IMG_RX.test(String(u || '')) || /googleusercontent|drive\.google\.com\/uc\?|imgur|cloudinary/i.test(String(u || ''));
const copyText = async (toast, text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error('Could not copy.'); } };
export function matchesPack(p, q) {
  const n = String(q || '').trim().toLowerCase(); if (!n) return true;
  return [p.title, ...(p.tags || []), ...(p.prompts || []).map(x => `${x.label} ${x.text}`), p.notes].join(' ').toLowerCase().includes(n);
}

export function PackCard({ pack: p, leads, onOpen, selected, compact = false }) {
  const lead = p.leadId ? leads?.find(l => String(l._id) === String(p.leadId)) : null;
  const thumbs = (p.images || []).filter(i => isImageLink(i.link)).slice(0, 3);
  return (
    <Card padding={3} interactive onClick={onOpen} selected={selected} className={`cp-card${compact ? ' cp-card--compact' : ''}`} aria-label={`Open ${p.title}`}>
      <Row gap={2} align="start"><Stack gap={1} style={{ flex: 1, minWidth: 0 }}><span className="cp-card-title">{p.title}</span><Row gap={1} wrap><Pill id={p.kind} list={CONCEPT_KINDS} size="sm" />{p.industryKey && <Pill tone="neutral" label={displayIndustry(p.industryKey)} size="sm" icon={false} variant="outline" />}</Row></Stack></Row>
      {!compact && <>
        <Row gap={2} wrap className="cp-card-meta"><span>{(p.prompts || []).length} prompt{(p.prompts || []).length === 1 ? '' : 's'}</span><span>{(p.images || []).length} image{(p.images || []).length === 1 ? '' : 's'}</span><span>{p.lastUsedAt ? `Used ${relativeTime(p.lastUsedAt)}` : 'Not shown yet'}</span>{lead && <span className="lay-truncate">{lead.business}</span>}</Row>
        {thumbs.length > 0 && <Row gap={1} className="cp-thumbs">{thumbs.map(i => <img key={i.id} src={i.link} alt={i.label || ''} className="cp-thumb" loading="lazy" />)}</Row>}
      </>}
    </Card>
  );
}
PackCard.Skeleton = function PackCardSkeleton() { return <Card padding={3} aria-busy="true"><SkeletonBlock width="70%" height={16} /><Row gap={1}><SkeletonBlock width={60} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width={90} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonText lines={1} /></Card>; };

/** PackPicker: the From library picker LeadDetail opens on a concept item. */
export function PackPicker({ packs = [], industry, onPick, onClose }) {
  const [q, setQ] = useState('');
  const key = industryKey(industry);
  const [all, setAll] = useState(false);
  const list = useMemo(() => packs.filter(p => !p.archived && matchesPack(p, q) && (all || !key || !p.industryKey || p.industryKey === key)), [packs, q, key, all]);
  return (
    <Sheet open onClose={onClose} title="From library" description={key && !all ? `Packs for ${displayIndustry(key)} and packs without an industry.` : 'Every pack.'} tall width={520}>
      <Stack gap={2}>
        <Row gap={2} align="center"><Input placeholder="Search packs" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search packs" data-autofocus />{key && <Chip label="All industries" selected={all} onClick={() => setAll(v => !v)} />}</Row>
        {list.length ? list.map(p => <ListRow key={p._id} leading={<IconTile icon={CONCEPT_KINDS.find(k => k.id === p.kind)?.icon || 'Image01'} tone="callback" size="sm" glow={false} />} title={p.title} subtitle={`${(p.prompts || []).length} prompts, ${(p.images || []).length} images${p.industryKey ? `, ${displayIndustry(p.industryKey)}` : ''}`} onClick={() => onPick(p)} />) : <EmptyState size="sm" icon="Image01" title="No pack matches" description="Build one in Concepts first." />}
      </Stack>
    </Sheet>
  );
}

/* ── Pack detail ───────────────────────────────────────────────── */
function PromptRow({ prompt, onChange, onRemove, onCopy, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`cp-prompt${open ? ' is-open' : ''}`}>
      <Row gap={1} align="center">
        <button type="button" className="cp-prompt-head" onClick={() => setOpen(o => !o)} aria-expanded={open}><ChevronDown width={16} height={16} className="cp-prompt-chev" /><span className="lay-truncate">{prompt.label || 'Untitled prompt'}</span></button>
        <IconButton icon={Copy01} label="Copy prompt" variant="secondary" onClick={onCopy} className="cp-copy" />
      </Row>
      <Collapsible open={open}>
        <Stack gap={2} className="cp-prompt-body">
          <InlineEdit value={prompt.label || ''} onSave={(v) => onChange({ label: v })} placeholder="Label" label="Prompt label" className="cp-prompt-label" />
          <InlineEdit value={prompt.text || ''} onSave={(v) => onChange({ text: v })} multiline placeholder="The prompt text" label="Prompt text" className="cp-prompt-text" />
          <Row gap={2} justify="end"><Button variant="ghost" size="md" icon="Trash01" onClick={onRemove}>Remove</Button></Row>
        </Stack>
      </Collapsible>
    </div>
  );
}

function PackDetail({ pack: p, leads, industries, onPatch, onPatchLead, onClose }) {
  const toast = useToast();
  const [pick, setPick] = useState(false);
  const [tag, setTag] = useState('');
  const [img, setImg] = useState({ label: '', link: '' });
  const [showImg, setShowImg] = useState(false);
  const lead = p.leadId ? leads.find(l => String(l._id) === String(p.leadId)) : null;
  const pp = (set) => onPatch(p._id, set);
  const prompts = p.prompts || [];
  const setPrompt = (id, patch) => pp({ prompts: prompts.map(x => (x.id === id ? { ...x, ...patch } : x)) });
  const markShown = async () => {
    if (!lead) return;
    const ok = await pp({ usedFor: [...new Set([...(p.usedFor || []), String(lead._id)])], lastUsedAt: new Date().toISOString() });
    if (!ok) return;
    const concepts = lead.concepts || [];
    const match = concepts.filter(c => c.label && (c.label.toLowerCase() === p.title.toLowerCase() || String(c.packId) === String(p._id)) && c.status !== 'shown');
    if (match.length && onPatchLead) await onPatchLead(lead._id, { concepts: concepts.map(c => (match.some(m => m.id === c.id) ? { ...c, status: 'shown' } : c)) });
    toast.success(`Marked shown to ${lead.business}${match.length ? ', concept updated' : ''}.`);
  };
  return (
    <Stack gap={4} className="cp-detail">
      <Card className="cp-head">
        <Row gap={2} align="start">
          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <InlineEdit value={p.title} onSave={(v) => pp({ title: v })} label="Pack title" className="cp-title" />
            <span className="dt-muted">{(p.usedFor || []).length} lead{(p.usedFor || []).length === 1 ? '' : 's'} shown{p.lastUsedAt ? `, last ${relativeTime(p.lastUsedAt)}` : ''}</span>
          </Stack>
          {onClose && <IconButton icon={XClose} label="Close" variant="ghost" onClick={onClose} />}
        </Row>
        <Grid minColumnWidth={150} gap={2}>
          <Select label="Kind" value={p.kind} onChange={(e) => pp({ kind: e.target.value })} options={CONCEPT_KINDS.map(k => ({ id: k.id, label: k.label }))} />
          <Select label="Industry" value={p.industryKey || ''} onChange={(e) => pp({ industryKey: e.target.value })} options={[{ id: '', label: 'Any industry' }, ...industries.map(k => ({ id: k, label: displayIndustry(k) }))]} />
        </Grid>
        <Row gap={2} align="center" wrap>
          <span className="dt-fact-label">Lead</span>
          {lead ? <Row gap={1} align="center"><Avatar name={lead.business} size="xs" /><span className="cp-lead lay-truncate">{lead.business}</span></Row> : <span className="dt-muted">None</span>}
          <Button variant="secondary" size="md" icon="Users01" onClick={() => setPick(true)} className="cp-link-lead">{lead ? 'Change' : 'Link a lead'}</Button>
          {lead && <Button size="md" icon={Check} onClick={markShown} className="cp-mark-shown">Mark shown to {lead.business.split(' ')[0]}</Button>}
        </Row>
        <Row gap={1} wrap align="center" className="cp-tags">
          {(p.tags || []).map(t => <Chip key={t} label={t} selected onClick={() => pp({ tags: p.tags.filter(x => x !== t) })} />)}
          <Input placeholder="Add tag" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = tag.trim().toLowerCase(); if (t) pp({ tags: [...new Set([...(p.tags || []), t])] }); setTag(''); } }} aria-label="Add tag" className="cp-tag-input" />
        </Row>
      </Card>
      <Card>
        <Row gap={2} justify="between" align="center"><p className="pb-card-h" style={{ margin: 0 }}>Prompts</p><Button variant="ghost" size="md" icon={Plus} onClick={() => pp({ prompts: [...prompts, { id: uid(), label: `Prompt ${prompts.length + 1}`, text: '' }] })} className="cp-add-prompt">Add prompt</Button></Row>
        <Stack gap={1}>
          {prompts.map((x, i) => <PromptRow key={x.id} prompt={x} defaultOpen={i === 0} onChange={(patch) => setPrompt(x.id, patch)} onRemove={() => pp({ prompts: prompts.filter(y => y.id !== x.id) })} onCopy={() => copyText(toast, x.text, x.label || 'Prompt')} />)}
          {!prompts.length && <p className="dt-muted">No prompts yet.</p>}
        </Stack>
      </Card>
      <Card>
        <Row gap={2} justify="between" align="center"><p className="pb-card-h" style={{ margin: 0 }}>Images</p><Button variant="ghost" size="md" icon={Plus} onClick={() => setShowImg(v => !v)}>{showImg ? 'Done' : 'Add image link'}</Button></Row>
        {showImg && <Row gap={2} wrap align="end"><Input label="Label" value={img.label} onChange={(e) => setImg(v => ({ ...v, label: e.target.value }))} placeholder="Direction 1" /><Input label="Link" value={img.link} onChange={(e) => setImg(v => ({ ...v, link: e.target.value }))} placeholder="https://" /><Button size="md" icon={Plus} disabled={!img.link.trim()} onClick={() => { pp({ images: [...(p.images || []), { id: uid(), label: img.label.trim(), link: img.link.trim() }] }); setImg({ label: '', link: '' }); }}>Add</Button></Row>}
        <Stack gap={1}>
          {(p.images || []).map(i => <ListRow key={i.id} leading={isImageLink(i.link) ? <img src={i.link} alt="" className="cp-thumb cp-thumb--sm" loading="lazy" /> : <IconTile icon="Image01" tone="neutral" size="sm" glow={false} />} title={i.label || i.link.replace(/^https?:\/\//, '')} subtitle={i.label ? i.link.replace(/^https?:\/\//, '') : undefined} trailing={<Row gap={0}><IconButton icon="LinkExternal01" label="Open image" variant="ghost" onClick={() => window.open(i.link, '_blank', 'noopener')} /><IconButton icon={XClose} label="Remove image" variant="ghost" onClick={() => pp({ images: p.images.filter(x => x.id !== i.id) })} /></Row>} chevron={false} />)}
          {!(p.images || []).length && <p className="dt-muted">No image links yet. Paste Drive or hosted links.</p>}
        </Stack>
      </Card>
      <Card><p className="pb-card-h">Notes</p><InlineEdit value={p.notes || ''} onSave={(v) => pp({ notes: v })} multiline placeholder="What works, what to avoid." label="Pack notes" /></Card>
      {pick && <LeadPicker leads={leads} title="Link a lead" onClose={() => setPick(false)} onPick={(l) => { setPick(false); pp({ leadId: String(l._id), ...(l.industry && !p.industryKey ? { industryKey: industryKey(l.industry) } : {}) }); }} />}
    </Stack>
  );
}

/* ── Screen ────────────────────────────────────────────────────── */
export default function AdminConcepts({ packs = [], loading, leads = [], onCreate, onPatch, onPatchLead, onRefresh, openId }) {
  const toast = useToast();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [selId, setSelId] = useState(null);
  const [kind, setKind] = useState('');
  const [ind, setInd] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', kind: 'logo', industryKey: '' });
  const [busy, setBusy] = useState(false);
  const showSkel = useDelayedLoading(loading);
  useTopBar(null);
  useEffect(() => { if (openId?.id) setSelId(openId.id); }, [openId]);

  const live = useMemo(() => packs.filter(p => !p.archived), [packs]);
  const industries = useMemo(() => [...new Set([...leads.map(l => industryKey(l.industry)), ...live.map(p => p.industryKey)].filter(Boolean))].sort(), [leads, live]);
  const list = useMemo(() => live.filter(p => (!kind || p.kind === kind) && (!ind || p.industryKey === ind) && matchesPack(p, q)), [live, kind, ind, q]);
  const sel = selId ? live.find(p => String(p._id) === String(selId)) : null;
  const kindCounts = useMemo(() => Object.fromEntries(CONCEPT_KINDS.map(k => [k.id, live.filter(p => p.kind === k.id).length])), [live]);
  const create = async () => { if (!draft.title.trim()) return; setBusy(true); const item = await onCreate?.({ ...draft, title: draft.title.trim(), prompts: [], images: [], tags: [], notes: '', usedFor: [] }); setBusy(false); if (item) { toast.success('Pack created.'); setCreating(false); setDraft({ title: '', kind: 'logo', industryKey: '' }); setSelId(item._id); } else toast.error('Could not create the pack.'); };
  const detail = sel && <PackDetail pack={sel} leads={leads} industries={industries} onPatch={onPatch} onPatchLead={onPatchLead} onClose={desktop ? () => setSelId(null) : undefined} />;

  return (
    <PageShell className={`aa-main aa-main--wide po-shell cp-shell${sel && desktop ? ' has-panel' : ''}`}>
      <div className="po-split">
        <ScrollArea wide className="po-page">
          <Section title="Concepts" description={showSkel ? undefined : `${live.length} pack${live.length === 1 ? '' : 's'}, ${live.reduce((n, p) => n + (p.prompts || []).length, 0)} prompts`} action={<Button icon={Plus} onClick={() => setCreating(true)} className="cp-new">New pack</Button>}>
            <Stack gap={2}>
              <Input className="cl-search" placeholder="Search title, tags, prompt text" value={q} onChange={(e) => setQ(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label="Search packs" trailing={q ? <button type="button" className="cl-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={14} height={14} /></button> : undefined} />
              <Row gap={2} wrap className="cp-kinds">{CONCEPT_KINDS.filter(k => kindCounts[k.id] || k.id === kind).map(k => <Chip key={k.id} label={k.label} count={kindCounts[k.id]} icon={k.icon} selected={kind === k.id} onClick={() => setKind(kind === k.id ? '' : k.id)} />)}</Row>
              {industries.length > 0 && <Row gap={2} wrap className="cp-inds">{industries.map(k => <Chip key={k} label={displayIndustry(k)} count={live.filter(p => p.industryKey === k).length} selected={ind === k} onClick={() => setInd(ind === k ? '' : k)} />)}</Row>}
            </Stack>
          </Section>
          {showSkel ? (
            <Grid minColumnWidth={240} gap={3} aria-busy="true">{[1, 2, 3].map(i => <PackCard.Skeleton key={i} />)}</Grid>
          ) : !live.length ? (
            <Card><EmptyState icon="Image01" title="No packs yet" description="A pack is a set of prompts and image links for one kind of concept. Start with the logo directions." action={{ label: 'New pack', icon: Plus, onClick: () => setCreating(true) }} /></Card>
          ) : !list.length ? (
            <Card><EmptyState size="sm" icon="SearchMd" title="Nothing in this filter" action={{ label: 'Show all', onClick: () => { setKind(''); setInd(''); setQ(''); } }} /></Card>
          ) : (
            <Stagger className={`cp-grid${sel && desktop ? ' is-narrow' : ''}`}>{list.map(p => <PackCard key={p._id} pack={p} leads={leads} onOpen={() => setSelId(p._id)} selected={sel && String(sel._id) === String(p._id)} compact={!!sel && desktop} />)}</Stagger>
          )}
          {!showSkel && <Row gap={2} justify="end"><Button variant="ghost" size="md" icon="RefreshCw01" onClick={onRefresh}>Refresh</Button></Row>}
        </ScrollArea>
        {sel && desktop && <aside className="po-panel"><ScrollArea bare className="po-panel-scroll">{detail}</ScrollArea></aside>}
      </div>
      {sel && !desktop && <Sheet open onClose={() => setSelId(null)} title={sel.title} tall width={520}>{detail}</Sheet>}
      {creating && <Sheet open onClose={() => setCreating(false)} title="New pack" width={460} footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button loading={busy} disabled={!draft.title.trim()} icon={Check} onClick={create}>Create</Button></>}>
        <Stack gap={3}>
          <Input label="Title" value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Barber shop logo directions" data-autofocus />
          <Select label="Kind" value={draft.kind} onChange={(e) => setDraft(d => ({ ...d, kind: e.target.value }))} options={CONCEPT_KINDS.map(k => ({ id: k.id, label: k.label }))} />
          <Select label="Industry" value={draft.industryKey} onChange={(e) => setDraft(d => ({ ...d, industryKey: e.target.value }))} options={[{ id: '', label: 'Any industry' }, ...industries.map(k => ({ id: k, label: displayIndustry(k) }))]} />
        </Stack>
      </Sheet>}
      <style>{cpStyles}</style>
    </PageShell>
  );
}

const cpStyles = `
  .cp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--v-space-3); min-width: 0; }
  .cp-grid.is-narrow { grid-template-columns: 1fr; }
  .cp-grid > .v-stagger-item { display: contents; }
  .cp-card { gap: var(--v-space-2); text-align: left; align-items: stretch; }
  .cp-card-title { font-weight: var(--v-weight-bold); color: var(--v-text); overflow-wrap: anywhere; }
  .cp-card-meta { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .cp-thumbs { min-width: 0; }
  .cp-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border); background: var(--v-surface-2); flex-shrink: 0; }
  .cp-thumb--sm { width: 36px; height: 36px; }
  .cp-detail { min-width: 0; }
  .cp-head { gap: var(--v-space-3); }
  .cp-title { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .cp-lead { font-weight: var(--v-weight-semibold); min-width: 0; }
  .cp-tag-input { max-width: 180px; }
  .cp-prompt { border: 1px solid var(--v-border); border-radius: var(--v-radius-md); padding: 0 var(--v-space-2); min-width: 0; }
  .cp-prompt-head { flex: 1; display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); min-width: 0; border: 0; background: transparent; color: var(--v-text); font: inherit; font-weight: var(--v-weight-semibold); text-align: left; cursor: pointer; padding: 0; }
  .cp-prompt-head:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-sm); }
  .cp-prompt-chev { flex-shrink: 0; transition: transform var(--v-dur-fast) var(--v-ease-out); color: var(--v-text-3); }
  .cp-prompt.is-open .cp-prompt-chev { transform: rotate(180deg); }
  .cp-prompt-body { padding: 0 0 var(--v-space-2); }
  .cp-prompt-label { font-weight: var(--v-weight-semibold); }
  .cp-prompt-text { font-size: var(--v-text-sm); color: var(--v-text-2); line-height: var(--v-lh-sm); }
`;
