// Brand rule: the wordmark is always "Visualize." with the red period.
// Never "Visualize. Studio", never outlined, no script/italic.
export default function Wordmark({ size = 20, className = '' }) {
  return (
    <span className={`wordmark ${className}`} style={{ fontSize: `${size}px` }}>
      Visualize<span className="wordmark-dot">.</span>
    </span>
  );
}
