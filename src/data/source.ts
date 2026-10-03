// The one interface every data source implements (ARCHITECTURE §4.7): `ApiSource` (real, poll +
// SSE) and, in Part 5, `DemoSource`. A source hands over parsed contract values; it never touches
// the store. `connectSource` (./sync) wires one to the store.

import type { Feed, LiveEvent } from '../domain';

/** `reset` begins a fresh demo evening; it is local delivery metadata, never a wire field. */
export type FeedHandler = (feed: Feed, options?: { readonly reset: true }) => void;
export type EventHandler = (event: LiveEvent) => void;
export type StatusHandler = (status: SyncStatus) => void;

/**
 * Where the connection stands. Changes only on a transition, never per poll.
 * - `idle`: not started, or stopped.
 * - `connecting`: started, waiting for the first feed or the stream.
 * - `resyncing`: the stream is (re)open but a full feed fetched after it hasn't landed yet, so
 *   live events are held back.
 * - `live`: the stream is open and trusted.
 * - `reconnecting`: the stream dropped; a retry is scheduled. Polling carries on meanwhile.
 * - `paused`: the tab is hidden. No network activity.
 * - `offline`: the browser reports no network. No network activity.
 */
export type SyncPhase = 'idle' | 'connecting' | 'resyncing' | 'live' | 'reconnecting' | 'paused' | 'offline';

export interface SyncStatus {
  readonly phase: SyncPhase;
  /** The last feed request failed (network error, HTTP error, unreadable body). */
  readonly feedError: boolean;
}

export const IDLE_STATUS: SyncStatus = { phase: 'idle', feedError: false };

export interface Source {
  /**
   * Begins delivering. Calling it again while started does nothing: stop first. `onStatus` is
   * optional; sources without a connection (DemoSource) may never call it.
   */
  start(onFeed: FeedHandler, onEvent: EventHandler, onStatus?: StatusHandler): void;
  /** Stops everything the source started: timers, connections, listeners, pending retries. */
  stop(): void;
  /** Asks for a match's details (line-ups, stats) when it opens. Idempotent per id. */
  ensureMatchDetails(id: number): void;
}
