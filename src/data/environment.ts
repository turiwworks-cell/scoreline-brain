// What the sync service needs from the outside world besides the network, injectable so tests
// run on a fake clock and a fake document.

export type TimerHandle = unknown;

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  /** Epoch ms. */
  now(): number;
}

export type EnvironmentChange = 'visibility' | 'online' | 'offline';

export interface SyncEnvironment {
  isHidden(): boolean;
  isOnline(): boolean;
  /** Listens for tab visibility and network changes. Returns the one call that removes them all. */
  subscribe(listener: (change: EnvironmentChange) => void): () => void;
}

export const realScheduler: Scheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
  now: () => Date.now(),
};

/** The page's visibility and `navigator.onLine`. Outside a browser: always visible and online. */
export function browserEnvironment(): SyncEnvironment {
  const doc = typeof document !== 'undefined' ? document : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;
  return {
    isHidden: () => doc?.visibilityState === 'hidden',
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    subscribe(listener) {
      const onVisibility = () => listener('visibility');
      const onOnline = () => listener('online');
      const onOffline = () => listener('offline');
      doc?.addEventListener('visibilitychange', onVisibility);
      win?.addEventListener('online', onOnline);
      win?.addEventListener('offline', onOffline);
      return () => {
        doc?.removeEventListener('visibilitychange', onVisibility);
        win?.removeEventListener('online', onOnline);
        win?.removeEventListener('offline', onOffline);
      };
    },
  };
}
