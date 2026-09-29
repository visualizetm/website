import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import { Input } from '../ui';
import { matchesSearch } from '../lib/leads';

/* One search for every list (search where it is missing): the Input with
 * the search glyph and a clear control, and the one matcher the screens
 * share for a lead shaped row (business, contact, phone digits, industry,
 * area, descriptor). Orders and submissions keep their own matchers over
 * their own fields but use the same control. The heading beside it reads
 * "14 new, 6 match" while a search or a filter is on (matchLine). */
export const matchesList = matchesSearch;
export const matchLine = (total, noun, shown) => `${total} ${noun}, ${shown} match`;

export default function ListSearch({ value, onChange, placeholder = 'Search business, contact, phone, industry', label = 'Search', className = '', autoFocus = false }) {
  return (
    <Input className={`lsr ${className}`.trim()} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} leading={<SearchMd width={16} height={16} />} aria-label={label}
      inputMode="search" autoComplete="off" data-autofocus={autoFocus || undefined}
      trailing={value ? <button type="button" className="lsr-clear" onClick={() => onChange('')} aria-label="Clear search"><XClose width={14} height={14} /></button> : undefined} />
  );
}
