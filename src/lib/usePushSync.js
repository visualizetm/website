/* On app open, if this device has allowed notifications, make sure it has a push subscription and that the server has it
 * (src/lib/pushStatus.js planPushSync decides). It heals the three ways push goes quiet without anyone noticing: the subscription
 * is missing, the server pruned its row, or the server removed the last device and flagged pushNeedsResubscribe. It never asks for
 * permission (that needs a tap, so it stays on Settings), and every failure is silent: Settings shows the state and the button. */
import { useEffect } from 'react';
import { apiFetch } from '../shared/api';
import { planPushSync } from './pushStatus';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function syncPush({ force = false } = {}) {
  if (!supported()) return 'skip';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const plan = planPushSync({ supported: true, permission: Notification.permission, hasSubscription: !!sub, force });
  if (plan === 'skip') return plan;
  if (plan === 'resubscribe') { try { await sub.unsubscribe(); } catch { /* the subscribe below makes a fresh one */ } sub = null; }
  if (!sub) {
    const key = (await apiFetch('/api/push-key')).data?.key;
    if (!key) return 'no-key';
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  const res = await apiFetch('/api/admin/push-subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
  return res.ok ? plan : 'failed';
}

let ranThisLoad = false; // once per page load, however many times the shell mounts

/** Once per app open, after the first settings read (so the flag is known). */
export default function usePushSync({ ready, needsResubscribe }) {
  useEffect(() => {
    if (!ready || ranThisLoad) return;
    ranThisLoad = true;
    /* The event tells an open Settings screen to look again (it may have read the subscription mid-way, or the flag before it cleared). */
    syncPush({ force: !!needsResubscribe }).catch(() => 'failed').then(result => { try { window.dispatchEvent(new CustomEvent('vz:push-synced', { detail: { result } })); } catch { /* no window events */ } });
  }, [ready, needsResubscribe]);
}
