import { PageShell, ScrollArea, Section, Card, EmptyState } from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';

/* Concepts (rebuilt as a client presentation, docs/CONCEPTS-AUDIT.md). The
 * prompt library that lived here is gone; the list of every concept set
 * across every lead lands in Part 3. */
export default function AdminConcepts({ loading }) {
  useTopBar(null);
  const E = COPY.empty['concepts.none'];
  return (
    <PageShell className="aa-main aa-main--wide">
      <ScrollArea wide>
        <Section title="Concepts" loading={loading} />
        <Card><EmptyState icon="LayersThree01" title={E.title} description={E.description} /></Card>
      </ScrollArea>
    </PageShell>
  );
}
