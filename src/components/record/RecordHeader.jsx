import ScoreBadge from './ScoreBadge';
import { SOURCE_TONE } from '../../lib/triage';
import { Avatar, Pill, Menu } from '../../ui';
import { STAGES, PRIORITIES, CLIENT_STATUSES, displayIndustry } from '../../shared/semantics';
import { checkpointOf, newestTick } from '../../lib/deal';
import { formatPhone, telHref } from '../../shared/phone';

/* The record header (laws 4 and 5): the avatar, the business name on one
 * line, two pills (status and priority), one context line, and three
 * controls: the primary, the secondary and the overflow menu. On a phone
 * the name lives in the top bar, so the header starts at the pills. */
export default function RecordHeader({ rec, primary = null, secondary = null, menu = [], phone = false, pulse = false }) {
  const { lead, stage, mode, deal } = rec;
  const tick = mode === 'deal' ? newestTick(deal) : null;
  const status = mode === 'client'
    ? <Pill id={lead.clientStatus || 'active'} list={CLIENT_STATUSES} size="sm" />
    : tick
      ? <Pill tone="booked" label={checkpointOf(tick.id)?.label || 'Booked'} size="sm" icon="Check" />
      : <Pill id={stage} list={STAGES} size="sm" variant="outline" />;
  const parts = [
    lead.askFor,
    lead.phone ? <a href={telHref(lead.phone)} className="rc-tel">{formatPhone(lead.phone)}</a> : null,
    lead.area,
    lead.industry ? displayIndustry(lead.industry) : null,
  ].filter(Boolean);
  return (
    <header className={`rc-head${phone ? ' rc-head--phone' : ''}${pulse ? ' v-pulse-won' : ''}`}>
      {!phone && <Avatar name={lead.business} size="md" className="rc-avatar" style={{ width: 'var(--v-tap)', height: 'var(--v-tap)' }} status={stage === 'client' ? 'booked' : undefined} />}
      <div className="rc-head-main">
        <div className="rc-head-top">
          {!phone && <h2 className="rc-name">{lead.business}</h2>}
          {rec.triage
            ? <span className="rc-pills"><Pill label={rec.triage.source.label} tone={SOURCE_TONE[rec.triage.source.id] || 'neutral'} icon={false} size="sm" /><ScoreBadge score={rec.triage.score} /></span>
            : <span className="rc-pills">{status}<Pill id={lead.priority || 'warm'} list={PRIORITIES} size="sm" /></span>}
        </div>
        {/* A client (workspace redesign): the contact, area and industry sit on the profile card, so the header does not say them twice. */}
        {parts.length > 0 && mode !== 'client' && (
          <p className="rc-ctx">{parts.map((p, i) => <span key={i} className="rc-ctx-part">{i > 0 && <span className="rc-dot" aria-hidden="true">·</span>}{p}</span>)}</p>
        )}
      </div>
      <div className="rc-head-actions">{primary}{secondary}<Menu label="More actions" align="end" items={menu} /></div>
    </header>
  );
}
