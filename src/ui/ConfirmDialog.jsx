import { useCallback, useRef, useState } from 'react';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Modal from './Modal';
import Button from './Button';
/**
 * ConfirmDialog: built on Modal. Danger variant for delete and destructive actions.
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose called on cancel, Escape, backdrop
 * @param {Function} props.onConfirm may return a promise; the button shows loading until it settles
 * @param {string} props.title
 * @param {import('react').ReactNode} [props.body]
 * @param {string} [props.confirmLabel='Confirm']
 * @param {string} [props.cancelLabel='Cancel']
 * @param {boolean} [props.danger]
 * @param {string|Function} [props.icon] confirm button icon (Trash01 by default when danger)
 */
export default function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, icon }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm?.(); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} description={body} danger={danger} closeButton={false}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} icon={icon ?? (danger ? Trash01 : undefined)} onClick={confirm} loading={busy} data-autofocus>{confirmLabel}</Button>
      </>}
    />
  );
}

/**
 * useConfirm: promise-style confirmation for the window.confirm call sites.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   ...
 *   if (!(await confirm({ title: 'Delete Garcia Landscaping?', body: 'It moves to Recently deleted.', danger: true, confirmLabel: 'Delete' }))) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirm() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const confirm = useCallback((opts) => new Promise((resolve) => { resolver.current = resolve; setState(opts); }), []);
  const settle = (v) => { resolver.current?.(v); resolver.current = null; setState(null); };
  const element = (
    <ConfirmDialog open={!!state} onClose={() => settle(false)} onConfirm={() => settle(true)}
      title={state?.title || 'Are you sure?'} body={state?.body} confirmLabel={state?.confirmLabel || 'Confirm'} cancelLabel={state?.cancelLabel || 'Cancel'} danger={!!state?.danger} icon={state?.icon} />
  );
  return [confirm, element];
}
export const confirmDialogStyles = '';
