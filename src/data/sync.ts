// Wires a Source to whatever applies its output (the store's actions satisfy `SyncTarget`).
// data/ doesn't import store/: the target is described here by shape.

import type { Feed, LiveEvent } from '../domain';
import type { Source, SyncStatus } from './source';

export interface SyncTarget {
  applyFeed(feed: Feed, now: number): void;
  applyEvent(event: LiveEvent, now: number): void;
  setSync(status: SyncStatus): void;
}

export interface Connection {
  /** Forwards to the source; call when a match opens. */
  ensureMatchDetails(id: number): void;
  /** Stops the source. Safe to call more than once. */
  disconnect(): void;
}

/** Starts `source` feeding `target`. `now` stamps each update (epoch ms). */
export function connectSource(source: Source, target: SyncTarget, now: () => number = Date.now): Connection {
  let connected = true;
  source.start(
    (feed) => target.applyFeed(feed, now()),
    (event) => target.applyEvent(event, now()),
    (status) => target.setSync(status),
  );
  return {
    ensureMatchDetails: (id) => {
      if (connected) source.ensureMatchDetails(id);
    },
    disconnect: () => {
      if (!connected) return;
      connected = false;
      source.stop();
    },
  };
}
