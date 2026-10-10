import { useEffect, useMemo, useState } from 'react';
import { COPY } from '../shared/copy';
import { useSendEmail } from './SendEmailModal';
import { useRoundLog } from './RoundLog';
import { invoicesOf, markPaid as markInvoicePaid, replaceInvoice } from '../lib/invoices';
import { durationMs } from '../ui/motion';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import {
  Stack, Row, Grid, Card, Button, Sheet, Modal, Input, Select, useToast, useConfirm,
} from '../ui';
import { projectStageOf } from '../shared/semantics';
import { retainerOf } from '../shared/pricing';
import { money } from '../shared/format';
import { fmtDateTime } from '../shared/dates';
import { useShell } from '../shell/ShellContext';
import {
  uid, today, monthKey, monthLabel, addMonths, localDate, stagesFor, nextStage, retainerSchedule, scheduleStatus, deliverBlockReason, isActiveProject, deliveryStepsAfter, deliveryStepsAtDelivery, FOLLOW_UP_DAYS, cancelAtFor, monthRecord, projectsOf, nextUnpaid, CANCEL_NOTICE_DAYS,
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

/* ── The hook ────────────────────────────────────────────────────── */
/**
 * @param {object} args
 * @param {object} args.lead
 * @param {Array} args.projects every project (filtered here)
 * @param {Function} args.patch (set) => Promise<boolean> patches the lead, toasts on failure
 * @param {Function} args.patchRaw (set) => Promise<boolean> for InlineEdit, which toasts itself
 * @param {Function} [args.onPatchProject] (id, set) => Promise<boolean>
 * @param {Function} args.openTab (id) => void opens a section of the record
 */
export function useClientWorkspace({ lead, projects, patch, patchRaw, onPatchProject, readOnly = false, openTab }) {
  const toast = useToast();
  const shell = useShell();
  // Planner prompt 2, part 5: the retainer month's delivered count comes from the planner when the client has one.
  const posts = shell?.posts || [];
  const plannerOn = !!lead.planner?.enabled;
  const [paidPulse, setPaidPulse] = useState(null); // invoice id that just got paid
  const retPulse = false; // the retainer's won pulse went with the sheet; the page opens the record on its Retainer tab
  const [confirm, confirmDialog] = useConfirm();
  /* The invoice and delivery emails (CRM revamp, step 6): the server stamps the project, so it reloads after a send. */
  const email = useSendEmail({ lead, patch, onSent: () => { shell?.refreshLeads?.(); shell?.projectOps?.reload?.(); } });
  /* New project and Start a retainer are one page at every width (src/pages/AdminProjectNew.jsx). */
  const openNew = () => shell?.openProjectNew?.(lead);
  const openRet = () => shell?.openProjectNew?.(lead, 'retainer');
  const mine = useMemo(() => projectsOf(projects, lead._id), [projects, lead._id]);
  const work = useMemo(() => mine.filter(p => p.kind !== 'retainer'), [mine]);
  const [projId, setProjId] = useState(null);
  const current = work.find(p => String(p._id) === String(projId)) || work.find(isActiveProject) || work[0] || null;
  useEffect(() => { setProjId(null); }, [lead._id]);
  const [pay, setPay] = useState(null); // { project, item }
  const [payForm, setPayForm] = useState({ amount: '', at: today(), label: '' });
  const [manual, setManual] = useState(false);
  const [manualForm, setManualForm] = useState({ amount: '', label: '', at: today(), projectId: '' });
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

  /* Revision rounds: one flow, shared with the Concepts editor (RoundLog.jsx). */
  const roundLog = useRoundLog({ onPatchProject });
  const openRound = roundLog.open;

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
  /* Review links: the Delivery checklist's Send review link step opens this client's Reviews card with the link minted if it is missing. */
  const sendReviewLink = () => { shell?.go?.('reviews', { leadId: String(lead._id), generate: true }); };
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
      {roundLog.modal}
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
      <Modal open={!!logDel} onClose={() => setLogDel(null)} title="Log delivery" description={logDel ? monthLabel(logDel.month) : ''}
        footer={<><Button variant="ghost" onClick={() => setLogDel(null)}>Cancel</Button><Button loading={busy} icon={Check} onClick={saveDelivery}>Log</Button></>}>
        <Grid minColumnWidth={120} gap={2}><Input label="How many" type="number" inputMode="numeric" min={0} value={logForm.count} onChange={(e) => setLogForm(f => ({ ...f, count: e.target.value }))} data-autofocus /></Grid>
        <Input label="Note (optional)" value={logForm.note} onChange={(e) => setLogForm(f => ({ ...f, note: e.target.value }))} placeholder="Three story graphics and the monthly plan" />
      </Modal>
    </>
  );

  return {
    lead, readOnly, patch, patchRaw, toast, confirm, email, busy,
    mine, work, current, setProjId, ret, retPlan, retProject, months, ledger, posts, plannerOn, paidPulse, retPulse,
    openNew, openRet, openRound, openPay, openManual, openLogDel,
    pp, ppRaw, setStage, advance, archive, payInvoice, setRet, cancelRetainer, cancelNow, setDelivery, writeInvoices, sendReviewLink,
    modals,
  };
}
