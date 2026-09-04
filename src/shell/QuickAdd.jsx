import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import { Menu, IconButton } from '../ui';
/** Quick Add: the Plus button and its Menu. Items come from the shell. */
export default function QuickAdd({ items }) {
  return <Menu label="Quick add" align="end" items={items} trigger={<IconButton icon={Plus} label="Quick add" variant="secondary" tooltip={false} className="sh-quickadd" />} />;
}
export const quickAddStyles = '';
