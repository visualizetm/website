import { useEffect, useState } from 'react';
import { Button, InlineEdit, Sheet, Stack, Row } from '../../ui';
import { fmtDate, relativeTime } from '../../shared/dates';
import { money } from '../../shared/format';
import { formatPhone } from '../../shared/phone';
import { displayIndustry } from '../../shared/semantics';
import { lifetimeValue, isHex, brandText } from '../../lib/projects';
import { copyText } from '../ClientWorkspace';
import { AnglePara } from './FactsGrid';

/* The full profile (client page workspace redesign, section 1): every
 * detail the page used to show in its flat grid, grouped: Contact, Online,
 * Business, Brand, Notes. Filled rows are tap to edit in place; the empty
 * ones wait behind one Add a detail sheet (law 3); Edit all is the header
 * action. On a phone this is a pushed screen (a section, through
 * nav-history); on a computer LeadDetail shows it in a side panel. The
 * `focus` prop names the field a profile card's dimmed button asked for, so
 * the Add a detail sheet opens on arrival. */

export function profileGroups(rec) {
  const { lead, clientMode, patchRaw } = rec;
  const save = (key) => (v) => patchRaw({ [key]: v });
  const saveSocial = (key) => (v) => patchRaw({ socials: { ...(lead.socials || {}), [key]: v } });
  const b = { primary: '', colors: [], fontDisplay: '', fontBody: '', notes: '', ...(lead.brand || {}) };
  const brand = (next) => patchRaw({ brand: { ...b, ...next } });
  const scan = lead.enrichment?.lastScanAt ? `${relativeTime(lead.enrichment.lastScanAt)}, ${lead.enrichment.scanCount || 1} scan${(lead.enrichment.scanCount || 1) === 1 ? '' : 's'}` : '';
  const soc = (k) => lead.socials?.[k] || '';
  return [
    { id: 'contact', label: 'Contact', rows: [
      { id: 'phone', label: 'Phone', raw: lead.phone || '', value: formatPhone(lead.phone) || '', format: formatPhone, onSave: save('phone'), inputMode: 'tel', placeholder: 'Add phone' },
      { id: 'askFor', label: 'Contact', raw: lead.askFor || '', value: lead.askFor || '', onSave: save('askFor'), placeholder: 'Who to ask for' },
      { id: 'email', label: 'Email', raw: lead.email || '', value: lead.email || '', onSave: save('email'), inputMode: 'email', type: 'email', placeholder: 'Add email' },
      { id: 'bestWindow', label: 'Best window', raw: lead.bestWindow || '', value: lead.bestWindow || '', onSave: save('bestWindow'), placeholder: 'Before 8am or after 5pm' },
      { id: 'phoneNote', label: 'Phone note', raw: lead.phoneNote || '', value: lead.phoneNote || '', onSave: save('phoneNote'), placeholder: 'Front desk, extension' },
    ] },
    { id: 'online', label: 'Online', rows: [
      { id: 'website', label: 'Website', raw: soc('website'), value: soc('website'), onSave: saveSocial('website'), placeholder: 'Add website', inputMode: 'url' },
      { id: 'instagram', label: 'Instagram', raw: soc('instagram'), value: soc('instagram'), onSave: saveSocial('instagram'), placeholder: 'Add Instagram', inputMode: 'url' },
      { id: 'facebook', label: 'Facebook', raw: soc('facebook'), value: soc('facebook'), onSave: saveSocial('facebook'), placeholder: 'Add Facebook', inputMode: 'url' },
      { id: 'google', label: 'Maps', raw: soc('google'), value: soc('google'), onSave: saveSocial('google'), placeholder: 'Add the Google Maps link', inputMode: 'url' },
    ] },
    { id: 'business', label: 'Business', rows: [
      { id: 'area', label: 'Area', raw: lead.area || '', value: lead.area || '', onSave: save('area'), placeholder: 'Wilmington DE' },
      { id: 'industry', label: 'Industry', raw: lead.industry || '', value: lead.industry ? displayIndustry(lead.industry) : '', onSave: save('industry'), placeholder: 'Detailing, bakery, barber' },
      { id: 'source', label: 'Source', value: lead.sourceId ? 'Nightly scraper' : 'Added by hand' },
      { id: 'added', label: 'Added', value: fmtDate(lead.createdAt) || '' },
      clientMode && { id: 'since', label: 'Since', value: fmtDate(lead.clientSince) || fmtDate(lead.bookedOutcome?.at) || '' },
      clientMode && { id: 'lifetime', label: 'Lifetime', value: lifetimeValue(lead) > 0 ? money(lifetimeValue(lead)) : '' },
      { id: 'scanned', label: 'Last scanned', value: scan },
    ].filter(Boolean) },
    { id: 'brand', label: 'Brand', rows: [
      { id: 'primary', label: 'Primary color', raw: b.primary, value: b.primary, onSave: async (v) => { const t = v.trim(); if (t && !isHex(t)) return false; return brand({ primary: t }); }, placeholder: 'Six digit hex', errorMessage: 'Use a six digit hex value.' },
      { id: 'colors', label: 'Colors', raw: (b.colors || []).filter(Boolean).join(', '), value: (b.colors || []).filter(Boolean).join(', '), onSave: async (v) => { const list = v.split(',').map(x => x.trim()).filter(Boolean); if (list.some(x => !isHex(x))) return false; return brand({ colors: list }); }, placeholder: 'Hex values, comma separated', errorMessage: 'Hex values only, comma separated.' },
      { id: 'fontDisplay', label: 'Display font', raw: b.fontDisplay, value: b.fontDisplay, onSave: (v) => brand({ fontDisplay: v }), placeholder: 'Barlow Condensed' },
      { id: 'fontBody', label: 'Body font', raw: b.fontBody, value: b.fontBody, onSave: (v) => brand({ fontBody: v }), placeholder: 'Inter' },
      { id: 'brandNotes', label: 'Brand notes', raw: b.notes, value: b.notes, onSave: (v) => brand({ notes: v }), placeholder: 'One line: tone, do and do not' },
    ] },
    { id: 'notes', label: 'Notes', rows: [
      { id: 'angle', label: 'The angle', raw: lead.angle || '', value: lead.angle || '', onSave: save('angle'), placeholder: 'Why this client, in your words.', multiline: true, para: true },
      { id: 'descriptor', label: 'Descriptor', raw: lead.descriptor || '', value: lead.descriptor || '', onSave: save('descriptor'), placeholder: 'What they do, one line' },
    ] },
  ];
}

