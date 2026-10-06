import { logoSrc } from './logo.data';
import { logoToneStyles } from './Logo';
import { logoSpinnerStyles } from './logoSpinner.styles';

/**
 * LogoSpinner: the loading screen. The whole Aperture icon turns, linear, one turn every 1.1 s, around its
 * center; the red dot is at the exact center, so it reads as fixed while the four arcs go round. Flat: no glow,
 * shadow, gradient, blur, trail or extra bar. CSS keyframes on transform only, no timers.
 * Reduced motion: no rotation, a slow opacity pulse between 0.55 and 1 on the static icon.
 * Shows only while something is really loading; it adds no minimum time.
 *
 * Tone follows the surface: reversed (light arcs) on the dark site and admin, primary (ink) on a light surface.
 * Use it for a full screen or a full panel. Inside a button or a row keep Spinner, the kit's small inline one.
 * @param {object} props
 * @param {number} [props.size=56] px, never below 24 (24 is the small inline size for a panel).
 * @param {'reversed'|'primary'|'auto'} [props.tone='reversed'] auto is for the admin: reversed on its dark theme, primary on its light one.
 * @param {'inline'|'panel'|'screen'|'page'} [props.layout='panel'] inline: just the icon; panel: fills its parent;
 *        screen: a fixed layer over the viewport (the marketing Suspense fallback); page: in flow, one viewport tall.
 */
export default function LogoSpinner({ size = 56, tone = 'reversed', layout = 'panel', className = '', style, ...rest }) {
  const px = Math.max(24, Number(size) || 56);
  const icon = (t, extra = '') => <img className={`lspin-icon ${extra}`.trim()} src={logoSrc('icon', t)} width={px} height={px} alt="" aria-hidden="true" draggable="false" style={{ '--lspin-size': `${px}px` }} />;
  return (
    <div className={`lspin lspin--${layout} ${className}`.trim()} role="status" aria-label="Loading" style={style} {...rest}>
      {tone === 'auto'
        ? (<>{icon('reversed', 'v-logo-rev')}{icon('primary', 'v-logo-pri')}<style>{logoToneStyles}</style></>)
        : icon(tone)}
      <span className="lspin-sr">Loading</span>
      <style>{logoSpinnerStyles}</style>
    </div>
  );
}
