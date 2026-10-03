/* LeadDetail: ONE record for Leads, Deals and Clients (UI simplification,
 * part A). Laws that hold in every mode at every width:
 *   1. One number, one place. "$150 paid of $350" renders exactly once, in the Money section's header.
 *   2. One way into a section: a tab on the computer, a row on the phone. No folds, no subnav plus accordion, no section buttons on cards.
 *   3. Empty facts do not render. One "Add a detail" ghost button opens a sheet of InlineEdits for the empty ones.
 *   4. At most two pills in the header: one status pill (stage; client status when a client; the newest deal checkpoint when a deal) and priority. Industry is text.
 *   5. At most three controls in the header: one primary, one secondary, one overflow menu.
 *   6. Every section has a one line empty state with one action, never a card per empty thing.
 * The pieces live in src/components/record: RecordHeader, NextActionStrip,
 * FactsGrid, one component per section, and the registry that lists the
 * sections by mode (lead, deal, client). Everything renders from one `rec`
 * object built here from the props this component always had. */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Trophy01 from '@untitled-ui/icons-react/build/esm/Trophy01';
import {
  PageShell, ScrollArea, StickyFooterBar, Row, Stack, Card, Button, Tabs, Sheet, Modal, Textarea, SegmentedControl, Stagger, useConfirm, SkeletonBlock, SkeletonCircle, SkeletonText, useToast, useMediaQuery,
} from '../ui';
import { useShell, useTopBar } from '../shell/ShellContext';
import { usePush, sectionRootOf } from '../shell/nav-history';
import { normalizeLead } from '../lib/leads';
import { postsOf } from '../lib/posts';
import LeadForm from './LeadForm';
import TaskSheet from './TaskSheet';
import { isTask } from '../lib/tasks';
import CallbackPicker from './CallbackPicker';
import { useDecline } from './DeclineSheet';
import { useSendEmail } from './SendEmailModal';
import { useClientWorkspace, copyText } from './ClientWorkspace';
import { liveNextAction, nextActionFor } from '../lib/nextAction';
import { dealOf, metPatch, tickPatch, checkpointOf } from '../lib/deal';
import { wonWithoutPayment } from '../lib/dealConvert';
import { invoiceStatus } from '../lib/invoices';
import { nextUnpaid, brandText } from '../lib/projects';
import { newestSet, statusOf as conceptStatusOf } from '../lib/concepts';
import { normalizeStage, PRIORITIES, CLIENT_STATUSES, conceptSetStatusOf } from '../shared/semantics';
import { formatPhone } from '../shared/phone';
import { fmtDateTime } from '../shared/dates';
import { COPY } from '../shared/copy';
import { durationMs } from '../ui/motion';
import { RecordHeader, NextActionStrip, SocialsStrip, FactsGrid, AnglePara, SectionRows, SECTIONS, SECTIONS_BY_MODE, checkpointAction, runKeyFor } from './record';

const FIRST = { lead: 'playbook', deal: 'checkpoints', client: 'project' };
/* Next up (CRM revamp, step 2): a row's control opens the record on the section that does the thing. */
const INTENT_TAB = { outcome: 'checkpoints', payments: 'money', checkpoints: 'checkpoints', projects: 'project', retainer: 'retainer', meeting: 'meeting' };
const tidy = (items) => items.filter((it, i, all) => it !== 'divider' || (i > 0 && i < all.length - 1 && all[i - 1] !== 'divider'));

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {Array} [props.submissions]
 * @param {Function} props.onPatch (id, set) => Promise<boolean>   optimistic with rollback (AdminApp)
 * @param {Function} [props.onDelete] (id) => Promise
 * @param {Function} [props.onLinkSubmission]
 * @param {Function} props.onClose back to the list
 * @param {boolean} [props.readOnly]
 * @param {{ projects: Array, onCreateProject: Function, onPatchProject: Function }} [props.client] client mode
 * @param {{ kind: string, n: number }} [props.intent] opens a section on arrival
 */
/* triage (Triage lets you look before you decide): { score, source, onKeep, onLater, onDecline, onBin }. The record opens in lead
 * mode with everything editable, the header shows the source pill and the score, and a decision bar pinned at the bottom
 * replaces the outcome bar. */