export const profileSummary = (rec) => {
  const { lead } = rec;
  return [lead.askFor, lead.area, lead.industry ? displayIndustry(lead.industry) : ''].filter(Boolean).join(' · ') || 'Contact, online, business, brand';
};

function FactRow({ f, readOnly }) {
  return (
    <div className="rc-fact rc-pf-fact">
      <span className="rc-fact-label">{f.label}</span>
      {f.onSave && !readOnly
        ? <InlineEdit value={f.raw} onSave={f.onSave} format={f.format} placeholder={f.placeholder} label={f.label} inputMode={f.inputMode} type={f.type} errorMessage={f.errorMessage} className="rc-fact-edit" />
        : <span className="rc-fact-ro lay-truncate">{f.value}</span>}
    </div>
  );
}

export default function ProfileSection({ rec, focus = '' }) {
  const { lead, readOnly, toast, openEditAll } = rec;
  const groups = profileGroups(rec);
  const empty = groups.flatMap(g => g.rows.filter(r => !r.value && r.onSave && !r.para));
  const [open, setOpen] = useState(false);
  /* A dimmed button on the profile card asked for a field: open the sheet on arrival. */
  useEffect(() => { if (focus) setOpen(true); }, [focus]);
  return (
    <div className="rc-profile">
      <Row gap={2} align="center" justify="between" wrap className="rc-profile-head">
        <span className="rc-profile-h">Profile</span>
        <Row gap={2} wrap>
          {!readOnly && empty.length > 0 && <Button variant="ghost" size="md" icon="Plus" onClick={() => setOpen(true)} className="rc-add-detail">Add a detail</Button>}
          {!readOnly && openEditAll && <Button variant="secondary" size="md" icon="Edit02" onClick={openEditAll} className="rc-profile-edit">Edit all</Button>}
        </Row>
      </Row>
      {groups.map(g => {
        const filled = g.rows.filter(r => r.value && !r.para);
        const paras = g.rows.filter(r => r.para && r.value);
        if (!filled.length && !paras.length) return null;
        return (
          <section key={g.id} className="rc-pf-group" aria-label={g.label}>
            <p className="rc-label">{g.label}</p>
            {paras.map(r => <AnglePara key={r.id} rec={rec} />)}
            {filled.length > 0 && <div className="rc-facts rc-pf-facts">{filled.map(f => <FactRow key={f.id} f={f} readOnly={readOnly} />)}</div>}
            {g.id === 'brand' && <Row gap={2} wrap><Button variant="ghost" size="md" icon="Copy01" onClick={() => copyText(toast, brandText(lead), 'Brand block')} className="rc-pf-copy">Copy brand</Button></Row>}
          </section>
        );
      })}
      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Add a detail" description={lead.business} label="Add a detail">
          <Stack gap={2}>
            {empty.map(f => (
              <div key={f.id} className={`rc-fact rc-fact--sheet${f.id === focus ? ' is-focus' : ''}`}>
                <span className="rc-fact-label">{f.label}</span>
                <InlineEdit value="" onSave={f.onSave} placeholder={f.placeholder} label={f.label} inputMode={f.inputMode} type={f.type} multiline={f.multiline} errorMessage={f.errorMessage} className="rc-fact-edit" />
              </div>
            ))}
            {!empty.length && <p className="rc-line">Every detail is filled in.</p>}
          </Stack>
        </Sheet>
      )}
    </div>
  );
}
