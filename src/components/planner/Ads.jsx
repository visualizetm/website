import { ItemRow, Empty, Media, StatusPill, titleOf } from './parts';
import { MonthBar } from './Plan';
import { COPY } from '../../shared/copy';
import { adSentence, adTiles, adSpend, adGroups, shortDate } from '../../lib/plannerView';
import { AD_PLACEMENTS } from '../../shared/semantics';

/* Ads (Planner v2, part 1 G). The live ad first on the raised layer: its
 * name and Live pill, the creative, where it shows and what the button
 * says, up to three result tiles (a tile with no number does not render),
 * one plain sentence, and the budget with its spend bar only when Rob
 * shows the budget. Then Coming up and Finished as rows, one sentence
 * each. The client never runs an ad; nothing here writes. */
const placementNames = (ids = []) => ids.map(id => (AD_PLACEMENTS.find(p => p.id === id) || {}).label).filter(Boolean);

/** The ad's own card, shared with its page. */
export function AdBody({ item }) {
  const A = COPY.planner.ads;
  const ad = item.ad || {};
  const line = adSentence(ad);
  const tiles = adTiles(ad);
  const spend = adSpend(ad);
  const shown = A.shown(placementNames(ad.placements).join(', '), ad.buttonText);
  const live = item.status === 'live';
  return (
    <section className={`pl-card pl-adbody${live ? ' pl-card--raised' : ''}`} aria-label={ad.name || COPY.planner.kinds.ad}>
      <div className="pl-card-head">
        <h2 className="pl-adbody-name">{ad.name || COPY.planner.kinds.ad}</h2>
        <StatusPill item={item} />
      </div>
      <Media item={item} />
      {item.caption && <p className="pl-words">{item.caption}</p>}
      {shown && <p className="pl-muted">{shown}</p>}
      {ad.audience && <p className="pl-muted">{ad.audience}</p>}
      {tiles.length > 0 && <div className="pl-tiles">{tiles.map(t => <div key={t.id} className="pl-tile"><span className="pl-tile-n">{t.text}</span><span className="pl-tile-l">{t.label}</span></div>)}</div>}
      {line ? <p className="pl-adline">{line}</p> : live ? <p className="pl-muted">{A.noResults}</p> : null}
      {spend && (
        <>
          <p className="pl-muted">{A.budget(spend.budget)}. {A.spent(spend.spent, spend.budget)}.</p>
          <span className="pl-bar" role="progressbar" aria-label={A.spent(spend.spent, spend.budget)} aria-valuemin={0} aria-valuemax={spend.budget} aria-valuenow={Math.min(spend.spent, spend.budget)}><span className="pl-bar-fill" style={{ width: `${spend.pct}%` }} /></span>
        </>
      )}
    </section>
  );
}

/** One plain sentence for an ad in a list. */
function rowLine(item) {
  const A = COPY.planner.ads;
  const ad = item.ad || {};
  if (item.status === 'review') return A.needsYou;
  if (item.status === 'finished') return [A.ran(shortDate(ad.startDate), shortDate(ad.endDate)), adSentence(ad)].filter(Boolean).join(' ');
  return A.starts(shortDate(ad.startDate || item.date));
}

export default function AdsScreen({ items, month, onShift, onOpen }) {
  const C = COPY.planner;
  const g = adGroups(items);
  const any = g.live.length + g.coming.length + g.finished.length > 0;
  return (
    <>
      <MonthBar month={month} onShift={onShift} />
      {!any && <Empty {...C.empty.ads} kind="ads" />}
      {g.live.map(item => <AdBody key={item.id} item={item} />)}
      {g.coming.length > 0 && (
        <section className="pl-week-group" aria-labelledby="pl-ads-coming">
          <h2 className="pl-h2" id="pl-ads-coming">{C.ads.coming}</h2>
          <div className="pl-rows">{g.coming.map(i => <ItemRow key={i.id} item={i} title={titleOf(i)} line={rowLine(i)} onOpen={onOpen} />)}</div>
        </section>
      )}
      {g.finished.length > 0 && (
        <section className="pl-week-group" aria-labelledby="pl-ads-done">
          <h2 className="pl-h2" id="pl-ads-done">{C.ads.finished}</h2>
          <div className="pl-rows">{g.finished.map(i => <ItemRow key={i.id} item={i} title={titleOf(i)} line={rowLine(i)} onOpen={onOpen} />)}</div>
        </section>
      )}
    </>
  );
}
