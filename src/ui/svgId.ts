import { useId } from 'react';

/** A document-unique id that is safe inside `url(#…)` (React's ids carry punctuation). */
export function useSvgId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}
