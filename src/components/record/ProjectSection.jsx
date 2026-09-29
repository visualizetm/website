import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import { Row, Stack, Card, Button, Pill, Menu, Checkbox } from '../../ui';
import { PROJECT_KINDS, PROJECT_STAGES, projectStageOf } from '../../shared/semantics';
import { money } from '../../shared/format';
import { fmtDate, fmtDateTime } from '../../shared/dates';
import { COPY } from '../../shared/copy';
import { stagesFor, nextStage, revisionsUsed, revisionsMax, extraRounds, revisionsExhausted, extraRoundFeeFor, DELIVERY_STEPS } from '../../lib/projects';
import { Stepper } from '../ClientWorkspace';
import EmptyLine from './EmptyLine';
import ProjectPicker from './ProjectPicker';

/* Project: one card. Name and kind on one line, the stage stepper, the
 * rounds line with Log a round, one row with the advance button (Deliver at
 * delivery). Delivered, the send delivery checklist follows as plain rows.
 * Several projects: the picker above chooses one. */
export const projectSummary = (rec) => {
  const p = rec.cw.current;
  if (!p) return 'No project yet';
  return `${p.name} · ${projectStageOf(p.stage).label} · rounds ${revisionsUsed(p)} of ${revisionsMax(p)}`;
};

export default function ProjectSection({ rec }) {
  const { cw, readOnly } = rec;
  const p = cw.current;
  const E = COPY.empty['clients.projects'];
  if (!p) return <EmptyLine text={E.title} action={!readOnly ? { label: E.action, icon: Plus, onClick: cw.openNew, className: 'cw-new-project' } : null} />;
  const used = revisionsUsed(p); const max = revisionsMax(p); const extra = extraRounds(p);
  const stages = p.stages?.length ? p.stages : stagesFor(p.kind);
  const next = nextStage(p);
  const menu = [
    { id: 'adv', label: next ? `Advance to ${projectStageOf(next).label}` : 'Delivered', icon: 'ArrowRight', disabled: !next || readOnly, onSelect: () => cw.advance(p) },
    'divider',
    ...stages.map(s => ({ id: `s:${s}`, label: `Set stage: ${projectStageOf(s).label}`, icon: projectStageOf(s).icon, disabled: s === p.stage || readOnly, onSelect: () => cw.setStage(p, s) })),
    'divider',
    { id: 'new', label: 'New project', icon: 'Plus', disabled: readOnly, onSelect: cw.openNew },
    { id: 'arch', label: 'Archive', icon: 'Trash01', danger: true, disabled: readOnly, onSelect: () => cw.archive(p) },
  ];
  return (
    <div className="rc-project">
      <ProjectPicker cw={cw} />
      <Card className="cw-project" glow={p.stage === 'delivered' ? 'booked' : undefined}>
        <Row gap={2} align="center" className="cw-project-head">
          <Row gap={2} wrap align="center" style={{ flex: 1, minWidth: 0 }}><span className="cw-project-name">{p.name}</span><Pill id={p.kind} list={PROJECT_KINDS} size="sm" variant="outline" /><Pill id={p.stage} list={PROJECT_STAGES} size="sm" /></Row>
          <Menu label={`Actions for ${p.name}`} items={menu} />
        </Row>
        <span className="rc-muted">Started {fmtDate(p.createdAt) || 'today'}</span>
        <Stepper project={p} />
        <Row gap={2} justify="between" align="center" wrap className="rc-rounds">
          <span className="cw-rev-label">Rounds {used} of {max}{extra ? `, ${extra} extra` : ''}</span>
          {!readOnly && (revisionsExhausted(p)
            ? <Button variant="secondary" size="md" icon={Plus} onClick={() => cw.openRound(p)} className="cw-extra-round">Log extra round ({money(extraRoundFeeFor(p))})</Button>
            : <Button variant="secondary" size="md" icon={Plus} onClick={() => cw.openRound(p)} className="cw-log-round">Log a round</Button>)}
        </Row>
        {(p.revisions?.log || []).length > 0 && <ul className="cw-rev-log">{(p.revisions.log).slice(-4).map((r, i) => <li key={i}><span className="cw-rev-when">{fmtDate(r.at)}</span>{r.extra && <Pill tone="new" label={`Extra, ${money(extraRoundFeeFor(p))}`} size="sm" icon={false} />}<span className="cw-rev-note">{r.note || 'Round logged'}</span></li>)}</ul>}
        {next && !readOnly && <Row gap={2}><Button variant="secondary" size="md" iconEnd="ArrowRight" onClick={() => cw.advance(p)} className="cw-advance">{next === 'delivered' ? 'Deliver' : projectStageOf(next).label}</Button></Row>}
        {p.stage === 'delivered' && (
          <div className="rc-group">
            <p className="rc-label">Send delivery</p>
            <Stack gap={0}>
              {DELIVERY_STEPS.map(st => st.id === 'emailSent' ? (
                <Row key={st.id} gap={2} align="center" justify="between" wrap className="cw-deliv-email">
                  <Checkbox label={st.label} checked={!!p.delivery?.emailSent} onChange={(v) => cw.setDelivery(p, st.id, v)} disabled={readOnly} />
                  {!readOnly && <Button variant="secondary" size="md" icon="Send01" onClick={() => cw.email.open('delivery', { project: p })} className="cw-send-delivery">Send</Button>}
                </Row>
              ) : <Checkbox key={st.id} label={st.id === 'followUp' && p.delivery?.followUpLeadCallbackAt ? `${st.label} (${fmtDateTime(p.delivery.followUpLeadCallbackAt)})` : st.label} checked={st.id === 'followUp' ? !!p.delivery?.followUpLeadCallbackAt : !!p.delivery?.[st.id]} onChange={(v) => cw.setDelivery(p, st.id, v)} disabled={readOnly} />)}
            </Stack>
            <p className="rc-muted">Every delivery ends with a retainer pitch.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
