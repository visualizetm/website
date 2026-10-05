import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Stack, Row, Button, Menu, Pill, Sheet, Input, EmptyState, ErrorState, SkeletonBlock, Stagger, useConfirm, useToast } from '../../ui';
import { fetchTemplates, patchDoc, removeDoc, saveTemplatePrefs, typeLabel } from '../../lib/docs';
import { managed, buildDoc } from '../../lib/docTemplates';
import { COPY } from '../../shared/copy';

/* Doc templates (docs job, milestone 4): the Settings tab that manages what the New doc sheet offers. A saved template (made from any doc's
 * menu, "Save as template") can be renamed, edited in the doc editor, deleted and reordered; a built in one can be hidden and shown and
 * reordered but never deleted (Edit a copy makes a saved one from it). Blank is not listed: it is always there. The order and the hidden ones
 * are one small document (settings doc-templates), written through the docs route. */
export default function DocTemplatesPanel({ docsApi }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [state, setState] = useState({ loading: true, saved: [], prefs: { hidden: [], order: [] }, error: false });
  const [rename, setRename] = useState(null);
  const load = useCallback(async () => {
    const r = await fetchTemplates();
    setState(r.ok ? { loading: false, saved: r.data.items || [], prefs: r.data.prefs || { hidden: [], order: [] }, error: false } : { loading: false, saved: [], prefs: { hidden: [], order: [] }, error: true });
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => managed(state.saved, state.prefs), [state]);
  const savePrefs = async (next) => {
    const before = state.prefs;
    setState(s => ({ ...s, prefs: next }));
    const r = await saveTemplatePrefs(next);
    if (!r.ok) { setState(s => ({ ...s, prefs: before })); toast.error(COPY.error.save); }
  };
  const keys = rows.map(r => r.key);
  const move = (key, dir) => {
    const at = keys.indexOf(key); const to = at + dir;
    if (at < 0 || to < 0 || to >= keys.length) return;
    const order = [...keys]; [order[at], order[to]] = [order[to], order[at]];
    savePrefs({ ...state.prefs, order });
  };
  const toggleHidden = (key) => { const hidden = new Set(state.prefs.hidden || []); if (hidden.has(key)) hidden.delete(key); else hidden.add(key); savePrefs({ ...state.prefs, hidden: [...hidden] }); };
  const doRename = async (row, title) => {
    const r = await patchDoc(row._id, { title });
    if (!r.ok) { toast.error(COPY.error.save); return false; }
    setState(s => ({ ...s, saved: s.saved.map(t => (String(t._id) === String(row._id) ? { ...t, title } : t)) }));
    return true;
  };
  const del = async (row) => {
    if (!(await confirm({ title: 'Delete this template?', body: `${row.label} is removed from the New doc sheet. Docs already made from it stay.`, danger: true, confirmLabel: 'Delete' }))) return;
    const r = await removeDoc(row._id);
    if (r.ok) { setState(s => ({ ...s, saved: s.saved.filter(t => String(t._id) !== String(row._id)) })); toast.success('Template deleted.'); } else toast.error(COPY.error.save);
  };
  const copyOf = async (row) => {
    const d = buildDoc(row, { lead: null });
    const item = await docsApi.ops.create({ template: true, type: d.type, title: d.title.replace(/\[client name\]/gi, '').replace(/,\s*$/, '').trim() || row.label, blocks: d.blocks });
    if (item) { toast.success('A copy is saved. Edit it here.'); docsApi.openDoc(item); } else toast.error(COPY.error.save);
  };

  if (state.loading) return <Stack gap={3} aria-busy="true" aria-hidden="true">{[88, 104, 104, 104, 104, 104, 104].map((h, i) => <SkeletonBlock key={i} height={h} radius="var(--v-radius-lg)" />)}</Stack>;
  if (state.error) return <Card><ErrorState title={COPY.error.settings.title} description="The templates did not load." onRetry={load} /></Card>;
  return (
    <Stack gap={3}>
      <Card className="st-card">
        <p className="pb-card-h">Doc templates</p>
        <p className="dt-muted">What the New doc sheet offers, in this order. Hide a built in one you never use. Save any doc as a template from its menu.</p>
      </Card>
      <Stagger className="v-stack dtp-rows" cap={6}>
        {rows.map((r, i) => (
          <Card key={r.key} className={`dtp-row${r.hidden ? ' is-hidden' : ''}`} data-template={r.key}>
            <Row gap={3} align="center" justify="between">
              <span className="dtp-text">
                <span className="dtp-name">{r.label}</span>
                <span className="dtp-sub">{r.builtin ? r.blurb : `${typeLabel(r.type)}, ${(r.blocks || []).length} blocks`}</span>
                <span className="dtp-pills"><Pill tone="neutral" label={r.builtin ? 'Built in' : 'Saved'} size="sm" icon={false} variant="soft" />{r.hidden && <Pill tone="new" label="Hidden" size="sm" icon={false} variant="soft" />}</span>
              </span>
              <Menu label={`${r.label} actions`} items={[
                ...(r.builtin ? [{ id: 'hide', label: r.hidden ? 'Show in New doc' : 'Hide from New doc', icon: r.hidden ? 'Eye' : 'EyeOff', onSelect: () => toggleHidden(r.key) }, { id: 'copy', label: 'Edit a copy', icon: 'Edit02', onSelect: () => copyOf(r) }]
                  : [{ id: 'edit', label: 'Edit', icon: 'Edit02', onSelect: () => docsApi.openDoc(r) }, { id: 'rename', label: 'Rename', icon: 'Pencil01', onSelect: () => setRename(r) }]),
                { id: 'up', label: 'Move up', icon: 'ArrowUp', disabled: i === 0, onSelect: () => move(r.key, -1) },
                { id: 'down', label: 'Move down', icon: 'ArrowDown', disabled: i === rows.length - 1, onSelect: () => move(r.key, 1) },
                ...(r.builtin ? [] : ['divider', { id: 'del', label: 'Delete', icon: 'Trash01', danger: true, onSelect: () => del(r) }]),
              ]} />
            </Row>
          </Card>
        ))}
      </Stagger>
      {state.saved.length === 0 && <Card><EmptyState size="sm" icon="Save01" title="No saved templates yet" description={COPY.docs.savedHint} /></Card>}
      {rename && <RenameSheet row={rename} onSave={(t) => doRename(rename, t)} onClose={() => setRename(null)} />}
      {confirmDialog}
      <style>{panelStyles}</style>
    </Stack>
  );
}

function RenameSheet({ row, onSave, onClose }) {
  const [name, setName] = useState(row.title || row.label || '');
  const [busy, setBusy] = useState(false);
  const save = async () => { if (!name.trim() || busy) return; setBusy(true); try { if (await onSave(name.trim().slice(0, 160))) onClose(); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} title="Rename template" label="Rename template" width={420}
      footer={<Row gap={2} justify="end" wrap><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Check" onClick={save} disabled={!name.trim()} loading={busy} className="dtp-rename-save">Save</Button></Row>}>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value.slice(0, 160))} data-autofocus required onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
    </Sheet>
  );
}


const panelStyles = `
  .dtp-rows { gap: var(--v-space-3); }
  .dtp-row { padding: var(--v-space-3); }
  .dtp-row.is-hidden { opacity: 0.7; }
  .dtp-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .dtp-name { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .dtp-sub { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dtp-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dtp-pills { display: flex; gap: var(--v-space-2); flex-wrap: wrap; margin-top: var(--v-space-1); }
`;
