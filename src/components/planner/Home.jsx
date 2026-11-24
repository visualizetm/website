import { ItemRow } from './parts';
import { COPY } from '../../shared/copy';

/* Home (Planner v2). Placeholder until milestone 1.3. */
export default function HomeScreen({ data, items, onOpen }) {
  const C = COPY.planner;
  return (
    <>
      <h1 className="pl-h1">{C.home.hey(data.client?.firstName)}</h1>
      <div className="pl-rows">{items.map(i => <ItemRow key={i.id} item={i} title={i.caption || i.ad?.name || C.kinds.post} line={i.date} onOpen={onOpen} />)}</div>
    </>
  );
}
