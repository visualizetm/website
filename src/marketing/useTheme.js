/* Site Prompt 4: the light/dark read every marketing component needs to
 * pick a theme-correct logo or asset, shared so CaseStudy.jsx and Home's
 * logo strip do not each keep their own copy. Mirrors ThemeToggle.jsx's own
 * read (dataset.theme, seeded pre-paint by index.html) plus live updates:
 * the OS preference (while the user has not chosen) and the ThemeToggle
 * button's own click, via a MutationObserver on the root's data-theme.
 */
import { useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onMedia = (e) => {
      try { const v = localStorage.getItem('vz_theme'); if (v === 'light' || v === 'dark') return; } catch { /* fall through */ }
      setTheme(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', onMedia);

    const obs = new MutationObserver(() => setTheme(document.documentElement.dataset.theme || 'dark'));
    obs.observe(document.documentElement, { attributeFilter: ['data-theme'] });

    return () => { mq.removeEventListener('change', onMedia); obs.disconnect(); };
  }, []);

  return theme;
}
