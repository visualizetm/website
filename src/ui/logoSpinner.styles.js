/* The loading screen's stylesheet, one source for two places: the LogoSpinner component (it carries its own
 * <style>, so the marketing site, which does not load uiStyles, gets it too) and the parser painted splash in
 * index.html (the vite plugin in vite.config.js). Plain strings, no imports, so
 * Node loads it. No hex: the colors are the host's own tokens (--v-ground in the admin, --bg on the site). */
export const LOGO_SPIN_MS = 1100;

export const logoSpinnerStyles = `
  .lspin { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .lspin--screen { position: fixed; inset: 0; z-index: 9999; background: var(--v-ground, var(--bg)); }
  .lspin--panel { width: 100%; min-height: 240px; padding: 48px 0; box-sizing: border-box; }
  .lspin--page { width: 100%; min-height: calc(100 * var(--svh, 1vh)); background: var(--v-ground, var(--bg)); }
  .lspin-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .lspin-icon { display: block; width: var(--lspin-size, 56px); height: var(--lspin-size, 56px); animation: lspin-turn ${LOGO_SPIN_MS}ms linear infinite; }
  @keyframes lspin-turn { to { transform: rotate(360deg); } }
  @keyframes lspin-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .lspin-icon { animation: lspin-pulse 2s ease-in-out infinite; } }
  [data-v-motion='reduce'] .lspin-icon { animation: lspin-pulse 2s ease-in-out infinite; }
`.replace(/\n\s*/g, '\n').trim();