export default function LeadDetail({ lead: rawLead, submissions = [], onPatch, onDelete, onLinkSubmission, onClose, readOnly = false, client = null, intent = null, triage = null }) {
  const lead = normalizeLead(rawLead);
  const leadId = lead._id;
  const shell = useShell();
  const toast = useToast();
  const phone = useMediaQuery('(max-width: 767px)');
  const stage = normalizeStage(lead);
  const clientMode = !!client && (stage === 'client' || stage === 'won');
  const dealMode = !clientMode && (stage === 'booked' || stage === 'deal');
  const mode = clientMode ? 'client' : dealMode ? 'deal' : 'lead';
  const ids = SECTIONS_BY_MODE[mode];
  const deal = dealOf(lead);
  const [confirm, confirmDialog] = useConfirm();
  // Two write paths: `patch` toasts on failure (buttons, menus, checkboxes); `patchRaw` is for InlineEdit, which shows its own failure toast.
  const patchRaw = (set) => (readOnly ? Promise.resolve(false) : onPatch(leadId, set));
  const patch = async (set) => { const ok = await patchRaw(set); if (!ok && !readOnly) toast.error(COPY.error.save); return ok; };

  /* The section that is open: the tab on a computer, the row on a phone (none until tapped). */
  const first = FIRST[mode];
  const [tabState, setTabState] = useState(first);
  useEffect(() => { setTabState(first); }, [leadId, first]);
  const intentN = intent?.n; const intentKind = intent?.kind;
  /* A phone (mobile revamp): the record is a first screen, and each other section is a screen of its own, a history entry that carries
     `sec` (Back returns to the first screen, and closing the record for good goes back past both). An intent (chase the invoice, open the
     checkpoints) opens its section at once, with nothing to unfold and nothing to shift. A computer keeps its tabs in state. */
  const location = useLocation(); const navigate = useNavigate(); const pushEntry = usePush();
  const entryOpen = location.state?.open || null;
  const entryDriven = phone && !!entryOpen;
  const intentTarget = intentKind && ids.includes(INTENT_TAB[intentKind]) && INTENT_TAB[intentKind] !== first ? INTENT_TAB[intentKind] : null; // the stage's own section is already on the first screen
  const secEntry = entryDriven && entryOpen.sec && ids.includes(entryOpen.sec) ? entryOpen.sec : null;
  const localSec = phone && !entryDriven && tabState !== first ? tabState : null; // a phone with no history entry behind it (an embedded record): the same screens, held in state
  const phoneTab = entryDriven ? (secEntry || intentTarget) : localSec;
  const tab = phone ? (phoneTab || first) : tabState;
  const openTab = (id) => {
    if (!ids.includes(id)) return;
    if (!entryDriven) { setTabState(id); return; }
    if (id === tab) return;
    pushEntry(location.pathname + (location.search || ''), { open: { ...entryOpen, sec: id, intent: null, recordOrigin: !!entryOpen.recordOrigin || !!location.state?.origin, n: Date.now() }, selectedId: leadId });
  };
  const setTab = openTab;
  /* A section opens at its top; the first screen comes back where it was left. */
  const scrollMemo = useRef(0);
  useEffect(() => {
    const el = phone ? document.querySelector('.dt-scroll') : null;
    if (!el) return undefined;
    el.scrollTop = phoneTab ? 0 : scrollMemo.current;
    return () => { if (!phoneTab) scrollMemo.current = el.scrollTop; };
  }, [phoneTab, phone]);
  useEffect(() => {
    if (phone) return undefined;
    const target = intentTarget;
    if (!target) return undefined;
    const t = setTimeout(() => setTabState(target), 60);
    return () => clearTimeout(t);
  }, [intentN, intentKind, intentTarget, leadId, phone]);
  /* Closing the record for good: from a section screen that is two entries back (the section, then the record); a record reached by a deep
     link has no list behind it, so it goes to its section's root. */
  const closeRecord = () => {
    if (!secEntry) { onClose?.(); return; }
    if (entryOpen.recordOrigin) navigate(-2); else navigate(sectionRootOf(location.pathname), { replace: true });
  };
  const backFn = secEntry ? () => navigate(-1) : localSec ? () => setTabState(first) : onClose;
  const activeSectionLabel = phone && phoneTab ? (SECTIONS[phoneTab]?.label || '') : '';
  useTopBar({ title: activeSectionLabel || lead.business, back: backFn });

  const email = useSendEmail({ lead, patch: patchRaw, onSent: () => shell?.refreshLeads?.() });
  const cw = useClientWorkspace({ lead, projects: client?.projects || [], patch, patchRaw, onCreateProject: client?.onCreateProject, onPatchProject: client?.onPatchProject, readOnly, openTab });
  const decline = useDecline({ onPatch: (id, set) => (readOnly ? Promise.resolve(false) : onPatch(id, set)), onDeclined: () => closeRecord() });
  const [editAll, setEditAll] = useState(false);
  const [cbOpen, setCbOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false); // the Set task sheet (tasks with a due date)
  const [outcome, setOutcome] = useState(null); // 'won' | 'lost'
  const [outcomeNote, setOutcomeNote] = useState('');
  const [wonPulse, setWonPulse] = useState(false);
  const [busy, setBusy] = useState('');
  const [invoiceReq, setInvoiceReq] = useState(null); // { n, kind, inv } for the Money tab's card
  const wonClose = () => { setWonPulse(true); setTimeout(() => { setWonPulse(false); closeRecord(); }, durationMs('--v-dur-slow') * 2 + 60); };

  const actionCtx = { projects: shell?.projects || [], sets: shell?.sets || [] };
  const next = liveNextAction(lead, actionCtx);
  /* One runner for every action button on the record: the strip, the header's primary, the outcome bar and the Checkpoints rows. */
  const run = async (what) => {
    const [kind, arg] = String(what).split(':');
    if (kind === 'call') { if (lead.phone) shell?.go('calls', { ids: [leadId], autostart: true }); return; }
    if (kind === 'build') { shell?.openConcepts?.(lead); return; }
    if (kind === 'tab') { openTab(arg); return; }
    if (kind === 'email') { email.open(arg); return; }
    if (kind === 'clear') { await patchRaw({ nextAction: nextActionFor(lead, actionCtx) }); return; }
    if (kind === 'done') { if (next) await patch({ nextAction: { ...next, doneAt: new Date().toISOString() } }); return; }
    if (kind === 'task') { setTaskOpen(true); return; }
    if (kind === 'met') { setBusy(what); const ok = await patch(metPatch(lead)); setBusy(''); if (ok) { toast.success(`Met them. ${lead.business} is a deal.`); openTab('checkpoints'); } return; }
    if (kind === 'tick') { setBusy(what); const ok = await patch(tickPatch(lead, arg)); setBusy(''); if (ok) toast.success(`${checkpointOf(arg)?.label || 'Step'} ticked.`); }
  };
  const requestInvoice = (kind, inv = null) => { setInvoiceReq({ n: Date.now(), kind, inv }); openTab('money'); };

  /* Outcomes */
  const openOutcome = (kind) => { setOutcomeNote(''); setOutcome(kind); };
  const closeOut = async () => {
    const at = new Date().toISOString();
    const prevStage = lead.stage;
    if (outcome === 'won') {
      /* Mark won without payment (CRM revamp, step 5): the conversion with no invoice and no ledger entry; the project starts too. */
      const conv = wonWithoutPayment(lead);
      const ok = await patch({ ...conv.leadSet, bookedOutcome: { ...conv.leadSet.bookedOutcome, reason: outcomeNote.trim() || 'Pro bono' } });
      if (ok) {
        if (shell?.projectOps?.create) shell.projectOps.create(conv.projectDoc);
        setOutcome(null);
        toast.success(`${lead.business} is a client.`, { action: { label: 'Open in Clients', onClick: () => shell?.go('clients') } });
        wonClose();
      }
    } else {
      // explicit: true, because a booked, won or client record leaving its stage is the guard's business.
      const ok = await patch({ stage: 'lost', bookedOutcome: { result: 'lost', reason: outcomeNote.trim(), at }, explicit: true });
      if (ok) { toast.undo(`${lead.business} marked lost.`, () => onPatch(leadId, { stage: prevStage || 'booked', bookedOutcome: { result: 'lost', reason: '', at: '' }, explicit: true }), { seconds: 6 }); setOutcome(null); closeRecord(); }
    }
  };
  const openTask = () => setTaskOpen(true);
  const taskNow = isTask(next) && !next.doneAt ? next : null;
  const del = async () => { if (!onDelete) return; if (await confirm({ title: `Delete ${lead.business}?`, body: 'It moves to Recently deleted in Settings and can be restored for 30 days.', danger: true, confirmLabel: 'Delete' })) await onDelete(leadId); };

  const rec = { lead, stage, mode, clientMode, dealMode, readOnly, deal, patch, patchRaw, onPatch, onLinkSubmission, submissions, shell, toast, email, confirm, cw, next, run, busy, has: (id) => ids.includes(id), openTab, wonClose, invoiceReq, triage, openTask, taskNow };

  /* The header's three controls by mode (law 5). */
  const ca = dealMode ? checkpointAction(lead, { canBuild: !!shell?.openConcepts }) : null;
  let primary = null; let secondary = null;
  if (mode === 'lead') {
    primary = stage === 'client' || stage === 'won'
      ? <Button icon="User01" onClick={() => shell?.openRecord?.(lead)} className="rc-primary">Open client record</Button>
      : <Button icon={PhoneCall01} disabled={!lead.phone} onClick={() => run('call')} className="rc-primary">Call</Button>;
    if (!readOnly && stage === 'lead' && shell?.openListPicker) secondary = <Button variant="secondary" icon="Rows01" onClick={() => shell.openListPicker([lead])} className="rc-secondary">{lead.listId ? 'Move list' : 'Add to list'}</Button>;
  } else if (mode === 'deal') {
    if (ca && !readOnly) primary = <Button icon={ca.icon} loading={busy === runKeyFor(ca)} onClick={() => run(runKeyFor(ca))} className={`rc-primary${ca.kind === 'met' ? ' dt-met' : ''}`} aria-label={ca.label === 'Tick' ? `Tick ${ca.checkpoint.label.toLowerCase()}` : undefined}>{ca.label}</Button>;
    secondary = <Button variant="secondary" icon="CurrencyDollar" onClick={() => openTab('money')} className="rc-secondary">Invoices</Button>;
  } else {
    const cur = cw.current; const nx = cur ? nextUnpaid(cur) : null;
    if (!readOnly) {
      primary = !cur ? <Button icon="Plus" onClick={cw.openNew} className="rc-primary cw-new-project">New project</Button>
        : !nx ? <Button icon="Plus" onClick={() => requestInvoice('add')} className="rc-primary">Add invoice</Button>
          : invoiceStatus(nx) === 'draft' ? <Button icon="Send01" onClick={() => requestInvoice('send', nx)} className="rc-primary">Send invoice</Button>
            : <Button icon="Check" onClick={() => requestInvoice('pay', nx)} className="rc-primary">Mark paid</Button>;
      if (cur) secondary = <Button variant="secondary" icon="Plus" onClick={() => cw.openRound(cur)} className="rc-secondary">Log a round</Button>;
    }
  }

  /* The overflow menu, in the approved order; a group with nothing in it takes its divider with it. */
  const social = (k) => lead.socials?.[k] || '';
  const openUrl = (u) => window.open(u, '_blank', 'noopener');
  const hasShowcase = !!lead.showcase && typeof lead.showcase === 'object' && Object.keys(lead.showcase).length > 0;
  const plannerWaiting = postsOf(shell?.posts || [], leadId).filter(p => p.status === 'review').length;
  const plannerLabel = !lead.planner?.enabled ? 'off' : plannerWaiting ? `${plannerWaiting} in review` : 'on';
  const conceptSet = newestSet(shell?.sets, leadId);
  const conceptSt = conceptSet ? conceptSetStatusOf(conceptStatusOf(conceptSet)) : null;
  const menu = tidy([
    ...(!readOnly ? [
      { id: 'edit', label: 'Edit all', icon: 'Edit02', onSelect: () => setEditAll(true) },
      { id: 'status', label: clientMode ? 'Priority and status' : 'Priority', icon: 'Zap', onSelect: () => setStatusOpen(true) },
      { id: 'task', label: taskNow ? 'Edit task' : 'Set task', icon: 'CheckCircle', onSelect: openTask },
    ] : []),
    { id: 'text', label: 'Text', icon: 'MessageCircle01', disabled: !lead.phone, onSelect: () => { window.location.href = `sms:${String(lead.phone).replace(/[^0-9+]/g, '')}`; } },
    { id: 'mail', label: 'Email', icon: 'Mail01', disabled: !lead.email, onSelect: () => { window.location.href = `mailto:${lead.email}`; } },
    { id: 'ig', label: 'Instagram', icon: 'Camera01', disabled: !social('instagram'), onSelect: () => openUrl(social('instagram')) },
    { id: 'fb', label: 'Facebook', icon: 'ThumbsUp', disabled: !social('facebook'), onSelect: () => openUrl(social('facebook')) },
    { id: 'web', label: 'Website', icon: 'Globe01', disabled: !social('website'), onSelect: () => openUrl(social('website')) },
    { id: 'maps', label: 'Maps', icon: 'MarkerPin01', disabled: !social('google'), onSelect: () => openUrl(social('google')) },
    { id: 'copy', label: 'Copy phone', icon: 'Copy01', disabled: !lead.phone, onSelect: () => copyText(toast, formatPhone(lead.phone), 'Number') },
    ...(clientMode ? [{ id: 'brand', label: 'Copy brand', icon: 'Copy01', onSelect: () => copyText(toast, brandText(lead), 'Brand block') }] : []),
    'divider',
    ...(clientMode && shell?.openShowcase ? [{ id: 'showcase', label: `Showcase, ${hasShowcase ? (lead.showcase.published ? 'published' : 'draft') : 'none yet'}`, icon: 'Image01', onSelect: () => shell.openShowcase(lead) }] : []),
    ...(clientMode && shell?.openPlanner ? [{ id: 'planner', label: `Planner, ${plannerLabel}`, icon: 'Calendar', onSelect: () => shell.openPlanner(lead) }] : []),
    ...(shell?.openConcepts ? [{ id: 'concepts', label: `Concepts, ${conceptSt ? conceptSt.label.toLowerCase() : 'none'}`, icon: 'LayersThree01', onSelect: () => shell.openConcepts(lead) }] : []),
    'divider',
    ...(!readOnly && !clientMode && stage !== 'client' && stage !== 'won' && shell?.openListPicker ? [{ id: 'list', label: lead.listId ? 'Move list' : 'Add to list', icon: 'Rows01', onSelect: () => shell.openListPicker([lead]) }] : []),
    ...(!readOnly ? [{ id: 'callback', label: lead.callbackAt ? `Callback, ${fmtDateTime(lead.callbackAt)}` : 'Set a callback', icon: 'PhoneIncoming01', onSelect: () => setCbOpen(true) }] : []),
    ...(!readOnly && !clientMode && !['declined', 'won', 'client'].includes(stage) ? [{ id: 'decline', label: 'Decline', icon: 'SlashCircle01', onSelect: () => decline.open(lead) }] : []),
    ...(dealMode && !readOnly ? [{ id: 'lost', label: 'Mark as lost', icon: 'XClose', danger: true, onSelect: () => openOutcome('lost') }, { id: 'won', label: 'Mark won without payment', icon: 'Trophy01', onSelect: () => openOutcome('won') }] : []),
    ...(clientMode && !readOnly ? [{ id: 'newproj', label: 'New project', icon: 'Plus', onSelect: cw.openNew }, ...(!cw.ret || cw.ret.status === 'cancelled' ? [{ id: 'ret', label: 'Start a retainer', icon: 'RefreshCw01', onSelect: cw.openRet }] : [])] : []),
    ...(stage === 'client' && !clientMode && shell?.openRecord ? [{ id: 'openclient', label: 'Open client record', icon: 'User01', onSelect: () => shell.openRecord(lead) }] : []),
    'divider',
    ...(onDelete && !readOnly ? [{ id: 'del', label: 'Delete', icon: 'Trash01', danger: true, onSelect: del }] : []),
  ]);

  /* The sections of this mode: one component and one summary each. */
  const sections = ids.map(id => { const s = SECTIONS[id]; return { id, label: s.label, summary: s.summary(rec), body: <s.Component rec={rec} /> }; });
  const tabs = sections.filter(s => s.id !== 'details');
  const active = tabs.find(s => s.id === tab) || tabs[0];
  const firstSection = sections.find(x => x.id === first);
  const otherSections = sections.filter(x => x.id !== first);
  const header = <RecordHeader rec={rec} primary={primary} secondary={secondary} menu={menu} phone={phone} pulse={wonPulse} />;

  return (
    <PageShell className="dt">
      <ScrollArea bare className="dt-scroll" key={leadId}>
        {/* The entrance: the header, the strip and the sections step in once per record (Stagger, the kit's one entrance). */}
        <Stagger className="rc-inner" cap={5}>
          {!(phone && phoneTab) && header}
          {!(phone && phoneTab) && next && !next.doneAt ? <NextActionStrip rec={rec} /> : null}
          {mode === 'lead' && !(phone && phoneTab) ? <SocialsStrip rec={rec} onAdd={() => setEditAll(true)} /> : null}
          {phone && !phoneTab && firstSection && <div className="rc-first" role="region" aria-label={firstSection.label}>{firstSection.body}</div>}
          {phone && !phoneTab && <SectionRows sections={otherSections} onOpen={openTab} />}
          {phone && phoneTab && <div className="rc-secscreen" role="region" aria-label={activeSectionLabel}>{(sections.find(x => x.id === phoneTab) || {}).body}</div>}
          {!phone && <FactsGrid rec={rec} />}
          {!phone && lead.angle ? <AnglePara rec={rec} /> : null}
          {!phone && <Tabs label="Sections" tabs={tabs.map(t => ({ id: t.id, label: t.label }))} value={active.id} onChange={setTab} className="rc-tabs" />}
          {!phone && <div className="rc-panel" role="tabpanel" aria-label={active.label}>{active.body}</div>}
        </Stagger>
      </ScrollArea>
      {triage && !readOnly && (
        <StickyFooterBar className="dt-outbar dt-triagebar">
          <Row gap={2} wrap className="dt-outbar-row dt-triagebar-row">
            <Button icon="Check" onClick={triage.onKeep} className="tr-keep">Keep</Button>
            <Button variant="secondary" icon="Clock" onClick={triage.onLater} className="tr-later">Later</Button>
            <Button variant="secondary" icon="SlashCircle01" onClick={triage.onDecline} className="tr-decline">Decline</Button>
            <Button variant="danger" icon="Trash01" onClick={triage.onBin} className="tr-bin">Bin</Button>
          </Row>
        </StickyFooterBar>
      )}
      {dealMode && !readOnly && (
        <StickyFooterBar className="dt-outbar">
          <Row gap={2} className="dt-outbar-row">
            {primary}
            <Button variant="danger" icon={XClose} onClick={() => openOutcome('lost')}>Mark as lost</Button>
          </Row>
        </StickyFooterBar>
      )}
      {confirmDialog}
      {email.modal}
      {cw.modals}
      {decline.sheet}
      {editAll && <Sheet open onClose={() => setEditAll(false)} title="Edit lead" description={lead.business} tall width={640}><LeadForm lead={lead} onSave={async (v) => { const ok = await onPatch(leadId, v); if (ok) setEditAll(false); }} onCancel={() => setEditAll(false)} onDelete={onDelete ? async (id) => { await onDelete(id); setEditAll(false); } : undefined} /></Sheet>}
      {cbOpen && <CallbackPicker open onClose={() => setCbOpen(false)} value={lead.callbackAt} business={lead.business} onSave={async (v) => { const ok = await patch({ callbackAt: v || '' }); if (ok) { setCbOpen(false); toast.success(v ? `Callback set for ${fmtDateTime(v)}.` : 'Callback cleared.'); } }} />}
      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title={clientMode ? 'Priority and status' : 'Priority'} description={lead.business} footer={<Button variant="ghost" onClick={() => setStatusOpen(false)}>Done</Button>}>
        <Stack gap={3}>
          <SegmentedControl label="Priority" full options={PRIORITIES.map(p => ({ id: p.id, label: p.label, icon: p.icon }))} value={lead.priority || 'warm'} onChange={(id) => patch({ priority: id })} />
          {clientMode && <SegmentedControl label="Client status" full options={CLIENT_STATUSES.map(c => ({ id: c.id, label: c.label }))} value={lead.clientStatus || 'active'} onChange={(id) => patch({ clientStatus: id })} />}
        </Stack>
      </Modal>
      {taskOpen && <TaskSheet business={lead.business} task={taskNow} onClose={() => setTaskOpen(false)} onSave={(na) => patch({ nextAction: na })} onDone={taskNow ? async () => { await run('done'); return true; } : null} />}
      <Modal open={!!outcome} onClose={() => setOutcome(null)} title={outcome === 'won' ? `Mark ${lead.business} won without payment?` : `Mark ${lead.business} as lost?`} danger={outcome === 'lost'} description={outcome === 'won' ? 'Pro bono: they become a client now and the project starts with no invoice and nothing on the ledger.' : 'They leave Booked. Undo is available for six seconds.'}
        footer={<><Button variant="ghost" onClick={() => setOutcome(null)}>Cancel</Button><Button variant={outcome === 'lost' ? 'danger' : 'primary'} icon={outcome === 'won' ? Trophy01 : XClose} onClick={closeOut}>{outcome === 'won' ? 'Won, no payment' : 'Mark lost'}</Button></>}>
        <Textarea label="Note (optional)" rows={2} value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} placeholder={outcome === 'won' ? 'Went with Web Complete plus Site Care.' : 'Chose their nephew.'} data-autofocus />
      </Modal>
    </PageShell>
  );
}

