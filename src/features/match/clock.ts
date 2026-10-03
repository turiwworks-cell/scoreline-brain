// The match's running time where the screen needs more than MatchClock's label. Leaf hooks on the
// shared 1 Hz ticker (ARCHITECTURE §4.6): React re-renders only when the value itself changes.

import { useSyncExternalStore } from 'react';
import { liveMinute, type Match, type MatchTime } from '../../domain';
import { subscribeSecond } from '../../ui';

type Timed = Pick<Match, 'status' | 'clock'>;

const idle = () => () => {};

/** The minute the match is in now; moves once a minute while it is live. */
export function useMatchMinute(match: Timed): number {
  return useSyncExternalStore(
    match.status === 'live' ? subscribeSecond : idle,
    () => liveMinute(match, Date.now()).minute,
    () => match.clock.minute,
  );
}

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** The hero's clock (luau:4728): "58:26"; past 90 it stops at "90:00" and the added time shows apart, "+3". */
export function heroClock(t: MatchTime): { readonly main: string; readonly plus: string } {
  if (t.minute >= 90) return { main: '90:00', plus: `+${t.minute - 90}` };
  return { main: `${pad2(t.minute)}:${pad2(t.second)}`, plus: '' };
}

/** The hero clock's text, "main|plus", turning every second while the match is live. */
export function useHeroClock(match: Timed): string {
  const read = () => {
    const c = heroClock(liveMinute(match, Date.now()));
    return `${c.main}|${c.plus}`;
  };
  return useSyncExternalStore(match.status === 'live' ? subscribeSecond : idle, read, read);
}
