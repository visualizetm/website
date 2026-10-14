import { Component, lazy, Suspense } from 'react';

/* CrashBoundary (the faster landing prompt): the top level boundary around
 * the whole app, with nothing of the kit in it. The old ShellCrash imported
 * the kit's barrel for its styled card, which put every kit component, the
 * kit's icon map and the record stylesheet into the entry both hosts
 * download; the card (src/shell/ShellCrash.jsx) now loads only when a crash
 * has happened, and the boundary itself is these few lines. The error is
 * logged the way the kit's boundary logs, through the same lazy card. */
const ShellCrashCard = lazy(() => import('./ShellCrash'));

export default class CrashBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Suspense fallback={<p role="alert" style={{ padding: 24, fontFamily: 'Inter, sans-serif' }}>Visualize could not start. Reload the page.</p>}>
        <ShellCrashCard error={error} />
      </Suspense>
    );
  }
}
