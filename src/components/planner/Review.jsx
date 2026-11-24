import { IgPost } from './parts';
import { reviewQueue } from '../../lib/plannerView';

/* Review mode (Planner v2). Placeholder until milestone 1.3. */
export default function ReviewScreen({ items, client }) {
  const q = reviewQueue(items);
  return <div className="pl-screen">{q[0] ? <IgPost item={q[0]} client={client} /> : null}</div>;
}
export const reviewStyles = '';
