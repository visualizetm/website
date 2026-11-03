import { useEffect, useState } from 'react';
import { Sheet, Stack, Row, Grid, Button, Chip, Input, Textarea, Card, Checkbox } from '../../ui';
import { CLOSER_STEPS as STEPS, CLOSER_LINES, PILLARS, BELIEFS, PITCH_LIMIT_MS, closerSet, pillarPatch, pitchElapsed, askUnlocked, askPatch, sayItBack, emptyPainRow, painFilled } from '../../shared/callScript';
import ObjectionSheet, { objectionStyles } from './ObjectionSheet';
import PricePresenter from './PricePresenter';
import { callStepperStyles } from './CallStepper';

/* The concept call stepper (prompt 2 of 3, milestone 2): CLOSER from docs/HORMOZI-CLOSE.md section 4, one step per screen, over
 * a booked lead's record ("Start the concept call") and from the meeting reminder's tap (?intent=closer). Every write lands under
 * afterCall.closer (src/shared/callScript.js: closerSet, pillarPatch, askPatch).
 *   1 Clarify     why they said yes, the goal
 *   2 Label       the say it back line; They said yes, or Not quite, fix it
 *   3 Pain cycle  repeating rows (tried, how long, how it went), Add a row, nudged until two are filled, then "not on you"
 *   4 Pillars     Look, Trust, Leads, each a 30 second client story, tapped in order; the pitch clock shows under three minutes
 *   5 Beliefs     gets you closer, trusts me, works for you; the ask stays locked until all three
 *   6 The ask     the price presenter; They pushed back opens the objection cards; Asked bumps the counter */
