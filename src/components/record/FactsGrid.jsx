import { useState } from 'react';
import { Button, InlineEdit, Sheet, Stack } from '../../ui';
import { formatPhone } from '../../shared/phone';
import { fmtDate, relativeTime } from '../../shared/dates';
import { money } from '../../shared/format';
import { lifetimeValue, isHex } from '../../lib/projects';

/* The facts (law 3): two columns of one line rows, label then value, and
 * only filled values render. The empty ones wait behind one "Add a detail"
 * ghost button, which opens a sheet of InlineEdits. Order: Phone, Since,
 * Contact, Lifetime, Website, Email, Area, Phone note, Best window, Source,
 * Added, Last scanned; a client adds its brand facts (Links and Brand used
 * to be two profile cards). */
export function factsFor(rec) {
  const { lead, clientMode, patchRaw } = rec;
  const save = (key) => (v) => patchRaw({ [key]: v });
  const saveSocial = (key) => (v) => patchRaw({ socials: { ...(lead.socials || {}), [key]: v } });
  const b = { primary: '', colors: [], fontDisplay: '', fontBody: '', notes: '', ...(lead.brand || {}) };
  const brand = (next) => patchRaw({ brand: { ...b, ...next } });
  const scan = lead.enrichment?.lastScanAt ? `${relativeTime(lead.enrichment.lastScanAt)}, ${lead.enrichment.scanCount || 1} scan${(lead.enrichment.scanCount || 1) === 1 ? '' : 's'}` : '';
  const facts = [
    { id: 'phone', label: 'Phone', raw: lead.phone || '', value: formatPhone(lead.phone) || '', format: formatPhone, onSave: save('phone'), inputMode: 'tel', placeholder: 'Add phone' },
    clientMode && { id: 'since', label: 'Since', value: fmtDate(lead.clientSince) || fmtDate(lead.bookedOutcome?.at) || '' },
    { id: 'askFor', label: 'Contact', raw: lead.askFor || '', value: lead.askFor || '', onSave: save('askFor'), placeholder: 'Who to ask for' },
    clientMode && { id: 'lifetime', label: 'Lifetime', value: lifetimeValue(lead) > 0 ? money(lifetimeValue(lead)) : '' },
    { id: 'website', label: 'Website', raw: lead.socials?.website || '', value: lead.socials?.website || '', onSave: saveSocial('website'), placeholder: 'Add website', inputMode: 'url' },
    { id: 'email', label: 'Email', raw: lead.email || '', value: lead.email || '', onSave: save('email'), inputMode: 'email', type: 'email', placeholder: 'Add email' },
    { id: 'area', label: 'Area', raw: lead.area || '', value: lead.area || '', onSave: save('area'), placeholder: 'Wilmington DE' },
    { id: 'phoneNote', label: 'Phone note', raw: lead.phoneNote || '', value: lead.phoneNote || '', onSave: save('phoneNote'), placeholder: 'Front desk, extension' },
    { id: 'bestWindow', label: 'Best window', raw: lead.bestWindow || '', value: lead.bestWindow || '', onSave: save('bestWindow'), placeholder: 'Before 8am or after 5pm' },
    { id: 'source', label: 'Source', value: lead.sourceId ? 'Nightly scraper' : 'Added by hand' },
    { id: 'added', label: 'Added', value: fmtDate(lead.createdAt) || '' },
    { id: 'scanned', label: 'Last scanned', value: scan },
    clientMode && { id: 'primary', label: 'Primary color', raw: b.primary, value: b.primary, onSave: async (v) => { const t = v.trim(); if (t && !isHex(t)) return false; return brand({ primary: t }); }, placeholder: 'Six digit hex', errorMessage: 'Use a six digit hex color.' },
    clientMode && { id: 'colors', label: 'Colors', raw: (b.colors || []).filter(Boolean).join(', '), value: (b.colors || []).filter(Boolean).join(', '), onSave: async (v) => { const list = v.split(',').map(x => x.trim()).filter(Boolean); if (list.some(x => !isHex(x))) return false; return brand({ colors: list.slice(0, 4) }); }, placeholder: 'Up to four hex colors', errorMessage: 'Use six digit hex colors, separated by commas.' },
    clientMode && { id: 'fontDisplay', label: 'Display font', raw: b.fontDisplay, value: b.fontDisplay, onSave: (v) => brand({ fontDisplay: v }), placeholder: 'Barlow Condensed' },
    clientMode && { id: 'fontBody', label: 'Body font', raw: b.fontBody, value: b.fontBody, onSave: (v) => brand({ fontBody: v }), placeholder: 'Inter' },
    clientMode && { id: 'brandNotes', label: 'Brand notes', raw: b.notes, value: b.notes, onSave: (v) => brand({ notes: v }), placeholder: 'One line: tone, do and do not' },
    // The angle is a paragraph above the tabs, never a grid row; empty, it is added from the sheet.
    { id: 'angle', label: 'The angle', raw: lead.angle || '', value: lead.angle || '', onSave: save('angle'), placeholder: 'Why this lead, in your words.', multiline: true, sheetOnly: true },
  ].filter(Boolean);
  return facts;
}

export function AnglePara({ rec }) {
  const { lead, readOnly, patchRaw } = rec;
  if (!lead.angle) return null;
  return readOnly
    ? <p className="rc-angle">{lead.angle}</p>
    : <InlineEdit value={lead.angle} onSave={(v) => patchRaw({ angle: v })} multiline placeholder="Why this lead, in your words." label="The angle" className="rc-angle rc-angle--edit" />;
}

export default function FactsGrid({ rec }) {
  const { lead, readOnly } = rec;
  const facts = factsFor(rec);
  const filled = facts.filter(f => f.value && !f.sheetOnly);
  const empty = facts.filter(f => !f.value && f.onSave);
  const [open, setOpen] = useState(false);
  return (
    <div className="rc-facts">
      {filled.map(f => (
        <div key={f.id} className="rc-fact">
          <span className="rc-fact-label">{f.label}</span>
          {f.onSave && !readOnly
            ? <InlineEdit value={f.raw} onSave={f.onSave} format={f.format} placeholder={f.placeholder} label={f.label} inputMode={f.inputMode} type={f.type} errorMessage={f.errorMessage} className="rc-fact-edit" />
            : <span className="rc-fact-ro lay-truncate">{f.value}</span>}
        </div>
      ))}
      {!readOnly && empty.length > 0 && (
        <div className="rc-fact rc-fact--add"><Button variant="ghost" size="md" icon="Plus" onClick={() => setOpen(true)} className="rc-add-detail">Add a detail</Button></div>
      )}
      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Add a detail" description={lead.business} label="Add a detail">
          <Stack gap={2}>
            {empty.map(f => (
              <div key={f.id} className="rc-fact rc-fact--sheet">
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
