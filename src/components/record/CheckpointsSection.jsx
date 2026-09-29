import { Select, InlineEdit, Button, Menu } from '../../ui';
import { CHECKPOINTS, checkpointOf, isTicked, tickPatch, untickPatch, isStalled, daysHere, newestTick } from '../../lib/deal';
import { PACKAGES, planFor } from '../../shared/pricing';
import { money } from '../../shared/format';
import { fmtDate, fmtDateTime } from '../../shared/dates';
import { actionFor, runKeyFor } from './checkpointAction';

/* Checkpoints: the nine steps of a deal as a plain vertical stepper, each
 * row with its date or its one button (Tick, Met them, Send; the Invoices
 * rows switch to Money). Above it the package and the contract link. */
export const checkpointsSummary = (rec) => {
  const { lead, deal } = rec;
  const n = newestTick(deal);
  const days = daysHere(lead);
  return `${n ? checkpointOf(n.id)?.label : 'Booked'} · ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} here`}${isStalled(lead) ? ' · stalled' : ''}`;
};

export default function CheckpointsSection({ rec }) {
  const { lead, deal, readOnly, patch, run, busy, shell, toast } = rec;
  const canBuild = !!shell?.openConcepts;
  const setPackage = (packageId) => { const p = packageId ? planFor(PACKAGES.find(x => x.id === packageId)?.price || 0, packageId) : null; return patch({ deal: { ...deal, packageId, plan: p ? { months: p.months, monthly: p.monthly } : null } }); };
  const tick = async (id) => { const ok = await patch(tickPatch(lead, id)); if (ok) toast.success(`${checkpointOf(id).label} ticked.`); };
  const untick = async (id) => { const ok = await patch(untickPatch(lead, id)); if (ok) toast.success(`${checkpointOf(id).label} unticked.`); };
  const cls = { send: 'dc-send', met: 'dc-met', tick: 'dc-tick', build: 'dc-build', money: 'dc-money' };
  return (
    <div className="rc-cp">
      {readOnly
        ? <div className="rc-fact"><span className="rc-fact-label">Package</span><span className="rc-fact-ro">{PACKAGES.find(p => p.id === deal.packageId)?.label || 'No package yet'}</span></div>
        : <Select label="Package" value={deal.packageId || ''} onChange={(e) => setPackage(e.target.value)} options={PACKAGES.map(p => ({ id: p.id, label: `${p.label} (${money(p.price)})` }))} placeholder="No package yet" className="rc-cp-pkg" />}
      <div className="rc-fact"><span className="rc-fact-label">Contract</span>{readOnly ? <span className="rc-fact-ro lay-truncate">{deal.contractLink || 'None'}</span> : <InlineEdit value={deal.contractLink || ''} onSave={(v) => patch({ deal: { ...deal, contractLink: v.trim() } })} placeholder="Paste the contract link" label="Contract link" className="rc-fact-edit" />}</div>
      {isStalled(lead) && <p className="rc-line rc-line--danger">Stalled since {fmtDate(deal.stalledSince)}. {lead.stage === 'deal' ? `${daysHere(lead)} days at this step.` : ''}</p>}
      <ol className="dc-steps" aria-label="Checkpoints">
        {CHECKPOINTS.map((c, i) => {
          const cp = deal.checkpoints[c.id];
          const on = isTicked(deal, c.id);
          const prevOn = i === 0 || isTicked(deal, CHECKPOINTS[i - 1].id);
          const a = on ? null : actionFor(c, { canBuild });
          const key = a ? runKeyFor(a) : '';
          const menu = [
            ...(on ? [{ id: 'untick', label: 'Untick', icon: 'XClose', onSelect: () => untick(c.id) }] : [{ id: 'tick', label: 'Tick', icon: 'Check', onSelect: () => tick(c.id) }]),
            ...(c.id === 'concepts' && canBuild ? [{ id: 'open', label: 'Open concepts', icon: 'LayersThree01', onSelect: () => shell.openConcepts(lead) }] : []),
          ];
          return (
            <li key={c.id} className={`dc-step${on ? ' is-done' : ''}${!on && prevOn ? ' is-current' : ''}`}>
              <span className="dc-dot" aria-hidden="true">{on ? '✓' : i + 1}</span>
              <div className="dc-body">
                <span className="dc-label">{c.label}</span>
                <span className="dc-when">{on ? `${fmtDateTime(cp.at)}${cp.by === 'auto' ? ', on its own' : ''}` : c.auto ? 'Ticks on its own' : 'Waiting on you'}</span>
              </div>
              {!readOnly && (
                <span className="dc-actions">
                  {a && <Button variant="secondary" size="md" icon={a.icon} loading={busy === key} onClick={() => run(key)} className={cls[a.kind]} aria-label={a.short === 'Tick' ? `Tick ${c.label.toLowerCase()}` : undefined}>{a.short}</Button>}
                  <Menu label={`${c.label} actions`} items={menu} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