const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function CloserStepper({ open, lead, onClose, onPatch }) {
  const closer = lead?.afterCall?.closer || {};
  const [step, setStep] = useState(() => Math.min(STEPS.length, Math.max(1, Number(closer.step) || 1)));
  const [d, setD] = useState(() => ({
    why: closer.why || '', goal: closer.goal || lead?.afterCall?.goal || '', label: closer.label || '',
    pain: Array.isArray(closer.pain) && closer.pain.length ? closer.pain : [emptyPainRow(), emptyPainRow()],
    beliefs: { closer: !!closer.beliefs?.closer, trust: !!closer.beliefs?.trust, works: !!closer.beliefs?.works },
  }));
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState(false);
  const [obj, setObj] = useState(false);
  const [, setTick] = useState(0);
  const cur = STEPS[step - 1];
  const elapsed = pitchElapsed(closer);
  useEffect(() => { if (elapsed == null || cur.id !== 'pillars') return undefined; const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, [elapsed == null, cur.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  const save = async (fields, s = step) => { setBusy(true); try { return await onPatch(closerSet(lead, fields, s)); } finally { setBusy(false); } };
  const fieldsOf = () => ({ clarify: { why: d.why.trim(), goal: d.goal.trim() }, label: { label: d.label, why: d.why.trim() }, pain: { pain: d.pain.filter(r => r.tried || r.howLong || r.result).slice(0, 8) }, pillars: {}, beliefs: { beliefs: d.beliefs }, ask: {} }[cur.id] || {});
  const next = async () => { const ok = await save(fieldsOf(), step + 1); if (ok !== false) setStep(s => Math.min(STEPS.length, s + 1)); };
  const back = () => setStep(s => Math.max(1, s - 1));
  const unlocked = askUnlocked({ beliefs: d.beliefs });
  const pillarOrder = PILLARS.filter(p => closer.pillars?.[p.id]).length;
  const nextPillar = PILLARS[pillarOrder] || null;
  const filled = painFilled(d.pain);
  const setRow = (i, k, v) => setD(x => ({ ...x, pain: x.pain.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));

  const body = () => {
    switch (cur.id) {
      case 'clarify': return (
        <Stack gap={3}>
          <p className="cs-line">{CLOSER_LINES.clarify}</p>
          <Textarea label="Why they said yes" value={d.why} onChange={(e) => set('why', e.target.value)} rows={2} data-autofocus />
          <p className="cs-line">{CLOSER_LINES.goal}</p>
          <Textarea label="The goal" value={d.goal} onChange={(e) => set('goal', e.target.value)} rows={2} />
          <p className="cs-hint">If they say they just want information, do not accept it. Nobody takes calls to collect information.</p>
        </Stack>
      );
      case 'label': return (
        <Stack gap={3}>
          <Card level={2} padding={3}><p className="pb-card-h">Say it back</p><p className="cs-line">{sayItBack(d.why, d.goal)}</p></Card>
          <p className="cs-hint">They have to say yes and own it. You cannot cure what they will not admit they have.</p>
          <Row gap={2}>
            <Chip label="They said yes" selected={d.label === 'yes'} onClick={() => set('label', 'yes')} />
            <Chip label="Not quite, fix it" selected={d.label === 'fix'} onClick={() => set('label', 'fix')} />
          </Row>
          {d.label === 'fix' && <Textarea label="Their words" value={d.why} onChange={(e) => set('why', e.target.value)} rows={2} data-autofocus />}
        </Stack>
      );
      case 'pain': return (
        <Stack gap={3}>
          <p className="cs-line">{CLOSER_LINES.pain.join(' ')}</p>
          {d.pain.map((r, i) => (
            <Grid key={i} minColumnWidth={110} gap={2} className="cl-painrow">
              <Input label={`Tried ${i + 1}`} value={r.tried} onChange={(e) => setRow(i, 'tried', e.target.value)} placeholder="A guy on Fiverr" />
              <Input label="How long" value={r.howLong} onChange={(e) => setRow(i, 'howLong', e.target.value)} placeholder="A month" />
              <Input label="How it went" value={r.result} onChange={(e) => setRow(i, 'result', e.target.value)} placeholder="Never finished" />
            </Grid>
          ))}
          <Row gap={2} align="center">
            <Button variant="secondary" icon="Plus" onClick={() => setD(x => ({ ...x, pain: x.pain.length < 8 ? [...x.pain, emptyPainRow()] : x.pain }))} className="cl-addrow">Add a row</Button>
            <span className="cs-hint cl-nudge" aria-live="polite">{filled < 2 ? `Keep cycling. What else? (${filled} of 2)` : 'Enough. Their words are the ammo for the close.'}</span>
          </Row>
          {filled >= 2 && <Card level={2} padding={3} className="cl-notonyou"><p className="cs-line">{CLOSER_LINES.notOnYou}</p></Card>}
        </Stack>
      );
      case 'pillars': return (
        <Stack gap={3}>
          <Row gap={2} align="center" className="cl-pitch">
            <p className="cs-line" style={{ flex: 1 }}>{CLOSER_LINES.pillars}</p>
            <span className={`cl-clock${elapsed != null && elapsed > PITCH_LIMIT_MS ? ' is-over' : ''}`} aria-label="Pitch clock" aria-live="off">{elapsed == null ? '3:00' : fmtClock(Math.max(0, PITCH_LIMIT_MS - elapsed))}</span>
          </Row>
          <p className="cs-hint">Three pillars, never more. A 30 second story each, in order. The clock starts on the first tap and the pitch stays under three minutes.</p>
          {PILLARS.map((p, i) => {
            const done = !!closer.pillars?.[p.id]; const isNext = nextPillar?.id === p.id;
            return (
              <Card key={p.id} level={2} padding={3} className={`cl-pillar${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
                <button type="button" className="ob-card-btn v-stretch" disabled={!isNext && !done} aria-pressed={done} onClick={() => !done && onPatch(pillarPatch(lead, p.id))}>
                  <span className="ob-card-label">{i + 1}. {p.label}{done && <span className="ob-card-n">told</span>}</span>
                  <span className="ob-card-said">{p.line}</span>
                </button>
                {(done || isNext) && <p className="cl-story">{p.story}</p>}
              </Card>
            );
          })}
        </Stack>
      );
      case 'beliefs': return (
        <Stack gap={3}>
          <p className="cs-hint">Three yeses before the ask. The price step stays locked until all three.</p>
          {BELIEFS.map(b => (
            <Card key={b.id} level={2} padding={3}>
              <Checkbox label={b.label} checked={!!d.beliefs[b.id]} onChange={(v) => setD(x => ({ ...x, beliefs: { ...x.beliefs, [b.id]: !!v } }))} className={`cl-belief cl-belief--${b.id}`} />
              <p className="cs-line">{b.ask}</p>
            </Card>
          ))}
          {!unlocked && <p className="cs-hint cl-locked">Tick all three to unlock the ask.</p>}
        </Stack>
      );
      case 'ask': return (
        <Stack gap={3}>
          <p className="cs-line">{CLOSER_LINES.gap}</p>
          <p className="cs-hint">Open the prices, say the highest number first, then stop talking. Asked counts every ask; handle what comes back, then ask again.</p>
          <Button size="lg" full icon="CurrencyDollar" onClick={() => setPrices(true)} className="cl-prices">Open the prices</Button>
          <Row gap={2}>
            <Button variant="secondary" icon="Check" loading={busy} onClick={async () => { setBusy(true); try { await onPatch(askPatch(lead, 'closer')); } finally { setBusy(false); } }} className="cl-asked">Asked ({Number(closer.asks) || 0})</Button>
            <Button variant="secondary" icon="MessageCircle01" onClick={() => setObj(true)} className="cl-pushback">They pushed back</Button>
          </Row>
          <p className="cs-hint">{CLOSER_LINES.referral}</p>
        </Stack>
      );
      default: return null;
    }
  };
  const last = cur.id === 'ask';
  const locked = cur.id === 'beliefs' && !unlocked;
  const footer = (
    <>
      <Button variant="ghost" onClick={back} disabled={busy || step <= 1}>Back</Button>
      <span className="cs-pos">{step} of {STEPS.length}</span>
      {last
        ? <Button icon="Check" onClick={async () => { await save({}, STEPS.length); onClose?.(); }} className="cl-done">Done</Button>
        : <Button loading={busy} disabled={locked} onClick={next} className="cs-next" aria-disabled={locked || undefined}>{cur.id === 'beliefs' ? 'The ask' : 'Next'}</Button>}
    </>
  );
  return (
    <>
      <Sheet open={open && !prices && !obj} onClose={onClose} title={cur.title} description={lead.business} tall className="cs-sheet cl-sheet" footer={footer}>
        <div className="cs-prog" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step} aria-label="Concept call progress" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
          {STEPS.map((s, i) => <span key={s.id} className={`cs-seg${i + 1 < step ? ' is-done' : i + 1 === step ? ' is-cur' : ''}`} />)}
        </div>
        <div className="cs-body" key={cur.id}>{body()}</div>
        <style>{callStepperStyles + objectionStyles + closerStyles}</style>
      </Sheet>
      {prices && <PricePresenter open lead={lead} onClose={() => setPrices(false)} onPatch={onPatch} />}
      {obj && <ObjectionSheet open lead={lead} askKey="closer" onClose={() => setObj(false)} onPatch={onPatch} />}
    </>
  );
}

export const closerStyles = `
  .cl-clock { font-family: var(--v-font-display); font-size: var(--v-text-2xl); font-variant-numeric: tabular-nums; color: var(--v-text-2); }
  .cl-clock.is-over { color: var(--v-status-danger-text); }
  .cl-pillar .ob-card-btn:disabled { cursor: default; opacity: 0.6; }
  .cl-pillar.is-next { border-color: var(--v-border-focus); }
  .cl-story { margin-top: var(--v-space-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .cl-nudge { flex: 1; }
`;
