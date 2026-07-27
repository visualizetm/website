import { useState, useEffect } from 'react';
import Sun from '@untitled-ui/icons-react/build/esm/Sun';
import Moon01 from '@untitled-ui/icons-react/build/esm/Moon01';

const KEY = 'vz_theme';

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  // Follow OS theme changes live — but only while the user hasn't chosen explicitly.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e) => {
      try { if (localStorage.getItem(KEY)) return; } catch { /* fall through */ }
      const next = e.matches ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun width={16} height={16} /> : <Moon01 width={16} height={16} />}
    </button>
  );
}
