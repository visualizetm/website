/* The red alarm: the reminders job has not run in the last ten minutes, so no push is coming. Shown at the top of Settings and on
 * the home. The words come from src/lib/pushStatus.js (alarmText) and the numbers from the shell's health (the settings GET),
 * which the shell refreshes every few minutes. Silent while the cron keeps its pace, while the first settings read is still on
 * its way, and while the app is offline (an offline phone cannot know). */
import { useEffect, useState } from 'react';
import { Icon, Button, useOnline } from '../ui';
import { useShell } from '../shell/ShellContext';
import { alarmText } from '../lib/pushStatus';

export default function CronAlarm({ onOpen = null, actionLabel = 'Open Settings' }) {
  const shell = useShell();
  const online = useOnline();
  const health = shell?.health;
  const loaded = !!shell?.healthLoaded;
  const [, setTick] = useState(0); // a minute clock: time passing is what makes the cron stale, with no new data
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60e3); return () => clearInterval(id); }, []);
  const text = loaded && online ? alarmText(health, Date.now()) : '';
  if (!text) return null;
  return (
    <div className="cron-alarm" role="status" aria-live="polite" data-card="cron-alarm">
      <Icon icon="AlertTriangle" size="var(--v-icon-md)" className="cron-alarm-icon" />
      <p className="cron-alarm-text">{text}</p>
      {onOpen && <Button variant="secondary" size="md" onClick={onOpen} className="cron-alarm-btn">{actionLabel}</Button>}
    </div>
  );
}

export const cronAlarmStyles = `
  .cron-alarm { display: flex; align-items: center; gap: var(--v-space-3); min-width: 0; padding: var(--v-space-3) var(--v-space-4); border-radius: var(--v-radius-lg); border: 1px solid color-mix(in srgb, var(--v-status-danger-text) 38%, var(--v-border)); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); }
  .cron-alarm-icon { flex-shrink: 0; }
  .cron-alarm-text { flex: 1; min-width: 0; margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); overflow-wrap: anywhere; }
  .cron-alarm-btn { flex-shrink: 0; }
  @media (max-width: 480px) { .cron-alarm { flex-wrap: wrap; } .cron-alarm-btn { margin-left: calc(var(--v-icon-md) + var(--v-space-3)); } }
`;
