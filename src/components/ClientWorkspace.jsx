import { useEffect, useMemo, useState } from 'react';
import { COPY } from '../shared/copy';
import { useSendEmail } from './SendEmailModal';
import { useComputerOnly } from './ComputerOnly';
import { invoicesOf, markPaid as markInvoicePaid, replaceInvoice, newInvoice } from '../lib/invoices';
import { durationMs } from '../ui/motion';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import {
  Stack, Row, Grid, Card, Button, Pill, Sheet, Modal, Input, Select, Textarea, Checkbox, useToast, useConfirm,
} from '../ui';
import { PROJECT_KINDS, projectStageOf } from '../shared/semantics';
import { PACKAGES, RETAINERS, ADDONS, retainerOf, planLine, REVISION_ROUNDS } from '../shared/pricing';
import { money } from '../shared/format';
import { fmtDateTime } from '../shared/dates';
import { useShell } from '../shell/ShellContext';
import {
  uid, today, monthKey, monthLabel, addMonths, localDate, stagesFor, nextStage, retainerSchedule, scheduleStatus, revisionsUsed, extraRounds, revisionsMax, revisionsExhausted, extraRoundFeeFor, deliverBlockReason, isActiveProject, deliveryStepsAfter, deliveryStepsAtDelivery, FOLLOW_UP_DAYS, retainerMonthly, cancelAtFor, monthRecord, projectsOf, nextUnpaid, buildProject, buildRetainerProject, CANCEL_NOTICE_DAYS,
} from '../lib/projects';

/* The client workspace (Prompt 10, rebuilt in UI simplification part A):
 * every rule lives in src/lib/projects.js; this file holds the state, the
 * writes and the modals the client's sections share, as one hook:
 *   useClientWorkspace({ lead, projects, patch, patchRaw, onCreateProject, onPatchProject, readOnly, openTab })
 * The Project, Money, Files and Retainer sections (src/components/record)
 * render from what it returns; `cw.modals` mounts once in LeadDetail. */

