import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Bell01 from '@untitled-ui/icons-react/build/esm/Bell01';
import { COPY } from '../../shared/copy';
import { Sheet } from './parts';

/* The Alerts sheet (Planner v2, part 3), opened by the bell in the top bar. Turn on alerts saves this device through the planner's
 * own door (push_on, the portal's shared toggle: a device turned on in the portal is already on here). An iPhone shows alerts only
 * from the Home Screen, so there Safari gets the Add to Home Screen hint instead of a button that cannot work. Then the three
 * switches, stored on the client's record by the alerts action (booleans only). Nothing here sends anything. */

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const standalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
const keyBytes = (b64) => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
/** The worker, or null when it is not there yet (registration waits for an idle moment after load; a sheet must not hang on it). */
const worker = () => Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 3000))]);

/* settingsHref (the client app): the panel's Settings, where Sign out is, as a text link at the bottom of the sheet. */
export default function AlertsSheet({ alerts, onClose, send, onAlerts, settingsHref = '' }) {
  const A = COPY.planner.alerts;
  const supported = pushSupported();
  const hint = !supported && isIOS() && !standalone();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState('');
  useEffect(() => {
    if (!supported) return undefined;
    let alive = true;
    worker().then(reg => (reg ? reg.pushManager.getSubscription() : null)).then(sub => { if (alive && sub) setOn(true); }).catch(() => {});
    return () => { alive = false; };
  }, [supported]);

  const turnOn = async () => {
    setBusy('device'); setSaid('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setSaid(perm === 'denied' ? A.blocked : A.noPermission); return; }
      const reg = await worker();
      if (!reg) { setSaid(A.notReady); return; }
      const key = (await (await fetch('/api/push-key')).json().catch(() => ({})))?.key;
      if (!key) { setSaid(A.notSetUp); return; }
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
      const r = await send({ action: 'push_on', subscription: sub.toJSON() });
      if (!r.ok) { setSaid(r.status === 429 ? A.tooMany : A.failed); return; }
      setOn(true); setSaid(A.turnedOn);
    } catch { setSaid(A.failed); } finally { setBusy(''); }
  };
  const turnOff = async () => {
    setBusy('device'); setSaid('');
    try {
      const reg = await worker();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) { await send({ action: 'push_off', endpoint: sub.endpoint }); await sub.unsubscribe().catch(() => {}); }
      setOn(false); setSaid(A.turnedOff);
    } catch { setSaid(A.failed); } finally { setBusy(''); }
  };
  const flip = async (key) => {
    if (busy) return;
    const next = !alerts[key];
    setBusy(key); setSaid('');
    onAlerts({ ...alerts, [key]: next });
    const r = await send({ action: 'alerts', alerts: { [key]: next } });
    setBusy('');
    if (r.ok) { if (r.json?.alerts) onAlerts(r.json.alerts); }
    else { onAlerts({ ...alerts, [key]: !next }); setSaid(r.status === 429 ? A.tooMany : A.failed); }
  };

  return (
    <Sheet title={A.title} onClose={onClose} busy={busy === 'device'}>
      <div className="pl-alerts-device">
        <span className="pl-alerts-bell" aria-hidden="true"><Bell01 width={20} height={20} /></span>
        <div className="pl-alerts-text">
          <p className="pl-alerts-state">{on ? A.deviceOn : A.deviceOff}</p>
          <p className="pl-muted">{hint ? A.iphoneHint : !supported ? A.unsupported : on ? A.deviceOnLine : A.deviceOffLine}</p>
        </div>
      </div>
      {supported && (on
        ? <button type="button" className="pl-btn pl-btn--secondary pl-btn--full" onClick={turnOff} disabled={!!busy} aria-busy={busy === 'device' ? 'true' : undefined}>{A.turnOff}</button>
        : <button type="button" className="pl-btn pl-btn--lg pl-btn--full pl-alerts-on" onClick={turnOn} disabled={!!busy} aria-busy={busy === 'device' ? 'true' : undefined}>{A.turnOn}</button>)}
      <fieldset className="pl-field pl-switches">
        <legend className="pl-label">{A.which}</legend>
        {['review', 'today', 'ideas'].map(key => (
          <button key={key} type="button" role="switch" aria-checked={alerts[key] ? 'true' : 'false'} className="pl-switch" onClick={() => flip(key)} disabled={!!busy} aria-busy={busy === key ? 'true' : undefined}>
            <span className="pl-switch-text"><span className="pl-switch-name">{A.switches[key]}</span><span className="pl-switch-help">{A.help[key]}</span></span>
            <span className="pl-switch-knob" aria-hidden="true"><span /></span>
          </button>
        ))}
      </fieldset>
      {said && <p className="pl-hint" role="status">{said}</p>}
    {settingsHref && <Link className="pl-alerts-settings" to={settingsHref} onClick={onClose}>{COPY.clientApp.settings.link}</Link>}
    </Sheet>
  );
}

export const alertsStyles = `
  .pl-alerts-device { display: flex; align-items: flex-start; gap: var(--v-space-3); }
  .pl-alerts-bell { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: var(--v-tap); height: var(--v-tap); border-radius: 50%; background: var(--v-red-soft); color: var(--v-red-highlight); }
  .pl-alerts-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pl-alerts-state { font-weight: var(--v-weight-bold); color: var(--v-text); }
  .pl-switches { gap: var(--v-space-2); }
  .pl-switch { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap-lg); padding: var(--v-space-2) var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text); font-family: var(--v-font-body); text-align: left; cursor: pointer; }
  .pl-switch:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .pl-switch:disabled { cursor: default; }
  .pl-switch-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pl-switch-name { font-weight: var(--v-weight-bold); font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .pl-switch-help { color: var(--v-text-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-switch-knob { position: relative; flex-shrink: 0; width: 44px; height: 26px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); border: 1px solid var(--v-border-strong); transition: background var(--v-dur-fast) var(--v-ease-out); }
  .pl-switch-knob span { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--v-text-2); transition: transform var(--v-dur-fast) var(--v-ease-out), background var(--v-dur-fast) var(--v-ease-out); }
  .pl-switch[aria-checked='true'] .pl-switch-knob { background: var(--v-red-hover); border-color: var(--v-red-hover); }
  .pl-switch[aria-checked='true'] .pl-switch-knob span { transform: translateX(18px); background: var(--v-text-on-red); }
  /* The client app: the panel's Settings, a text link at the foot of the sheet, a 44px target. */
  .pl-alerts-settings { display: flex; align-items: center; justify-content: center; min-height: 44px; margin-top: var(--v-space-2); color: var(--v-text-2); text-decoration: underline; text-underline-offset: 3px; font-size: var(--v-text-sm); }
`;
