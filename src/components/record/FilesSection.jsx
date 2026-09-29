import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import { Button, IconButton, InlineEdit, Checkbox, Toggle, useToast } from '../../ui';
import { safeHref } from '../../lib/safeUrl';
import { COPY } from '../../shared/copy';
import { fmtDateTime } from '../../shared/dates';
import { releaseBlockReason, DELIVERABLE_GROUPS, deliverablesFor } from '../../lib/projects';
import { copyText } from '../ClientWorkspace';
import EmptyLine from './EmptyLine';
import ProjectPicker from './ProjectPicker';

/* Files: the links (Drive is the client's own; Website and Instagram are
 * the lead's socials, edited through Edit all), the release toggle line,
 * then the deliverable groups as plain checkbox rows with a link each. */
const LINKS = [['drive', 'Google Drive'], ['website', 'Website'], ['instagram', 'Instagram']];

export const filesSummary = (rec) => {
  const p = rec.cw.current;
  if (!p) return 'No project yet';
  const all = p.deliverables || [];
  return `${all.filter(d => d.done).length} of ${all.length} ready · ${p.releasedAt ? 'released' : 'release at full payment'}`;
};

export default function FilesSection({ rec }) {
  const { lead, cw, readOnly, patchRaw } = rec;
  const toast = useToast();
  const p = cw.current;
  const links = lead.links || {};
  const valueOf = (k) => links[k] || (k === 'website' ? lead.socials?.website : k === 'instagram' ? lead.socials?.instagram : '') || '';
  const saveDrive = (v) => patchRaw({ links: { website: '', instagram: '', ...links, drive: v } });
  const relBlock = p ? releaseBlockReason(p) : null;
  const driveLink = p?.links?.drive || links.drive || '';
  const E = COPY.empty;
  return (
    <div className="rc-files">
      <div className="rc-group">
        <p className="rc-label">Links</p>
        {LINKS.map(([k, label]) => { const v = valueOf(k); const href = safeHref(v); return (
          <div key={k} className="rc-fact rc-fact--wide">
            <span className="rc-fact-label">{label}</span>
            {k === 'drive' && !readOnly
              ? <InlineEdit value={links.drive || ''} onSave={saveDrive} placeholder="Paste the Drive folder link" label="Google Drive link" className="rc-fact-edit" />
              : <span className="rc-fact-ro lay-truncate">{v || (k === 'drive' ? 'None' : 'Not set, add it in Edit all')}</span>}
            <span className="rc-fact-act">{href && <IconButton icon="LinkExternal01" label={`Open ${label}`} variant="ghost" onClick={() => window.open(href, '_blank', 'noopener')} />}<IconButton icon="Copy01" label={`Copy ${label}`} variant="ghost" disabled={!v} onClick={() => copyText(toast, v, label)} /></span>
          </div>
        ); })}
      </div>
      <ProjectPicker cw={cw} />
      {!p ? <EmptyLine text={E['clients.deliverables.noproject'].title} action={!readOnly ? { label: E['clients.deliverables.noproject'].action, icon: Plus, onClick: cw.openNew } : null} /> : (
        <>
          <Toggle label="Released to client" description={p.releasedAt ? `Released ${fmtDateTime(p.releasedAt)}.` : relBlock || 'Paid in full. Flip this once the Drive folder is shared.'} checked={!!p.releasedAt} disabled={!!relBlock || readOnly} onChange={(v) => cw.pp(p, { releasedAt: v ? new Date().toISOString() : '' })} className="cw-release-toggle" />
          {p.releasedAt && safeHref(driveLink) && <Button variant="secondary" size="md" href={safeHref(driveLink)} target="_blank" rel="noopener noreferrer" icon="Folder" iconEnd="LinkExternal01" className="cw-drive-big">Open the Drive folder</Button>}
          {(p.deliverables || []).length ? DELIVERABLE_GROUPS.filter(g => (p.deliverables || []).some(d => d.group === g.id)).map(g => (
            <div key={g.id} className="rc-group">
              <p className="rc-label">{g.label}</p>
              {(p.deliverables || []).filter(d => d.group === g.id).map(d => (
                <div key={d.id} className="cw-deliv">
                  <Checkbox label={d.label} checked={!!d.done} onChange={(v) => cw.pp(p, { deliverables: p.deliverables.map(x => (x.id === d.id ? { ...x, done: v } : x)) })} disabled={readOnly} />
                  <span className="cw-deliv-link">{readOnly ? (safeHref(d.link) ? <a href={safeHref(d.link)} target="_blank" rel="noopener noreferrer" className="cw-deliv-a lay-truncate">{d.link.replace(/^https?:\/\//, '')}</a> : null) : <InlineEdit value={d.link || ''} onSave={(v) => cw.ppRaw(p, { deliverables: p.deliverables.map(x => (x.id === d.id ? { ...x, link: v } : x)) })} placeholder="Add a link" label={`${d.label} link`} format={(v) => v.replace(/^https?:\/\//, '')} className={`cw-deliv-edit${d.link ? ' has-link' : ''}`} />}{d.link && <IconButton icon="LinkExternal01" label={`Open ${d.label}`} variant="ghost" onClick={() => { const u = safeHref(d.link); if (u) window.open(u, '_blank', 'noopener'); }} />}</span>
                </div>
              ))}
            </div>
          )) : <EmptyLine text={E['clients.deliverables'].title} action={!readOnly ? { label: E['clients.deliverables'].action, onClick: () => cw.pp(p, { deliverables: deliverablesFor(p.kind) }) } : null} />}
        </>
      )}
    </div>
  );
}
