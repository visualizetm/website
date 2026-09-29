import { SegmentedControl } from '../../ui';

/* Several projects on one client: the Project, Money and Files sections
 * share the pick (cw.current) through this one control. */
export default function ProjectPicker({ cw }) {
  if (cw.work.length < 2) return null;
  return <SegmentedControl label="Project" size="sm" options={cw.work.map(p => ({ id: String(p._id), label: p.name }))} value={String(cw.current?._id || '')} onChange={cw.setProjId} className="rc-picker" />;
}
