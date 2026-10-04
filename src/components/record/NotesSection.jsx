import LeadNotes from '../LeadNotes';

/* Notes: the textarea. The checklists that used to sit under it are the Tasks section now (one task system). */
export const notesSummary = (rec) => (rec.lead.notes || '').split('\n').map(l => l.trim()).find(Boolean) || 'No notes yet';

export default function NotesSection({ rec }) {
  const { lead, onPatch } = rec;
  return (
    <div className="rc-notes">
      <LeadNotes lead={lead} onSave={(id, v) => onPatch(id, { notes: v })} />
    </div>
  );
}
