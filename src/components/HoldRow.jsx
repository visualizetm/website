import { useState } from 'react';
import { SwipeRow } from '../ui';
import RowSheet from './RowSheet';

/* A row with only a long press (CRM mobile revamp, milestone 5): the client and project rows. A tap still opens the record; a long press
   opens the essentials and the quick actions. items are the same shape the row menu takes. */
export default function HoldRow({ title, subtitle, facts, items, enabled = true, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SwipeRow enabled={enabled} onHold={() => setOpen(true)}>{children}</SwipeRow>
      {open && <RowSheet title={title} subtitle={subtitle} facts={facts} items={items} onClose={() => setOpen(false)} />}
    </>
  );
}
