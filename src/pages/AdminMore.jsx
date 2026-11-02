import { PageShell, ScrollArea, Section, Stack, ListRow, SkeletonBlock, Icon, Stagger } from '../ui';
import { MORE_SECTIONS, WORKSPACES, NAV_GROUP_META } from '../shell/nav';
import { useTopBar } from '../shell/ShellContext';

/* More (CRM mobile revamp, milestone 3): the phone's way to everything that is not a tab, as one screen
 * instead of a sheet of buttons. Sections as the sidebar groups them (Pipeline, Clients, Studio, System), one row per screen with its count on
 * the right. No account card (the shell, milestone 3): Sign out is a text link at the bottom of Settings, where a thumb
 * cannot land on it by accident. A tab screen: the tab bar stays, More is the active tab. */
export default function AdminMore({ counts = {}, countsLoading = false, onGo }) {
  useTopBar(null);
  /* The nav revamp (milestone 7): the sections are the workspaces (Pipeline, Clients), then Studio and System, the same rows the sidebar lists. */
  const groups = MORE_SECTIONS.map(sec => ({ group: sec.label, blurb: WORKSPACES.find(w => w.id === sec.id)?.blurb || NAV_GROUP_META[sec.label]?.blurb, items: sec.items }));
  return (
    <PageShell className="aa-main aa-main--wide mo-shell">
      <ScrollArea wide className="mo-page">
        <Section description="What is not on the tab bar." />
        <Stack gap={5}>
          {groups.map(g => (
            <section key={g.group} className="mo-group" aria-label={g.group}>
              <p className="mo-group-h">{g.group}<span className="mo-group-b">{g.blurb}</span></p>
              <Stagger className="mo-rows" cap={4}>
                {g.items.map(n => {
                  const count = n.badge ? counts?.[n.badge] || 0 : 0;
                  return (
                    <ListRow key={n.id} leading={<Icon icon={n.icon} size="var(--v-icon-md)" />} title={n.moreLabel || n.label} onClick={() => onGo(n.id)}
                      meta={n.badge && countsLoading ? <SkeletonBlock width={24} height={16} radius="var(--v-radius-pill)" /> : count > 0 ? <span className="mo-count" aria-label={`${count} waiting`}>{count}</span> : null} />
                  );
                })}
              </Stagger>
            </section>
          ))}
        </Stack>
      </ScrollArea>
      <style>{moreStyles}</style>
    </PageShell>
  );
}

const moreStyles = `
  .mo-group { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .mo-group-h { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--v-space-2); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .mo-group-b { text-transform: none; letter-spacing: 0; font-weight: var(--v-weight-regular, 400); }
  .mo-rows { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .mo-count { min-width: 24px; padding: 0 var(--v-space-2); border-radius: var(--v-radius-pill); background: var(--v-surface-3); color: var(--v-text); font-size: var(--v-text-sm); line-height: 24px; text-align: center; font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; }
`;
