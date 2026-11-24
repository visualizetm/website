import { IgPost, StatusPill } from './parts';

/* The post page (Planner v2). Placeholder until milestone 1.4. */
export default function PostPage({ item, client }) {
  return <div className="pl-screen"><StatusPill item={item} /><IgPost item={item} client={client} /></div>;
}
