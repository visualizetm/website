import { useMemo, useState } from 'react';
import { PageShell, ScrollArea, Section, Stack, Row, Card, Button, Chip, Pill, IconTile, ListRow, EmptyState, NoResults, ErrorState, Stagger, useMediaQuery } from '../ui';
import { COPY } from '../shared/copy';
import { fmtDateTime } from '../shared/dates';
import { useShell, useTopBar } from '../shell/ShellContext';
import { templateName, statusOf } from '../lib/compose';
import { DRAFT_CHIPS, filterDrafts, whyLine, firstLines, recipientOf, waiting } from '../lib/sendTimes';
import { gmailDraftUrl } from '../lib/gmailLink';

/* Drafts (email safety, prompt 1 of 3), /drafts: every email and text written for Rob that has not gone, newest due first, and
 * what went in the last thirty days under the Sent chip. One row per entry: who it goes to, the subject, two lines, why it
 * exists, then Preview and edit and Send, both of which open the send sheet (src/components/email/SendSheet.jsx): nothing
 * leaves from this list, only from the sheet, after he read it. A text row gets Edit and Text it. The list is the shell's
 * (AdminApp loads /api/admin/email/drafts once and after every change), so the tab badge and the Home card agree with it. */
export default function AdminDrafts({ drafts, loading = false, error = false, onRetry, leads = [] }) {
  const shell = useShell();
  const phone = useMediaQuery('(max-width: 767px)');
  useTopBar(null);
  const [chip, setChip] = useState('all');
  const rows = useMemo(() => filterDrafts(drafts || [], chip), [drafts, chip]);
  const leadOf = (id) => leads.find(l => String(l._id) === String(id)) || null;
  const openSheet = (row, opts) => shell?.openSendSheet?.(row, opts);
  const count = (drafts || []).filter(waiting).length;
  const E = COPY.empty.drafts;
  let body;
  if (error && !drafts) body = <Card><ErrorState title="Drafts did not load" description="Nothing was lost. Try again." onRetry={onRetry} /></Card>;
  else if (loading && !drafts) body = <Stack gap={2} aria-busy="true">{[1, 2, 3].map(i => <ListRow.Skeleton key={i} />)}</Stack>;
  else if (!(drafts || []).length) body = <EmptyState icon="Mail01" title={E.title} description={E.description} action={{ label: E.action, onClick: () => shell?.go?.('leads') }} />;
  else if (!rows.length) body = <NoResults noun={chip === 'sent' ? 'sent emails' : chip === 'text' ? 'texts' : 'emails'} filters={[DRAFT_CHIPS.find(c => c.id === chip)?.label || chip]} onClear={() => setChip('all')} />;
  else body = (
    <Stagger className="dr-rows" cap={6}>
      {rows.map(r => {
        const l = leadOf(r.recordId); const st = statusOf(r.status); const isText = r.channel === 'text'; const open = waiting(r);
        const who = l?.business || 'A record';
        const title = isText ? `Text ${who}` : (r.subject || templateName(r.templateId));
        return (
          <Card key={r._id} as="div" padding={3} interactive data-row-id={r._id} className={`dr-row lay-card${isText ? ' is-text' : ''}`}>
            <button type="button" className="v-stretch" onClick={() => openSheet(r)} aria-label={`Open ${title}, to ${recipientOf(r)}`}>{title}</button>
            <Row gap={3} align="start" wrap={false} style={{ minWidth: 0 }}>
              <IconTile icon={isText ? 'MessageCircle01' : 'Mail01'} tone={r.status === 'failed' ? 'danger' : open ? 'progress' : 'neutral'} size="sm" />
              <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <span className="dr-to lay-truncate">{who} · {recipientOf(r)}</span>
                <span className="dr-subject lay-truncate">{title}</span>
                <span className="dr-peek">{firstLines(r.text)}</span>
                <Row gap={2} align="center" wrap>
                  <Pill tone={st.tone} label={r.status === 'queued' && r.sendAt ? `Queued, ${fmtDateTime(r.sendAt)}` : st.label} size="sm" icon={false} />
                  <span className="dr-why">{whyLine(r, templateName(r.templateId))}</span>
                  {r.gmailDraftId && <span className="dr-gmail">In Gmail</span>}
                </Row>
              </Stack>
            </Row>
            <Row gap={2} wrap className="v-above dr-actions">
              {r.gmailDraftId && <Button variant="ghost" size="md" icon="LinkExternal01" href={gmailDraftUrl(r.gmailMessageId)} target="_blank" rel="noopener noreferrer" className="dr-gmail-open">Open</Button>}
              {open ? <>
                <Button variant="secondary" size="md" icon="Edit02" onClick={() => openSheet(r, { startEdit: isText })} className="dr-edit">{isText ? 'Edit' : 'Preview and edit'}</Button>
                <Button size="md" icon={isText ? 'MessageCircle01' : 'Send01'} onClick={() => openSheet(r)} className="dr-send">{isText ? 'Text it' : 'Send'}</Button>
              </> : <Button variant="ghost" size="md" onClick={() => openSheet(r)} className="dr-view">Open</Button>}
            </Row>
          </Card>
        );
      })}
    </Stagger>
  );
  return (
    <PageShell className="aa-main aa-main--wide dr-shell">
      <ScrollArea wide className="dr-page">
        {!phone && <Section description={loading && !drafts ? undefined : `${count} waiting for your tap`} loading={loading && !drafts} />}
        {phone && <p className="dr-count">{loading && !drafts ? ' ' : `${count} waiting for your tap`}</p>}
        <Row gap={2} wrap className="dr-chips" role="group" aria-label="Show">
          {DRAFT_CHIPS.map(c => <Chip key={c.id} label={c.label} selected={chip === c.id} onClick={() => setChip(c.id)} className={`dr-chip dr-chip--${c.id}`} />)}
        </Row>
        {body}
        <p className="dr-note">Nothing sends until you open it and tap Send.</p>
      </ScrollArea>
      <style>{drStyles}</style>
    </PageShell>
  );
}
const drStyles = `
  .dr-page { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .dr-count { margin: 0; min-height: var(--v-lh-sm); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .dr-chips { min-width: 0; }
  .dr-rows { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .dr-row { display: flex; flex-direction: column; gap: var(--v-space-3); position: relative; }
  .dr-to { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .dr-subject { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .dr-peek { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .dr-why { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .dr-gmail { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-status-progress-text); }
  .dr-actions { position: relative; }
  .dr-note { margin: 0; display: flex; align-items: center; gap: var(--v-space-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
