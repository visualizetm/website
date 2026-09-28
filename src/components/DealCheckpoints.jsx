import { useState } from 'react';
import { Card, Stack, Row, Button, Menu, Pill, InlineEdit, Select, useToast } from '../ui';
import { CHECKPOINTS, dealOf, isTicked, tickPatch, untickPatch, metPatch, isStalled, daysHere } from '../lib/deal';
import { dealPackageLabel, dealPlanLine, dealTotal } from '../lib/dealConvert';
import { PACKAGES, planFor } from '../shared/pricing';
import { money } from '../shared/format';
import { fmtDate, fmtDateTime } from '../shared/dates';
import { COPY } from '../shared/copy';
import { useSendEmail } from './SendEmailModal';
import { useShell } from '../shell/ShellContext';

/* The Checkpoints fold (CRM revamp, step 5): the nine steps of a deal as a
 * vertical stepper with a check and a date on each, Tick on the manual
 * ones, Untick in the row menu, Met them on Call done, and Send on Intro,
 * Onboarding and Invoice that for now tick the step and say emails come
 * in the next step. Above it the package line and the contract link. */
const SEND_KIND = { introSent: 'intro', onboardingSent: 'onboarding' };

export default function DealCheckpoints({ lead, patch, readOnly = false, onOpenConcepts }) {
  const toast = useToast();
  const shell = useShell();
  const deal = dealOf(lead);
  const [busy, setBusy] = useState('');
  /* Send (CRM revamp, step 6): the intro and onboarding emails go out through the send modal; the server stamps the checkpoint. */
  const email = useSendEmail({ lead, patch, onSent: () => shell?.refreshLeads?.() });
  const write = async (id, set, msg) => { setBusy(id); const ok = await patch(set); setBusy(''); if (!ok) toast.error(COPY.error.save); else if (msg) toast.success(msg); return ok; };
  const tick = (id) => write(id, tickPatch(lead, id), `${CHECKPOINTS.find(c => c.id === id).label} ticked.`);
  const untick = (id) => write(id, untickPatch(lead, id), `${CHECKPOINTS.find(c => c.id === id).label} unticked.`);
  const met = () => write('callDone', metPatch(lead), `Met them. ${lead.business} is a deal.`);
  const send = (id) => email.open(SEND_KIND[id]);
  const setPackage = (packageId) => { const p = packageId ? planFor(PACKAGES.find(x => x.id === packageId)?.price || 0, packageId) : null; return patch({ deal: { ...deal, packageId, plan: p ? { months: p.months, monthly: p.monthly } : null } }); };
  const stalled = isStalled(lead);
  return (
    <Stack gap={3}>
      <Card className="dc-head">
        <Row gap={2} wrap align="center" justify="between">
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <span className="pb-card-h" style={{ margin: 0 }}>{dealPackageLabel(deal) || 'No package'}</span>
            <span className="dt-muted">{dealTotal(deal) ? `${money(dealTotal(deal))}, ${dealPlanLine(deal).toLowerCase()}` : 'Pick a package to price it.'}{lead.stage === 'deal' ? `, ${daysHere(lead)} day${daysHere(lead) === 1 ? '' : 's'} at this step` : ''}</span>
          </Stack>
          {stalled && <Pill tone="danger" label={`Stalled since ${fmtDate(deal.stalledSince)}`} size="sm" icon="ClockRewind" variant="solid" />}
        </Row>
        {!readOnly && <Select label="Package" value={deal.packageId || ''} onChange={(e) => setPackage(e.target.value)} options={PACKAGES.map(p => ({ id: p.id, label: `${p.label} (${money(p.price)})` }))} placeholder="No package yet" />}
        <div className="cw-kv"><span className="dt-fact-label">Contract link</span>{readOnly ? <span className="dt-fact-ro">{deal.contractLink || 'None'}</span> : <InlineEdit value={deal.contractLink || ''} onSave={(v) => patch({ deal: { ...deal, contractLink: v.trim() } })} placeholder="https://..." label="Contract link" />}</div>
      </Card>
      <Card className="dc-card">
        <ol className="dc-steps" aria-label="Checkpoints">
          {CHECKPOINTS.map((c, i) => {
            const cp = deal.checkpoints[c.id];
            const on = isTicked(deal, c.id);
            const prevOn = i === 0 || isTicked(deal, CHECKPOINTS[i - 1].id);
            const menu = [
              ...(on ? [{ id: 'untick', label: 'Untick', icon: 'XClose', onSelect: () => untick(c.id) }] : [{ id: 'tick', label: 'Tick', icon: 'Check', onSelect: () => tick(c.id) }]),
              ...(c.id === 'concepts' && onOpenConcepts ? [{ id: 'open', label: 'Open concepts', icon: 'LayersThree01', onSelect: onOpenConcepts }] : []),
            ];
            return (
              <li key={c.id} className={`dc-step${on ? ' is-done' : ''}${!on && prevOn ? ' is-current' : ''}`}>
                <span className="dc-dot" aria-hidden="true">{on ? '✓' : i + 1}</span>
                <div className="dc-body">
                  <span className="dc-label">{c.label}</span>
                  <span className="dc-when">{on ? `${fmtDateTime(cp.at)}${cp.by === 'auto' ? ', on its own' : ''}` : c.auto ? 'Ticks on its own' : 'Waiting on you'}</span>
                </div>
                {!readOnly && (
                  <Row gap={1} align="center" className="dc-actions">
                    {!on && c.met && <Button variant="secondary" size="md" icon="Check" loading={busy === c.id} onClick={met} className="dc-met">Met them</Button>}
                    {!on && c.send && <Button variant="secondary" size="md" icon="Send01" loading={busy === c.id} onClick={() => send(c.id)} className="dc-send">Send</Button>}
                    {!on && !c.auto && !c.send && <Button variant="secondary" size="md" icon="Check" loading={busy === c.id} onClick={() => tick(c.id)} className="dc-tick">Tick</Button>}
                    {!on && c.auto && !c.met && c.id === 'concepts' && onOpenConcepts && <Button variant="ghost" size="md" icon="LayersThree01" onClick={onOpenConcepts}>Build</Button>}
                    <Menu label={`${c.label} actions`} items={menu} />
                  </Row>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
      {email.modal}
    </Stack>
  );
}

export const dealCheckpointsStyles = `
  .dc-head { gap: var(--v-space-3); }
  .dc-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .dc-step { position: relative; display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap); padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); }
  .dc-step:last-child { border-bottom: 0; }
  .dc-dot { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: var(--v-surface-3); color: var(--v-text-2); font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); }
  .dc-step.is-done .dc-dot { background: var(--v-status-booked-solid); color: var(--v-text-inverse); }
  .dc-step.is-current .dc-dot { box-shadow: 0 0 0 2px var(--v-red); }
  .dc-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .dc-label { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .dc-step.is-done .dc-label { color: var(--v-status-booked-text); }
  .dc-when { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .dc-actions { flex-shrink: 0; }
`;
