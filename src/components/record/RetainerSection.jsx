import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import { Row, Stack, Grid, Card, Button, Pill, InlineEdit, ProgressBar } from '../../ui';
import { RETAINER_STATUSES, SCHEDULE_STATUSES } from '../../shared/semantics';
import { money } from '../../shared/format';
import { fmtDate } from '../../shared/dates';
import { COPY } from '../../shared/copy';
import { postsOf } from '../../lib/posts';
import { monthLabel, nextUnpaid, scheduleStatus, retainerMonthly } from '../../lib/projects';
import { fmtDay, fmtDayShort } from '../ClientWorkspace';
import EmptyLine from './EmptyLine';

/* Retainer: the retainer card as it was, with the monthly deliverables as
 * one row per month (a bar and Log delivery) instead of a card each. */
export const retainerSummary = (rec) => {
  const { ret, retPlan } = rec.cw;
  if (!ret || ret.status === 'cancelled') return 'None yet';
  const bill = ret.status === 'paused' ? 'paused' : ret.nextBillAt ? `bills ${fmtDayShort(ret.nextBillAt)}` : 'no bill date';
  return `${retPlan?.label || ret.planId}, ${bill}`;
};

export default function RetainerSection({ rec }) {
  const { lead, cw, readOnly, patchRaw } = rec;
  const { ret, retPlan, retProject, months } = cw;
  const E = COPY.empty;
  if (!ret || ret.status === 'cancelled') {
    const text = ret?.status === 'cancelled' ? `${E['clients.retainer.cancelled'].title}: ${retPlan?.label || 'the plan'} ended ${fmtDate(ret.cancelAt) || 'recently'}.` : E['clients.retainer'].title;
    return <EmptyLine text={text} action={!readOnly ? { label: E['clients.retainer'].action, icon: RefreshCw01, onClick: cw.openRet, className: 'cw-start-retainer' } : null} />;
  }
  const nx = retProject ? nextUnpaid(retProject) : null;
  return (
    <Card className={`cw-retainer${cw.retPulse ? ' v-pulse-won' : ''}`}>
      <Row gap={2} wrap align="center"><Pill id={ret.status} list={RETAINER_STATUSES} size="sm" /><span className="cw-project-name">{retPlan?.label || ret.planId}</span><span className="dt-opt-n cw-ret-price">{money(ret.amount)}<small>/mo</small></span></Row>
      <Grid minColumnWidth={140} gap={2}>
        <div className="cw-kv"><span className="rc-fact-label">Started</span><span>{fmtDay(ret.startedAt) || fmtDate(ret.startedAt) || 'Unknown'}</span></div>
        <div className="cw-kv"><span className="rc-fact-label">Next bill</span><span>{ret.status === 'paused' ? 'Paused' : fmtDay(ret.nextBillAt) || 'Not set'}</span></div>
        <div className="cw-kv"><span className="rc-fact-label">Bill day</span><span>Day {ret.billDay}</span></div>
        {ret.cancelAt && <div className="cw-kv"><span className="rc-fact-label">Ends</span><span>{fmtDate(ret.cancelAt)}</span></div>}
      </Grid>
      <div className="cw-kv"><span className="rc-fact-label">Stripe subscription</span>{readOnly ? <span className="rc-fact-ro">{ret.stripeSubscriptionId || 'None'}</span> : <InlineEdit value={ret.stripeSubscriptionId || ''} onSave={(v) => patchRaw({ retainer: { ...lead.retainer, stripeSubscriptionId: v.trim() } })} placeholder="sub_... (so a cancellation reconciles)" label="Stripe subscription id" className="cw-sub-id" />}</div>
      {ret.stripeCancelledAt && <p className="rc-line">Stripe reported this subscription cancelled on {fmtDate(ret.stripeCancelledAt)}.</p>}
      {nx && ret.status !== 'paused' && (
        <Row gap={2} justify="between" align="center" wrap className="cw-nextbill">
          <span className="cw-nextbill-amt">Next bill {money(nx.amount)}, {fmtDay(nx.dueAt)}</span>
          <Row gap={1}><Pill id={scheduleStatus(nx)} list={SCHEDULE_STATUSES} size="sm" />{!readOnly && <Button variant="secondary" size="md" icon={Check} onClick={() => cw.openPay(retProject, nx)} className="cw-bill-paid">Mark paid</Button>}</Row>
        </Row>
      )}
      {!readOnly && <Row gap={2} wrap>
        {ret.status === 'active' && <Button variant="secondary" size="md" icon="PauseCircle" onClick={() => cw.setRet({ status: 'paused' })}>Pause</Button>}
        {ret.status === 'paused' && <Button size="md" icon="Play" onClick={() => cw.setRet({ status: 'active' })}>Resume</Button>}
        {(ret.status === 'active' || ret.status === 'paused') && <Button variant="danger" size="md" onClick={cw.cancelRetainer} className="cw-cancel-retainer">Cancel</Button>}
        {ret.status === 'ending' && <Button variant="danger" size="md" onClick={cw.cancelNow}>Mark cancelled now</Button>}
      </Row>}
      {ret.status === 'ending' && <p className="rc-line">Notice given. It bills until {fmtDate(ret.cancelAt)}, then the monthly job (or you) marks it cancelled.</p>}
      {retProject && (
        <Stack gap={1} className="cw-months">
          <p className="rc-label">Monthly deliverables: {retainerMonthly(ret.planId).label}</p>
          {months.map((m, i) => {
            /* Planner prompt 2, part 5: with the planner on, the month's delivered count is the posts that reached approved or posted. */
            const fromPlanner = cw.plannerOn ? postsOf(cw.posts, lead._id).filter(p => p.month === m.month && (p.status === 'approved' || p.status === 'posted')).length : null;
            const delivered = fromPlanner ?? m.delivered;
            return (
              <div key={m.month} className={`rc-month${i === 0 ? ' is-current' : ''}`}>
                <span className="rc-month-name">{monthLabel(m.month)}{i === 0 ? <span className="rc-muted"> · this month</span> : ''}</span>
                <ProgressBar value={m.included ? Math.min(100, Math.round((delivered / m.included) * 100)) : 0} tone={delivered >= m.included && m.included ? 'booked' : 'progress'} size="sm" className="rc-month-bar" />
                <span className="rc-month-count">{delivered} of {m.included} {retainerMonthly(ret.planId).unit}{fromPlanner !== null ? ', from their planner' : ''}</span>
                {!readOnly && fromPlanner === null && <Button variant="secondary" size="md" icon={Plus} onClick={() => cw.openLogDel(retProject, m.month)} className="cw-log-delivery">Log delivery</Button>}
              </div>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
