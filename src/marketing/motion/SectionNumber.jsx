// SectionNumber: a zero-padded "01"-style label next to a thin hairline
// rule, for numbering sections on a page. Purely presentational - it has no
// motion of its own; wrap it in <Reveal> where a caller wants it to enter.
import { cx } from './shared';

export function SectionNumber({ value, label, padTo = 2, className = '', ...rest }) {
  const padded = String(value).padStart(padTo, '0');
  return (
    <div className={cx('m-section-number', className)} {...rest}>
      <span className="m-section-number-value">{padded}</span>
      <span className="m-section-number-rule" aria-hidden="true" />
      {label ? <span className="m-section-number-label">{label}</span> : null}
    </div>
  );
}
