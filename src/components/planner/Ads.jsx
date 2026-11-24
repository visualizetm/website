import { ItemRow, Empty, Media, titleOf } from './parts';
import { COPY } from '../../shared/copy';
import { adSentence, adTiles, adSpend } from '../../lib/plannerView';
import { AD_PLACEMENTS } from '../../shared/semantics';

/* Ads (Planner v2). The list is a placeholder until milestone 1.5; AdBody is the ad's own card, shared with the post page. */
const placementNames = (ids = []) => ids.map(id => (AD_PLACEMENTS.find(p => p.id === id) || {}).label).filter(Boolean);

export function AdBody({ item }) {
  const A = COPY.planner.ads;
  const ad = item.ad || {};
  const line = adSentence(ad);
  const tiles = adTiles(ad);
  const spend = adSpend(ad);
  const shown = A.shown(placementNames(ad.placements).join(', '), ad.buttonText);
  return (
    <section className={`pl-card pl-adbody${item.status === 'live' ? ' pl-card--raised' : ''}`} aria-label={ad.name || COPY.planner.kinds.ad}>
      <p className="pl-adbody-name">{ad.name || COPY.planner.kinds.ad}</p>
      <Media item={item} />
      {item.caption && <p className="pl-words">{item.caption}</p>}
      {shown && <p className="pl-muted">{shown}</p>}
      {ad.audience && <p className="pl-muted">{ad.audience}</p>}
      {tiles.length > 0 && <div className="pl-tiles">{tiles.map(t => <div key={t.id} className="pl-tile"><span className="pl-tile-n">{t.text}</span><span className="pl-tile-l">{t.label}</span></div>)}</div>}
      {line && <p className="pl-adline">{line}</p>}
      {spend && <><p className="pl-muted">{A.spent(spend.spent, spend.budget)}</p><span className="pl-bar" role="progressbar" aria-label={A.spent(spend.spent, spend.budget)} aria-valuemin={0} aria-valuemax={spend.budget} aria-valuenow={Math.min(spend.spent, spend.budget)}><span className="pl-bar-fill" style={{ width: `${spend.pct}%` }} /></span></>}
    </section>
  );
}

export default function AdsScreen({ items, onOpen }) {
  const C = COPY.planner;
  const list = items.filter(i => i.kind === 'ad');
  return (
    <>
      <h1 className="pl-h1">{C.ads.title}</h1>
      {list.length ? <div className="pl-rows">{list.map(i => <ItemRow key={i.id} item={i} title={titleOf(i)} line={i.date} onOpen={onOpen} />)}</div> : <Empty {...C.empty.ads} />}
    </>
  );
}
