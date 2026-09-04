import { useState } from 'react';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import { Card, Stack, Grid, EmptyState, InlineEdit, Button, IconButton } from '../ui';

/* The call playbook pieces of a lead: script steps, objections, close, intel.
 * Read-only in the Call Console room; pass `onChange(nextValue)` from the
 * lead detail (Prompt 8) to make every line an InlineEdit. Writes replace the
 * whole script{} / objections[] / close{} through the existing $set. */

const STEPS = [
  ['confirm', 'Opener', 'Confirm you have the right person'],
  ['intro', 'Intro', 'Who you are, buy ten seconds'],
  ['homework', 'Homework', 'Show you looked'],
  ['question', 'The question', 'Then stop talking'],
  ['hook', 'Value', 'The hook'],
  ['ask', 'Ask', 'Two options, always'],
];

export function ScriptSteps({ lead, onChange }) {
  const s = lead.script || {};
  const steps = onChange ? STEPS : STEPS.filter(([k]) => s[k]);
  if (!steps.length) return <EmptyState size="sm" icon="Edit02" title="No script yet" description="Add the opener, value, and ask on the lead." />;
  const set = (k, v) => onChange({ ...s, [k]: v });
  return (
    <ol className="pb-steps">
      {steps.map(([k, title, hint], i) => (
        <li key={k} className="pb-step">
          <div className="pb-step-head"><span className="pb-step-n">{i + 1}</span><span className="pb-step-title">{title}</span><span className="pb-step-hint">{hint}</span></div>
          {onChange ? <InlineEdit value={s[k] || ''} onSave={(v) => set(k, v)} multiline placeholder={`Write the ${title.toLowerCase()}`} label={title} className="pb-say pb-say--edit" /> : <p className="pb-say">{s[k]}</p>}
          {k === 'question' && (s.likelyAnswers?.length > 0 || onChange) && (
            <div className="pb-qa">
              {(s.likelyAnswers || []).map((r, j) => (
                <div key={j} className="pb-qa-row">
                  {onChange ? <><InlineEdit value={r.say || ''} onSave={(v) => set('likelyAnswers', s.likelyAnswers.map((x, m) => (m === j ? { ...x, say: v } : x)))} placeholder="They say" label="They say" className="pb-qa-say" /><span className="pb-qa-edit"><InlineEdit value={r.respond || ''} onSave={(v) => set('likelyAnswers', s.likelyAnswers.map((x, m) => (m === j ? { ...x, respond: v } : x)))} placeholder="You respond" label="You respond" /><IconButton icon={Trash01} label="Remove answer" onClick={() => set('likelyAnswers', s.likelyAnswers.filter((_, m) => m !== j))} /></span></>
                    : <><span className="pb-qa-say">{r.say}</span><span className="pb-qa-respond">{r.respond}</span></>}
                </div>
              ))}
              {onChange && <Button variant="ghost" icon={Plus} onClick={() => set('likelyAnswers', [...(s.likelyAnswers || []), { say: '', respond: '' }])}>Add a likely answer</Button>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function Objections({ lead, onChange }) {
  const rows = lead.objections || [];
  const [open, setOpen] = useState(() => new Set());
  if (!rows.length && !onChange) return <EmptyState size="sm" icon="MessageCircle01" title="No objections listed" description="Return to the ask after every one." />;
  const setRow = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="pb-obj">
      {rows.map((r, i) => {
        const on = open.has(i) || !!onChange;
        return (
          <div key={i} className={`pb-obj-row${on ? ' is-open' : ''}`}>
            {onChange ? (
              <div className="pb-obj-edit">
                <InlineEdit value={r.say || ''} onSave={(v) => setRow(i, { say: v })} placeholder="What they say" label="Objection" className="pb-obj-say" />
                <InlineEdit value={r.respond || ''} onSave={(v) => setRow(i, { respond: v })} multiline placeholder="What you say back" label="Response" className="pb-obj-respond-edit" />
                <IconButton icon={Trash01} label="Remove objection" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="pb-obj-x" />
              </div>
            ) : (
              <>
                <button type="button" className="pb-obj-btn" onClick={() => setOpen(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} aria-expanded={on}>
                  <span className="pb-obj-say">{r.say}</span><ChevronDown width={16} height={16} className="pb-chev" />
                </button>
                {on && <p className="pb-obj-respond">{r.respond}</p>}
              </>
            )}
          </div>
        );
      })}
      {onChange && <Button variant="ghost" icon={Plus} onClick={() => onChange([...rows, { say: '', respond: '' }])}>Add an objection</Button>}
    </div>
  );
}

export function CloseCards({ lead, onChange }) {
  const c = lead.close || {};
  const all = [['lockIt', 'Lock it', 'booked'], ['ifNo', 'If it is a no', 'danger'], ['noAnswer', 'No answer', 'new']];
  const cards = onChange ? all : all.filter(([k]) => c[k]);
  if (!cards.length) return <EmptyState size="sm" icon="Check" title="No close lines yet" />;
  return (
    <Stack gap={2}>
      {cards.map(([k, title, tone]) => <Card key={k} level={2} padding={3} glow={tone}><p className="pb-card-h">{title}</p>{onChange ? <InlineEdit value={c[k] || ''} onSave={(v) => onChange({ ...c, [k]: v })} multiline placeholder={`Write the ${title.toLowerCase()} line`} label={title} className="pb-say pb-say--edit" /> : <p className="pb-say">{c[k]}</p>}</Card>)}
    </Stack>
  );
}

export function IntelCards({ lead, onChange, ListEditor }) {
  const i = lead.intel || {};
  const all = [['accomplishments', 'Accomplishments', 'booked'], ['gaps', 'Gaps', 'danger'], ['dropLines', 'Drop these on the call', 'callback']];
  const groups = onChange ? all : all.filter(([k]) => i[k]?.length);
  if (!groups.length) return <EmptyState size="sm" icon="SearchMd" title="No intel yet" description="The nightly scan fills this in when it finds something." />;
  return (
    <Grid minColumnWidth={200} gap={2}>
      {groups.map(([k, title, tone]) => (
        <Card key={k} level={2} padding={3} glow={tone}>
          <p className="pb-card-h">{title}</p>
          {onChange && ListEditor ? <ListEditor items={i[k] || []} onChange={(next) => onChange({ ...i, [k]: next })} placeholder={`Add to ${title.toLowerCase()}`} /> : <ul className="pb-list">{(i[k] || []).map((x, j) => <li key={j}>{x}</li>)}</ul>}
        </Card>
      ))}
    </Grid>
  );
}
/* playbookStyles lives in src/ui/lead.styles.js (uiStyles). */
