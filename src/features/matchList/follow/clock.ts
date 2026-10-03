// The card's own clock: a number that moves once a second while the card shows something that
// counts (his minutes, the countdown), and stands still otherwise.

import { useSyncExternalStore } from 'react';
import { subscribeSecond } from '../../../ui';

const idle = () => () => {};

/** `Date.now()` rounded down to `every` ms, re-rendered as it moves; 0 while `every` is 0. */
export function useNowMs(every: number): number {
  return useSyncExternalStore(
    every > 0 ? subscribeSecond : idle,
    () => (every > 0 ? Math.floor(Date.now() / every) * every : 0),
    () => 0,
  );
}
