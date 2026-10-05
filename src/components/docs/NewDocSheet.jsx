import { useEffect, useState } from 'react';
import { Sheet, Icon, Pill, SkeletonBlock, Button } from '../../ui';
import { fetchTemplates, typeLabel } from '../../lib/docs';
import { offered, buildDoc } from '../../lib/docTemplates';
import { COPY } from '../../shared/copy';

/* New doc (docs job, milestone 4): the template sheet. Blank, Project brief, Call notes, Contract, Delivery notes, Brand notes, then the
 * templates Rob saved (Settings manages them: hide, rename, reorder, delete). Choosing one makes the doc at once with this client's fields
 * filled as plain text and every field it cannot answer left as a [placeholder], then opens it. The built in ones show at once; the saved
 * ones follow when they arrive, so the sheet never waits on the network to offer Blank. */
export default function NewDocSheet({ lead, projects, onCreate, onClose }) {
  const [state, setState] = useState({ loading: true, saved: [], prefs: {}, error: false });
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let live = true;
    fetchTemplates().then(r => { if (live) setState(r.ok ? { loading: false, saved: r.data.items || [], prefs: r.data.prefs || {}, error: false } : { loading: false, saved: [], prefs: {}, error: true }); });
    return () => { live = false; };
  }, []);
  const list = offered(state.saved, state.prefs);
  const pick = async (t) => {
    if (busy) return;
    setBusy(t.key);
    const doc = buildDoc(t, { lead, projects });
    const ok = await onCreate({ leadId: String(lead._id), ...doc });
    setBusy('');
    if (ok) onClose();
  };
  return (
    <Sheet open onClose={onClose} title="New doc" description={lead?.business} label="New doc" className="nd-sheet" tall>
      <div className="nd-list" role="group" aria-label="Templates">
        {list.map(t => (
          <button key={t.key} type="button" className="nd-opt" data-template={t.key} disabled={!!busy} onClick={() => pick(t)}>
            <span className="nd-ico"><Icon icon={t.builtin ? 'File02' : 'Save01'} size={20} /></span>
            <span className="nd-text"><span className="nd-name">{t.label}</span><span className="nd-sub">{t.builtin ? t.blurb : `Saved template, ${typeLabel(t.type)}`}</span></span>
            {busy === t.key ? <Pill tone="neutral" label="Making it" size="sm" icon={false} variant="soft" /> : !t.builtin && <Pill tone="neutral" label="Saved" size="sm" icon={false} variant="soft" />}
          </button>
        ))}
        {state.loading && <SkeletonBlock height={56} radius="var(--v-radius-md)" aria-hidden="true" />}
      </div>
      {state.error && <p className="nd-note" role="alert">Your saved templates did not load. The built in ones are here. <Button variant="ghost" size="md" onClick={() => { setState(s => ({ ...s, loading: true, error: false })); fetchTemplates().then(r => setState(r.ok ? { loading: false, saved: r.data.items || [], prefs: r.data.prefs || {}, error: false } : { loading: false, saved: [], prefs: {}, error: true })); }}>Retry</Button></p>}
      {!state.loading && !state.error && state.saved.length === 0 && <p className="nd-note">{COPY.docs.savedHint}</p>}
      <style>{newDocStyles}</style>
    </Sheet>
  );
}

const newDocStyles = `
  .nd-list { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .nd-opt { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap-lg); padding: var(--v-space-2) var(--v-space-3); text-align: left; border: 1px solid var(--v-border-1); border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text); font: inherit; cursor: pointer; }
  .nd-opt:hover:not(:disabled) { border-color: var(--v-border-2); }
  .nd-opt:disabled { opacity: 0.6; cursor: default; }
  .nd-opt:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .nd-ico { display: inline-flex; flex-shrink: 0; color: var(--v-text-3); }
  .nd-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .nd-name { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); overflow-wrap: anywhere; }
  .nd-sub { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .nd-note { margin: var(--v-space-3) 0 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
