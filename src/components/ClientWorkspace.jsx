import { useEffect, useMemo, useRef, useState } from 'react';
import { COPY } from '../shared/copy';
import { durationMs } from '../ui/motion';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import {
  Section, Stack, Row, Grid, Card, Button, IconButton, Pill, Menu, InlineEdit, ListRow, Sheet, Modal, Input, Select, Textarea, Checkbox, Toggle, Collapsible, ProgressBar, EmptyState, IconTile, Table, Icon, useToast, useConfirm, useMediaQuery,
} from '../ui';
import { PROJECT_STAGES, PROJECT_KINDS, SCHEDULE_STATUSES, RETAINER_STATUSES, projectStageOf, industryKey, REVIEW_CHANNELS, TESTIMONIAL_SOURCES, TESTIMONIAL_SOURCE_IDS } from '../shared/semantics';
import { PACKAGES, RETAINERS, ADDONS, retainerOf, planLine, REVISION_ROUNDS } from '../shared/pricing';
import { money } from '../shared/format';
import { fmtDate, fmtDateTime } from '../shared/dates';
import { cloudinaryEnabled, uploadToCloudinary } from '../lib/cloudinary';
import {
  uid, today, monthKey, monthLabel, addMonths, localDate, stagesFor, nextStage, retainerSchedule, scheduleStatus, scheduleTotal, paidTotal, owedTotal, isFullyPaid, nextUnpaid, paidPct,
  planMonth, planRemaining, planReminderDue, revisionsUsed, extraRounds, revisionsMax, revisionsExhausted, extraRoundFeeFor, deliverBlockReason, releaseBlockReason, isActiveProject,
  DELIVERABLE_GROUPS, deliverablesFor, DELIVERY_STEPS, FOLLOW_UP_DAYS, retainerMonthly, isOnRetainer, cancelAtFor, monthRecord, projectsOf, brandText, isHex, buildProject, buildRetainerProject, CANCEL_NOTICE_DAYS,
} from '../lib/projects';

/* Client workspace (Prompt 10): the blocks LeadDetail renders in client mode.
 *   ClientLinks, ClientBrand           profile column cards
 *   ClientSections                     Projects, Payments, Retainer, Deliverables sections
 *   ShowcaseSection                    Site Prompt 2 Part 2: the public showcase editor
 * Every rule lives in src/lib/projects.js; this file only renders and writes. */

const fmtDay = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''; };
const fmtDayShort = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };
const copyText = async (toast, text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error(COPY.error.copy); } };
const E = (k) => COPY.empty[k];

