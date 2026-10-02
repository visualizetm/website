import EmptyState from './EmptyState';
/**
 * NoResults: the list has rows, but none match the search or the filters. It is not the first time empty state
 * (EmptyState, "nothing here yet, make one"): it says what was looked for and gives one way back.
 * @param {object} props
 * @param {string} props.noun plural, lower case ("deals", "projects")
 * @param {string} [props.query] the search text, when one is typed
 * @param {string[]} [props.filters] names of the filters that are on ("Active", "Hot")
 * @param {Function} props.onClear clears the search and the filters together
 */
export default function NoResults({ noun, query = '', filters = [], onClear, className = '' }) {
  const q = String(query || '').trim();
  const shownQ = q.length > 32 ? `${q.slice(0, 31)}...` : q;
  const named = filters.filter(Boolean);
  const title = q ? `Nothing matches "${shownQ}"` : `No ${noun} in ${named.join(' and ') || 'this view'}`;
  const description = q
    ? (named.length ? `No ${noun} match that search inside ${named.join(' and ')}.` : `No ${noun} match that search. Check the spelling, or try a phone number.`)
    : `Every ${noun.replace(/s$/, '')} is still here under All.`;
  const label = q && named.length ? 'Clear search and filters' : q ? 'Clear search' : 'Show all';
  return <EmptyState size="sm" icon="SearchMd" title={title} description={description} action={{ label, onClick: onClear }} className={`v-noresults ${className}`.trim()} data-state="no-results" />;
}
