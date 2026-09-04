import { useEffect, useMemo, useRef, useState } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import Trophy01 from '@untitled-ui/icons-react/build/esm/Trophy01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import {
  PageShell, ScrollArea, StickyFooterBar, Section, Stack, Row, Grid, Card, Button, IconButton, Pill, Avatar, Menu, Tabs, Tooltip, InlineEdit, ListRow, Sheet, Modal, Input, Select, Textarea, Checkbox, Toggle, Collapsible, ProgressBar, Stagger, useToast, useMediaQuery, EmptyState, IconTile,
} from '../ui';
import { useShell, useTopBar } from '../shell/ShellContext';
import LeadForm from './LeadForm';
import LeadHistory from './LeadHistory';
import LeadNotes from './LeadNotes';
import { ScriptSteps, Objections, CloseCards, IntelCards } from './LeadPlaybook';
import Checklists from './Checklists';
import LinkedSubmissions from './LinkedSubmissions';
import CallbackPicker from './CallbackPicker';
import { normalizeStage, CALL_STATUSES, PRIORITIES, STAGES, MEETING_TYPES, CONCEPT_STATUSES, CONCEPT_PRESETS, displayIndustry } from '../shared/semantics';
import { PACKAGES, RETAINERS, ADDONS, priceOption, planLine, defaultRetainer, money as fmtMoney } from '../shared/pricing';
import { formatPhone, telHref } from '../shared/phone';
import { fmtDate, fmtDateTime, relativeTime, countdownLabel } from '../shared/dates';
import { meetingDate } from '../lib/booked';
import { isNewLead } from '../lib/leads';
import { downloadIcs } from '../lib/ics';

/**
 * LeadDetail: ONE detail for Leads, Booked, and (read only until Prompt 10)
 * Clients. Stage aware: a lead shows the pipeline blocks; booked adds the
 * meeting workspace and the outcome bar; a client shows the same plus a link
 * to its client record.
 * @param {object} props
 * @param {object} props.lead
 * @param {Array} [props.submissions]
 * @param {Function} props.onPatch (id, set) => Promise<boolean>   optimistic with rollback (AdminApp)
 * @param {Function} [props.onDelete] (id) => Promise
 * @param {Function} [props.onLinkSubmission]
 * @param {Function} props.onClose back to the list
 * @param {boolean} [props.readOnly]
 */
const LS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const SOCIAL_ACTIONS = [['instagram', 'Camera01', 'Instagram'], ['facebook', 'ThumbsUp', 'Facebook'], ['website', 'Globe01', 'Website'], ['google', 'MarkerPin01', 'Maps']];
const uid = () => Math.random().toString(36).slice(2, 10);
const MEETING_SERVICES = [...PACKAGES.map(p => ({ id: p.id, label: p.label, price: p.price })), ...RETAINERS.map(r => ({ id: r.id, label: `${r.label} retainer`, price: r.price }))];

/* Editable list of strings with add, edit, remove, reorder (drag on desktop, menu on mobile). */
function ListEditor({ items, onChange, placeholder = 'Add a line' }) {
  const [draft, setDraft] = useState('');
  const drag = useRef(null);
  const desktop = useMediaQuery('(hover: hover) and (pointer: fine)');
  const move = (i, d) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...items, v]); setDraft(''); };
  return (
    <div className="dt-list">
      {items.map((t, i) => (
        <div key={i} className="dt-list-row" draggable={desktop} onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag.current == null || drag.current === i) return; const n = [...items]; const [x] = n.splice(drag.current, 1); n.splice(i, 0, x); drag.current = null; onChange(n); }}>
          <InlineEdit value={t} onSave={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} label="Line" className="dt-list-text" />
          <Menu label="Line actions" items={[{ id: 'up', label: 'Move up', icon: 'ChevronLeft', disabled: i === 0, onSelect: () => move(i, -1) }, { id: 'down', label: 'Move down', icon: 'ChevronDown', disabled: i === items.length - 1, onSelect: () => move(i, 1) }, 'divider', { id: 'rm', label: 'Remove', icon: 'Trash01', danger: true, onSelect: () => onChange(items.filter((_, j) => j !== i)) }]} />
        </div>
      ))}
      <Row gap={1}><Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><IconButton icon={Plus} label="Add" variant="secondary" onClick={add} /></Row>
    </div>
  );
}

