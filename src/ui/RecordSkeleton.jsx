import Card from './Card';
import Row from './Row';
import Stack from './Stack';
import { SkeletonBlock, SkeletonCircle, SkeletonText } from './Skeleton';
/**
 * RecordSkeleton (Prompt 14): the shape of a record detail while it resolves,
 * for deep links into a panel, a Sheet, or the detail column before the list
 * has loaded. A header card (avatar, name, pills, actions), then `cards`
 * content cards. LeadDetail.Skeleton builds its two column layout on top.
 * @param {object} props
 * @param {number} [props.cards=3]
 * @param {boolean} [props.tabs] a tab strip line under the header
 * @param {boolean} [props.header=true] the avatar header card
 */
export default function RecordSkeleton({ cards = 3, tabs = false, header = true, className = '' }) {
  return (
    <Stack gap={4} className={`v-recskel ${className}`.trim()} aria-busy="true">
      {header && <Card>
        <Row gap={3} align="start"><SkeletonCircle size={56} /><Stack gap={2} style={{ flex: 1 }}><SkeletonBlock width="60%" height={24} /><Row gap={1}><SkeletonBlock width={70} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width={56} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonBlock width="45%" height={12} /></Stack></Row>
        <Row gap={1} wrap>{[1, 2, 3].map(i => <SkeletonBlock key={i} width={104} height={44} radius="var(--v-radius-md)" />)}</Row>
      </Card>}
      {tabs && <Row gap={2} className="v-recskel-tabs">{[1, 2, 3, 4].map(i => <SkeletonBlock key={i} width={72} height={16} />)}</Row>}
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i}><SkeletonBlock width={120} height={12} /><SkeletonText lines={i === 0 ? 3 : 2} /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Card>
      ))}
    </Stack>
  );
}
export const recordSkeletonStyles = `
  .v-recskel { min-width: 0; }
  .v-recskel-tabs { padding-bottom: var(--v-space-3); border-bottom: 1px solid var(--v-border); }
`;
