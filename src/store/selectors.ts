// Selectors for the store, and the rules every component follows when reading it.
//
// Conventions
// 1. Read the store only through a selector from this file: `useScoreline(selectMatch(id))`.
//    Never select the whole state or the whole `domain`: any poll that changes anything would
//    re-render that component.
// 2. Select the narrowest thing the component renders: a match, a score, a status, an id list.
//    Unchanged matches keep their identity across polls (Part 2's structural sharing), so a
//    narrow selector re-renders only when its own data changed.
// 3. A selector returns something already in the state (or a primitive). It never builds a new
//    object or array per call, which would re-render on every store update. A derived list goes
//    through `derivedList`, which returns the previous array while the contents are equal.
// 4. Fixed selectors are module-level constants named `selectX`. Selectors with an argument are
//    factories, `selectX(arg)`, cached per argument so the function is the same every render
//    and can be passed straight to `useScoreline` without `useCallback`.
// 5. Actions come from `selectActions`; the object is stable and never triggers a render.
// 6. Domain rules (standings, ordering, formatting) live in src/domain (Part 4). A selector only
//    picks or wraps them.

import type { League, Match, MatchStatus, Moment, Player, Score, Team } from '../domain';
import type { SyncPhase, SyncStatus } from '../data/source';
import type { ScorelineActions, ScorelineState } from './store';

export type Selector<T> = (state: ScorelineState) => T;

/** Caches one selector per key, so `selectX(key)` is referentially stable. */
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

/**
 * A selector for a list computed from `domain.matches` and `domain.matchOrder`. It recomputes
 * only when either changes, and returns its previous array while the items are the same.
 */
function derivedList<T>(compute: (state: ScorelineState) => readonly T[]): Selector<readonly T[]> {
  let lastMatches: unknown;
  let lastOrder: unknown;
  let last: readonly T[] = [];
  return (state) => {
    const { matches, matchOrder } = state.domain;
    if (matches === lastMatches && matchOrder === lastOrder) return last;
    lastMatches = matches;
    lastOrder = matchOrder;
    const next = compute(state);
    if (next.length !== last.length || next.some((v, i) => !Object.is(v, last[i]))) last = next;
    return last;
  };
}

// ── Whole-store, stable ──────────────────────────────────────────────────────

export const selectActions: Selector<ScorelineActions> = (s) => s.actions;

// ── Sync status ──────────────────────────────────────────────────────────────

export const selectSync: Selector<SyncStatus> = (s) => s.sync;
export const selectSyncPhase: Selector<SyncPhase> = (s) => s.sync.phase;
export const selectFeedError: Selector<boolean> = (s) => s.sync.feedError;

// ── Moments ──────────────────────────────────────────────────────────────────

/** The moment queue. The MomentDirector reads it and calls `actions.takeMoments()`. */
export const selectMoments: Selector<readonly Moment[]> = (s) => s.moments;

// ── Domain ───────────────────────────────────────────────────────────────────

export const selectLoaded: Selector<boolean> = (s) => s.domain.loaded;
export const selectDays: Selector<readonly string[]> = (s) => s.domain.days;
/** Match ids in feed order. */
export const selectMatchOrder: Selector<readonly number[]> = (s) => s.domain.matchOrder;

export const selectMatch = perKey((id: number): Selector<Match | undefined> => (s) => s.domain.matches[id]);
export const selectScore = perKey((id: number): Selector<Score | undefined> => (s) => s.domain.matches[id]?.score);
export const selectMatchStatus = perKey((id: number): Selector<MatchStatus | undefined> => (s) => s.domain.matches[id]?.status);
export const selectTeam = perKey((id: string): Selector<Team | undefined> => (s) => s.domain.teams[id]);
export const selectLeague = perKey((id: string): Selector<League | undefined> => (s) => s.domain.leagues[id]);
/** `key` is `playerKey(team, n)`. */
export const selectPlayer = perKey((key: string): Selector<Player | undefined> => (s) => s.domain.players[key]);

/** Ids of the matches on `day` (-1 yesterday, 0 today, 1 tomorrow), in feed order. */
export const selectMatchIdsByDay = perKey((day: number) =>
  derivedList((s) => s.domain.matchOrder.filter((id) => s.domain.matches[id]?.day === day)),
);

/** Ids of the live matches, in feed order. */
export const selectLiveMatchIds: Selector<readonly number[]> = derivedList((s) =>
  s.domain.matchOrder.filter((id) => s.domain.matches[id]?.status === 'live'),
);

/**
 * The match the desktop opens in its match pane on load (ARCHITECTURE §6): the featured one, else
 * the first live match, else the first of today, else the first. Undefined before any feed.
 */
export const selectFeaturedMatchId: Selector<number | undefined> = (s) => {
  const { matches, matchOrder } = s.domain;
  return (
    matchOrder.find((id) => matches[id]?.featured) ??
    matchOrder.find((id) => matches[id]?.status === 'live') ??
    matchOrder.find((id) => matches[id]?.day === 0) ??
    matchOrder[0]
  );
};

/**
 * A match `team` plays in, for a player opened without one: live first, then today's, then the
 * first in feed order.
 */
export const selectMatchIdOfTeam = perKey((team: string): Selector<number | undefined> => (s) => {
  const { matches, matchOrder } = s.domain;
  const plays = (id: number) => matches[id]?.home === team || matches[id]?.away === team;
  return (
    matchOrder.find((id) => plays(id) && matches[id]?.status === 'live') ??
    matchOrder.find((id) => plays(id) && matches[id]?.day === 0) ??
    matchOrder.find(plays)
  );
});
