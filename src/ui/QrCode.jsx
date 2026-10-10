import { useEffect, useRef, useState } from 'react';
import { encodeQr } from '../lib/qr';
import { logoSrc } from './logo.data';
import Button from './Button';

/**
 * QrCode (review links): a QR code painted on a canvas, Visualize ink on
 * paper in every theme (the --v-qr-* tokens), with the Aperture mark on a
 * paper panel in the middle when `icon` is on. The panel is 22 percent of
 * the side on error correction level H, which scripts/qr-test.mjs decodes
 * with an independent reader down to 160px; without the icon the code is
 * level M. Download saves the canvas as a PNG named `downloadName`.
 * @param {object} props
 * @param {string} props.value  what the code says (the review link)
 * @param {number} [props.size=160]  CSS pixels a side; the canvas paints at the device's pixel ratio
 * @param {boolean} [props.icon=true]
 * @param {string} [props.label]  the accessible name ("QR code for the review link")
 * @param {string} [props.downloadName]  the PNG's file name without the extension
 */
export default function QrCode({ value, size = 160, icon = true, label = 'QR code', downloadName = 'qr-code', className = '' }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !value) return undefined;
    let live = true;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const px = Math.round(size * dpr);
    canvas.width = px; canvas.height = px;
    const ctx = canvas.getContext('2d');
    /* A token that points at another token only resolves once it is applied, so the two colours are read off a probe element. */
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;color:var(--v-qr-ink);background-color:var(--v-qr-paper)';
    canvas.parentElement?.appendChild(probe);
    const got = getComputedStyle(probe);
    const ink = got.color || 'rgb(8, 8, 8)';
    const paper = got.backgroundColor && got.backgroundColor !== 'rgba(0, 0, 0, 0)' ? got.backgroundColor : 'rgb(255, 255, 255)';
    probe.remove();
    let q;
    try { q = encodeQr(value, { level: icon ? 'H' : 'M' }); } catch { setReady(false); return undefined; }
    const quiet = 4; const total = q.size + quiet * 2; const scale = px / total;
    ctx.fillStyle = paper; ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = ink;
    for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++) if (q.modules[r][c]) ctx.fillRect(Math.floor((c + quiet) * scale), Math.floor((r + quiet) * scale), Math.ceil(scale), Math.ceil(scale));
    setReady(true);
    if (!icon) return undefined;
    const panel = Math.round(px * 0.22); const at = Math.round((px - panel) / 2);
    ctx.fillStyle = paper; ctx.fillRect(at, at, panel, panel);
    const img = new Image();
    img.onload = () => { if (!live) return; const pad = Math.round(panel * 0.12); ctx.drawImage(img, at + pad, at + pad, panel - pad * 2, panel - pad * 2); };
    img.src = logoSrc('icon', 'primary');
    return () => { live = false; };
  }, [value, size, icon]);
  const download = () => {
    const canvas = ref.current; if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${downloadName}.png`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };
  return (
    <div className={`v-qr ${className}`.trim()}>
      <canvas ref={ref} className="v-qr-canvas" style={{ width: size, height: size }} role="img" aria-label={label} />
      <Button variant="secondary" size="md" icon="Download01" onClick={download} disabled={!ready} className="v-qr-download">Download PNG</Button>
    </div>
  );
}

export const qrCodeStyles = `
  .v-qr { display: inline-flex; flex-direction: column; align-items: center; gap: var(--v-space-2); }
  .v-qr-canvas { display: block; border-radius: var(--v-radius-md); background: var(--v-qr-paper); }
`;
