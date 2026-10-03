// The list's memory of fresh goals. The domain derives goal moments once per event (deduped by
// event id, ARCHITECTURE §4.2); this watches the store's moment queue and keeps, per match, when
// the latest one landed and for which side, so the cards and rows can play their choreography
// from it. It only reads: the queue belongs to the MomentDirector (Part 17), which empties it.

import { useSyncExternalStore } from 'react';
import type { Moment, Side } from '../../domain';
import { scorelineStore } from '../../store';
import { markLife, type GoalMark } from './goalFeel';

type Listener = () => void;

export interface Clock {
  /** seconds, on any steady scale */
  now(): number;
}

export const performanceClock: Clock = { now: () => (typeof performance === 'undefined' ? Date.now() : performance.now()) / 1000 };

export interface GoalFeed {
  /** the latest goal of a match, if any */
  mark(matchId: number): GoalMark | undefined;
  /** every match's latest goal */
  marks(): ReadonlyMap<number, GoalMark>;
  /** the match whose goal landed last */
  latest(): { id: number; mark: GoalMark } | undefined;
  record(matchId: number, side: Side, at?: number): void;
  /** a goal was taken back (VAR): the mark goes with it */
  clear(matchId: number): void;
  /** true while any mark is still playing at `now` */
  active(now: number): boolean;
  subscribe(listener: Listener): () => void;
  /** Reads goal moments off a store's queue. Returns the unsubscribe. */
  watch(source: MomentSource): () => void;
  readonly clock: Clock;
}

export interface MomentSource {
  getState(): { moments: readonly Moment[]; session?: number };
  subscribe(listener: (state: { moments: readonly Moment[]; session?: number }, prev: { moments: readonly Moment[]; session?: number }) => void): () => void;
}

const SEEN_CAP = 400;

/**
 * Calls `handle` once for each moment that appears in a store's queue from now on. The queue is
 * the MomentDirector's to empty (Part 17); this only looks, and remembers ids so a moment is never
 * seen twice. Returns the unsubscribe.
 */
export function watchMoments(source: MomentSource, handle: (moment: Moment) => void, onReset?: () => void): () => void {
  const seen = new Set<string>();
  const take = (moments: readonly Moment[]) => {
    for (const mo of moments) {
      if (seen.has(mo.id)) continue;
      seen.add(mo.id);
      if (seen.size > SEEN_CAP) seen.delete(seen.values().next().value as string);
      handle(mo);
    }
  };
  // moments already queued when this starts are old news: remember them, handle none
  for (const mo of source.getState().moments) seen.add(mo.id);
  return source.subscribe((state, prev) => {
    if (state.session !== prev.session) {
      seen.clear();
      onReset?.();
    }
    if (state.moments !== prev.moments) take(state.moments);
  });
}

export function createGoalFeed(clock: Clock = performanceClock): GoalFeed {
  const marks = new Map<number, GoalMark>();
  const listeners = new Set<Listener>();
  let n = 0;
  let last: { id: number; mark: GoalMark } | undefined;

  const emit = () => {
    for (const l of [...listeners]) l();
  };

  const feed: GoalFeed = {
    clock,
    mark: (id) => marks.get(id),
    marks: () => marks,
    latest: () => last,
    record(matchId, side, at = clock.now()) {
      const mark: GoalMark = { t: at, side, n: ++n };
      marks.set(matchId, mark);
      last = { id: matchId, mark };
      emit();
    },
    clear(matchId) {
      if (!marks.delete(matchId)) return;
      if (last?.id === matchId) {
        last = undefined;
        for (const [id, mark] of marks) if (!last || mark.t > last.mark.t) last = { id, mark };
      }
      emit();
    },
    active(now) {
      const life = markLife();
      for (const m of marks.values()) if (now - m.t < life) return true;
      return false;
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    watch(source) {
      return watchMoments(
        source,
        (mo) => {
          if (mo.kind === 'goal' && mo.side) feed.record(mo.matchId, mo.side);
          else if (mo.kind === 'goalCancelled') feed.clear(mo.matchId);
        },
        () => {
          if (marks.size === 0) return;
          marks.clear();
          last = undefined;
          emit();
        },
      );
    },
  };
  return feed;
}

/** The app's feed. */
export const goalFeed = createGoalFeed();

/** Starts reading the app store's moments for as long as `feed` is the app's own. */
export function watchAppGoals(feed: GoalFeed = goalFeed): () => void {
  return feed.watch(scorelineStore);
}

/** One match's latest goal; re-renders only when that match scores. */
export function useGoalMark(matchId: number, feed: GoalFeed = goalFeed): GoalMark | undefined {
  return useSyncExternalStore(
    feed.subscribe,
    () => feed.mark(matchId),
    () => undefined,
  );
}
