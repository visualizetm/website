import { useEffect, useMemo, useRef, useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import {
  PageShell, ScrollArea, StickyFooterBar, Stack, Row, Card, Button, Pill, Input, Select, Checkbox, SegmentedControl, EmptyState, ErrorState, Stagger, SkeletonBlock, useConfirm, useDelayedLoading, useRetry, useToast,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';
import { PROJECT_KINDS } from '../shared/semantics';
import { PACKAGES, RETAINERS, ADDONS, retainerOf, planLine } from '../shared/pricing';
import { money } from '../shared/format';
import { buildProject, buildRetainerProject, retainerMonthly, nextUnpaid, today, localDate, isClientLead } from '../lib/projects';
import LeadPicker from '../components/LeadPicker';

/* New project (nothing computer only): one page at every width, one column
 * under 768, the same page above it. /clients/:id/projects/new sets a
 * project or a retainer up for one client; /projects/new asks which client
 * first. Create does exactly what the sheets did: buildProject or
 * buildRetainerProject, the POST, clientStatus active, the Drive link onto
 * the lead when it had none, then the record opens on its Project tab. */
const MODES = [{ id: 'package', label: 'Package' }, { id: 'addons', label: 'Add-ons' }, { id: 'retainer', label: 'Retainer' }, { id: 'custom', label: 'Custom' }];
const fmtDayShort = (s) => { const d = localDate(s); return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''; };
const defaultBillDay = () => String(new Date().getDate() > 28 ? 28 : new Date().getDate());

export default function AdminProjectNew({ lead = null, leads = [], loading = false, error = false, onRetry, onCreateProject, onPatchLead, onPick, onCancel, onDone, mode: startMode = 'package' }) {
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const [confirm, confirmDialog] = useConfirm();
  const showSkel = useDelayedLoading(loading);
  const [mode, setMode] = useState(MODES.some(m => m.id === startMode) ? startMode : 'package');
  const [packageId, setPackageId] = useState(PACKAGES[2].id);
  const [addonIds, setAddonIds] = useState([]);
  const [retainerId, setRetainerId] = useState(RETAINERS[1].id);
  const [billDay, setBillDay] = useState(defaultBillDay);
  const [custom, setCustom] = useState({ name: '', total: '', kind: 'brand' });
  const [start, setStart] = useState(today());
  const [drive, setDrive] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(!lead);
  const touchedRef = useRef(false); touchedRef.current = touched;
  const touch = (fn) => (v) => { setTouched(true); fn(v); };
  useEffect(() => { setDrive(lead?.links?.drive || ''); }, [lead?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* The leave guard: the browser's own beforeunload once a field has been touched; the in-app back asks first. */
  useEffect(() => { const onUnload = (e) => { if (!touchedRef.current) return undefined; e.preventDefault(); e.returnValue = ''; return ''; }; window.addEventListener('beforeunload', onUnload); return () => window.removeEventListener('beforeunload', onUnload); }, []);
  const leave = async () => { if (touchedRef.current && !(await confirm({ title: 'Leave without creating?', body: 'What you set up here goes.', danger: true, confirmLabel: 'Leave' }))) return; onCancel?.(); };
  useTopBar({ title: lead ? `New project for ${lead.business}` : 'New project', back: leave });

  const preview = useMemo(() => {
    if (!lead) return null;
    if (mode === 'retainer') return buildRetainerProject(lead._id, retainerId, start, Math.max(1, Math.min(28, Number(billDay) || 1)));
    const pick = mode === 'package' ? { packageId } : mode === 'addons' ? { addonIds } : { custom: { ...custom, total: Number(custom.total) || 0 } };
    return buildProject(lead._id, pick, { startDate: start, drive });
  }, [lead, mode, packageId, addonIds, retainerId, billDay, custom, start, drive]);
  const valid = mode === 'package' ? !!packageId : mode === 'addons' ? addonIds.length > 0 : mode === 'retainer' ? !!retainerId && Number(billDay) >= 1 && Number(billDay) <= 28 : !!custom.name.trim() && Number(custom.total) > 0;

  const create = async () => {
    if (!preview || !valid || busy) return;
    setBusy(true);
    try {
      const item = await onCreateProject(preview);
      if (!item) { toast.error(COPY.error.create); return; }
      if (mode === 'retainer') {
        const r = retainerOf(retainerId); const first = nextUnpaid(item);
        await onPatchLead(lead._id, { retainer: { projectId: String(item._id), planId: r.id, amount: r.price, status: 'active', startedAt: start, billDay: Math.max(1, Math.min(28, Number(billDay) || 1)), nextBillAt: first?.dueAt || start, cancelAt: '' }, clientStatus: lead.clientStatus === 'paused' ? 'active' : (lead.clientStatus || 'active') });
      } else {
        if (lead.clientStatus !== 'active') onPatchLead(lead._id, { clientStatus: 'active' });
        if (preview.links?.drive && !lead.links?.drive) onPatchLead(lead._id, { links: { website: '', instagram: '', ...(lead.links || {}), drive: preview.links.drive } });
      }
      setTouched(false);
      toast.success(`${item.name} created.`);
      onDone?.(lead, item, mode === 'retainer' ? 'retainer' : 'projects');
    } finally { setBusy(false); }
  };

  const label = (text) => <p className="pn-label">{text}</p>;
  const picker = picking && <LeadPicker leads={leads} title="Which client?" description="The project goes on their record." filter={isClientLead} onPick={(l) => { setPicking(false); onPick?.(l); }} onClose={() => { setPicking(false); if (!lead) onCancel?.(); }} />;

  if (showSkel) {
    return (
      <PageShell className="aa-main aa-main--wide pn-shell">
        <ScrollArea><div className="pn-inner" aria-busy="true" aria-hidden="true">
          <Stack gap={0}><SkeletonBlock width="85%" height={32} /><span className="pn-skel-line2"><SkeletonBlock width="45%" height={32} /></span></Stack>
          <section className="pn-sec"><SkeletonBlock width={40} height={16} /><SkeletonBlock height={50} radius="var(--v-radius-md)" /></section>
          {mode === 'retainer' ? (
            <>
              <section className="pn-sec"><SkeletonBlock width={64} height={16} />
                <div className="pn-opts">{RETAINERS.map((r, i) => <div key={r.id} className="pn-opt pn-opt--skel"><span className="pn-opt-top"><SkeletonBlock width={80 + (i % 3) * 20} height={22} /><SkeletonBlock width={96} height={18} /></span><SkeletonBlock width="92%" height={18} /><span className="pn-skel-line2"><SkeletonBlock width={i === 3 ? '90%' : '55%'} height={18} /></span>{i === 3 && <span className="pn-skel-line3"><SkeletonBlock width="40%" height="100%" /></span>}</div>)}</div>
              </section>
              <section className="pn-sec"><SkeletonBlock width={120} height={16} /><SkeletonBlock width={240} height={70} radius="var(--v-radius-md)" className="pn-skel-field" /></section>
            </>
          ) : (
            <section className="pn-sec"><SkeletonBlock width={64} height={16} />
              <div className="pn-opts">{PACKAGES.map((pk, i) => <div key={pk.id} className="pn-opt pn-opt--skel"><span className="pn-opt-top"><SkeletonBlock width={90 + (i % 3) * 20} height={22} /><SkeletonBlock width={i > 4 ? 150 : 40} height={18} /></span><SkeletonBlock width="92%" height={18} /><span className="pn-skel-line2"><SkeletonBlock width="55%" height={18} /></span></div>)}</div>
            </section>
          )}
          <section className="pn-sec"><SkeletonBlock width={72} height={16} /><SkeletonBlock width={240} height={mode === 'retainer' ? 88 : 70} radius="var(--v-radius-md)" className="pn-skel-field" /></section>
          {mode !== 'retainer' && <section className="pn-sec"><SkeletonBlock width={170} height={16} /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></section>}
          <section className="pn-sec pn-summary"><SkeletonBlock width={64} height={16} /><SkeletonBlock width={160} height={24} /><SkeletonBlock width={90} height={32} /><SkeletonBlock width={180} height={18} /><ul className="pn-lines"><li><SkeletonBlock width="100%" height={18} /></li>{mode === 'retainer' && [1, 2, 3].map(i => <li key={i}><SkeletonBlock width={i === 3 ? '50%' : '100%'} height={i === 3 ? 24 : 18} /></li>)}</ul></section>
        </div></ScrollArea>
        <StickyFooterBar className="pn-foot"><Row gap={2} className="pn-foot-row"><SkeletonBlock height={44} radius="var(--v-radius-md)" className="pn-foot-skel" /><SkeletonBlock height={44} radius="var(--v-radius-md)" className="pn-foot-skel" /></Row></StickyFooterBar>
        <style>{pnStyles}</style>
      </PageShell>
    );
  }
  if (error && !lead) {
    return <PageShell className="aa-main aa-main--wide pn-shell"><ScrollArea><div className="pn-inner"><Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card></div></ScrollArea><style>{pnStyles}</style></PageShell>;
  }
  if (!lead && !leads.some(isClientLead)) {
    return <PageShell className="aa-main aa-main--wide pn-shell"><ScrollArea><div className="pn-inner"><Card><EmptyState size="sm" icon="Briefcase01" title="No clients yet" description="A project goes on a client record. Win a deal first, or open Clients." action={{ label: 'Open Clients', icon: 'Briefcase01', onClick: () => onCancel?.() }} /></Card></div></ScrollArea><style>{pnStyles}</style></PageShell>;
  }
  if (!lead) {
    return (
      <PageShell className="aa-main aa-main--wide pn-shell">
        <ScrollArea><div className="pn-inner"><Stack gap={4}>
          <h2 className="pn-title">New project</h2>
          <p className="pn-line">Pick the client first. The project goes on their record.</p>
          <Row gap={2}><Button icon="Briefcase01" onClick={() => setPicking(true)}>Pick a client</Button><Button variant="ghost" onClick={() => onCancel?.()}>Cancel</Button></Row>
        </Stack></div></ScrollArea>
        {picker}
        <style>{pnStyles}</style>
      </PageShell>
    );
  }
  const p = preview;
  return (
    <PageShell className="aa-main aa-main--wide pn-shell">
      <ScrollArea>
        <Stagger className="pn-inner" cap={6}>
          <h2 className="pn-title">New project for {lead.business}</h2>
          <section className="pn-sec">{label('What')}<SegmentedControl label="What" full options={MODES} value={mode} onChange={touch(setMode)} /></section>
          {mode === 'package' && (
            <section className="pn-sec">{label('Package')}
              <div className="pn-opts" role="radiogroup" aria-label="Package">
                {PACKAGES.map(pk => (
                  <button key={pk.id} type="button" role="radio" aria-checked={packageId === pk.id} className={`pn-opt${packageId === pk.id ? ' is-on' : ''}`} onClick={() => touch(setPackageId)(pk.id)}>
                    <span className="pn-opt-top"><span className="pn-opt-name">{pk.label}</span><span className="pn-opt-price">{money(pk.price)}{pk.plan ? `, or ${money(pk.plan.monthly)} a month` : ''}</span></span>
                    <span className="pn-opt-lines">{pk.included.join(' · ')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {mode === 'addons' && (
            <section className="pn-sec">{label('Add-ons')}
              <div className="pn-checks">{ADDONS.map(a => (
                <div key={a.id} className="pn-check">
                  <Checkbox label={`${a.label}, ${money(a.price)}`} checked={addonIds.includes(a.id)} onChange={(v) => touch(setAddonIds)(v ? [...addonIds, a.id] : addonIds.filter(x => x !== a.id))} />
                  {a.freeWith && <span className="pn-free">Free with {a.freeWith.includes('any') ? 'any package' : a.freeWith.map(id => PACKAGES.find(x => x.id === id)?.label || id).join(' or ')}</span>}
                </div>
              ))}</div>
            </section>
          )}
          {mode === 'retainer' && (
            <section className="pn-sec">{label('Retainer')}
              <div className="pn-opts" role="radiogroup" aria-label="Retainer plan">
                {RETAINERS.map(r => (
                  <button key={r.id} type="button" role="radio" aria-checked={retainerId === r.id} className={`pn-opt${retainerId === r.id ? ' is-on' : ''}`} onClick={() => touch(setRetainerId)(r.id)}>
                    <span className="pn-opt-top"><span className="pn-opt-name">{r.label}</span><span className="pn-opt-price">{money(r.price)} a month</span></span>
                    <span className="pn-opt-lines">{retainerMonthly(r.id).label} · {r.included.join(' · ')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {mode === 'retainer' && (
            <section className="pn-sec">{label('Bill day of month')}
              <Input aria-label="Bill day of month" type="number" inputMode="numeric" min={1} max={28} value={billDay} onChange={(e) => touch(setBillDay)(e.target.value)} hint="1 to 28" className="pn-short" />
            </section>
          )}
          {mode === 'custom' && (
            <section className="pn-sec">{label('Custom')}
              <Input label="Name" value={custom.name} onChange={(e) => touch(setCustom)({ ...custom, name: e.target.value })} placeholder="Menu redesign" />
              <Input label="Total" type="number" inputMode="decimal" min={0} value={custom.total} onChange={(e) => touch(setCustom)({ ...custom, total: e.target.value })} className="pn-short" />
              <Select label="Kind" value={custom.kind} onChange={(e) => touch(setCustom)({ ...custom, kind: e.target.value })} options={PROJECT_KINDS.filter(k => k.id !== 'retainer').map(k => ({ id: k.id, label: k.label }))} className="pn-short" />
            </section>
          )}
          <section className="pn-sec">{label('Start date')}<Input aria-label="Start date" type="date" value={start} onChange={(e) => touch(setStart)(e.target.value)} hint={mode === 'retainer' ? 'The first bill lands on the bill day after this.' : 'The first payment starts the project.'} className="pn-short" /></section>
          {mode !== 'retainer' && <section className="pn-sec">{label('Drive folder link (optional)')}<Input aria-label="Drive folder link" value={drive} onChange={(e) => touch(setDrive)(e.target.value)} placeholder="https://drive.google.com/..." /></section>}
          {p && (
            <section className="pn-sec pn-summary">{label('Summary')}
              <Row gap={2} align="center" wrap><span className="pn-sum-name">{p.name || 'Project'}</span><Pill id={p.kind} list={PROJECT_KINDS} size="sm" /></Row>
              <span className="pn-sum-total">{mode === 'retainer' ? `${money(retainerOf(retainerId)?.price || 0)} a month` : money(p.total)}</span>
              <p className="pn-line">{mode === 'retainer' ? `Bills on day ${Math.max(1, Math.min(28, Number(billDay) || 1))} of each month.` : p.plan ? planLine({ ...p.plan, total: p.total, alt: null }) : 'One payment, due at the start.'}</p>
              <ul className="pn-lines">{(p.invoices || []).slice(0, mode === 'retainer' ? 3 : 12).map(s => <li key={s.id}><span>{s.label}</span><span className="pn-lines-amt">{money(s.amount)}, {fmtDayShort(s.dueAt)}</span></li>)}{mode === 'retainer' && (p.invoices || []).length > 3 && <li><span className="pn-line">and {(p.invoices || []).length - 3} more months</span></li>}</ul>
            </section>
          )}
        </Stagger>
      </ScrollArea>
      <StickyFooterBar className="pn-foot">
        <Row gap={2} className="pn-foot-row">
          <Button variant="ghost" onClick={leave} disabled={busy}>Cancel</Button>
          <Button icon={Plus} loading={busy} disabled={!valid} onClick={create} className="pn-create">Create</Button>
        </Row>
      </StickyFooterBar>
      {picker}
      {confirmDialog}
      <style>{pnStyles}</style>
    </PageShell>
  );
}

const pnStyles = `
  .pn-shell.aa-main { display: flex; flex-direction: column; }
  .pn-inner { display: flex; flex-direction: column; gap: var(--v-space-5); width: 100%; max-width: 760px; margin: 0 auto; min-width: 0; }
  .pn-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); overflow-wrap: anywhere; }
  .pn-sec { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .pn-label { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .pn-line { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .pn-short { max-width: 240px; }
  .pn-skel-line2 { display: none; }
  .pn-skel-field { max-width: 100%; }
  .pn-opt.pn-opt--skel { gap: 6px; }
  .pn-skel-line3 { display: block; height: 12px; }
  @media (max-width: 767px) { .pn-skel-line3 { height: 15px; } }
  @media (max-width: 767px) { .pn-opt.pn-opt--skel { gap: 3px; } }
  @media (max-width: 767px) { .pn-skel-line2 { display: block; } }
  .pn-opts { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .pn-opt { display: flex; flex-direction: column; gap: 2px; width: 100%; min-height: var(--v-tap-lg); padding: var(--v-space-3); text-align: left; font: inherit; color: var(--v-text); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); cursor: pointer; }
  .pn-opt:hover { border-color: var(--v-border-strong); }
  .pn-opt:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .pn-opt.is-on { border-color: var(--v-red); background: var(--v-red-soft); }
  .pn-opt-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--v-space-3); }
  .pn-opt-name { font-weight: var(--v-weight-bold); }
  .pn-opt-price { font-size: var(--v-text-sm); color: var(--v-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pn-opt-lines { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .pn-checks { display: flex; flex-direction: column; }
  .pn-check { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); flex-wrap: wrap; border-bottom: 1px solid var(--v-border); }
  .pn-check:last-child { border-bottom: 0; }
  .pn-free { font-size: var(--v-text-xs); color: var(--v-status-booked-text); }
  .pn-summary { padding: var(--v-space-3); background: var(--v-surface-2); border-radius: var(--v-radius-md); }
  .pn-sum-name { font-weight: var(--v-weight-bold); }
  .pn-sum-total { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; }
  .pn-lines { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--v-space-1); font-size: var(--v-text-sm); color: var(--v-text-2); }
  .pn-lines li { display: flex; justify-content: space-between; gap: var(--v-space-3); }
  .pn-lines-amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pn-foot-row { width: 100%; max-width: 760px; }
  .pn-foot-row > .v-btn, .pn-foot-row > .pn-foot-skel { flex: 1 1 140px; min-width: 0; width: auto; }
`;
