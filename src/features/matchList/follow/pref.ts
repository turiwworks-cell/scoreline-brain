// The player you follow, kept in localStorage until accounts exist (ARCHITECTURE §4.5). One at a time.
// Not following anyone is a choice worth keeping: it is stored as "none", so the default player
// (the demo follows Argentina's 10) doesn't come back after an Unfollow.

import { useSyncExternalStore } from 'react';
import { sameFollowed, type Followed } from './model';

export const FOLLOW_KEY = 'scoreline:follow';

export interface FollowPref {
  get(): Followed | null;
  set(f: Followed | null): void;
  subscribe(l: () => void): () => void;
}

function parse(raw: string | null, fallback: Followed | null): Followed | null {
  if (raw === null) return fallback;
  if (raw === 'none') return null;
  try {
    const v = JSON.parse(raw) as { team?: unknown; n?: unknown };
    if (typeof v.team === 'string' && typeof v.n === 'number' && Number.isFinite(v.n)) return { team: v.team, n: v.n };
  } catch {
    /* fall through */
  }
  return fallback;
}

export function createFollowPref(fallback: Followed | null, storage?: Pick<Storage, 'getItem' | 'setItem'>): FollowPref {
  const listeners = new Set<() => void>();
  // the last value read, so the same player is the same object between reads
  let cached: Followed | null | undefined;
  let cachedRaw: string | null | undefined;
  let memory: string | null = null;

  const read = (): string | null => {
    try {
      return storage ? storage.getItem(FOLLOW_KEY) : memory;
    } catch {
      return memory;
    }
  };

  return {
    get() {
      const raw = read();
      if (cached === undefined || raw !== cachedRaw) {
        cachedRaw = raw;
        cached = parse(raw, fallback);
      }
      return cached;
    },
    set(f) {
      const raw = f ? JSON.stringify({ team: f.team, n: f.n }) : 'none';
      memory = raw;
      try {
        storage?.setItem(FOLLOW_KEY, raw);
      } catch {
        /* private window: kept for this visit only */
      }
      for (const l of [...listeners]) l();
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

const browserStorage = (): Pick<Storage, 'getItem' | 'setItem'> | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

let appPref: FollowPref | undefined;
let appFallback: Followed | null = null;

/** The app's preference. The fallback is the player followed before anyone has been chosen. */
export function followPref(fallback: Followed | null): FollowPref {
  if (!appPref || !sameFollowed(appFallback, fallback)) {
    appFallback = fallback;
    appPref = createFollowPref(fallback, browserStorage());
  }
  return appPref;
}

export function useFollowed(pref: FollowPref): Followed | null {
  return useSyncExternalStore(pref.subscribe, pref.get, () => null);
}
