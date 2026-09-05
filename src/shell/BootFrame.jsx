import { BOOT_FRAME_HTML } from './bootFrame';
/**
 * BootFrame: the same skeleton frame index.html paints before the bundle,
 * rendered by React while the session check is in flight. Because the markup
 * is identical, React's first commit swaps the parser's frame for this one in
 * one paint; no blank ground, no login flash for a signed in user.
 */
export default function BootFrame() {
  return <div className="vz-boot-host" dangerouslySetInnerHTML={{ __html: BOOT_FRAME_HTML }} />;
}
