/* The boot frame (Prompt 14): the shell's outline in skeleton, painted by the
 * parser before the bundle runs and rendered again by React while the session
 * check is in flight, so a signed in user never sees blank ground or a login
 * flash. index.html gets this markup and CSS through the Vite plugin in
 * vite.config.js (one source, no hand copy); AdminApp renders the same string
 * through BootFrame.jsx.
 *
 * Which variant shows is decided by the pre-paint script in index.html:
 *   html[data-vz-boot='shell']  the signed in frame (vz_boot hint present)
 *   html[data-vz-boot='login']  the login card outline (no hint)
 *   html[data-vz-side='rail']   the collapsed sidebar (vz_shell_collapsed)
 * Colors come from src/ui/tokens.js (parsed here), so the frame and the shell
 * cannot drift; the geometry mirrors the shell (sidebar 240 or 68, top bar 60,
 * tab bar 58) so the real shell lands on top without a shift. Motion honors
 * both prefers-reduced-motion and html[data-v-motion='reduce'].
 */
import { tokenStyles } from '../ui/tokens.js';

const [darkBlock, lightBlock] = tokenStyles.split("[data-v-theme='light']");
const val = (block, name, fallback) => {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(block);
  return m ? m[1].trim() : fallback;
};
// The shimmer sweep is the kit's: --v-dur-slow times four, read from the same token block.
const SHIMMER_MS = (parseFloat(val(darkBlock, '--v-dur-slow', '320ms')) || 320) * 4;
const NAMES = ['--v-ground', '--v-bar', '--v-surface-1', '--v-surface-2', '--v-surface-3', '--v-border', '--v-sidebar-bg', '--v-sidebar-border'];
const vars = (block) => NAMES.map(n => `${n}:${val(block, n, val(darkBlock, n, ''))}`).join(';');

const skel = (w, h, extra = '') => `<i class="vz-skel" style="width:${w};height:${h}${extra ? ';' + extra : ''}"></i>`;
const navRow = () => `<div class="vz-boot-nav">${skel('18px', '18px', 'border-radius:5px')}${skel('62%', '12px')}</div>`;
const card = (h) => `<div class="vz-boot-card" style="height:${h}px">${skel('40%', '12px')}${skel('55%', '26px')}</div>`;

export const BOOT_FRAME_HTML = [
  '<div class="vz-boot vz-boot--shell" aria-hidden="true">',
  '<aside class="vz-boot-side">',
  `<div class="vz-boot-brand">${skel('28px', '28px', 'border-radius:8px')}${skel('88px', '16px')}</div>`,
  `<div class="vz-boot-navs">${navRow().repeat(4)}<span class="vz-boot-gap"></span>${navRow().repeat(3)}<span class="vz-boot-gap"></span>${navRow().repeat(3)}</div>`,
  `<div class="vz-boot-user">${skel('32px', '32px', 'border-radius:999px')}${skel('56%', '12px')}</div>`,
  '</aside>',
  '<div class="vz-boot-col">',
  `<header class="vz-boot-top">${skel('132px', '22px')}<span class="vz-boot-top-r">${skel('44px', '44px', 'border-radius:10px').repeat(3)}</span></header>`,
  '<main class="vz-boot-main"><div class="vz-boot-content">',
  `${skel('58%', '32px')}${skel('42%', '14px')}`,
  `<div class="vz-boot-row">${card(92).repeat(4)}</div>`,
  `<div class="vz-boot-grid">${card(132).repeat(4)}</div>`,
  `<div class="vz-boot-card vz-boot-card--tall">${skel('30%', '12px')}${skel('100%', '56px')}${skel('100%', '56px')}${skel('100%', '56px')}</div>`,
  '</div></main>',
  `<nav class="vz-boot-tabs">${`<span class="vz-boot-tab">${skel('26px', '26px', 'border-radius:999px')}${skel('34px', '10px')}</span>`.repeat(6)}</nav>`,
  '</div></div>',
  '<div class="vz-boot vz-boot--login" aria-hidden="true"><div class="vz-boot-login">',
  `${skel('110px', '22px')}${skel('68px', '28px')}${skel('96px', '14px')}${skel('100%', '44px', 'border-radius:10px;margin-top:8px')}${skel('100%', '56px', 'border-radius:16px')}`,
  '</div></div>',
].join('');

