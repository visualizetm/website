import { useCallback } from 'react';
import { patchWithRollback } from '../shared/api';
import { useToast } from './Toast';
/**
 * useOptimisticPatch: update local state, fire the PATCH, roll back with an
 * error toast on failure, in one call.
 *
 *   const mutate = useOptimisticPatch();
 *   await mutate({
 *     url: '/api/admin/call-leads',
 *     id: lead._id,
 *     set: { priority: 'hot' },
 *     apply: () => { const prev = lead.priority; setLead(l => ({ ...l, priority: 'hot' })); return () => setLead(l => ({ ...l, priority: prev })); },
 *     error: 'Could not update priority.',       // optional toast text
 *     success: 'Marked hot.',                     // optional success toast
 *   });
 *
 * `apply` runs immediately and returns the undo function. Resolves true on
 * success, false after rollback.
 */
export default function useOptimisticPatch() {
  const toast = useToast();
  return useCallback(async ({ url, id, set, apply, error = 'Could not save. Your change was undone.', success }) => {
    const ok = await patchWithRollback({ url, id, set, apply, onError: () => toast.error(error) });
    if (ok && success) toast.success(success);
    return ok;
  }, [toast]);
}
