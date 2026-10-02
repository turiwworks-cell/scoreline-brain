// The one Zustand store (ARCHITECTURE §1, §4). Three slices, each replaced only when it really
// changed so selectors on the others don't fire:
// - `domain`: the normalized state from src/domain. Only applyFeed / applyEvent produce it, and
//   their structural sharing decides identity: an unchanged poll returns the same object and the
//   store doesn't update at all.
// - `sync`: connection status from the Source. Kept apart from match data, and only replaced on a
//   transition (never per poll).
// - `moments`: moments from the domain not yet taken by the MomentDirector (Part 17).
//
// Prefs (the followed player) arrive with the features that need them.

import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { applyEvent, applyFeed, emptyState, type DomainState, type Feed, type LiveEvent, type Moment } from '../domain';
import type { SyncStatus } from '../data/source';

/** Moments kept for the MomentDirector. Past this the oldest go (it collapses floods anyway). */
export const MAX_MOMENTS = 100;

const NO_MOMENTS: readonly Moment[] = [];
const IDLE: SyncStatus = { phase: 'idle', feedError: false };

export interface ScorelineActions {
  /** Applies a parsed feed. `now` is epoch ms. No-op (no store update) when nothing changed. */
  applyFeed(feed: Feed, now?: number): void;
  /** Applies one parsed live event. `now` is epoch ms. No-op when nothing changed. */
  applyEvent(event: LiveEvent, now?: number): void;
  /** Records a connection status. No-op when it equals the current one. */
  setSync(status: SyncStatus): void;
  /** Returns the queued moments, oldest first, and empties the queue. */
  takeMoments(): readonly Moment[];
}

export interface ScorelineState {
  readonly domain: DomainState;
  readonly sync: SyncStatus;
  readonly moments: readonly Moment[];
  /** Stable for the store's lifetime: selecting it never re-renders. */
  readonly actions: ScorelineActions;
}

export type ScorelineStore = StoreApi<ScorelineState>;

export function createScorelineStore(initial: DomainState = emptyState()): ScorelineStore {
  return createStore<ScorelineState>()((set, get) => {
    const commit = (domain: DomainState, moments: readonly Moment[]): void => {
      const cur = get();
      if (domain === cur.domain && moments.length === 0) return;
      set({
        ...(domain !== cur.domain ? { domain } : {}),
        ...(moments.length > 0 ? { moments: [...cur.moments, ...moments].slice(-MAX_MOMENTS) } : {}),
      });
    };

    return {
      domain: initial,
      sync: IDLE,
      moments: NO_MOMENTS,
      actions: {
        applyFeed(feed, now = Date.now()) {
          const r = applyFeed(get().domain, feed, now);
          commit(r.state, r.moments);
        },
        applyEvent(event, now = Date.now()) {
          const r = applyEvent(get().domain, event, now);
          commit(r.state, r.moments);
        },
        setSync(status) {
          const cur = get().sync;
          if (cur.phase === status.phase && cur.feedError === status.feedError) return;
          set({ sync: { phase: status.phase, feedError: status.feedError } });
        },
        takeMoments() {
          const q = get().moments;
          if (q.length > 0) set({ moments: NO_MOMENTS });
          return q;
        },
      },
    };
  });
}

/** The app's store. Tests make their own with `createScorelineStore`. */
export const scorelineStore: ScorelineStore = createScorelineStore();

/** Reads the app store through a selector from ./selectors (see the conventions there). */
export function useScoreline<T>(selector: (state: ScorelineState) => T): T {
  return useStore(scorelineStore, selector);
}