export const BOOT_CSS = `
html{${vars(darkBlock)}}
html[data-v-theme='light']{${vars(lightBlock)}}
html[data-vz-boot] body{margin:0;background:var(--v-ground)}
.vz-boot{display:none;position:fixed;inset:0;background:var(--v-ground);color:transparent;font-family:system-ui,sans-serif}
html[data-vz-boot='shell'] .vz-boot--shell{display:flex}
html[data-vz-boot='login'] .vz-boot--login{display:flex;align-items:center;justify-content:center;padding:16px}
.vz-skel{display:block;flex-shrink:0;border-radius:6px;background-color:var(--v-surface-2);background-image:linear-gradient(105deg,transparent 38%,var(--v-surface-3) 50%,transparent 62%);background-size:240% 100%;background-position:120% 0;animation:vz-shimmer ${SHIMMER_MS}ms linear infinite}
@keyframes vz-shimmer{from{background-position:120% 0}to{background-position:-120% 0}}
@media (prefers-reduced-motion: reduce){.vz-skel{animation:none;background-image:none}}
html[data-v-motion='reduce'] .vz-skel{animation:none;background-image:none}
.vz-boot-side{display:none;flex-direction:column;flex-shrink:0;width:240px;height:100%;padding:12px 8px;background:var(--v-sidebar-bg);border-right:1px solid var(--v-sidebar-border);gap:8px}
html[data-vz-side='rail'] .vz-boot-side{width:68px}
html[data-vz-side='rail'] .vz-boot-side .vz-skel:not(:first-child),html[data-vz-side='rail'] .vz-boot-user .vz-skel:last-child{display:none}
@media (min-width:768px){.vz-boot-side{display:flex}}
.vz-boot-brand,.vz-boot-nav,.vz-boot-user{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 12px}
.vz-boot-navs{flex:1;display:flex;flex-direction:column;gap:2px;min-height:0;overflow:hidden}
.vz-boot-gap{height:12px;flex-shrink:0}
.vz-boot-user{border-top:1px solid var(--v-sidebar-border);padding-top:8px}
.vz-boot-col{flex:1;min-width:0;display:flex;flex-direction:column;height:100%}
.vz-boot-top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;padding:8px max(clamp(16px,3vw,24px),env(safe-area-inset-right)) 8px max(clamp(16px,3vw,24px),env(safe-area-inset-left));padding-top:calc(8px + env(safe-area-inset-top,0px));background:var(--v-surface-1);border-bottom:1px solid var(--v-border);flex-shrink:0}
.vz-boot-top-r{display:flex;gap:4px}
.vz-boot-main{flex:1;min-height:0;overflow:hidden;padding:clamp(16px,3vw,24px) max(clamp(16px,3vw,24px),env(safe-area-inset-right)) clamp(16px,3vw,24px) max(clamp(16px,3vw,24px),env(safe-area-inset-left))}
.vz-boot-content{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.vz-boot-row{display:flex;gap:8px;overflow:hidden}
.vz-boot-row .vz-boot-card{flex:1 0 150px}
.vz-boot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px}
.vz-boot-card{display:flex;flex-direction:column;justify-content:flex-end;gap:8px;padding:12px;background:var(--v-surface-1);border:1px solid var(--v-border);border-radius:16px;box-sizing:border-box;min-width:0}
.vz-boot-card--tall{justify-content:flex-start;padding:16px}
.vz-boot-tabs{display:flex;justify-content:space-around;align-items:center;height:calc(58px + env(safe-area-inset-bottom,0px));padding-bottom:env(safe-area-inset-bottom,0px);background:var(--v-surface-1);border-top:1px solid var(--v-border);flex-shrink:0}
@media (min-width:768px){.vz-boot-tabs{display:none}}
html[data-v-theme='light'] .vz-boot-side .vz-skel{background-color:rgba(255,255,255,0.08);background-image:linear-gradient(105deg,transparent 38%,rgba(255,255,255,0.14) 50%,transparent 62%)}
.vz-boot-tab{display:flex;flex-direction:column;align-items:center;gap:6px}
.vz-boot-login{width:min(360px,100%);display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 20px;background:var(--v-surface-1);border:1px solid var(--v-border);border-radius:16px;box-sizing:border-box}
`.replace(/\n\s*/g, '');
