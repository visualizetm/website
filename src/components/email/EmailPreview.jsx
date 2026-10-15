import { useState } from 'react';
import { SegmentedControl, Button, SkeletonBlock } from '../../ui';

/* The email preview (the email system, milestone 3): the server's HTML in a
 * sandboxed iframe (srcdoc, no allow-scripts, no same origin), at a phone's
 * 375px or a desktop's 600px, with the plain text part behind one link.
 * Compose and Settings, Emails both draw it. */
const WIDTHS = [{ id: 'phone', label: 'Phone' }, { id: 'desktop', label: 'Desktop' }];
export default function EmailPreview({ html = '', text = '', loading = false, stale = false, className = '' }) {
  const [width, setWidth] = useState('phone');
  const [plain, setPlain] = useState(false);
  return (
    <div className={`ep ${className}`.trim()} data-preview={loading ? 'loading' : plain ? 'text' : width}>
      <div className="ep-bar">
        <SegmentedControl label="Preview width" size="sm" options={WIDTHS} value={width} onChange={setWidth} className="ep-width" />
        <Button variant="ghost" size="md" onClick={() => setPlain(p => !p)} aria-pressed={plain} className="ep-plain">{plain ? 'Rendered' : 'Plain text'}</Button>
      </div>
      {loading && !html ? <div className="ep-skel" aria-busy="true" aria-hidden="true"><SkeletonBlock height={420} radius="var(--v-radius-md)" /></div>
        : plain ? <pre className="ep-text">{text}</pre>
          : <div className={`ep-frame-wrap ep-frame-wrap--${width}${stale ? ' is-stale' : ''}`}><iframe title="Email preview" className="ep-frame" sandbox="" srcDoc={html} loading="lazy" /></div>}
    </div>
  );
}
export const emailPreviewStyles = `
  .ep { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .ep-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); flex-wrap: wrap; }
  .ep-frame-wrap { overflow: auto; border-radius: var(--v-radius-md); border: 1px solid var(--v-border); background: var(--v-surface-1); transition: opacity var(--v-dur-base) var(--v-ease-out); }
  .ep-frame-wrap.is-stale { opacity: 0.6; }
  .ep-frame { display: block; border: 0; height: min(70vh, 720px); width: 100%; background: transparent; }
  .ep-frame-wrap--phone .ep-frame { width: 375px; max-width: 100%; margin: 0 auto; }
  .ep-frame-wrap--desktop .ep-frame { width: 600px; max-width: 100%; margin: 0 auto; }
  .ep-text { margin: 0; padding: var(--v-space-4); border-radius: var(--v-radius-md); border: 1px solid var(--v-border); background: var(--v-surface-1); color: var(--v-text); font-family: var(--v-font-body); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); white-space: pre-wrap; overflow-wrap: anywhere; max-height: min(70vh, 720px); overflow: auto; }
  .ep-skel { min-height: 420px; }
`;
