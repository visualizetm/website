import LeadNotes from '../LeadNotes';
import Checklists from '../Checklists';

/* Notes: the textarea and the checklists. */
export const notesSummary = (rec) => (rec.lead.notes || '').split('\n').map(l => l.trim()).find(Boolean) || 'No notes yet';

export default function NotesSection({ rec }) {
  const { lead, onPatch } = rec;
  return (
    <div className="rc-notes">
      <LeadNotes lead={lead} onSave={(id, v) => onPatch(id, { notes: v })} />
      <div className="rc-group"><p className="rc-label">Checklists</p><Checklists lead={lead} onPatch={onPatch} /></div>
    </div>
  );
}
