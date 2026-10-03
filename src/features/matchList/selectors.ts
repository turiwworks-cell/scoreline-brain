// The list's selectors. They follow the conventions at the top of store/selectors.ts: module-level
// and cached per argument, so a selector is the same function every render, and a derived list
// returns its previous array while the contents are equal, so a poll that changes nothing on the
// list re-renders nothing on it.

import type { Match, NextFixture, Player } from '../../domain';
import { selectMatchOrder, type ScorelineState } from '../../store';
import { cardOrder, listGroups, sameGroups, type Group } from './groups';

type Selector<T> = (state: ScorelineState) => T;

function perKey<K, T>(make: (key: K) => Selector<T>): (key: K) => Selector<T> {
  const cache = new Map<K, Selector<T>>();
  return (key) => {
    let sel = cache.get(key);
    if (!sel) {
      sel = make(key);
      cache.set(key, sel);
    }
    return sel;
  };
}

/** The groups of the list for a day tab, or Ongoing. */
export const selectGroups = perKey((key: string): Selector<readonly Group[]> => {
  const live = key === 'live';
  const day = live ? 0 : Number(key);
  let lastMatches: unknown;
  let lastOrder: unknown;
  let lastLeagues: unknown;
  let last: readonly Group[] = [];
  return (s) => {
    const { matches, matchOrder, leagues } = s.domain;
    if (matches === lastMatches && matchOrder === lastOrder && leagues === lastLeagues) return last;
    lastMatches = matches;
    lastOrder = matchOrder;
    lastLeagues = leagues;
    const next = listGroups(s.domain, { day, live });
    if (!sameGroups(last, next)) last = next;
    return last;
  };
});

export const groupsKey = (list: { day: number; live: boolean }) => (list.live ? 'live' : String(list.day));

/** Ids of the live matches, in card order. */
export const selectCardIds: Selector<readonly number[]> = (() => {
  let lastMatches: unknown;
  let last: readonly number[] = [];
  return (s: ScorelineState) => {
    const { matches, matchOrder } = s.domain;
    if (matches === lastMatches) return last;
    lastMatches = matches;
    const live = matchOrder.flatMap((id) => (matches[id]?.status === 'live' ? [matches[id] as Match] : []));
    const next = cardOrder(live);
    if (next.length !== last.length || next.some((id, i) => id !== last[i])) last = next;
    return last;
  };
})();

export { selectMatchOrder };

/** The squads: one object, replaced only when a feed changes a squad. */
export const selectPlayers: Selector<Readonly<Record<string, Player>>> = (s) => s.domain.players;

/** A team's next fixture after tonight (`next`, luau:2258). */
export const selectNext = perKey((team: string): Selector<NextFixture | undefined> => (s) => s.domain.next[team]);

/**
 * A team's most relevant match (matchOf, luau:7110): live, then today, then tomorrow, then any
 * other; the first in feed order among equals.
 */
export const selectFollowMatchId = perKey((team: string): Selector<number | undefined> => (s) => {
  const { matches, matchOrder } = s.domain;
  let best: number | undefined;
  let bestScore = -1;
  for (const id of matchOrder) {
    const m = matches[id];
    if (!m || (m.home !== team && m.away !== team)) continue;
    const score = m.status === 'live' ? 4 : m.day === 0 ? 3 : m.day === 1 ? 2 : 1;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
});
