import { useState } from 'react';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import { Card, Stack, Grid, EmptyState } from '../ui';

/* The call playbook pieces of a lead: script steps, objections, close, intel.
 * Shared by the Call Console room and (Prompt 8) the lead detail. */

const STEPS = [
  ['confirm', 'Opener', 'Confirm you have the right person'],
  ['intro', 'Intro', 'Who you are, buy ten seconds'],
  ['homework', 'Homework', 'Show you looked'],
  ['question', 'The question', 'Then stop talking'],
  ['hook', 'Value', 'The hook'],
  ['ask', 'Ask', 'Two options, always'],
];

export function ScriptSteps({ lead }) {
  const s = lead.script || {};
  const steps = STEPS.filter(([k]) => s[k]);
  if (!steps.length) return <EmptyState size="sm" icon="Edit02" title="No script yet" description="Add the opener, value, and ask on the lead." />;
  return (
    <ol className="pb-steps">
      {steps.map(([k, title, hint], i) => (
        <li key={k} className="pb-step">
          <div className="pb-step-head"><span className="pb-step-n">{i + 1}</span><span className="pb-step-title">{title}</span><span className="pb-step-hint">{hint}</span></div>
          <p className="pb-say">{s[k]}</p>
          {k === 'question' && s.likelyAnswers?.length > 0 && (
            <div className="pb-qa">{s.likelyAnswers.map((r, j) => <div key={j} className="pb-qa-row"><span className="pb-qa-say">{r.say}</span><span className="pb-qa-respond">{r.respond}</span></div>)}</div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Objections({ lead }) {
  const rows = lead.objections || [];
  const [open, setOpen] = useState(() => new Set());
  if (!rows.length) return <EmptyState size="sm" icon="MessageCircle01" title="No objections listed" description="Return to the ask after every one." />;
  return (
    <div className="pb-obj">
      {rows.map((r, i) => {
        const on = open.has(i);
        return (
          <div key={i} className={`pb-obj-row${on ? ' is-open' : ''}`}>
            <button type="button" className="pb-obj-btn" onClick={() => setOpen(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} aria-expanded={on}>
              <span className="pb-obj-say">{r.say}</span><ChevronDown width={16} height={16} className="pb-chev" />
            </button>
            {on && <p className="pb-obj-respond">{r.respond}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function CloseCards({ lead }) {
  const c = lead.close || {};
  const cards = [['lockIt', 'Lock it', 'booked'], ['ifNo', 'If it is a no', 'danger'], ['noAnswer', 'No answer', 'new']].filter(([k]) => c[k]);
  if (!cards.length) return <EmptyState size="sm" icon="Check" title="No close lines yet" />;
  return (
    <Stack gap={2}>
      {cards.map(([k, title, tone]) => <Card key={k} level={2} padding={3} glow={tone}><p className="pb-card-h">{title}</p><p className="pb-say">{c[k]}</p></Card>)}
    </Stack>
  );
}

export function IntelCards({ lead }) {
  const i = lead.intel || {};
  const groups = [['accomplishments', 'Accomplishments', 'booked'], ['gaps', 'Gaps', 'danger'], ['dropLines', 'Drop these on the call', 'callback']].filter(([k]) => i[k]?.length);
  if (!groups.length) return <EmptyState size="sm" icon="SearchMd" title="No intel yet" description="The nightly scan fills this in when it finds something." />;
  return (
    <Grid minColumnWidth={200} gap={2}>
      {groups.map(([k, title, tone]) => (
        <Card key={k} level={2} padding={3} glow={tone}>
          <p className="pb-card-h">{title}</p>
          <ul className="pb-list">{i[k].map((x, j) => <li key={j}>{x}</li>)}</ul>
        </Card>
      ))}
    </Grid>
  );
}

export const playbookStyles = `
  .pb-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-3); }
  .pb-step { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); }
  .pb-step-head { display: flex; align-items: baseline; gap: var(--v-space-2); flex-wrap: wrap; }
  .pb-step-n { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--v-red-soft); color: var(--v-red-highlight); font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); }
  .pb-step-title { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .pb-step-hint { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .pb-say { margin: 0; font-size: var(--v-text-lg); line-height: var(--v-lh-lg); color: var(--v-text); overflow-wrap: anywhere; }
  .pb-qa { display: flex; flex-direction: column; gap: var(--v-space-1); border-top: 1px solid var(--v-border); padding-top: var(--v-space-2); }
  .pb-qa-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: var(--v-space-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pb-qa-say { color: var(--v-text-3); font-style: italic; }
  .pb-qa-respond { color: var(--v-text); }
  .pb-obj { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .pb-obj-row { background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); overflow: hidden; }
  .pb-obj-row.is-open { border-color: var(--v-border-strong); }
  .pb-obj-btn { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); width: 100%; min-height: var(--v-tap); padding: var(--v-space-2) var(--v-space-3); border: 0; background: transparent; color: var(--v-text); cursor: pointer; text-align: left; font: inherit; font-size: var(--v-text-md); font-weight: var(--v-weight-semibold); }
  .pb-obj-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .pb-chev { flex-shrink: 0; color: var(--v-text-3); transition: transform var(--v-dur-base) var(--v-ease-out); }
  .is-open .pb-chev { transform: rotate(180deg); }
  .pb-obj-respond { margin: 0; padding: 0 var(--v-space-3) var(--v-space-3); font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .pb-card-h { margin: 0 0 var(--v-space-2); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .pb-list { margin: 0; padding-left: var(--v-space-4); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); display: flex; flex-direction: column; gap: var(--v-space-1); }
`;