/* ── Links block ─────────────────────────────────────────────────── */
const LINKS = [['website', 'Website', 'Globe01'], ['drive', 'Google Drive', 'Folder'], ['clickup', 'ClickUp', 'Columns03'], ['instagram', 'Instagram', 'Camera01']];
export function ClientLinks({ lead, patch, patchRaw, readOnly }) {
  const toast = useToast();
  const write = patchRaw || patch;
  const links = lead.links || {};
  const valueOf = (k) => links[k] || (k === 'website' ? lead.socials?.website : k === 'instagram' ? lead.socials?.instagram : '') || '';
  const save = (k) => (v) => write({ links: { website: '', drive: '', clickup: '', instagram: '', ...links, [k]: v } });
  return (
    <Card className="cw-links">
      <p className="pb-card-h">Links</p>
      <Stack gap={1}>
        {LINKS.map(([k, label, icon]) => { const v = valueOf(k); return (
          <div key={k} className={`cw-link${v ? ' has-value' : ''}`}>
            {v ? <a className="cw-link-btn" href={v} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label}`}><IconTile icon={icon} tone={v ? 'progress' : 'neutral'} size="sm" glow={false} /><span className="cw-link-label">{label}</span></a>
              : <span className="cw-link-btn"><IconTile icon={icon} tone="neutral" size="sm" glow={false} /><span className="cw-link-label">{label}</span></span>}
            <span className="cw-link-edit">{readOnly ? <span className="dt-fact-ro lay-truncate">{v || 'None'}</span> : <InlineEdit value={links[k] || ''} onSave={save(k)} placeholder={v ? v : 'Paste a link'} label={`${label} link`} className="cw-link-field" />}</span>
            <IconButton icon={Copy01} label={`Copy ${label}`} variant="ghost" disabled={!v} onClick={() => copyText(toast, v, label)} />
          </div>
        ); })}
      </Stack>
    </Card>
  );
}

/* ── Brand block ─────────────────────────────────────────────────── */
function Swatch({ value, label, onSave, readOnly }) {
  const ok = isHex(value);
  return (
    <div className="cw-swatch">
      <span className="cw-swatch-chip" style={ok ? { background: value } : undefined} aria-hidden="true">{!ok && <span className="cw-swatch-x" />}</span>
      {readOnly ? <span className="dt-fact-ro">{value || 'None'}</span> : <InlineEdit value={value || ''} onSave={async (v) => { const t = v.trim(); if (t && !isHex(t)) return false; return onSave(t); }} placeholder={label} label={label} className="cw-swatch-edit" errorMessage="Use a six digit hex color." />}
    </div>
  );
}
export function ClientBrand({ lead, patch, patchRaw, readOnly }) {
  const toast = useToast();
  const b = { primary: '', colors: [], fontDisplay: '', fontBody: '', logoLink: '', notes: '', ...(lead.brand || {}) };
  const write = (next) => (patchRaw || patch)({ brand: { ...b, ...next } });
  const colors = [0, 1, 2, 3].map(i => b.colors[i] || '');
  return (
    <Card className="cw-brand">
      <Row gap={2} justify="between" align="center"><p className="pb-card-h" style={{ margin: 0 }}>Brand</p><Button variant="ghost" icon={Copy01} onClick={() => copyText(toast, brandText(lead), 'Brand block')} className="cw-copy-brand">Copy brand</Button></Row>
      <Stack gap={2}>
        <div className="cw-brand-row"><span className="dt-fact-label">Primary</span><Swatch value={b.primary} label="Primary hex" onSave={(v) => write({ primary: v })} readOnly={readOnly} /></div>
        <div className="cw-brand-row"><span className="dt-fact-label">Secondary</span><div className="cw-swatches">{colors.map((c, i) => <Swatch key={i} value={c} label={`Color ${i + 1}`} onSave={(v) => { const n = [...colors]; n[i] = v; write({ colors: n.map(x => x || '').filter((x, j) => x || j < colors.filter(Boolean).length) }); }} readOnly={readOnly} />)}</div></div>
        <div className="cw-brand-row"><span className="dt-fact-label">Display font</span>{readOnly ? <span className="dt-fact-ro">{b.fontDisplay || 'None'}</span> : <InlineEdit value={b.fontDisplay} onSave={(v) => write({ fontDisplay: v })} placeholder="Barlow Condensed" label="Display font" className="dt-fact-edit" />}</div>
        <div className="cw-brand-row"><span className="dt-fact-label">Body font</span>{readOnly ? <span className="dt-fact-ro">{b.fontBody || 'None'}</span> : <InlineEdit value={b.fontBody} onSave={(v) => write({ fontBody: v })} placeholder="Inter" label="Body font" className="dt-fact-edit" />}</div>
        <div className="cw-brand-row"><span className="dt-fact-label">Logo</span>{readOnly ? <span className="dt-fact-ro lay-truncate">{b.logoLink || 'None'}</span> : <InlineEdit value={b.logoLink} onSave={(v) => write({ logoLink: v })} placeholder="Drive link to the logo files" label="Logo link" className="dt-fact-edit" />}</div>
        <div className="cw-brand-row"><span className="dt-fact-label">Notes</span>{readOnly ? <span className="dt-fact-ro">{b.notes || 'None'}</span> : <InlineEdit value={b.notes} onSave={(v) => write({ notes: v })} placeholder="One line: tone, do and do not" label="Brand notes" className="dt-fact-edit" />}</div>
      </Stack>
    </Card>
  );
}

/* ── Stepper ─────────────────────────────────────────────────────── */
function Stepper({ project }) {
  const stages = project.stages?.length ? project.stages : stagesFor(project.kind);
  const cur = stages.indexOf(project.stage);
  return (
    <ol className="cw-stepper" aria-label="Stages" tabIndex={0}>
      {stages.map((s, i) => <li key={s} className={`cw-step${i < cur ? ' is-done' : ''}${i === cur ? ' is-current' : ''}`}><span className="cw-step-dot" aria-hidden="true">{i < cur ? <Check width={10} height={10} /> : i + 1}</span><span className="cw-step-label">{projectStageOf(s).label}</span></li>)}
    </ol>
  );
}

/* ── New project sheet ───────────────────────────────────────────── */
function NewProjectSheet({ lead, onClose, onCreate }) {
  const [mode, setMode] = useState('package');
  const [packageId, setPackageId] = useState(PACKAGES[2].id);
  const [addonIds, setAddonIds] = useState([]);
  const [custom, setCustom] = useState({ name: '', total: '', kind: 'brand' });
  const [start, setStart] = useState(today());
  const [drive, setDrive] = useState(lead.links?.drive || '');
  const [clickup, setClickup] = useState(lead.links?.clickup || '');
  const [busy, setBusy] = useState(false);
  const pick = mode === 'package' ? { packageId } : mode === 'addons' ? { addonIds } : { custom: { ...custom, total: Number(custom.total) || 0 } };
  const preview = useMemo(() => buildProject(lead._id, pick, { startDate: start, drive, clickup }), [lead._id, mode, packageId, addonIds, custom, start, drive, clickup]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = mode === 'package' ? !!packageId : mode === 'addons' ? addonIds.length > 0 : !!custom.name.trim() && Number(custom.total) > 0;
  return (
    <Sheet open onClose={onClose} title="New project" description={lead.business} tall width={560} className="cw-sheet"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!valid} onClick={async () => { setBusy(true); try { await onCreate(preview); } finally { setBusy(false); } }}>Create</Button></>}>
      <Stack gap={4}>
        <Select label="What" value={mode} onChange={(e) => setMode(e.target.value)} options={[{ id: 'package', label: 'A package' }, { id: 'addons', label: 'An add-on set (print)' }, { id: 'custom', label: 'Custom' }]} />
        {mode === 'package' && <Select label="Package" value={packageId} onChange={(e) => setPackageId(e.target.value)} options={PACKAGES.map(p => ({ id: p.id, label: `${p.label} (${money(p.price)})` }))} data-autofocus />}
        {mode === 'addons' && <div className="v-field"><span className="v-field-label">Add-ons</span><Stack gap={0}>{ADDONS.map(a => <Checkbox key={a.id} label={`${a.label} (${money(a.price)})`} checked={addonIds.includes(a.id)} onChange={(v) => setAddonIds(v ? [...addonIds, a.id] : addonIds.filter(x => x !== a.id))} />)}</Stack></div>}
        {mode === 'custom' && <Grid minColumnWidth={160} gap={2}><Input label="Name" value={custom.name} onChange={(e) => setCustom(c => ({ ...c, name: e.target.value }))} data-autofocus /><Input label="Total" type="number" inputMode="decimal" value={custom.total} onChange={(e) => setCustom(c => ({ ...c, total: e.target.value }))} /><Select label="Kind" value={custom.kind} onChange={(e) => setCustom(c => ({ ...c, kind: e.target.value }))} options={PROJECT_KINDS.filter(k => k.id !== 'retainer').map(k => ({ id: k.id, label: k.label }))} /></Grid>}
        <Grid minColumnWidth={160} gap={2}><Input label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} hint="The first payment starts the project." /></Grid>
        <Card level={2} padding={3} className="cw-preview">
          <Row gap={2} justify="between" align="center"><span className="pb-card-h" style={{ margin: 0 }}>{preview.name || 'Project'}</span><Pill id={preview.kind} list={PROJECT_KINDS} size="sm" /></Row>
          <span className="dt-opt-n">{money(preview.total)}</span>
          <p className="dt-muted">{preview.plan ? planLine({ ...preview.plan, total: preview.total, alt: null }) : 'One payment, due at the start.'}</p>
          <Stack gap={0}>{preview.schedule.map(s => <Row key={s.id} gap={2} justify="between" className="cw-preview-row"><span>{s.label}</span><span>{money(s.amount)}, {fmtDayShort(s.dueAt)}</span></Row>)}</Stack>
        </Card>
        <Grid minColumnWidth={200} gap={2}><Input label="Drive folder (optional)" value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/..." /><Input label="ClickUp folder (optional)" value={clickup} onChange={(e) => setClickup(e.target.value)} placeholder="https://app.clickup.com/..." /></Grid>
      </Stack>
    </Sheet>
  );
}

/* ── The four sections ───────────────────────────────────────────── */
/**
 * @param {object} props
 * @param {object} props.lead
 * @param {Array} props.projects every project (filtered here)
 * @param {Function} props.patch (set) => Promise<boolean> patches the lead
 * @param {Function} props.onCreateProject (doc) => Promise<item|null>
 * @param {Function} props.onPatchProject (id, set) => Promise<boolean>
 * @param {Function} props.sec (id) => section props from LeadDetail
 * @param {Function} props.jump (tabId) => void
 */
export function ClientSections({ lead, projects, patch, patchRaw, onCreateProject, onPatchProject, sec, jump, readOnly, onPulseTab }) {
  const toast = useToast();
  const [paidPulse, setPaidPulse] = useState(null); // schedule item id that just got paid
  const [retPulse, setRetPulse] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const wide = useMediaQuery('(min-width: 1440px)'); // the detail column is narrow below this; the schedule stacks
  const mine = useMemo(() => projectsOf(projects, lead._id), [projects, lead._id]);
  const work = useMemo(() => mine.filter(p => p.kind !== 'retainer'), [mine]);
  const [projId, setProjId] = useState(null);
  const current = work.find(p => String(p._id) === String(projId)) || work.find(isActiveProject) || work[0] || null;
  useEffect(() => { setProjId(null); }, [lead._id]);
  const [newOpen, setNewOpen] = useState(false);
  const [round, setRound] = useState(null); // { project, extra }
  const [roundNote, setRoundNote] = useState('');
  const [pay, setPay] = useState(null); // { project, item }
  const [payForm, setPayForm] = useState({ amount: '', at: today(), label: '' });
  const [manual, setManual] = useState(false);
  const [manualForm, setManualForm] = useState({ amount: '', label: '', at: today(), projectId: '' });
  const [retOpen, setRetOpen] = useState(false);
  const [retForm, setRetForm] = useState({ planId: RETAINERS[1].id, start: today(), billDay: String(new Date().getDate() > 28 ? 28 : new Date().getDate()) });
  const [logDel, setLogDel] = useState(null); // { project, month }
  const [logForm, setLogForm] = useState({ count: '1', note: '' });
  const [busy, setBusy] = useState(false);

  // Project writes: `pp` toasts on failure (buttons, menus, checkboxes); `ppRaw` is for InlineEdit, which toasts itself.
  const ppRaw = (p, set) => onPatchProject(p._id, set);
  const pp = async (p, set) => { const ok = await ppRaw(p, set); if (!ok) toast.error(COPY.error.save); return ok; };
  const otherActive = (p) => work.some(x => String(x._id) !== String(p._id) && isActiveProject(x));

  /* Stage changes, with the delivery gate. */
  const setStage = async (p, stage) => {
    if (stage === 'delivered') {
      const why = deliverBlockReason(p);
      if (why) { if (await confirm({ title: 'Not ready to deliver', body: why, confirmLabel: 'Open payments', icon: 'CreditCard01' })) jump('payments'); return; }
      if (!(await confirm({ title: `Mark ${p.name} delivered?`, body: 'Every delivery ends with a retainer pitch. The Send delivery checklist opens on the card.', confirmLabel: 'Mark delivered', icon: 'Check' }))) return;
      const ok = await pp(p, { stage });
      if (ok) { toast.success(`${p.name} delivered.`); if (!otherActive(p)) patch({ clientStatus: 'delivered' }); }
      return;
    }
    const ok = await pp(p, { stage });
    if (ok && (lead.clientStatus === 'delivered' || !lead.clientStatus)) patch({ clientStatus: 'active' });
  };
  const advance = (p) => { const n = nextStage(p); if (n) setStage(p, n); };
  const archive = async (p) => { if (await confirm({ title: `Archive ${p.name}?`, body: 'It leaves the list. The ledger entries it paid stay on the client.', danger: true, confirmLabel: 'Archive' })) pp(p, { archived: true }); };

  /* Revision rounds. */
  const saveRound = async () => {
    const p = round.project; const rev = { max: revisionsMax(p), used: revisionsUsed(p), log: [...(p.revisions?.log || [])], ...(p.revisions || {}) };
    rev.log = [...(p.revisions?.log || []), { at: new Date().toISOString(), note: roundNote.trim(), extra: !!round.extra }];
    rev.used = rev.log.filter(r => !r.extra).length;
    const set = { revisions: rev };
    if (round.extra) {
      const fee = extraRoundFeeFor(p); const n = extraRounds(p) + 1;
      set.schedule = [...(p.schedule || []), { id: uid(), amount: fee, dueAt: today(), status: 'upcoming', ledgerId: '', label: `Extra round ${n}`, extra: true }];
      set.total = (Number(p.total) || 0) + fee;
    }
    setBusy(true);
    const ok = await pp(p, set);
    setBusy(false);
    if (ok) { toast.success(round.extra ? `Extra round logged, ${money(extraRoundFeeFor(p))} added to the schedule.` : `Round ${rev.used} of ${rev.max} logged.`); setRound(null); setRoundNote(''); }
  };

  /* Mark paid: append to the ledger, then point the schedule item at it. */
  const openPay = (p, item) => { setPay({ project: p, item }); setPayForm({ amount: String(item.amount), at: today(), label: `${p.name}: ${item.label || 'payment'}` }); };
  const savePay = async () => {
    const { project: p, item } = pay; const amount = Number(payForm.amount) || 0; if (!(amount >= 0)) return;
    const ledgerId = uid();
    setBusy(true);
    const ok1 = await patch({ purchases: [...(lead.purchases || []), { id: ledgerId, label: payForm.label.trim() || item.label || 'Payment', amount, at: payForm.at || today(), notes: '', projectId: String(p._id) }] });
    if (!ok1) { setBusy(false); return; }
    let schedule = (p.schedule || []).map(s => (s.id === item.id ? { ...s, status: 'paid', ledgerId, paidAt: new Date().toISOString(), amount } : s));
    const set = { schedule };
    if (p.kind === 'retainer') {
      const future = schedule.filter(s => scheduleStatus(s) !== 'paid');
      if (future.length < 6) { const last = schedule[schedule.length - 1]; schedule = [...schedule, ...retainerSchedule(item.amount, addMonths(last.dueAt, 1, p.retainer?.billDay), p.retainer?.billDay, 6).map((s, i) => ({ ...s, label: `Month ${schedule.length + i + 1}` }))]; set.schedule = schedule; }
    }
    const ok2 = await pp(p, set);
    if (ok2 && p.kind === 'retainer' && lead.retainer) { const nx = nextUnpaid({ schedule }); patch({ retainer: { ...lead.retainer, nextBillAt: nx?.dueAt || '' } }); }
    setBusy(false);
    if (ok2) { toast.success(`${money(amount)} recorded.`); setPay(null); setPaidPulse(item.id); setTimeout(() => setPaidPulse(null), durationMs('--v-dur-slow') * 2 + 60); }
  };
  const saveManual = async () => {
    const amount = Number(manualForm.amount) || 0; if (!manualForm.label.trim()) return;
    setBusy(true);
    const ok = await patch({ purchases: [...(lead.purchases || []), { id: uid(), label: manualForm.label.trim(), amount, at: manualForm.at || today(), notes: '', ...(manualForm.projectId ? { projectId: manualForm.projectId } : {}) }] });
    setBusy(false);
    if (ok) { toast.success('Payment added.'); setManual(false); setManualForm({ amount: '', label: '', at: today(), projectId: '' }); }
  };

  /* Retainer. */
  const startRetainer = async () => {
    const r = retainerOf(retForm.planId); const billDay = Math.max(1, Math.min(28, Number(retForm.billDay) || 1));
    setBusy(true);
    const item = await onCreateProject(buildRetainerProject(lead._id, r.id, retForm.start, billDay));
    if (item) {
      const first = nextUnpaid(item);
      await patch({ retainer: { projectId: String(item._id), planId: r.id, amount: r.price, status: 'active', startedAt: retForm.start, billDay, nextBillAt: first?.dueAt || retForm.start, cancelAt: '' }, clientStatus: lead.clientStatus === 'paused' ? 'active' : (lead.clientStatus || 'active') });
      toast.success(`${r.label} retainer started, ${money(r.price)} a month.`);
      setRetOpen(false);
      setRetPulse(true); onPulseTab?.('retainer'); setTimeout(() => setRetPulse(false), durationMs('--v-dur-slow') * 2 + 60);
    } else toast.error(COPY.error.create);
    setBusy(false);
  };
  const setRet = (next) => patch({ retainer: { ...lead.retainer, ...next } });
  const cancelRetainer = async () => {
    if (!(await confirm({ title: 'Cancel the retainer?', body: `${CANCEL_NOTICE_DAYS} days notice: it keeps billing until ${fmtDay(cancelAtFor().slice(0, 10))}, then it is cancelled by the monthly job or by hand.`, danger: true, confirmLabel: 'Give notice' }))) return;
    if (await setRet({ status: 'ending', cancelAt: cancelAtFor() })) toast.success('Notice given. The retainer ends in 30 days.');
  };
  const retProject = lead.retainer?.projectId ? mine.find(p => String(p._id) === String(lead.retainer.projectId)) : null;
  const saveDelivery = async () => {
    const p = logDel.project; const key = logDel.month; const count = Math.max(0, Math.round(Number(logForm.count) || 0));
    const rec = monthRecord(p, key);
    const next = { ...rec, delivered: (rec.delivered || 0) + count, log: [...(rec.log || []), { at: new Date().toISOString(), count, note: logForm.note.trim() }] };
    const monthly = (p.monthly || []).some(m => m.month === key) ? (p.monthly || []).map(m => (m.month === key ? next : m)) : [...(p.monthly || []), next];
    setBusy(true);
    const ok = await pp(p, { monthly });
    setBusy(false);
    if (ok) { toast.success(`${count} logged for ${monthLabel(key)}.`); setLogDel(null); setLogForm({ count: '1', note: '' }); }
  };

  /* Delivery checklist (Delivered stage). */
  const setDelivery = async (p, id, v) => {
    const d = { driveShared: false, emailSent: false, pitchSent: false, followUpLeadCallbackAt: '', ...(p.delivery || {}) };
    if (id === 'followUp') {
      if (v) {
        const at = new Date(); at.setDate(at.getDate() + FOLLOW_UP_DAYS); at.setHours(10, 0, 0, 0);
        const ok = await patch({ callStatus: 'callback', callbackAt: at.toISOString(), callLog: [...(lead.callLog || []), { at: new Date().toISOString(), outcome: 'callback', note: 'Retainer follow up', meeting: '', email: '' }] });
        if (!ok) return;
        await pp(p, { delivery: { ...d, followUpLeadCallbackAt: at.toISOString() } });
        toast.success(`Follow up set for ${fmtDateTime(at)}. It is on the Calendar.`);
      } else await pp(p, { delivery: { ...d, followUpLeadCallbackAt: '' } });
      return;
    }
    await pp(p, { delivery: { ...d, [id]: v } });
  };

  /* ── Projects ── */
  const projectCard = (p) => {
    const used = revisionsUsed(p); const max = revisionsMax(p); const extra = extraRounds(p);
    const stages = p.stages?.length ? p.stages : stagesFor(p.kind);
    const menu = [
      { id: 'adv', label: nextStage(p) ? `Advance to ${projectStageOf(nextStage(p)).label}` : 'Delivered', icon: 'ArrowRight', disabled: !nextStage(p) || readOnly, onSelect: () => advance(p) },
      'divider',
      ...stages.map(s => ({ id: `s:${s}`, label: `Set stage: ${projectStageOf(s).label}`, icon: projectStageOf(s).icon, disabled: s === p.stage || readOnly, onSelect: () => setStage(p, s) })),
      'divider',
      { id: 'arch', label: 'Archive', icon: 'Trash01', danger: true, disabled: readOnly, onSelect: () => archive(p) },
    ];
    return (
      <Card key={p._id} className={`cw-project${String(current?._id) === String(p._id) ? ' is-current' : ''}`} glow={p.stage === 'delivered' ? 'booked' : undefined}>
        <Row gap={2} align="start" className="cw-project-head">
          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <Row gap={2} wrap align="center"><span className="cw-project-name">{p.name}</span><Pill id={p.kind} list={PROJECT_KINDS} size="sm" variant="outline" /><Pill id={p.stage} list={PROJECT_STAGES} size="sm" /></Row>
            <span className="dt-muted">Started {fmtDate(p.createdAt) || 'today'}, {money(p.total)}{p.plan ? `, ${money(p.plan.monthly)} a month for ${p.plan.months}` : ''}</span>
          </Stack>
          <Menu label={`Actions for ${p.name}`} items={menu} />
        </Row>
        <Stepper project={p} />
        <div className="cw-rev">
          <Row gap={2} justify="between" align="center" wrap>
            <span className="cw-rev-label">Revision rounds: {used} of {max}{extra ? `, ${extra} extra` : ''}</span>
            {!readOnly && (revisionsExhausted(p)
              ? <Button variant="secondary" size="md" icon={Plus} onClick={() => { setRound({ project: p, extra: true }); setRoundNote(''); }} className="cw-extra-round">Log extra round ({money(extraRoundFeeFor(p))})</Button>
              : <Button variant="secondary" size="md" icon={Plus} onClick={() => { setRound({ project: p, extra: false }); setRoundNote(''); }} className="cw-log-round">Log a round</Button>)}
          </Row>
          <ProgressBar value={max ? Math.min(100, Math.round((used / max) * 100)) : 0} tone={revisionsExhausted(p) ? 'new' : 'callback'} size="sm" />
          {revisionsExhausted(p) && <p className="dt-muted">Both included rounds are used. A third round is {money(extraRoundFeeFor(p))} and lands on the schedule as an unpaid line. Never discount by cutting price.</p>}
          {(p.revisions?.log || []).length > 0 && <ul className="cw-rev-log">{(p.revisions.log).slice(-4).map((r, i) => <li key={i}><span className="cw-rev-when">{fmtDate(r.at)}</span>{r.extra && <Pill tone="new" label={`Extra, ${money(extraRoundFeeFor(p))}`} size="sm" icon={false} />}<span className="cw-rev-note">{r.note || 'Round logged'}</span></li>)}</ul>}
        </div>
        <Row gap={2} wrap className="cw-project-meta">
          <span className="dt-muted">Paid {money(paidTotal(p))} of {money(scheduleTotal(p))}</span>
          <Button variant="ghost" size="md" onClick={() => { setProjId(p._id); jump('payments'); }}>Payments</Button>
          <Button variant="ghost" size="md" onClick={() => { setProjId(p._id); jump('deliverables'); }}>Deliverables</Button>
          {nextStage(p) && !readOnly && <Button variant="secondary" size="md" iconEnd="ArrowRight" onClick={() => advance(p)} className="cw-advance">{projectStageOf(nextStage(p)).label}</Button>}
        </Row>
        {p.stage === 'delivered' && (
          <Card level={2} padding={3} className="cw-delivery">
            <p className="pb-card-h">Send delivery</p>
            <Stack gap={0}>
              {DELIVERY_STEPS.map(st => <Checkbox key={st.id} label={st.id === 'followUp' && p.delivery?.followUpLeadCallbackAt ? `${st.label} (${fmtDateTime(p.delivery.followUpLeadCallbackAt)})` : st.label} checked={st.id === 'followUp' ? !!p.delivery?.followUpLeadCallbackAt : !!p.delivery?.[st.id]} onChange={(v) => setDelivery(p, st.id, v)} disabled={readOnly} />)}
            </Stack>
            <p className="dt-muted">Files release only at full payment. Every delivery ends with a retainer pitch.</p>
          </Card>
        )}
      </Card>
    );
  };
  const projectsSection = (
    <section {...sec('projects')}>
      <Section title="Projects" description={work.length ? `${work.filter(isActiveProject).length} active of ${work.length}` : undefined} action={!readOnly && <Button icon={Plus} onClick={() => setNewOpen(true)} className="cw-new-project">New project</Button>}>
        {work.length ? <Stack gap={3}>{work.map(projectCard)}</Stack>
          : <Card><EmptyState size="sm" icon="Briefcase01" title={E('clients.projects').title} description={E('clients.projects').description} action={!readOnly ? { label: E('clients.projects').action, icon: Plus, onClick: () => setNewOpen(true) } : undefined} /></Card>}
      </Section>
    </section>
  );

  /* ── Payments ── */
  const ledger = useMemo(() => (lead.purchases || []).map((x, i) => ({ ...x, _i: i })).sort((a, b) => String(b.at).localeCompare(String(a.at))), [lead.purchases]);
  const projectPicker = work.length > 1 && <Select label="Project" value={String(current?._id || '')} onChange={(e) => setProjId(e.target.value)} options={work.map(p => ({ id: String(p._id), label: p.name }))} className="cw-picker" />;
  const scheduleRows = current ? [...(current.schedule || [])].sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt))) : [];
  const statusPill = (s) => <Pill id={scheduleStatus(s)} list={SCHEDULE_STATUSES} size="sm" />;
  const payAction = (s) => (scheduleStatus(s) === 'paid'
    ? <Button variant="ghost" size="md" onClick={() => document.getElementById(`ledger-${s.ledgerId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Ledger</Button>
    : !readOnly && <Button variant="secondary" size="md" icon={Check} onClick={() => openPay(current, s)} className="cw-mark-paid">Mark paid</Button>);
  const planBlock = current?.plan && (() => {
    const m = planMonth(current); const nx = nextUnpaid(current); const remind = planReminderDue(current) || current.plan.stripeCancelled;
    return (
      <Card level={2} padding={3} className="cw-plan">
        <Row gap={2} wrap justify="between" align="center"><span className="pb-card-h" style={{ margin: 0 }}>Payment plan</span><Pill tone={isFullyPaid(current) ? 'booked' : 'progress'} label={`Month ${m} of ${current.plan.months}`} size="sm" icon={false} /></Row>
        <Grid minColumnWidth={140} gap={2}>
          <div className="cw-kv"><span className="dt-fact-label">Monthly</span><span>{money(current.plan.monthly)}</span></div>
          <div className="cw-kv"><span className="dt-fact-label">Next due</span><span>{nx ? fmtDay(nx.dueAt) : 'Paid in full'}</span></div>
          <div className="cw-kv"><span className="dt-fact-label">Remaining</span><span>{money(planRemaining(current))}</span></div>
        </Grid>
        <div className="cw-kv"><span className="dt-fact-label">Stripe subscription</span><InlineEdit value={current.plan.stripeSubscriptionId || ''} onSave={(v) => ppRaw(current, { plan: { ...current.plan, stripeSubscriptionId: v.trim() } })} placeholder="sub_... (so a cancellation reconciles)" label="Stripe subscription id" className="cw-sub-id" /></div>
        {current.plan.stripeCancelledAt ? (
          <Card level={3} padding={3} className="cw-stripe cw-stripe--ok" glow="booked">
            <p className="cw-stripe-h cw-stripe-h--ok">Stripe reports this subscription cancelled ({fmtDate(current.plan.stripeCancelledAt)}).</p>
          </Card>
        ) : remind && (
          <Card level={3} padding={3} className="cw-stripe" glow="danger">
            <p className="cw-stripe-h">Cancel the Stripe subscription after the final payment. Stripe does not stop it for you.</p>
            <Checkbox label="Stripe subscription cancelled" checked={!!current.plan.stripeCancelled} onChange={(v) => pp(current, { plan: { ...current.plan, stripeCancelled: v } })} disabled={readOnly} />
          </Card>
        )}
      </Card>
    );
  })();
  const paymentsSection = (
    <section {...sec('payments')}>
      <Section title="Payments" description={current ? `${current.name}: ${money(paidTotal(current))} paid of ${money(scheduleTotal(current))}` : 'No project selected'} action={projectPicker}>
        {current ? (
          <Stack gap={3}>
            <ProgressBar value={paidPct(current)} tone={isFullyPaid(current) ? 'booked' : 'progress'} size="sm" label={isFullyPaid(current) ? 'Paid in full' : `${money(owedTotal(current))} still owed`} />
            {wide ? (
              <Table aria-label="Payment schedule" density="sm" columnChooser={false} rows={scheduleRows} rowKey={(r) => r.id}
                columns={[
                  { id: 'label', label: 'Item', render: (r) => r.label || 'Payment', always: true },
                  { id: 'amount', label: 'Amount', align: 'end', render: (r) => money(r.amount) },
                  { id: 'due', label: 'Due', render: (r) => fmtDay(r.dueAt) },
                  { id: 'status', label: 'Status', render: statusPill },
                ]} rowActions={payAction} rowClassName={(r) => (r.id === paidPulse ? 'cw-row-paid' : '')} empty={<EmptyState size="sm" icon="CreditCard01" title={E('clients.schedule').title} description={E('clients.schedule').description} />} />
            ) : (
              <Stack gap={2}>{scheduleRows.map(s => <ListRow key={s.id} title={s.label || 'Payment'} subtitle={`${money(s.amount)}, due ${fmtDay(s.dueAt)}`} trailing={<Row gap={1}>{statusPill(s)}{payAction(s)}</Row>} chevron={false} className={`cw-sched-row${s.id === paidPulse ? ' v-pulse-won' : ''}`} />)}</Stack>
            )}
            {planBlock}
          </Stack>
        ) : <Card><EmptyState size="sm" icon="CreditCard01" title={E('clients.payments').title} description={E('clients.payments').description} action={!readOnly ? { label: E('clients.payments').action, icon: Plus, onClick: () => setNewOpen(true) } : undefined} /></Card>}
        <Card className="cw-ledger">
          <Row gap={2} justify="between" align="center" wrap><span className="pb-card-h" style={{ margin: 0 }}>Lifetime ledger, {money(ledger.reduce((n, x) => n + (Number(x.amount) || 0), 0))}</span>{!readOnly && <Button variant="secondary" size="md" icon={Plus} onClick={() => setManual(true)} className="cw-add-manual">Add manual payment</Button>}</Row>
          {ledger.length ? <Stack gap={1}>{ledger.map(x => { const proj = x.projectId ? mine.find(p => String(p._id) === String(x.projectId)) : null; return <ListRow key={x.id || x._i} id={x.id ? `ledger-${x.id}` : undefined} leading={<IconTile icon="CurrencyDollar" tone="won" size="sm" glow={false} />} title={x.label || 'Payment'} subtitle={[fmtDay(x.at) || fmtDate(x.at), proj?.name, x.notes].filter(Boolean).join(', ')} meta={money(x.amount)} chevron={false} className="cw-ledger-row" />; })}</Stack> : <EmptyState size="sm" icon="CurrencyDollar" title={E('clients.ledger').title} description={E('clients.ledger').description} action={!readOnly ? { label: E('clients.ledger').action, icon: Plus, onClick: () => setManual(true) } : undefined} />}
        </Card>
      </Section>
    </section>
  );

  /* ── Retainer ── */
  const ret = lead.retainer;
  const retPlan = ret ? retainerOf(ret.planId) : null;
  const months = retProject ? (() => { const cur = monthKey(); const keys = [...new Set([cur, ...(retProject.monthly || []).map(m => m.month)])].sort().reverse(); return keys.map(k => monthRecord(retProject, k)); })() : [];
  const retainerSection = (
    <section {...sec('retainer')}>
      <Section title="Retainer" description={ret ? `${retPlan?.label || ret.planId}, ${money(ret.amount)} a month` : 'Every delivery ends with a retainer pitch.'} action={!ret || ret.status === 'cancelled' ? (!readOnly && <Button icon={RefreshCw01} onClick={() => setRetOpen(true)} className="cw-start-retainer">Start a retainer</Button>) : undefined}>
        {ret && ret.status !== 'cancelled' ? (
          <Card className={`cw-retainer${retPulse ? ' v-pulse-won' : ''}`}>
            <Row gap={2} wrap align="center"><Pill id={ret.status} list={RETAINER_STATUSES} size="sm" /><span className="cw-project-name">{retPlan?.label || ret.planId}</span><span className="dt-opt-n cw-ret-price">{money(ret.amount)}<small>/mo</small></span></Row>
            <Grid minColumnWidth={140} gap={2}>
              <div className="cw-kv"><span className="dt-fact-label">Started</span><span>{fmtDay(ret.startedAt) || fmtDate(ret.startedAt) || 'Unknown'}</span></div>
              <div className="cw-kv"><span className="dt-fact-label">Next bill</span><span>{ret.status === 'paused' ? 'Paused' : fmtDay(ret.nextBillAt) || 'Not set'}</span></div>
              <div className="cw-kv"><span className="dt-fact-label">Bill day</span><span>Day {ret.billDay}</span></div>
              {ret.cancelAt && <div className="cw-kv"><span className="dt-fact-label">Ends</span><span>{fmtDate(ret.cancelAt)}</span></div>}
            </Grid>
            <div className="cw-kv"><span className="dt-fact-label">Stripe subscription</span><InlineEdit value={ret.stripeSubscriptionId || ''} onSave={(v) => (patchRaw || patch)({ retainer: { ...lead.retainer, stripeSubscriptionId: v.trim() } })} placeholder="sub_... (so a cancellation reconciles)" label="Stripe subscription id" className="cw-sub-id" /></div>
            {ret.stripeCancelledAt && <p className="dt-muted">Stripe reported this subscription cancelled on {fmtDate(ret.stripeCancelledAt)}.</p>}
            {retProject && nextUnpaid(retProject) && ret.status !== 'paused' && (
              <Card level={2} padding={3} className="cw-nextbill">
                <Row gap={2} justify="between" align="center" wrap>
                  <Stack gap={0}><span className="dt-fact-label">Next bill</span><span className="cw-nextbill-amt">{money(nextUnpaid(retProject).amount)}, {fmtDay(nextUnpaid(retProject).dueAt)}</span></Stack>
                  <Row gap={1}><Pill id={scheduleStatus(nextUnpaid(retProject))} list={SCHEDULE_STATUSES} size="sm" />{!readOnly && <Button variant="secondary" size="md" icon={Check} onClick={() => openPay(retProject, nextUnpaid(retProject))} className="cw-bill-paid">Mark paid</Button>}</Row>
                </Row>
              </Card>
            )}
            {!readOnly && <Row gap={2} wrap>
              {ret.status === 'active' && <Button variant="secondary" icon="PauseCircle" onClick={() => setRet({ status: 'paused' })}>Pause</Button>}
              {ret.status === 'paused' && <Button icon="Play" onClick={() => setRet({ status: 'active' })}>Resume</Button>}
              {(ret.status === 'active' || ret.status === 'paused') && <Button variant="danger" onClick={cancelRetainer} className="cw-cancel-retainer">Cancel</Button>}
              {ret.status === 'ending' && <Button variant="danger" onClick={async () => { if (await confirm({ title: 'Mark the retainer cancelled now?', body: 'Use this once the notice period is over.', danger: true, confirmLabel: 'Cancelled' })) setRet({ status: 'cancelled', nextBillAt: '' }); }}>Mark cancelled now</Button>}
            </Row>}
            {ret.status === 'ending' && <p className="dt-muted">Notice given. It bills until {fmtDate(ret.cancelAt)}, then the monthly job (or you) marks it cancelled.</p>}
            {retProject && (
              <Stack gap={2} className="cw-months">
                <p className="pb-card-h">Monthly deliverables: {retainerMonthly(ret.planId).label}</p>
                {months.map((m, i) => (
                  <Card key={m.month} level={2} padding={3} className={`cw-month${i === 0 ? ' is-current' : ''}`}>
                    <Row gap={2} justify="between" align="center" wrap><span className="cw-month-name">{monthLabel(m.month)}{i === 0 && <Pill tone="booked" label="This month" size="sm" icon={false} className="cw-month-pin" />}</span>{!readOnly && <Button variant="secondary" size="md" icon={Plus} onClick={() => { setLogDel({ project: retProject, month: m.month }); setLogForm({ count: '1', note: '' }); }} className="cw-log-delivery">Log delivery</Button>}</Row>
                    <ProgressBar value={m.included ? Math.min(100, Math.round((m.delivered / m.included) * 100)) : 0} tone={m.delivered >= m.included && m.included ? 'booked' : 'progress'} size="sm" label={`${m.delivered} of ${m.included} ${retainerMonthly(ret.planId).unit}`} />
                    {(m.log || []).length > 0 && <ul className="cw-rev-log">{m.log.slice(-3).map((l, j) => <li key={j}><span className="cw-rev-when">{fmtDate(l.at)}</span><span className="cw-rev-note">{l.count} delivered{l.note ? `, ${l.note}` : ''}</span></li>)}</ul>}
                  </Card>
                ))}
              </Stack>
            )}
          </Card>
        ) : (
          <Card><EmptyState size="sm" icon="RefreshCw01" title={ret?.status === 'cancelled' ? E('clients.retainer.cancelled').title : E('clients.retainer').title} description={ret?.status === 'cancelled' ? `${retPlan?.label || 'The plan'} ended ${fmtDate(ret.cancelAt) || 'recently'}. ${E('clients.retainer.cancelled').description}` : E('clients.retainer').description} action={!readOnly ? { label: E('clients.retainer').action, icon: RefreshCw01, onClick: () => setRetOpen(true) } : undefined} /></Card>
        )}
      </Section>
    </section>
  );

  /* ── Deliverables ── */
  const relBlock = current ? releaseBlockReason(current) : null;
  const driveLink = current?.links?.drive || lead.links?.drive || '';
  const deliverablesSection = (
    <section {...sec('deliverables')}>
      <Section title="Deliverables" description={current ? `${(current.deliverables || []).filter(d => d.done).length} of ${(current.deliverables || []).length} ready` : 'No project selected'} action={projectPicker}>
        {current ? (
          <Stack gap={3}>
            <Card className={`cw-release${current.releasedAt ? ' is-on' : ''}`} glow={current.releasedAt ? 'booked' : undefined}>
              <Toggle label="Released to client" description={current.releasedAt ? `Released ${fmtDateTime(current.releasedAt)}.` : relBlock || 'Paid in full. Flip this once the Drive folder is shared.'} checked={!!current.releasedAt} disabled={!!relBlock || readOnly} onChange={(v) => pp(current, { releasedAt: v ? new Date().toISOString() : '' })} className="cw-release-toggle" />
              {current.releasedAt && (driveLink ? <Button full size="lg" href={driveLink} target="_blank" rel="noopener noreferrer" icon="Folder" iconEnd="LinkExternal01" className="cw-drive-big">Open the Drive folder</Button> : <p className="dt-muted">Add the Drive folder link on the project or in Links to show it here.</p>)}
            </Card>
            {(current.deliverables || []).length ? DELIVERABLE_GROUPS.filter(g => (current.deliverables || []).some(d => d.group === g.id)).map(g => (
              <Card key={g.id} className="cw-dgroup">
                <p className="pb-card-h">{g.label}</p>
                <Stack gap={1}>{(current.deliverables || []).filter(d => d.group === g.id).map(d => (
                  <div key={d.id} className="cw-deliv">
                    <Checkbox label={d.label} checked={!!d.done} onChange={(v) => pp(current, { deliverables: current.deliverables.map(x => (x.id === d.id ? { ...x, done: v } : x)) })} disabled={readOnly} />
                    <span className="cw-deliv-link">{readOnly ? (d.link ? <a href={d.link} target="_blank" rel="noopener noreferrer" className="cw-deliv-a lay-truncate">{d.link.replace(/^https?:\/\//, '')}</a> : null) : <InlineEdit value={d.link || ''} onSave={(v) => ppRaw(current, { deliverables: current.deliverables.map(x => (x.id === d.id ? { ...x, link: v } : x)) })} placeholder="Add a link" label={`${d.label} link`} format={(v) => v.replace(/^https?:\/\//, '')} className={`cw-deliv-edit${d.link ? ' has-link' : ''}`} />}{d.link && <IconButton icon="LinkExternal01" label={`Open ${d.label}`} variant="ghost" onClick={() => window.open(d.link, '_blank', 'noopener')} />}</span>
                  </div>
                ))}</Stack>
              </Card>
            )) : <Card><EmptyState size="sm" icon="Folder" title={E('clients.deliverables').title} description={E('clients.deliverables').description} action={!readOnly ? { label: E('clients.deliverables').action, onClick: () => pp(current, { deliverables: deliverablesFor(current.kind) }) } : undefined} /></Card>}
          </Stack>
        ) : <Card><EmptyState size="sm" icon="Folder" title={E('clients.deliverables.noproject').title} description={E('clients.deliverables.noproject').description} action={!readOnly ? { label: E('clients.deliverables.noproject').action, icon: Plus, onClick: () => setNewOpen(true) } : undefined} /></Card>}
      </Section>
    </section>
  );

  return (
    <>
      {projectsSection}{paymentsSection}{retainerSection}{deliverablesSection}
      {confirmDialog}
      {newOpen && <NewProjectSheet lead={lead} onClose={() => setNewOpen(false)} onCreate={async (doc) => { const item = await onCreateProject(doc); if (item) { setNewOpen(false); setProjId(item._id); toast.success(`${item.name} created.`); if (lead.clientStatus !== 'active') patch({ clientStatus: 'active' }); if ((doc.links?.drive || doc.links?.clickup) && !(lead.links?.drive || lead.links?.clickup)) patch({ links: { website: '', instagram: '', ...(lead.links || {}), drive: lead.links?.drive || doc.links.drive, clickup: lead.links?.clickup || doc.links.clickup } }); } else toast.error(COPY.error.create); }} />}
      <Modal open={!!round} onClose={() => setRound(null)} title={round?.extra ? 'Log an extra round' : `Log round ${round ? revisionsUsed(round.project) + 1 : ''} of ${round ? revisionsMax(round.project) : REVISION_ROUNDS}`} description={round?.extra ? `${money(round ? extraRoundFeeFor(round.project) : 0)} for a ${round?.project.kind === 'web' || round?.project.kind === 'combined' ? 'web' : 'design'} round, added to the schedule as an unpaid line.` : 'What changed in this round.'}
        footer={<><Button variant="ghost" onClick={() => setRound(null)}>Cancel</Button><Button loading={busy} onClick={saveRound}>{round?.extra ? 'Log extra round' : 'Log round'}</Button></>}>
        <Textarea label={round?.extra ? 'Reason' : 'What changed'} rows={3} value={roundNote} onChange={(e) => setRoundNote(e.target.value)} placeholder={round?.extra ? 'They want the mark reworked after approving it.' : 'Tightened the wordmark spacing, swapped the secondary color.'} data-autofocus />
      </Modal>
      <Modal open={!!pay} onClose={() => setPay(null)} title="Mark paid" description={pay ? `${pay.project.name}: ${pay.item.label || 'payment'}` : ''}
        footer={<><Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button><Button loading={busy} icon={Check} onClick={savePay}>Record payment</Button></>}>
        <Grid minColumnWidth={140} gap={2}><Input label="Amount" type="number" inputMode="decimal" value={payForm.amount} onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))} data-autofocus /><Input label="Paid on" type="date" value={payForm.at} onChange={(e) => setPayForm(f => ({ ...f, at: e.target.value }))} /></Grid>
        <Input label="Ledger label" value={payForm.label} onChange={(e) => setPayForm(f => ({ ...f, label: e.target.value }))} />
      </Modal>
      {manual && <Sheet open onClose={() => setManual(false)} title="Add manual payment" description={lead.business} width={460}
        footer={<><Button variant="ghost" onClick={() => setManual(false)}>Cancel</Button><Button loading={busy} icon={Check} disabled={!manualForm.label.trim()} onClick={saveManual}>Add payment</Button></>}>
        <Stack gap={3}>
          <Input label="What for" value={manualForm.label} onChange={(e) => setManualForm(f => ({ ...f, label: e.target.value }))} placeholder="Sticker rerun" data-autofocus />
          <Grid minColumnWidth={140} gap={2}><Input label="Amount" type="number" inputMode="decimal" value={manualForm.amount} onChange={(e) => setManualForm(f => ({ ...f, amount: e.target.value }))} /><Input label="Date" type="date" value={manualForm.at} onChange={(e) => setManualForm(f => ({ ...f, at: e.target.value }))} /></Grid>
          <Select label="Project (optional)" value={manualForm.projectId} onChange={(e) => setManualForm(f => ({ ...f, projectId: e.target.value }))} options={mine.map(p => ({ id: String(p._id), label: p.name }))} placeholder="Not tied to a project" />
        </Stack>
      </Sheet>}
      {retOpen && <Sheet open onClose={() => setRetOpen(false)} title="Start a retainer" description={lead.business} width={460} className="cw-sheet"
        footer={<><Button variant="ghost" onClick={() => setRetOpen(false)}>Cancel</Button><Button loading={busy} icon={RefreshCw01} onClick={startRetainer}>Create</Button></>}>
        <Stack gap={3}>
          <Select label="Plan" value={retForm.planId} onChange={(e) => setRetForm(f => ({ ...f, planId: e.target.value }))} options={RETAINERS.map(r => ({ id: r.id, label: `${r.label} (${money(r.price)} a month)` }))} data-autofocus />
          <ul className="pb-list">{retainerOf(retForm.planId)?.included.map((x, i) => <li key={i}>{x}</li>)}<li>{retainerMonthly(retForm.planId).label}</li></ul>
          <Grid minColumnWidth={140} gap={2}><Input label="Start date" type="date" value={retForm.start} onChange={(e) => setRetForm(f => ({ ...f, start: e.target.value }))} /><Input label="Bill day of month" type="number" inputMode="numeric" min={1} max={28} value={retForm.billDay} onChange={(e) => setRetForm(f => ({ ...f, billDay: e.target.value }))} hint="1 to 28" /></Grid>
        </Stack>
      </Sheet>}
      <Modal open={!!logDel} onClose={() => setLogDel(null)} title="Log delivery" description={logDel ? monthLabel(logDel.month) : ''}
        footer={<><Button variant="ghost" onClick={() => setLogDel(null)}>Cancel</Button><Button loading={busy} icon={Check} onClick={saveDelivery}>Log</Button></>}>
        <Grid minColumnWidth={120} gap={2}><Input label="How many" type="number" inputMode="numeric" min={0} value={logForm.count} onChange={(e) => setLogForm(f => ({ ...f, count: e.target.value }))} data-autofocus /></Grid>
        <Input label="Note (optional)" value={logForm.note} onChange={(e) => setLogForm(f => ({ ...f, note: e.target.value }))} placeholder="Three story graphics and the monthly plan" />
      </Modal>
    </>
  );
}

/* ── Showcase (Site Prompt 2, Part 2) ────────────────────────────────
 * The public showcase editor: Publish, Card fields, four toggleable
 * sections (Brand identity, Website, Business cards, Print and product),
 * Landing page placement, and Testimonials. `showcase` and `reviews` are
 * both full-replacement objects server-side (see api/_routes/call-leads.js
 * sanitizeShowcase/sanitizeTestimonial), so every write here spreads the
 * current merged object forward and overrides only the one leaf that
 * changed, exactly like ClientBrand above. */

const DEFAULT_SHOWCASE = {
  published: false, slug: '', displayName: '', type: '', blurb: '', cover: '', year: '',
  brand: { enabled: true, logo: { light: '', dark: '' }, images: [], notes: '' },
  website: { enabled: true, url: '', screenshots: [], notes: '' },
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

/* An image URL field: InlineEdit (or read-only text) plus a live thumbnail
 * that falls back to a warning on a broken link, plus an optional Upload
 * button when Cloudinary is configured (Site Prompt 2, Part 5). Uploading
 * calls the same onSave the manual link uses, so the full-replacement
 * write rule still applies. */
function ImageField({ value, label, placeholder, onSave, readOnly }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [broken, setBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setBroken(false); }, [value]);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const url = await uploadToCloudinary(file);
    setUploading(false);
    if (url) await onSave(url); else toast.error('Could not upload that image.');
  };
  return (
    <div className="sc-imgfield">
      <Row gap={1} align="center">
        <EditableText value={value} onSave={onSave} placeholder={placeholder} label={label} readOnly={readOnly} className="sc-imgfield-edit" />
        {!readOnly && cloudinaryEnabled && (
          <>
            <IconButton icon="Upload01" label={uploading ? `Uploading ${label}` : `Upload ${label}`} variant="ghost" disabled={uploading} onClick={() => fileRef.current?.click()} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} aria-hidden="true" tabIndex={-1} />
          </>
        )}
      </Row>
      {value ? (broken
        ? <p className="sc-thumb-warn">Image not reachable.</p>
        : <img src={value} alt="" className="sc-thumb" width={64} height={64} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : null}
    </div>
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
        <div className="v-field"><span className="v-field-label">Cover image</span><ImageField value={sh.cover} label="Cover image" placeholder="Cover image URL" onSave={(v) => writeRaw({ cover: v })} readOnly={readOnly} /></div>
        <div className="cw-brand-row"><span className="dt-fact-label">Year</span><EditableText value={sh.year} onSave={(v) => writeRaw({ year: v.slice(0, 10) })} placeholder="2026" label="Year" readOnly={readOnly} className="dt-fact-edit" /></div>
      </Stack>
    </Card>
  );
}

function BrandBlock({ sh, write, writeRaw, lead, readOnly, jump }) {
  const b = sh.brand;
  const images = b.images || [];
  const summary = !b.enabled ? 'Off' : ([images.length ? `${images.length} image${images.length === 1 ? '' : 's'}` : '', b.notes ? 'notes' : ''].filter(Boolean).join(', ') || 'Not set up yet');
  const brandProfile = { primary: '', colors: [], fontDisplay: '', fontBody: '', ...(lead.brand || {}) };
  const chips = [brandProfile.primary, ...(brandProfile.colors || [])].filter(Boolean);
  return (
    <ShowcaseBlock title="Brand identity" enabled={b.enabled} onEnabled={(v) => write({ brand: { ...b, enabled: v } })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <Grid minColumnWidth={180} gap={2}>
          <div className="v-field"><span className="v-field-label">Logo, light background</span><ImageField value={b.logo.light} label="Logo, light background" placeholder="Logo URL for a light background" onSave={(v) => writeRaw({ brand: { ...b, logo: { ...b.logo, light: v } } })} readOnly={readOnly} /></div>
          <div className="v-field"><span className="v-field-label">Logo, dark background</span><ImageField value={b.logo.dark} label="Logo, dark background" placeholder="Logo URL for a dark background" onSave={(v) => writeRaw({ brand: { ...b, logo: { ...b.logo, dark: v } } })} readOnly={readOnly} /></div>
        </Grid>
        <div className="v-field">
          <span className="v-field-label">Gallery images ({images.length} of 12)</span>
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

function CardsBlock({ sh, write, writeRaw, readOnly }) {
  const c = sh.cards;
  const summary = !c.enabled ? 'Off' : ([c.front && 'front', c.back && 'back', c.notes && 'notes'].filter(Boolean).join(', ') || 'Not set up yet');
  return (
    <ShowcaseBlock title="Business cards" enabled={c.enabled} onEnabled={(v) => write({ cards: { ...c, enabled: v } })} summary={summary} readOnly={readOnly}>
      <Stack gap={3}>
        <Grid minColumnWidth={180} gap={2}>
          <div className="v-field"><span className="v-field-label">Front</span><ImageField value={c.front} label="Card front" placeholder="Front image URL" onSave={(v) => writeRaw({ cards: { ...c, front: v } })} readOnly={readOnly} /></div>
          <div className="v-field"><span className="v-field-label">Back</span><ImageField value={c.back} label="Card back" placeholder="Back image URL" onSave={(v) => writeRaw({ cards: { ...c, back: v } })} readOnly={readOnly} /></div>
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
          <ObjectListEditor items={items} readOnly={readOnly} canAdd={!readOnly && items.length < 12} addLabel="Add item"
            onReorder={(next) => write({ print: { ...p, items: next } })}
            onRemove={(i) => write({ print: { ...p, items: items.filter((_, j) => j !== i) } })}
            onAdd={() => write({ print: { ...p, items: [...items, { label: '', image: '', caption: '' }] } })}
            renderRow={(it, i) => (<>
              <EditableText value={it.label} onSave={(v) => writeRaw({ print: { ...p, items: items.map((x, j) => (j === i ? { ...x, label: v } : x)) } })} placeholder="Label, e.g. Sticker sheet" label={`Item ${i + 1} label`} readOnly={readOnly} />
              <ImageField value={it.image} label={`Item ${i + 1} image`} placeholder="Image URL" onSave={(v) => writeRaw({ print: { ...p, items: items.map((x, j) => (j === i ? { ...x, image: v } : x)) } })} readOnly={readOnly} />
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

/**
 * ShowcaseSection (Site Prompt 2, Part 2): the public showcase editor,
 * rendered as LeadDetail's Showcase tab in client mode only.
 * @param {object} props
 * @param {object} props.lead
 * @param {Function} props.patch (set) => Promise<boolean> toasts on failure
 * @param {Function} props.patchRaw (set) => Promise<boolean> for InlineEdit, which toasts itself
 * @param {Array} [props.submissions] every submission, filtered here to type 'review'
 * @param {Function} props.sec (id) => section props from LeadDetail
 * @param {Function} props.jump (tabId) => void, used by the Brand identity mirror's "Edit in Overview"
 */
export function ShowcaseSection({ lead, patch, patchRaw, submissions = [], sec, jump, readOnly }) {
  const sh = useMemo(() => ({
    ...DEFAULT_SHOWCASE, ...(lead.showcase || {}),
    brand: { ...DEFAULT_SHOWCASE.brand, ...(lead.showcase?.brand || {}), logo: { ...DEFAULT_SHOWCASE.brand.logo, ...(lead.showcase?.brand?.logo || {}) } },
    website: { ...DEFAULT_SHOWCASE.website, ...(lead.showcase?.website || {}) },
    cards: { ...DEFAULT_SHOWCASE.cards, ...(lead.showcase?.cards || {}) },
    print: { ...DEFAULT_SHOWCASE.print, ...(lead.showcase?.print || {}) },
    featured: { ...DEFAULT_SHOWCASE.featured, ...(lead.showcase?.featured || {}) },
  }), [lead.showcase]);
  // `write` (patch-based, toasts on failure) for toggles, add/remove/reorder;
  // `writeRaw` (patchRaw-based) for InlineEdit fields, which show their own toast.
  const write = (next) => patch({ showcase: { ...sh, ...next } });
  const writeRaw = (next) => (patchRaw || patch)({ showcase: { ...sh, ...next } });
  const reviews = { ...DEFAULT_REVIEWS, ...(lead.reviews || {}) };
  const testimonials = reviews.testimonials || [];
  const writeTestimonials = (next) => patch({ reviews: { ...reviews, testimonials: next } });
  return (
    <section {...sec('showcase')}>
      <Section title="Showcase" description="What shows on the public work page.">
        <PublishCard sh={sh} write={write} writeRaw={writeRaw} readOnly={readOnly} />
        <CardFieldsCard sh={sh} writeRaw={writeRaw} lead={lead} readOnly={readOnly} />
        <BrandBlock sh={sh} write={write} writeRaw={writeRaw} lead={lead} readOnly={readOnly} jump={jump} />
        <WebsiteBlock sh={sh} write={write} writeRaw={writeRaw} lead={lead} readOnly={readOnly} />
        <CardsBlock sh={sh} write={write} writeRaw={writeRaw} readOnly={readOnly} />
        <PrintBlock sh={sh} write={write} writeRaw={writeRaw} readOnly={readOnly} />
        <LandingCard sh={sh} write={write} readOnly={readOnly} />
        <TestimonialsCard lead={lead} testimonials={testimonials} writeTestimonials={writeTestimonials} submissions={submissions} readOnly={readOnly} />
      </Section>
    </section>
  );
}