/** LeadDetail.Skeleton: the record's shape while a deep link resolves, at both widths, by mode.
 * It renders the real header, facts, tabs and row classes with skeleton blocks inside, so the
 * loaded record lands on the same rows: the header, the strip on a deal, the facts grid (four
 * rows for a lead, five for a deal, eight for a client at the audit's fixtures), the angle, the
 * tabs and the first block of the first section; on a phone the header, the strip and one
 * 56px row per section. */
const SKELETON_FACTS = { lead: 4, deal: 5, client: 8 };
LeadDetail.Skeleton = function LeadDetailSkeleton({ mode = 'lead', deal = false, triage = false }) {
  const m = deal ? 'deal' : mode;
  const phone = useMediaQuery('(max-width: 767px)');
  const btn = (w, k) => <SkeletonBlock key={k} width={w} height={44} radius="var(--v-radius-md)" />;
  const head = (
    <header className={`rc-head${phone ? ' rc-head--phone' : ''}`}>
      {!phone && <span className="rc-avatar"><SkeletonCircle size={44} /></span>}
      <div className="rc-head-main">
        <div className="rc-head-top">{!phone && <SkeletonBlock width="40%" height={34} />}<span className="rc-pills">{[72, 56].map((w, i) => <SkeletonBlock key={i} width={w} height={22} radius="var(--v-radius-pill)" />)}</span></div>
        <div className="rc-ctx" style={{ height: phone && m !== 'client' ? (triage ? 42 : 36) : 18 }}><SkeletonBlock width={phone ? '90%' : '55%'} height={14} style={{ margin: '2px 0' }} /></div>
      </div>
      <div className="rc-head-actions">{btn(96, 1)}{btn(112, 2)}{btn(44, 3)}</div>
    </header>
  );
  const strip = m === 'deal' ? <div className="rc-next"><SkeletonBlock width={18} height={18} /><span className="rc-next-text" style={{ height: phone ? 54 : 26 }}><SkeletonBlock width={160} height={16} /></span><SkeletonBlock width={72} height={44} radius="var(--v-radius-md)" /></div> : null;
  const first = m === 'client'
    /* The project card runs the height of a project with its tasks and invoices (about 490px at 390). */
    ? <Card style={{ minHeight: phone ? 493 : undefined }}><SkeletonBlock width="40%" height={24} /><SkeletonText lines={2} /><SkeletonBlock width="100%" height={44} radius="var(--v-radius-md)" /></Card>
    : m === 'deal'
      ? <div className="rc-cp-pkg"><SkeletonBlock width="100%" height={68} radius="var(--v-radius-md)" /></div>
      : m === 'lead'
        /* Triage opens on the Playbook: four groups (accomplishments, gaps, drop these, before you dial), each a label, its items (1, 2, 0, 1 as a typical scraped lead) and the add row, under the pinned decision bar. */
        ? <>{(triage ? [1, 2, 0, 1] : [0, 0, 0, 1]).map((n, k) => <div key={k} className="rc-group"><SkeletonBlock width={120} height={16} />{Array.from({ length: n }, (_, i) => <div key={i} style={{ height: 40 }}><SkeletonBlock width="60%" height={18} style={{ margin: '11px 0' }} /></div>)}<Row gap={1}><SkeletonBlock width="100%" height={44} radius="var(--v-radius-md)" style={{ flex: 1, minWidth: 0 }} /><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row></div>)}</>
        : <div className="rc-group"><SkeletonBlock width={120} height={16} /><Row gap={1}><SkeletonBlock width="100%" height={44} radius="var(--v-radius-md)" style={{ flex: 1, minWidth: 0 }} /><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row></div>;
  /* A lead or triage record opens with its socials (two or three rows is the usual find), between the header and the rest. */
  const socials = m === 'lead' ? <div className="rc-soc"><p className="rc-soc-head"><SkeletonBlock width={64} height={12} /></p><ul className="rc-soc-list">{Array.from({ length: triage ? 3 : 2 }, (_, i) => <li key={i}><div className="rc-soc-link"><SkeletonBlock width={18} height={18} /><span className="rc-soc-text"><SkeletonBlock width="35%" height={16} /><SkeletonBlock width="55%" height={16} style={{ marginTop: 4 }} /></span></div></li>)}</ul></div> : null;
  const outbar = triage ? <StickyFooterBar className="dt-outbar dt-triagebar"><Row gap={2} wrap className="dt-outbar-row dt-triagebar-row">{[0, 1, 2, 3].map(k => <SkeletonBlock key={k} height={44} radius="var(--v-radius-md)" />)}</Row></StickyFooterBar> : m === 'deal' ? <StickyFooterBar className="dt-outbar"><Row gap={2} className="dt-outbar-row"><SkeletonBlock width="100%" height={44} radius="var(--v-radius-md)" /><SkeletonBlock width="100%" height={44} radius="var(--v-radius-md)" /></Row></StickyFooterBar> : null;
  return (
    <PageShell className="dt">
      <ScrollArea bare className="dt-scroll">
        <div className="rc-inner" aria-busy="true" aria-hidden="true">
          {head}
          {strip}
          {socials}
          {phone ? (
            <>
              <div className="rc-first">{first}</div>
              {/* A lead, triage or deal record: its first section runs past the first screen, so the skeleton stops there. */}
              {m === 'client' && <div className="rc-rows">{SECTIONS_BY_MODE[m].filter(id => id !== FIRST[m]).map(id => <Card key={id} padding={0} className="rc-row"><div className="rc-row-btn"><span className="rc-row-text"><SkeletonBlock width={90} height={16} /><SkeletonBlock width="70%" height={13} /></span></div></Card>)}</div>}
            </>
          ) : (
            <>
              <div className="rc-facts">{Array.from({ length: SKELETON_FACTS[m] * 2 }, (_, i) => <div key={i} className="rc-fact"><SkeletonBlock width={60} height={10} /><SkeletonBlock width={i % 2 ? '50%' : '70%'} height={14} /></div>)}</div>
              <div className="rc-angle" style={{ minHeight: 68 }}><SkeletonText lines={3} /></div>
              <div className="v-tabs rc-tabs" style={{ minHeight: 45 }}>{SECTIONS_BY_MODE[m].filter(id => id !== 'details').map(id => <SkeletonBlock key={id} width={72} height={16} />)}</div>
              <div className="rc-panel">{first}</div>
            </>
          )}
        </div>
      </ScrollArea>
      {outbar}
    </PageShell>
  );
};

/* recordStyles lives in src/ui/lead.styles.js (uiStyles). */
