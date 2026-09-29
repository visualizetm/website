import { scoreTone } from '../../lib/score';

/* The lead score as one pill (Triage and the triage record header). */
export default function ScoreBadge({ score, className = '' }) {
  const n = Number(score) || 0;
  return <span className={`tr-score tr-score--${scoreTone(n)} ${className}`.trim()} aria-label={`Score ${n} of 100`}>{n}</span>;
}
