import { Card, ListRow, IconTile } from '../ui';
import { useShell } from '../shell/ShellContext';
import { waiting } from '../lib/sendTimes';

/* The Drafts card on the home (email safety, prompt 1 of 3): how many emails and texts wait for Rob's tap, one row into /drafts.
 * It reads the shell's list (the same one the tab badge counts), and draws nothing while there is nothing waiting or the list is
 * still on its way, so it never pushes Next up around. */
export default function DraftsCard() {
  const shell = useShell();
  const rows = (shell?.drafts || []).filter(waiting);
  if (!rows.length) return null;
  const texts = rows.filter(r => r.channel === 'text').length;
  const emails = rows.length - texts;
  const what = [emails ? `${emails} email${emails === 1 ? '' : 's'}` : '', texts ? `${texts} text${texts === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  return (
    <Card padding={2} className="dc-card" data-card="drafts">
      <ListRow leading={<IconTile icon="Mail01" tone="progress" size="sm" glow={false} />} title={`${what} waiting for your tap`} subtitle="Read each one in Drafts, then send." onClick={() => shell?.go?.('drafts')} className="dc-row" aria-label={`${what} waiting for your tap. Open Drafts`} />
      <style>{dcStyles}</style>
    </Card>
  );
}
const dcStyles = `
  .dc-card { min-width: 0; }
`;
