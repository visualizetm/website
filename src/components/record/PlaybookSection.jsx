import { ScriptSteps, Objections, CloseCards } from '../LeadPlaybook';
import ListEditor from './ListEditor';

/* Playbook: the intel as three plain lists with small labels, then Before
 * you dial, the script, the objections and the close. Every line edits in
 * place; a read only record shows the lists as text. */
const INTEL = [['accomplishments', 'Accomplishments'], ['gaps', 'Gaps'], ['dropLines', 'Drop these on the call']];

export const playbookSummary = (rec) => {
  const { lead } = rec;
  const s = lead.script || {};
  const hasScript = Object.keys(s).some(k => k !== 'likelyAnswers' && s[k]);
  const obj = (lead.objections || []).length;
  const c = lead.close || {};
  const hasClose = Object.values(c).some(Boolean);
  const parts = [hasScript ? 'Script' : '', obj ? `${obj} objection${obj === 1 ? '' : 's'}` : '', hasClose ? 'close' : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Nothing written yet';
};

function Lines({ items, onChange, placeholder }) {
  if (onChange) return <ListEditor items={items} onChange={onChange} placeholder={placeholder} />;
  return items.length ? <ul className="pb-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="rc-line">None yet.</p>;
}

export default function PlaybookSection({ rec }) {
  const { lead, readOnly, patch } = rec;
  const intel = lead.intel || {};
  return (
    <div className="rc-playbook">
      {INTEL.map(([k, label]) => (
        <div key={k} className="rc-group"><p className="rc-label">{label}</p><Lines items={intel[k] || []} onChange={readOnly ? undefined : (next) => patch({ intel: { ...intel, [k]: next } })} placeholder={`Add to ${label.toLowerCase()}`} /></div>
      ))}
      <div className="rc-group"><p className="rc-label">Before you dial</p><Lines items={lead.beforeYouDial || []} onChange={readOnly ? undefined : (v) => patch({ beforeYouDial: v })} placeholder="Add a pre-dial check" /></div>
      <div className="rc-group"><p className="rc-label">Script</p><ScriptSteps lead={lead} onChange={readOnly ? undefined : (v) => patch({ script: v })} /></div>
      <div className="rc-group"><p className="rc-label">Objections</p><Objections lead={lead} onChange={readOnly ? undefined : (v) => patch({ objections: v })} /></div>
      <div className="rc-group"><p className="rc-label">Close</p><CloseCards lead={lead} onChange={readOnly ? undefined : (v) => patch({ close: v })} /></div>
    </div>
  );
}
