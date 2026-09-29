import FactsGrid, { AnglePara } from './FactsGrid';
import { fmtDate } from '../../shared/dates';
import { money } from '../../shared/format';
import { lifetimeValue } from '../../lib/projects';

/* Details: on a phone the facts and the angle are a row like every other
 * section; on a computer they sit under the header and this is not a tab. */
export const detailsSummary = (rec) => {
  const { lead, clientMode } = rec;
  const when = clientMode ? (fmtDate(lead.clientSince) || fmtDate(lead.bookedOutcome?.at)) : fmtDate(lead.createdAt);
  return [
    lead.area,
    when ? `${clientMode ? 'since' : 'added'} ${when}` : '',
    clientMode ? (lifetimeValue(lead) > 0 ? `${money(lifetimeValue(lead))} lifetime` : '') : (lead.sourceId ? 'nightly scraper' : 'added by hand'),
  ].filter(Boolean).join(' · ') || 'Phone, contact, email and more';
};

export default function DetailsSection({ rec }) {
  return <div className="rc-details"><AnglePara rec={rec} /><FactsGrid rec={rec} /></div>;
}
