import { useState } from 'react';
import { Sheet, Stack, Row, Button, Input, Select, Pill, ProgressBar, EmptyState, useToast } from '../ui';
import { handLists, listCount, windowLabel, WINDOWS } from '../lib/lists';
import { COPY } from '../shared/copy';

/* Add to list (CRM revamp, step 3): one sheet, reached from a lead card's
 * menu, the record's action row, the leads bulk bar, the kanban card menu
 * and a command bar row. Every open hand list with its count against the
 * target, and New list inline. Adding writes the list's members and each
 * lead's listId (moving it off any other open list) through the shell's
 * list ops, and toasts "Added to Tuesday morning, 19 of 25." */
export default function ListPicker({ leads, lists, ops, onClose }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('25');
  const [win, setWin] = useState('any');
  const open = handLists(lists);
  const ids = leads.map(l => l._id);
  const who = leads.length === 1 ? leads[0].business : `${leads.length} leads`;
  const add = async (list) => {
    setBusy(true);
    const r = await ops.addToList(ids, list._id);
    setBusy(false);
    if (!r) { toast.error(COPY.error.save); return; }
    toast.success(`Added to ${list.name}, ${r.count} of ${list.target}.`);
    onClose();
  };
  const create = async () => {
    const n = name.trim(); if (!n) return;
    setBusy(true);
    const item = await ops.createList({ name: n, target: Math.max(1, Math.min(500, Math.round(Number(target)) || 25)), window: win });
    setBusy(false);
    if (!item) { toast.error(COPY.error.create); return; }
    await add(item);
  };
  return (
    <Sheet open onClose={busy ? () => {} : onClose} title="Add to list" description={who} label="Add to list">
      <Stack gap={3}>
        {open.length ? open.map(l => {
          const n = listCount(l); const full = n >= (Number(l.target) || 0);
          return (
            <Row key={l._id} gap={3} align="center" className="lp-row" wrap={false}>
              <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                <Row gap={2} align="center" wrap><span className="lp-name lay-truncate">{l.name}</span>{l.window && l.window !== 'any' && <Pill tone="neutral" label={windowLabel(l.window)} size="sm" icon={false} variant="outline" />}</Row>
                <ProgressBar value={l.target ? Math.min(100, (n / l.target) * 100) : 0} tone={full ? 'booked' : 'progress'} size="sm" label={`${n} of ${l.target}`} />
              </Stack>
              <Button size="md" variant={full ? 'ghost' : 'secondary'} onClick={() => add(l)} disabled={busy}>{full ? 'Add anyway' : 'Add'}</Button>
            </Row>
          );
        }) : <EmptyState size="sm" icon="Rows01" title={COPY.empty['lists.picker'].title} description={COPY.empty['lists.picker'].description} />}
        {creating ? (
          <Stack gap={2} className="lp-new">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="Tuesday morning" data-autofocus onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
            <Row gap={2} wrap>
              <Input label="Target" type="number" inputMode="numeric" min={1} max={500} value={target} onChange={(e) => setTarget(e.target.value)} style={{ maxWidth: 120 }} />
              <Select label="Window" value={win} onChange={(e) => setWin(e.target.value)} options={WINDOWS.map(w => ({ id: w.id, label: w.label }))} />
            </Row>
            <Row gap={2} wrap><Button onClick={create} disabled={!name.trim() || busy} loading={busy}>Create and add</Button><Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button></Row>
          </Stack>
        ) : <Button variant="secondary" icon="Plus" onClick={() => setCreating(true)} disabled={busy}>New list</Button>}
      </Stack>
      <style>{`
        .lp-row { padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); }
        .lp-name { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text); }
        .lp-new { padding: var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); background: var(--v-surface-2); }
      `}</style>
    </Sheet>
  );
}
