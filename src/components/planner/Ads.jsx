import { ItemRow, Empty } from './parts';
import { COPY } from '../../shared/copy';

/* Ads (Planner v2). Placeholder until its milestone. */
export default function AdsScreen({ items, onOpen }) {
  const C = COPY.planner;
  const list = items.filter(i => ('Ads' === 'Ads') === (i.kind === 'ad'));
  return (
    <>
      <h1 className="pl-h1">{C.ads.title}</h1>
      {list.length ? <div className="pl-rows">{list.map(i => <ItemRow key={i.id} item={i} title={i.caption || i.ad?.name || C.kinds.post} line={i.date} onOpen={onOpen} />)}</div> : <Empty {...C.empty.ads} />}
    </>
  );
}
