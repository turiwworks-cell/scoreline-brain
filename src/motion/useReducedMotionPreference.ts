import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const snapshot = () => typeof matchMedia === 'function' && matchMedia(QUERY).matches;
const subscribe = (notify: () => void) => {
  if (typeof matchMedia !== 'function') return () => {};
  const preference = matchMedia(QUERY);
  preference.addEventListener('change', notify);
  return () => preference.removeEventListener('change', notify);
};

/** Manual CSS/frame loops follow the real preference, including changes while open. */
export function useReducedMotionPreference(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
