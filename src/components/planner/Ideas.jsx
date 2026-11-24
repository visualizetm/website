import { Empty } from './parts';
import { COPY } from '../../shared/copy';

/* Ideas (Planner v2). Placeholder until milestone 1.5. */
export default function IdeasScreen({ suggestions }) {
  const C = COPY.planner;
  return (
    <>
      <h1 className="pl-h1">{C.ideas.title}</h1>
      {suggestions.length ? <ul className="pl-rows">{suggestions.map(s => <li key={s.id} className="pl-row">{s.subject}</li>)}</ul> : <Empty {...C.empty.ideas} />}
    </>
  );
}
