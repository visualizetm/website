import { useRef } from 'react';
import { Avatar, Button, IconButton } from '../../ui';
import useScrollFade from './useScrollFade';
import { formatPhone } from '../../shared/phone';
import { displayIndustry } from '../../shared/semantics';
import { brandText } from '../../lib/projects';
import { safeHref } from '../../lib/safeUrl';
import { copyText } from '../ClientWorkspace';

/* The profile card (client page workspace redesign, section 1): who the
 * client is and every way to reach them, one tap each. Avatar, name (wraps,
 * never truncates), contact person, area and industry, phone, email. Then
 * one row of seven icon buttons: Call, Text, Email, Instagram, Facebook,
 * Website, Maps. A channel with no value stays in the row, dimmed, and its
 * tap opens the field to add it, so the row never shifts. Copy phone, Copy
 * brand, and Open profile for the rest. */

export const PROFILE_ACTIONS = [
  { id: 'call', label: 'Call', icon: 'PhoneCall01', field: 'phone' },
  { id: 'text', label: 'Text', icon: 'MessageCircle01', field: 'phone' },
  { id: 'email', label: 'Email', icon: 'Mail01', field: 'email' },
  { id: 'instagram', label: 'Instagram', icon: 'Camera01', field: 'instagram' },
  { id: 'facebook', label: 'Facebook', icon: 'ThumbsUp', field: 'facebook' },
  { id: 'website', label: 'Website', icon: 'Globe01', field: 'website' },
  { id: 'maps', label: 'Maps', icon: 'MarkerPin01', field: 'google' },
];

/** The value behind each action, or '' when the client has none. */
export function actionValue(lead, id) {
  if (id === 'call' || id === 'text') return lead.phone || '';
  if (id === 'email') return lead.email || '';
  const key = id === 'maps' ? 'google' : id;
  return safeHref(lead.socials?.[key]) || '';
}

export default function ProfileCard({ rec, onOpenProfile, onAdd }) {
  const { lead, readOnly, run, toast, clientMode } = rec;
  const actionsRef = useRef(null);
  useScrollFade(actionsRef);
  const sms = lead.phone ? `sms:${String(lead.phone).replace(/[^0-9+]/g, '')}` : '';
  const open = (id, value) => {
    if (id === 'call') { run('call'); return; }
    if (id === 'text') { window.location.href = sms; return; }
    if (id === 'email') { window.location.href = `mailto:${value}`; return; }
    window.open(value, '_blank', 'noopener');
  };
  const lines = [
    lead.askFor,
    [lead.area, lead.industry ? displayIndustry(lead.industry) : ''].filter(Boolean).join(', '),
  ].filter(Boolean);
  return (
    <section className="rc-pf" aria-label="Profile">
      <div className="rc-pf-top">
        <Avatar name={lead.business} src={safeHref(lead.showcase?.logoUrl) || undefined} size="lg" className="rc-pf-avatar" status={clientMode ? 'booked' : undefined} />
        <div className="rc-pf-id">
          <h2 className="rc-pf-name">{lead.business}</h2>
          {lines.map((l, i) => <p key={i} className="rc-pf-line">{l}</p>)}
          {/* Plain text, not links: the Call and Email buttons below are the 44px targets for both. */}
          {lead.phone && <p className="rc-pf-line rc-pf-strong">{formatPhone(lead.phone)}</p>}
          {lead.email && <p className="rc-pf-line rc-pf-strong lay-truncate">{lead.email}</p>}
        </div>
      </div>
      <div className="rc-pf-actions" role="group" aria-label="Reach them" ref={actionsRef}>
        {PROFILE_ACTIONS.map(a => {
          const value = actionValue(lead, a.id);
          if (value) return <IconButton key={a.id} icon={a.icon} label={a.label} variant="secondary" onClick={() => open(a.id, value)} className={`rc-pf-act rc-pf-act--${a.id}`} />;
          return <IconButton key={a.id} icon={a.icon} label={`Add ${a.label.toLowerCase()}`} variant="secondary" disabled={readOnly} onClick={() => onAdd?.(a.field)} className={`rc-pf-act rc-pf-act--${a.id} is-missing`} data-missing="true" />;
        })}
      </div>
      <div className="rc-pf-foot">
        <Button variant="ghost" size="md" icon="Copy01" disabled={!lead.phone} onClick={() => copyText(toast, formatPhone(lead.phone), 'Number')} className="rc-pf-copy">Copy phone</Button>
        <Button variant="ghost" size="md" icon="Copy01" onClick={() => copyText(toast, brandText(lead), 'Brand block')} className="rc-pf-copy">Copy brand</Button>
        <Button variant="secondary" size="md" icon="User01" onClick={onOpenProfile} className="rc-pf-open">Open profile</Button>
      </div>
    </section>
  );
}