export const fmtDay = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''; };
export const fmtDayShort = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };
export const copyText = async (toast, text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied.`); } catch { toast.error(COPY.error.copy); } };

/* ── Stepper ─────────────────────────────────────────────────────── */
export function Stepper({ project }) {
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
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => {
    const pick = mode === 'package' ? { packageId } : mode === 'addons' ? { addonIds } : { custom: { ...custom, total: Number(custom.total) || 0 } };
    return buildProject(lead._id, pick, { startDate: start, drive });
  }, [lead._id, mode, packageId, addonIds, custom, start, drive]);
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
          <Row gap={2} justify="between" align="center"><span className="rc-label">{preview.name || 'Project'}</span><Pill id={preview.kind} list={PROJECT_KINDS} size="sm" /></Row>
          <span className="dt-opt-n">{money(preview.total)}</span>
          <p className="dt-muted">{preview.plan ? planLine({ ...preview.plan, total: preview.total, alt: null }) : 'One payment, due at the start.'}</p>
          <Stack gap={0}>{preview.invoices.map(s => <Row key={s.id} gap={2} justify="between" className="cw-preview-row"><span>{s.label}</span><span>{money(s.amount)}, {fmtDayShort(s.dueAt)}</span></Row>)}</Stack>
        </Card>
        <Input label="Drive folder (optional)" value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/..." />
      </Stack>
    </Sheet>
  );
}

/* ── The hook ────────────────────────────────────────────────────── */
/**
 * @param {object} args
 * @param {object} args.lead
 * @param {Array} args.projects every project (filtered here)
 * @param {Function} args.patch (set) => Promise<boolean> patches the lead, toasts on failure
 * @param {Function} args.patchRaw (set) => Promise<boolean> for InlineEdit, which toasts itself
 * @param {Function} [args.onCreateProject] (doc) => Promise<item|null>
 * @param {Function} [args.onPatchProject] (id, set) => Promise<boolean>
 * @param {Function} args.openTab (id) => void opens a section of the record
 */
export function useClientWorkspace({ lead, projects, patch, patchRaw, onCreateProject, onPatchProject, readOnly = false, openTab }) {
  const toast = useToast();
  const shell = useShell();
  // Planner prompt 2, part 5: the retainer month's delivered count comes from the planner when the client has one.
  const posts = shell?.posts || [];
  const plannerOn = !!lead.planner?.enabled;
  const [paidPulse, setPaidPulse] = useState(null); // invoice id that just got paid
  const [retPulse, setRetPulse] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  /* The invoice and delivery emails (CRM revamp, step 6): the server stamps the project, so it reloads after a send. */
  const email = useSendEmail({ lead, patch, onSent: () => { shell?.refreshLeads?.(); shell?.projectOps?.reload?.(); } });
  /* CRM revamp, step 7: New project and Start a retainer are computer only; a phone gets the card. */
  const co = useComputerOnly();
  const [newOpen, setNewOpen] = useState(false);
  const [retOpen, setRetOpen] = useState(false);
  const openNew = () => (co.phone ? co.open('New project', lead.business) : setNewOpen(true));
  const openRet = () => (co.phone ? co.open('Start a retainer', lead.business) : setRetOpen(true));
  const mine = useMemo(() => projectsOf(projects, lead._id), [projects, lead._id]);
  const work = useMemo(() => mine.filter(p => p.kind !== 'retainer'), [mine]);
  const [projId, setProjId] = useState(null);
  const current = work.find(p => String(p._id) === String(projId)) || work.find(isActiveProject) || work[0] || null;
  useEffect(() => { setProjId(null); }, [lead._id]);
  const [round, setRound] = useState(null); // { project, extra }
  const [roundNote, setRoundNote] = useState('');
  const [pay, setPay] = useState(null); // { project, item }
  const [payForm, setPayForm] = useState({ amount: '', at: today(), label: '' });
  const [manual, setManual] = useState(false);
  const [manualForm, setManualForm] = useState({ amount: '', label: '', at: today(), projectId: '' });
  const [retForm, setRetForm] = useState({ planId: RETAINERS[1].id, start: today(), billDay: String(new Date().getDate() > 28 ? 28 : new Date().getDate()) });
  const [logDel, setLogDel] = useState(null); // { project, month }
  const [logForm, setLogForm] = useState({ count: '1', note: '' });
  const [busy, setBusy] = useState(false);

  // Project writes: `pp` toasts on failure (buttons, menus, checkboxes); `ppRaw` is for InlineEdit, which toasts itself.
  const ppRaw = (p, set) => (onPatchProject ? onPatchProject(p._id, set) : Promise.resolve(false));
  const pp = async (p, set) => { const ok = await ppRaw(p, set); if (!ok) toast.error(COPY.error.save); return ok; };
  const otherActive = (p) => work.some(x => String(x._id) !== String(p._id) && isActiveProject(x));

  /* Stage changes, with the delivery gate. Delivered is one dialog that
     carries the review link with a Copy button; copying ticks "Review link
     sent" on the delivery checklist as an undoable default. */
  const [deliver, setDeliver] = useState(null); // { project, copied }
  const reviewUrl = lead.showcase?.slug ? `https://visualizestudio.org/review/${lead.showcase.slug}` : '';
  const confirmDeliver = async () => {
    const p = deliver.project;
    const d = { driveShared: false, emailSent: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', ...(p.delivery || {}) };
    setBusy(true);
    const ok = await pp(p, { stage: 'delivered', deliveredAt: p.deliveredAt || new Date().toISOString(), delivery: { ...d, reviewLinkSent: d.reviewLinkSent || !!deliver.copied, steps: { ...deliveryStepsAtDelivery(), ...(d.steps || {}) } } });
    setBusy(false);
    if (ok) { setDeliver(null); toast.success(`${p.name} delivered.${deliver.copied ? ' Review link copied and ticked.' : ''}`); if (!otherActive(p)) patch({ clientStatus: 'delivered' }); }
    else toast.error(COPY.error.save);
  };
  const setStage = async (p, stage) => {
    if (stage === 'delivered') {
      const why = deliverBlockReason(p);
      if (why) { if (await confirm({ title: 'Not ready to deliver', body: why, confirmLabel: 'Open money', icon: 'CreditCard01' })) openTab('money'); return; }
      setDeliver({ project: p, copied: false });
      return;
    }
    const ok = await pp(p, { stage });
    if (ok && (lead.clientStatus === 'delivered' || !lead.clientStatus)) patch({ clientStatus: 'active' });
  };
  const advance = (p) => { const n = nextStage(p); if (n) setStage(p, n); };
  const archive = async (p) => { if (await confirm({ title: `Archive ${p.name}?`, body: 'It leaves the list. The ledger entries it paid stay on the client.', danger: true, confirmLabel: 'Archive' })) pp(p, { archived: true }); };

  /* Revision rounds. */
  const openRound = (p) => { setRound({ project: p, extra: revisionsExhausted(p) }); setRoundNote(''); };
  const saveRound = async () => {
    const p = round.project; const rev = { max: revisionsMax(p), used: revisionsUsed(p), log: [...(p.revisions?.log || [])], ...(p.revisions || {}) };
    rev.log = [...(p.revisions?.log || []), { at: new Date().toISOString(), note: roundNote.trim(), extra: !!round.extra }];
    rev.used = rev.log.filter(r => !r.extra).length;
    const set = { revisions: rev };
    if (round.extra) {
      const fee = extraRoundFeeFor(p); const n = extraRounds(p) + 1;
      set.invoices = [...invoicesOf(p), { ...newInvoice({ label: `Extra round ${n}`, amount: fee, dueAt: today(), status: 'sent' }), ledgerId: '', extra: true }];
      set.total = (Number(p.total) || 0) + fee;
    }
    setBusy(true);
    const ok = await pp(p, set);
    setBusy(false);
    if (ok) { toast.success(round.extra ? `Extra round logged, ${money(extraRoundFeeFor(p))} added as an invoice.` : `Round ${rev.used} of ${rev.max} logged.`); setRound(null); setRoundNote(''); }
  };

  /* Mark paid (CRM revamp, step 5): the ledger entry as today (or the day given), then the invoice paid and pointed at it. */
  const payInvoice = async (p, item, { paidAt = '', note = '' } = {}) => {
    const amount = Number(item.amount) || 0;
    const ledgerId = uid();
    setBusy(true);
    const ok1 = await patch({ purchases: [...(lead.purchases || []), { id: ledgerId, label: `${p.name}: ${item.label || 'payment'}`, amount, at: paidAt || today(), notes: note || '', projectId: String(p._id) }] });
    if (!ok1) { setBusy(false); return false; }
    let invoices = replaceInvoice(invoicesOf(p), markInvoicePaid(item, { paidAt: paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : '', note, ledgerId }));
    const set = { invoices };
    if (p.kind === 'retainer') {
      const future = invoices.filter(s => scheduleStatus(s) !== 'paid');
      if (future.length < 6) { const last = invoices[invoices.length - 1]; invoices = [...invoices, ...retainerSchedule(item.amount, addMonths(last.dueAt, 1, p.retainer?.billDay), p.retainer?.billDay, 6).map((s, i) => ({ ...s, label: `Month ${invoices.length + i + 1}` }))]; set.invoices = invoices; }
    }
    const ok2 = await pp(p, set);
    if (ok2 && p.kind === 'retainer' && lead.retainer) { const nx = nextUnpaid({ invoices }); patch({ retainer: { ...lead.retainer, nextBillAt: nx?.dueAt || '' } }); }
    setBusy(false);
    if (ok2) { toast.success(`${money(amount)} recorded.`); setPaidPulse(item.id); setTimeout(() => setPaidPulse(null), durationMs('--v-dur-slow') * 2 + 60); }
    return ok2;
  };
  const openPay = (p, item) => { setPay({ project: p, item }); setPayForm({ amount: String(item.amount), at: today(), label: `${p.name}: ${item.label || 'payment'}` }); };
  const savePay = async () => { const { project: p, item } = pay; const ok = await payInvoice({ ...p }, { ...item, amount: Number(payForm.amount) || item.amount }, { paidAt: payForm.at, note: '' }); if (ok) setPay(null); };
  const openManual = () => setManual(true);
  const saveManual = async () => {
    const amount = Number(manualForm.amount) || 0; if (!manualForm.label.trim()) return;
    setBusy(true);
    const ok = await patch({ purchases: [...(lead.purchases || []), { id: uid(), label: manualForm.label.trim(), amount, at: manualForm.at || today(), notes: '', ...(manualForm.projectId ? { projectId: manualForm.projectId } : {}) }] });
    setBusy(false);
    if (ok) { toast.success('Payment added.'); setManual(false); setManualForm({ amount: '', label: '', at: today(), projectId: '' }); }
  };

  /* Retainer. */
  const startRetainer = async () => {
    if (!onCreateProject) return;
    const r = retainerOf(retForm.planId); const billDay = Math.max(1, Math.min(28, Number(retForm.billDay) || 1));
    setBusy(true);
    const item = await onCreateProject(buildRetainerProject(lead._id, r.id, retForm.start, billDay));
    if (item) {
      const first = nextUnpaid(item);
      await patch({ retainer: { projectId: String(item._id), planId: r.id, amount: r.price, status: 'active', startedAt: retForm.start, billDay, nextBillAt: first?.dueAt || retForm.start, cancelAt: '' }, clientStatus: lead.clientStatus === 'paused' ? 'active' : (lead.clientStatus || 'active') });
      toast.success(`${r.label} retainer started, ${money(r.price)} a month.`);
      setRetOpen(false);
      setRetPulse(true); openTab('retainer'); setTimeout(() => setRetPulse(false), durationMs('--v-dur-slow') * 2 + 60);
    } else toast.error(COPY.error.create);
    setBusy(false);
  };
  const setRet = (next) => patch({ retainer: { ...lead.retainer, ...next } });
  const cancelRetainer = async () => {
    if (!(await confirm({ title: 'Cancel the retainer?', body: `${CANCEL_NOTICE_DAYS} days notice: it keeps billing until ${fmtDay(cancelAtFor().slice(0, 10))}, then it is cancelled by the monthly job or by hand.`, danger: true, confirmLabel: 'Give notice' }))) return;
    if (await setRet({ status: 'ending', cancelAt: cancelAtFor() })) toast.success('Notice given. The retainer ends in 30 days.');
  };
  const cancelNow = async () => { if (await confirm({ title: 'Mark the retainer cancelled now?', body: 'Use this once the notice period is over.', danger: true, confirmLabel: 'Cancelled' })) setRet({ status: 'cancelled', nextBillAt: '' }); };
  const ret = lead.retainer || null;
  const retPlan = ret ? retainerOf(ret.planId) : null;
  const retProject = ret?.projectId ? mine.find(p => String(p._id) === String(ret.projectId)) : null;
  const months = retProject ? (() => { const cur = monthKey(); const keys = [...new Set([cur, ...(retProject.monthly || []).map(m => m.month)])].sort().reverse(); return keys.map(k => monthRecord(retProject, k)); })() : [];
  const openLogDel = (p, month) => { setLogDel({ project: p, month }); setLogForm({ count: '1', note: '' }); };
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
    const d = { driveShared: false, emailSent: false, pitchSent: false, reviewLinkSent: false, followUpLeadCallbackAt: '', ...(p.delivery || {}) };
    if (id === 'followUp') {
      if (v) {
        const at = new Date(); at.setDate(at.getDate() + FOLLOW_UP_DAYS); at.setHours(10, 0, 0, 0);
        const ok = await patch({ callStatus: 'callback', callbackAt: at.toISOString(), callLog: [...(lead.callLog || []), { at: new Date().toISOString(), outcome: 'callback', note: 'Retainer follow up', meeting: '', email: '' }] });
        if (!ok) return;
        await pp(p, { delivery: { ...d, followUpLeadCallbackAt: at.toISOString(), steps: deliveryStepsAfter(d, 'followUp', true) } });
        toast.success(`Follow up set for ${fmtDateTime(at)}. It is on the Calendar.`);
      } else await pp(p, { delivery: { ...d, followUpLeadCallbackAt: '', steps: deliveryStepsAfter(d, 'followUp', false) } });
      return;
    }
    await pp(p, { delivery: { ...d, [id]: v, steps: deliveryStepsAfter(d, id, v) } });
  };
  const writeInvoices = (p) => (invoices) => pp(p, { invoices });
  const ledger = useMemo(() => (lead.purchases || []).map((x, i) => ({ ...x, _i: i })).sort((a, b) => String(b.at).localeCompare(String(a.at))), [lead.purchases]);

  const modals = (
    <>
      {confirmDialog}
      {email.modal}
      {co.sheet}
      {newOpen && <NewProjectSheet lead={lead} onClose={() => setNewOpen(false)} onCreate={async (doc) => { const item = onCreateProject ? await onCreateProject(doc) : null; if (item) { setNewOpen(false); setProjId(item._id); toast.success(`${item.name} created.`); if (lead.clientStatus !== 'active') patch({ clientStatus: 'active' }); if (doc.links?.drive && !lead.links?.drive) patch({ links: { website: '', instagram: '', ...(lead.links || {}), drive: doc.links.drive } }); } else toast.error(COPY.error.create); }} />}
      <Modal open={!!round} onClose={() => setRound(null)} title={round?.extra ? 'Log an extra round' : `Log round ${round ? revisionsUsed(round.project) + 1 : ''} of ${round ? revisionsMax(round.project) : REVISION_ROUNDS}`} description={round?.extra ? `${money(round ? extraRoundFeeFor(round.project) : 0)} for a ${round?.project.kind === 'web' || round?.project.kind === 'combined' ? 'web' : 'design'} round, added to the schedule as an unpaid line.` : 'What changed in this round.'}
        footer={<><Button variant="ghost" onClick={() => setRound(null)}>Cancel</Button><Button loading={busy} onClick={saveRound}>{round?.extra ? 'Log extra round' : 'Log round'}</Button></>}>
        <Textarea label={round?.extra ? 'Reason' : 'What changed'} rows={3} value={roundNote} onChange={(e) => setRoundNote(e.target.value)} placeholder={round?.extra ? 'They want the mark reworked after approving it.' : 'Tightened the wordmark spacing, swapped the secondary color.'} data-autofocus />
      </Modal>
      <Modal open={!!deliver} onClose={() => setDeliver(null)} title={deliver ? `Mark ${deliver.project.name} delivered?` : ''} description="Every delivery ends with a retainer pitch. The Send delivery checklist opens on the project."
        footer={<><Button variant="ghost" onClick={() => setDeliver(null)} disabled={busy}>Cancel</Button><Button loading={busy} icon={Check} onClick={confirmDeliver} className="cw-deliver-confirm">Mark delivered</Button></>}>
        <Card level={2} padding={3} className="cw-deliver-link">
          <p className="rc-label">Review link</p>
          {reviewUrl
            ? <><Row gap={1} align="center" wrap><a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="cw-deliv-a lay-truncate">{reviewUrl}</a><Button variant="secondary" size="md" icon={Copy01} onClick={async () => { await copyText(toast, reviewUrl, 'Review link'); setDeliver(d => (d ? { ...d, copied: true } : d)); }}>{deliver?.copied ? 'Copied' : 'Copy'}</Button></Row>
              <p className="dt-muted">Text it to them with the files. Copying ticks "Review link sent" on the checklist; untick it on the project if you change your mind.</p></>
            : <p className="dt-muted">Publish their showcase to get a review link; the checklist item stays on the project.</p>}
        </Card>
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

  return {
    lead, readOnly, patch, patchRaw, toast, confirm, email, co, busy,
    mine, work, current, setProjId, ret, retPlan, retProject, months, ledger, posts, plannerOn, paidPulse, retPulse,
    openNew, openRet, openRound, openPay, openManual, openLogDel,
    pp, ppRaw, setStage, advance, archive, payInvoice, setRet, cancelRetainer, cancelNow, setDelivery, writeInvoices,
    modals,
  };
}
