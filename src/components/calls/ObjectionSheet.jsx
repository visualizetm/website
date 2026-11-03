import { useState } from 'react';
import { Sheet, Stack, Button, Card } from '../../ui';
import { OBJECTIONS, objectionCard, objectionPatch, askPatch, objectionCount } from '../../shared/callScript';

/* Objection cards (prompt 2 of 3, milestone 3): Money, Time, Fit, Partner, Stall (and Bad past experience). Each card is what
 * they said, Rob's line (the lead's own objections[] first, then the shared set from docs/HORMOZI-CLOSE.md) and the logic in
 * one sentence. Tapping a card logs the objection on the lead with a count (afterCall.objection, afterCall.objections[id]);
 * "Handled, ask again" closes the sheet and bumps the ask counter. Reachable from the Room, both steppers and the record.
 *
 * The writes (objectionPatch, askPatch, objectionCount) are in src/shared/callScript.js so close-test reads them. */
/** The cards, inline (the stepper's value step) or in the sheet. `picked` opens that card; onPick(id) logs it. */
export function ObjectionCards({ lead, picked, onPick, ids = null }) {
  const list = (ids ? OBJECTIONS.filter(o => ids.includes(o.id)) : OBJECTIONS).map(o => objectionCard(lead, o.id));
  return (
    <div className="ob-cards" role="group" aria-label="Objections">
      {list.map(o => {
        const on = picked === o.id; const n = objectionCount(lead, o.id);
        return (
          <Card key={o.id} level={2} padding={3} className={`ob-card${on ? ' is-on' : ''}`}>
            <button type="button" className="ob-card-btn v-stretch" aria-pressed={on} onClick={() => onPick?.(o.id)} aria-label={`${o.label}${n ? `, logged ${n} times` : ''}`}>
              <span className="ob-card-label">{o.label}{n > 0 && <span className="ob-card-n">{n}</span>}</span>
              <span className="ob-card-said">{o.said}</span>
            </button>
            {on && (
              <div className="ob-card-body">
                <p className="ob-line">{o.line}</p>
                <p className="ob-logic">{o.logic}{o.own ? ' (your line for this lead)' : ''}</p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function ObjectionSheet({ open, lead, onClose, onPatch, askKey = 'asks' }) {
  const [picked, setPicked] = useState(lead?.afterCall?.objection || '');
  const [busy, setBusy] = useState(false);
  const pick = async (id) => { setPicked(id); await onPatch?.(objectionPatch(lead, id)); };
  const handled = async () => { setBusy(true); try { await onPatch?.(askPatch(lead, askKey)); } finally { setBusy(false); } onClose?.(); };
  return (
    <Sheet open={open} onClose={onClose} title="Objections" description="Tap what they said. Handle it, then ask again." tall className="ob-sheet"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button><Button icon="Check" loading={busy} onClick={handled}>Handled, ask again</Button></>}>
      <Stack gap={2}>
        <ObjectionCards lead={lead} picked={picked} onPick={pick} />
      </Stack>
      <style>{objectionStyles}</style>
    </Sheet>
  );
}

export const objectionStyles = `
  .ob-cards { display: grid; gap: var(--v-space-2); }
  .ob-card { position: relative; }
  .ob-card.is-on { border-color: var(--v-border-focus); }
  .ob-card-btn { display: flex; flex-direction: column; gap: var(--v-space-1); width: 100%; min-height: var(--v-tap); text-align: left; background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; }
  .ob-card-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  .ob-card-label { font-weight: var(--v-weight-bold); display: inline-flex; align-items: center; gap: var(--v-space-2); }
  .ob-card-n { font-size: var(--v-text-xs); line-height: 1; padding: 2px 6px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); color: var(--v-text-2); }
  .ob-card-said { color: var(--v-text-2); font-size: var(--v-text-sm); }
  .ob-card-body { margin-top: var(--v-space-2); border-top: 1px solid var(--v-border); padding-top: var(--v-space-2); display: grid; gap: var(--v-space-1); }
  .ob-line { font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .ob-logic { font-size: var(--v-text-sm); color: var(--v-text-3); }
`;