function Fact({ label, value, onSave, placeholder = 'Add', inputMode, type, format, readOnly, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`dt-fact${onClick ? ' dt-fact--btn' : ''}`} type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className="dt-fact-label">{label}</span>
      {readOnly || onClick ? <span className="dt-fact-ro lay-truncate">{value || placeholder}</span> : <InlineEdit value={value || ''} onSave={onSave} placeholder={placeholder} inputMode={inputMode} type={type} format={format} label={label} className="dt-fact-edit" />}
    </Tag>
  );
}

function CallMode({ on, onChange }) { return <Toggle size="sm" checked={on} onChange={onChange} label="Call mode" />; }

/* A block that collapses to its one line summary in Call Mode. */
function Block({ title, summary, callMode, action, children }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(!callMode); }, [callMode]);
  return (
    <Card className="dt-block">
      <Row gap={2} align="center" className="dt-block-head">
        <button type="button" className="dt-block-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}><span className="pb-card-h" style={{ margin: 0 }}>{title}</span>{!open && summary && <span className="dt-block-sum lay-truncate">{summary}</span>}</button>
        {action}
      </Row>
      <Collapsible open={open}>{children}</Collapsible>
    </Card>
  );
}

export default function LeadDetail({ lead, submissions = [], onPatch, onDelete, onLinkSubmission, onClose, readOnly = false }) {
  const shell = useShell();
  const toast = useToast();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const stage = normalizeStage(lead);
  const booked = stage === 'booked' || stage === 'won' || stage === 'client';
  const [tab, setTab] = useState('overview');
  const [editAll, setEditAll] = useState(false);
  const [linkSheet, setLinkSheet] = useState(null); // { key, label }
  const [linkDraft, setLinkDraft] = useState('');
  const [cbOpen, setCbOpen] = useState(false);
  const [resched, setResched] = useState(false);
  const [outcome, setOutcome] = useState(null); // 'won' | 'lost'
  const [outcomeNote, setOutcomeNote] = useState('');
  const [callMode, setCallModeState] = useState(() => LS(`vz_callmode_${lead._id}`, false));
  const setCallMode = (v) => { setCallModeState(v); try { localStorage.setItem(`vz_callmode_${lead._id}`, JSON.stringify(v)); } catch { /* fine */ } };
  const refs = useRef({});
  useTopBar({ title: lead.business, back: onClose });
  useEffect(() => { setTab('overview'); setCallModeState(LS(`vz_callmode_${lead._id}`, false)); }, [lead._id]);

  const patch = (set) => (readOnly ? Promise.resolve(false) : onPatch(lead._id, set));
  const save = (key) => async (v) => patch({ [key]: v });
  const saveSocial = (key) => async (v) => patch({ socials: { ...(lead.socials || {}), [key]: v } });
  const jump = (id) => { setTab(id); refs.current[id]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); };

  /* Meeting */
  const mDate = meetingDate(lead);
  const legacyMeeting = !lead.meeting?.date && lead.afterCall?.meeting;
  const saveMeeting = (m) => patch({ meeting: { date: '', time: '', type: 'call', location: '', ...(lead.meeting || {}), ...m } });
  const concepts = lead.concepts || [];
  const conceptsReady = concepts.filter(c => c.status === 'ready' || c.status === 'shown').length;
  const gamePlan = lead.gamePlan || [];
  const gp = (id) => gamePlan.find(g => g.serviceId === id) || { serviceId: id, checked: false, note: '' };
  const setGp = (id, patchG) => patch({ gamePlan: gamePlan.some(g => g.serviceId === id) ? gamePlan.map(g => (g.serviceId === id ? { ...g, ...patchG } : g)) : [...gamePlan, { ...gp(id), ...patchG }] });

  /* Pricing options: builder shape, migrating old free-text options once. */
  const options = useMemo(() => (lead.pricingOptions || []).map(o => (o.packageId ? o : { id: o.id || uid(), packageId: '', addonIds: [], retainerId: '', recommended: false, note: [o.label, o.price ? fmtMoney(o.price) : '', o.retainer, o.notes].filter(Boolean).join(', ') })), [lead.pricingOptions]);
  const writeOptions = (next) => patch({ pricingOptions: next.slice(0, 3).map(o => { const p = priceOption(o); return { ...o, label: p.pkg?.label || o.label || '', price: p.total, plan: p.plan ? (p.plan.months === 12 ? '12mo' : '6mo') : 'full', retainer: p.retainer ? `${p.retainer.label} ${fmtMoney(p.retainer.price)}/mo` : '', notes: o.note || '' }; }) });
  const setOpt = (id, patchO) => writeOptions(options.map(o => (o.id === id ? { ...o, ...patchO, ...(patchO.packageId && !o.retainerId ? { retainerId: defaultRetainer(patchO.packageId) } : {}) } : patchO.recommended ? { ...o, recommended: false } : o)));

  /* Outcomes */
  const closeOut = async () => {
    const at = new Date().toISOString();
    const prevStage = lead.stage;
    if (outcome === 'won') {
      const ok = await patch({ stage: 'client', clientSince: at, bookedOutcome: { result: 'won', reason: outcomeNote.trim(), at } });
      if (ok) { toast.success(`${lead.business} is a client.`, { action: { label: 'Open in Clients', onClick: () => shell?.go('clients') } }); setOutcome(null); onClose?.(); }
    } else {
      const ok = await patch({ stage: 'lost', bookedOutcome: { result: 'lost', reason: outcomeNote.trim(), at } });
      if (ok) { toast.undo(`${lead.business} marked lost.`, () => onPatch(lead._id, { stage: prevStage || 'booked', bookedOutcome: { result: 'lost', reason: '', at: '' } }), { seconds: 6 }); setOutcome(null); onClose?.(); }
    }
  };

  const profile = (
    <Card className="dt-profile">
      <Row gap={3} align="start">
        <Avatar name={lead.business} size="lg" status={stage === 'client' ? 'booked' : undefined} />
        <Stack gap={1} style={{ flex: 1 }}>
          <h2 className="dt-biz">{lead.business}</h2>
          <InlineEdit value={lead.descriptor || ''} onSave={save('descriptor')} placeholder="Add a one-line descriptor" label="Descriptor" className="dt-desc" />
        </Stack>
      </Row>
      <Row gap={1} wrap>
        {isNewLead(lead) && <Pill tone="new" label="New" size="sm" variant="solid" icon={false} />}
        <Pill id={stage} list={STAGES} size="sm" variant="outline" />
        <Menu label="Change priority" trigger={<button type="button" className="dt-pillbtn" aria-label={`Priority ${lead.priority || 'warm'}, change`}><Pill id={lead.priority || 'warm'} size="sm" /></button>} items={PRIORITIES.map(p => ({ id: p.id, label: p.label, icon: p.icon, disabled: (lead.priority || 'warm') === p.id, onSelect: () => patch({ priority: p.id }) }))} />
        <Pill id={lead.callStatus || 'not-called'} list={CALL_STATUSES} size="sm" />
        <InlineEdit value={lead.industry || ''} onSave={save('industry')} placeholder="Add industry" label="Industry" format={(v) => (v ? displayIndustry(v) : '')} className="dt-inline-pill" />
      </Row>
      <Row gap={1} wrap className="dt-actions" aria-label="Actions">
        <IconButton icon="Phone" label={lead.phone ? `Call ${formatPhone(lead.phone)}` : 'Add a phone to call'} variant={lead.phone ? 'secondary' : 'ghost'} onClick={() => (lead.phone ? (window.location.href = telHref(lead.phone)) : setLinkSheet({ key: 'phone', label: 'Phone' }))} />
        <IconButton icon="MessageCircle01" label={lead.phone ? 'Text' : 'Add a phone to text'} variant={lead.phone ? 'secondary' : 'ghost'} onClick={() => (lead.phone ? (window.location.href = `sms:${String(lead.phone).replace(/[^0-9+]/g, '')}`) : setLinkSheet({ key: 'phone', label: 'Phone' }))} />
        <IconButton icon="Mail01" label={lead.email ? `Email ${lead.email}` : 'Add an email'} variant={lead.email ? 'secondary' : 'ghost'} onClick={() => (lead.email ? (window.location.href = `mailto:${lead.email}`) : setLinkSheet({ key: 'email', label: 'Email' }))} />
        {SOCIAL_ACTIONS.map(([k, icon, label]) => <IconButton key={k} icon={icon} label={lead.socials?.[k] ? label : `Add ${label}`} variant={lead.socials?.[k] ? 'secondary' : 'ghost'} onClick={() => (lead.socials?.[k] ? window.open(lead.socials[k], '_blank', 'noopener') : setLinkSheet({ key: k, label, social: true }))} />)}
        <IconButton icon="Copy01" label="Copy phone" variant="ghost" disabled={!lead.phone} onClick={async () => { try { await navigator.clipboard.writeText(formatPhone(lead.phone)); toast.success('Number copied.'); } catch { toast.error('Could not copy.'); } }} />
      </Row>
      <Row gap={2} wrap>
        <Button icon={PhoneCall01} onClick={() => shell?.go('calls', { ids: [lead._id], autostart: true })} disabled={!lead.phone}>Start call</Button>
        {!readOnly && <Button variant="secondary" icon={Edit02} onClick={() => setEditAll(true)} className="dt-editall">Edit all</Button>}
        {stage === 'client' && <Button variant="ghost" onClick={() => shell?.go('clients')}>Open client record</Button>}
      </Row>
      <Stack gap={1} className="dt-facts">
        <Fact label="Phone" value={formatPhone(lead.phone) || ''} onSave={save('phone')} inputMode="tel" placeholder="Add phone" readOnly={readOnly} />
        <Fact label="Ask for" value={lead.askFor} onSave={save('askFor')} placeholder="Who to ask for" readOnly={readOnly} />
        <Fact label="Phone note" value={lead.phoneNote} onSave={save('phoneNote')} placeholder="Front desk, extension" readOnly={readOnly} />
        <Fact label="Best window" value={lead.bestWindow} onSave={save('bestWindow')} placeholder="Before 8am or after 5pm" readOnly={readOnly} />
        <Fact label="Email" value={lead.email} onSave={save('email')} inputMode="email" type="email" placeholder="Add email" readOnly={readOnly} />
        <Fact label="Address" value={lead.address} onSave={save('address')} placeholder="Add address" readOnly={readOnly} />
        <Fact label="Source" value={lead.sourceId ? 'Nightly scraper' : 'Added by hand'} readOnly />
        <Fact label="Added" value={fmtDate(lead.createdAt) || ''} readOnly />
        <Fact label="Last scanned" value={lead.enrichment?.lastScanAt ? `${relativeTime(lead.enrichment.lastScanAt)}, ${lead.enrichment.scanCount || 1} scan${(lead.enrichment.scanCount || 1) === 1 ? '' : 's'}` : 'Never'} readOnly />
        <Fact label="Callback due" value={lead.callbackAt ? fmtDateTime(lead.callbackAt) : ''} placeholder={readOnly ? 'None' : 'Set a time'} onClick={readOnly ? undefined : () => setCbOpen(true)} />
      </Stack>
    </Card>
  );

  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'playbook', label: 'Playbook' }, ...(booked ? [{ id: 'meeting', label: 'Meeting' }] : []), { id: 'notes', label: 'Notes' }, { id: 'history', label: 'History', count: ((lead.callLog || []).length + (lead.contactLog || []).length) || undefined }];
  const sec = (id) => ({ ref: (el) => { refs.current[id] = el; }, id: `dt-${id}`, className: 'dt-sec' });

  const overview = (
    <section {...sec('overview')}>
      <Section title="Overview">
        <Card><p className="pb-card-h">The angle</p><InlineEdit value={lead.angle || ''} onSave={save('angle')} multiline placeholder="Why this lead, in your words." label="The angle" className="pb-say pb-say--edit" /></Card>
        <IntelCards lead={lead} onChange={readOnly ? undefined : (v) => patch({ intel: v })} ListEditor={ListEditor} />
        <Card><p className="pb-card-h">Before you dial</p>{readOnly ? <ul className="pb-list">{(lead.beforeYouDial || []).map((x, i) => <li key={i}>{x}</li>)}</ul> : <ListEditor items={lead.beforeYouDial || []} onChange={(v) => patch({ beforeYouDial: v })} placeholder="Add a pre-dial check" />}</Card>
      </Section>
    </section>
  );
  const playbook = (
    <section {...sec('playbook')}>
      <Section title="Playbook" description="Every line edits in place. Return to the ask after every objection.">
        <Card><p className="pb-card-h">Script</p><ScriptSteps lead={lead} onChange={readOnly ? undefined : (v) => patch({ script: v })} /></Card>
        <Card><p className="pb-card-h">Objections</p><Objections lead={lead} onChange={readOnly ? undefined : (v) => patch({ objections: v })} /></Card>
        <Card><p className="pb-card-h">Close</p><CloseCards lead={lead} onChange={readOnly ? undefined : (v) => patch({ close: v })} /></Card>
      </Section>
    </section>
  );
  const meetingSummary = mDate ? `${countdownLabel(mDate)}, ${fmtDateTime(mDate)}${lead.meeting?.type ? `, ${MEETING_TYPES.find(t => t.id === lead.meeting.type)?.label}` : ''}` : legacyMeeting ? `${lead.afterCall.meeting} (no date set)` : 'No date set';
  const meeting = booked && (
    <section {...sec('meeting')}>
      <Section title="Meeting" description={callMode ? 'Call mode: every block shows its one line.' : undefined} action={<CallMode on={callMode} onChange={setCallMode} />}>
        <Block title="When" summary={meetingSummary} callMode={callMode} action={<Row gap={1}><Button variant="secondary" icon={Calendar} onClick={() => setResched(true)} className="dt-resched">{mDate ? 'Reschedule' : 'Set date'}</Button>{mDate && <IconButton icon={Download01} label="Add to calendar (.ics)" variant="secondary" onClick={() => { if (!downloadIcs(lead)) toast.error('Set a date first.'); }} />}</Row>}>
          <Stack gap={2}>
            {mDate ? <Row gap={2} wrap><Pill tone={countdownLabel(mDate) === 'today' ? 'booked' : 'neutral'} label={countdownLabel(mDate)} size="sm" icon="CalendarCheck01" /><span className="dt-when">{fmtDateTime(mDate)}</span>{lead.meeting?.type && <Pill tone="progress" label={MEETING_TYPES.find(t => t.id === lead.meeting.type)?.label || lead.meeting.type} size="sm" variant="outline" icon={false} />}</Row> : <p className="dt-muted">{legacyMeeting ? `Logged as "${lead.afterCall.meeting}". Set the date to get a countdown and a calendar file.` : 'No date yet.'}</p>}
            <Fact label="Where or link" value={lead.meeting?.location} onSave={(v) => saveMeeting({ location: v })} placeholder="Zoom link, cafe, their shop" readOnly={readOnly} />
          </Stack>
        </Block>
        <Block title="Services game plan" summary={`${gamePlan.filter(g => g.checked).length} planned`} callMode={callMode}>
          <Stack gap={1}>{MEETING_SERVICES.map(s => { const g = gp(s.id); return <div key={s.id} className="dt-gp"><Checkbox checked={g.checked} onChange={(v) => setGp(s.id, { checked: v })} label={`${s.label} (${fmtMoney(s.price)})`} disabled={readOnly} />{g.checked && <InlineEdit value={g.note || ''} onSave={(v) => setGp(s.id, { note: v })} placeholder="Note for the meeting" label={`${s.label} note`} className="dt-gp-note" />}</div>; })}</Stack>
        </Block>
        <Block title="Pricing options" summary={options.length ? `${options.length} option${options.length === 1 ? '' : 's'}${options.some(o => o.recommended) ? ', one recommended' : ''}` : 'None yet'} callMode={callMode} action={options.length < 3 && !readOnly && <Button variant="ghost" icon={Plus} onClick={() => writeOptions([...options, { id: uid(), packageId: PACKAGES[2].id, addonIds: [], retainerId: defaultRetainer(PACKAGES[2].id), recommended: !options.length, note: '' }])} className="dt-addopt">Add option</Button>}>
          {options.length ? (
            <Grid minColumnWidth={260} gap={3} className="dt-opts">
              {options.map((o, i) => { const p = priceOption(o); return (
                <Card key={o.id} level={2} className={`dt-opt${o.recommended ? ' is-rec' : ''}`} glow={o.recommended ? 'won' : undefined}>
                  <Row gap={2} justify="between"><span className="pb-card-h" style={{ margin: 0 }}>Option {i + 1}</span>{o.recommended && <Pill tone="won" label="Recommended" size="sm" icon="Star01" variant="solid" />}</Row>
                  <Select label="Package" value={o.packageId} onChange={(e) => setOpt(o.id, { packageId: e.target.value })} options={PACKAGES.map(pk => ({ id: pk.id, label: `${pk.label} (${fmtMoney(pk.price)})` }))} placeholder="Pick a package" disabled={readOnly} />
                  {p.pkg && <ul className="pb-list">{p.included.map((x, j) => <li key={j}>{x}</li>)}</ul>}
                  <div className="v-field"><span className="v-field-label">Add-ons</span><Stack gap={0}>{ADDONS.map(a => <Checkbox key={a.id} checked={(o.addonIds || []).includes(a.id)} onChange={(v) => setOpt(o.id, { addonIds: v ? [...(o.addonIds || []), a.id] : (o.addonIds || []).filter(x => x !== a.id) })} label={`${a.label} (${p.free.some(f => f.id === a.id) ? 'free' : fmtMoney(a.price)})`} disabled={readOnly} />)}</Stack></div>
                  <Select label="Retainer" value={o.retainerId || defaultRetainer(o.packageId)} onChange={(e) => setOpt(o.id, { retainerId: e.target.value })} options={RETAINERS.map(r => ({ id: r.id, label: `${r.label} (${fmtMoney(r.price)} a month)` }))} disabled={readOnly} />
                  <div className="dt-opt-total"><span className="dt-opt-n">{fmtMoney(p.total)}</span>{p.plan && <span className="dt-opt-plan">{planLine(p.plan)}</span>}{p.free.length > 0 && <span className="dt-opt-gift">Free: {p.free.map(f => f.label).join(', ')}</span>}{p.retainer && <span className="dt-opt-ret">Retainer: {p.retainer.label}, {fmtMoney(p.retainer.price)} a month</span>}</div>
                  <InlineEdit value={o.note || ''} onSave={(v) => setOpt(o.id, { note: v })} placeholder="Add a note" label="Option note" multiline />
                  <Row gap={2} justify="between"><Toggle size="sm" checked={!!o.recommended} onChange={(v) => setOpt(o.id, { recommended: v })} label="Recommended" disabled={readOnly} />{!readOnly && <IconButton icon={Trash01} label="Remove option" variant="danger" onClick={() => writeOptions(options.filter(x => x.id !== o.id))} />}</Row>
                </Card>); })}
            </Grid>
          ) : <EmptyState size="sm" icon="CurrencyDollar" title="No pricing options yet" description="Build up to three from the packages. Anything over $750 shows its payment plan." action={!readOnly ? { label: 'Add option', icon: Plus, onClick: () => writeOptions([{ id: uid(), packageId: PACKAGES[2].id, addonIds: [], retainerId: defaultRetainer(PACKAGES[2].id), recommended: true, note: '' }]) } : undefined} />}
        </Block>
        <Block title="Concepts" summary={`${conceptsReady} of ${concepts.length} ready`} callMode={callMode} action={!readOnly && <Row gap={1}>{!concepts.length && <Button variant="ghost" onClick={() => patch({ concepts: CONCEPT_PRESETS.map(l => ({ id: uid(), label: l, status: 'planned', link: '' })) })}>Add the usual five</Button>}<Button variant="ghost" icon={Plus} onClick={() => patch({ concepts: [...concepts, { id: uid(), label: 'New concept', status: 'planned', link: '' }] })}>Add</Button></Row>}>
          <Stack gap={2}>
            {concepts.length > 0 && <ProgressBar value={Math.round((conceptsReady / concepts.length) * 100)} tone="booked" size="sm" />}
            {concepts.map(c => (
              <Card key={c.id} level={2} padding={3} className="dt-concept">
                <Row gap={2} wrap>
                  <IconTile icon="Image01" tone={CONCEPT_STATUSES.find(s => s.id === c.status) ? c.status === 'planned' ? 'neutral' : c.status === 'generating' ? 'progress' : c.status === 'ready' ? 'booked' : 'won' : 'neutral'} size="sm" glow={false} />
                  <InlineEdit value={c.label} onSave={(v) => patch({ concepts: concepts.map(x => (x.id === c.id ? { ...x, label: v } : x)) })} label="Concept" className="dt-concept-label" />
                  <span style={{ flex: 1 }} />
                  <Menu label="Status" trigger={<button type="button" className="dt-pillbtn"><Pill id={c.status} list={CONCEPT_STATUSES} size="sm" /></button>} items={[...CONCEPT_STATUSES.map(s => ({ id: s.id, label: s.label, disabled: s.id === c.status, onSelect: () => patch({ concepts: concepts.map(x => (x.id === c.id ? { ...x, status: s.id } : x)) }) })), 'divider', { id: 'rm', label: 'Remove', icon: 'Trash01', danger: true, onSelect: () => patch({ concepts: concepts.filter(x => x.id !== c.id) }) }]} />
                </Row>
                {c.link ? <Button variant="secondary" full href={c.link} target="_blank" rel="noopener noreferrer" iconEnd="ArrowRight" className="dt-concept-link">Open {c.label}</Button> : <InlineEdit value="" onSave={(v) => patch({ concepts: concepts.map(x => (x.id === c.id ? { ...x, link: v } : x)) })} placeholder="Paste a link" label={`${c.label} link`} />}
              </Card>
            ))}
            {!concepts.length && <p className="dt-muted">Nothing tracked yet.</p>}
          </Stack>
        </Block>
        <Block title="Prep notes" summary={(lead.prepNotes || '').split('\n')[0] || 'Empty'} callMode={callMode}>
          <LeadNotes lead={lead} field="prepNotes" onSave={(id, v) => onPatch(id, { prepNotes: v })} placeholder="What to show, what to ask, what to avoid." />
        </Block>
      </Section>
    </section>
  );
  const notes = (
    <section {...sec('notes')}>
      <Section title="Notes"><Card><LeadNotes lead={lead} onSave={(id, v) => onPatch(id, { notes: v })} /></Card>
        <Card><p className="pb-card-h">Checklists</p><Checklists lead={lead} onPatch={onPatch} /></Card>
      </Section>
    </section>
  );
  const history = (
    <section {...sec('history')}>
      <Section title="History"><Card><LeadHistory lead={lead} /></Card>
        <Card><p className="pb-card-h">Their site submissions</p><LinkedSubmissions lead={lead} submissions={submissions} onLinkSubmission={onLinkSubmission} /></Card>
      </Section>
    </section>
  );
  const subnav = <div className="dt-subnav"><Tabs label="Sections" tabs={tabs} value={tab} onChange={jump} /></div>;
  const sections = <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>{overview}{playbook}{meeting}{notes}{history}</Stagger>;

  return (
    <PageShell className="dt">
      <ScrollArea bare className="dt-scroll" key={lead._id}>
        <div className="dt-inner">
          {desktop ? (
            <div className="dt-cols"><div className="dt-left">{profile}</div><div className="dt-right">{subnav}{sections}</div></div>
          ) : (
            <>{profile}{subnav}{sections}</>
          )}
        </div>
      </ScrollArea>
      {stage === 'booked' && !readOnly && (
        <StickyFooterBar className="dt-outbar">
          <Row gap={2} className="dt-outbar-row">
            <Button icon={Trophy01} onClick={() => { setOutcomeNote(''); setOutcome('won'); }} className="dt-won">Mark as won</Button>
            <Button variant="danger" icon={XClose} onClick={() => { setOutcomeNote(''); setOutcome('lost'); }}>Mark as lost</Button>
            <Button variant="secondary" icon={Calendar} onClick={() => setResched(true)}>Reschedule</Button>
          </Row>
        </StickyFooterBar>
      )}
      {editAll && <Sheet open onClose={() => setEditAll(false)} title="Edit lead" description={lead.business} tall width={640}><LeadForm lead={lead} onSave={async (v) => { const ok = await onPatch(lead._id, v); if (ok) setEditAll(false); }} onCancel={() => setEditAll(false)} onDelete={onDelete ? async (id) => { await onDelete(id); setEditAll(false); } : undefined} /></Sheet>}
      {linkSheet && (
        <Modal open onClose={() => setLinkSheet(null)} title={`Add ${linkSheet.label}`} footer={<><Button variant="ghost" onClick={() => setLinkSheet(null)}>Cancel</Button><Button onClick={async () => { const v = linkDraft.trim(); if (!v) return; const ok = linkSheet.social ? await saveSocial(linkSheet.key)(v) : await patch({ [linkSheet.key]: v }); if (ok) { setLinkSheet(null); setLinkDraft(''); } }}>Save</Button></>}>
          <Input label={linkSheet.label} value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} placeholder={linkSheet.social ? 'Handle or URL' : ''} inputMode={linkSheet.key === 'phone' ? 'tel' : linkSheet.key === 'email' ? 'email' : undefined} data-autofocus />
        </Modal>
      )}
      {cbOpen && <CallbackPicker open onClose={() => setCbOpen(false)} value={lead.callbackAt} business={lead.business} onSave={async (v) => { const ok = await patch({ callbackAt: v || '' }); if (ok) { setCbOpen(false); toast.success(v ? `Callback set for ${fmtDateTime(v)}.` : 'Callback cleared.'); } }} />}
      {resched && <RescheduleSheet lead={lead} onClose={() => setResched(false)} onSave={async (m) => { const ok = await saveMeeting(m); if (ok) { setResched(false); toast.success('Meeting updated.'); } }} />}
      <Modal open={!!outcome} onClose={() => setOutcome(null)} title={outcome === 'won' ? `Mark ${lead.business} as won?` : `Mark ${lead.business} as lost?`} danger={outcome === 'lost'} description={outcome === 'won' ? 'They become a client now, with everything here kept.' : 'They leave Booked. Undo is available for six seconds.'}
        footer={<><Button variant="ghost" onClick={() => setOutcome(null)}>Cancel</Button><Button variant={outcome === 'lost' ? 'danger' : 'primary'} icon={outcome === 'won' ? Trophy01 : XClose} onClick={closeOut}>{outcome === 'won' ? 'Won, convert to client' : 'Mark lost'}</Button></>}>
        <Textarea label="Note (optional)" rows={2} value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} placeholder={outcome === 'won' ? 'Went with Web Complete plus Site Care.' : 'Chose their nephew.'} data-autofocus />
      </Modal>
    </PageShell>
  );
}

function RescheduleSheet({ lead, onClose, onSave }) {
  const m = lead.meeting || {};
  const [date, setDate] = useState(m.date || '');
  const [time, setTime] = useState(m.time || '09:00');
  const [type, setType] = useState(m.type || 'call');
  const [location, setLocation] = useState(m.location || '');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} title={m.date ? 'Reschedule' : 'Set the meeting'} description={lead.business} className="dt-resched-sheet"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} onClick={async () => { setBusy(true); try { await onSave({ date, time, type, location }); } finally { setBusy(false); } }} disabled={!date}>Save</Button></>}>
      <Grid minColumnWidth={140} gap={2}><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-autofocus /><Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Grid>
      <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={MEETING_TYPES.map(t => ({ id: t.id, label: t.label }))} />
      <Input label="Where or link" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Zoom link, cafe, their shop" />
    </Sheet>
  );
}

/* leadDetailStyles lives in src/ui/lead.styles.js (uiStyles). */
