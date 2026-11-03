import { Card, Row, Button, Pill } from '../../ui';
import { objectionCard } from '../../shared/callScript';
import { prepFacts } from '../../lib/callSession';
import { safeHref } from '../../lib/safeUrl';

/* The record's two call cards (prompt 2 of 3, milestone 5). The Call sheet is every answer the steppers saved (afterCall.*):
 * the owner, their words, the goal, what they tried before, the objection with its count, the partner check, the asks and the
 * next step. The Prep card is what to know before dialing (src/lib/callSession.js prepFacts): the Google rating and count,
 * Instagram, the website's state, the best window and one drop line. Both render only the facts that exist. */
const Fact = ({ label, children }) => (children ? <div className="csh-fact"><span className="csh-label">{label}</span><span className="csh-value">{children}</span></div> : null);

export function CallSheetCard({ lead, next, onRun, onQuote, onCloser }) {
  const ac = lead?.afterCall || {}; const c = ac.closer || {};
  const obj = ac.objection ? objectionCard(lead, ac.objection) : null;
  const n = ac.objection ? Number(ac.objections?.[ac.objection]) || 1 : 0;
  const tried = (c.pain || []).filter(r => r?.tried).map(r => [r.tried, r.howLong, r.result].filter(Boolean).join(', '));
  const asks = (Number(ac.asks) || 0) + (Number(c.asks) || 0);
  const any = ac.answered || ac.whatTheySaid || ac.goal || c.goal || tried.length || obj || ac.partner || asks;
  return (
    <Card className="csh-card" data-card="call-sheet">
      <Row gap={2} align="center" className="csh-head">
        <p className="pb-card-h" style={{ flex: 1 }}>Call sheet</p>
        {ac.step ? <Pill tone={lead.callStatus === 'booked' ? 'booked' : 'neutral'} label={lead.callStatus === 'booked' ? 'Booked on the script' : `Step ${ac.step} of 8`} size="sm" icon={false} /> : null}
      </Row>
      {any ? (
        <div className="csh-grid">
          <Fact label="Owner">{ac.answered === 'owner' ? (lead.askFor || 'The owner') : ac.answered === 'other' ? `${lead.askFor || 'Someone'} (not the owner)` : ac.answered === 'none' ? 'No answer' : (lead.askFor || '')}</Fact>
          <Fact label="Their words">{ac.whatTheySaid}</Fact>
          <Fact label="Goal">{c.goal || ac.goal}</Fact>
          <Fact label="Tried before">{tried.length ? tried.join('; ') : ''}</Fact>
          <Fact label="Objection">{obj ? `${obj.label}${n > 1 ? ` (${n})` : ''}` : ''}</Fact>
          <Fact label="Partner">{ac.partner === 'yes' ? 'Someone else decides too' : ac.partner === 'no' ? 'Decides alone' : ''}</Fact>
          <Fact label="Asks">{asks ? String(asks) : ''}</Fact>
          <Fact label="Next step">{next?.label || ''}</Fact>
        </div>
      ) : <p className="csh-empty">Nothing saved yet. Run the script and every answer lands here.</p>}
      <Row gap={2} wrap className="csh-actions">
        {onRun && <Button variant="secondary" icon="PhoneCall01" onClick={onRun} className="csh-run">Run the script</Button>}
        {onCloser && <Button variant="secondary" icon="PhoneCall01" onClick={onCloser} className="csh-closer">Concept call</Button>}
        {onQuote && <Button variant="secondary" icon="CurrencyDollar" onClick={onQuote} className="csh-quote">Quote</Button>}
      </Row>
      <style>{callSheetStyles}</style>
    </Card>
  );
}

export function PrepCard({ lead, compact = false }) {
  const f = prepFacts(lead);
  const ig = f.instagram ? safeHref(f.instagram) : '';
  if (!f.rating && !f.instagram && !f.window && !f.drop && !lead?.socials?.website) return null;
  return (
    <Card level={compact ? 2 : 1} padding={compact ? 3 : 4} className={`csh-prep${compact ? ' csh-prep--compact' : ''}`} data-card="prep">
      <p className="pb-card-h">Before you dial</p>
      <div className="csh-grid">
        <Fact label="Google">{f.rating}</Fact>
        <Fact label="Instagram">{ig ? <a href={ig} target="_blank" rel="noopener noreferrer">{f.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, '')}</a> : ''}</Fact>
        <Fact label="Website">{f.website}</Fact>
        <Fact label="Best window">{f.window}</Fact>
      </div>
      {f.drop && <p className="csh-drop">{f.drop}</p>}
      <style>{callSheetStyles}</style>
    </Card>
  );
}

export const callSheetStyles = `
  .csh-card, .csh-prep { display: grid; gap: var(--v-space-3); }
  .csh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--v-space-2) var(--v-space-3); }
  .csh-fact { display: grid; gap: 2px; min-width: 0; }
  .csh-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; color: var(--v-text-3); font-weight: var(--v-weight-semibold); }
  .csh-value { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); overflow-wrap: anywhere; }
  .csh-empty { font-size: var(--v-text-sm); color: var(--v-text-3); }
  .csh-drop { font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); }
  .csh-prep--compact .csh-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
`;
