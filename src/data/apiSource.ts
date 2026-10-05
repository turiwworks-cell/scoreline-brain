// ApiSource: the real Source. Polls `/feed` with ETags and follows `/events` over SSE.
//
// Lifecycle (docs/DATA-CONTRACT.md §4, ARCHITECTURE §4):
// - Poll: one request at a time, the next one 15 s after the last one settles. While the stream
//   is trusted a poll is conditional (`If-None-Match`), so an unchanged feed costs a 304 and no
//   parsing at all.
// - Stream: one connection at a time. When it drops, a single retry is scheduled with
//   exponential backoff and jitter. The retry sends the last SSE id it saw (`Last-Event-ID`).
// - Resync: every time the stream (re)opens there may be a gap behind it, so its events are held
//   back until a full, unconditional feed requested after that open has landed. Then the held
//   events go through in order and the stream counts as trusted. Polls carry on meanwhile.
// - Hidden tab or offline: everything stops (poll, stream, retry). On visible or online, a fetch
//   goes out at once and the stream reconnects, which starts a resync.
// - stop(): clears every timer, aborts the request in flight, closes the stream and removes the
//   environment listeners. Callbacks that arrive late from the old run are ignored.

import { createFeedParser, parseEvent, type LiveEvent } from '../domain';
import { backoffDelay, DEFAULT_BACKOFF, type BackoffOptions } from './backoff';
import { browserEnvironment, realScheduler, type EnvironmentChange, type Scheduler, type SyncEnvironment, type TimerHandle } from './environment';
import { IDLE_STATUS, type EventHandler, type FeedHandler, type Source, type StatusHandler, type SyncPhase, type SyncStatus } from './source';
import type { FeedResponse, StreamHandle, Transport } from './transport';

export const POLL_MS = 15_000;
/** Events held during a resync. Past this the oldest go: the resync feed covers them anyway. */
const MAX_HELD = 500;

export interface ApiSourceOptions {
  readonly transport: Transport;
  readonly environment?: SyncEnvironment;
  readonly scheduler?: Scheduler;
  /** In [0, 1). Drives the backoff jitter. */
  readonly random?: () => number;
  readonly pollMs?: number;
  readonly backoff?: BackoffOptions;
  readonly maxHeld?: number;
}

interface Handlers {
  readonly onFeed: FeedHandler;
  readonly onEvent: EventHandler;
  readonly onStatus: StatusHandler | undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function decodeEvent(data: string): LiveEvent | undefined {
  try {
    return parseEvent(JSON.parse(data));
  } catch {
    return undefined;
  }
}

export function createApiSource(options: ApiSourceOptions): Source {
  const { transport } = options;
  const env = options.environment ?? browserEnvironment();
  const sched = options.scheduler ?? realScheduler;
  const random = options.random ?? Math.random;
  const pollMs = options.pollMs ?? POLL_MS;
  const backoff = options.backoff ?? DEFAULT_BACKOFF;
  const maxHeld = options.maxHeld ?? MAX_HELD;
  let readFeed = createFeedParser();

  // ── Run state. `session` bumps on every start and stop; async work from an older session is
  // dropped on arrival.
  let session = 0;
  let running = false;
  let handlers: Handlers | null = null;
  let unsubscribeEnv: (() => void) | null = null;
  let suspended: 'hidden' | 'offline' | null = null;
  let lastStatus: SyncStatus = IDLE_STATUS;

  // ── Poll.
  let etag: string | undefined;
  let pollTimer: TimerHandle | null = null;
  let inFlight: { readonly token: number; readonly ctl: AbortController } | null = null;
  let requestToken = 0;
  let refetchQueued = false;
  let feedError = false;

  // ── Stream. `streamToken` bumps whenever the current connection is replaced or closed.
  let stream: StreamHandle | null = null;
  let streamToken = 0;
  let streamOpen = false;
  let lastEventId: string | undefined;
  let reconnectTimer: TimerHandle | null = null;
  let attempts = 0;
  /** Bumps on every stream open. A feed proves a resync only if requested after the latest open. */
  let openGen = 0;
  let trusted = false;
  let held: LiveEvent[] = [];

  const requested = new Set<number>();

  function phase(): SyncPhase {
    if (!running) return 'idle';
    if (suspended === 'hidden') return 'paused';
    if (suspended === 'offline') return 'offline';
    if (streamOpen) return trusted ? 'live' : 'resyncing';
    if (reconnectTimer !== null) return 'reconnecting';
    return 'connecting';
  }

  function emitStatus(): void {
    const next: SyncStatus = { phase: phase(), feedError };
    if (next.phase === lastStatus.phase && next.feedError === lastStatus.feedError) return;
    lastStatus = next;
    handlers?.onStatus?.(next);
  }

  function suspendReason(): 'hidden' | 'offline' | null {
    if (env.isHidden()) return 'hidden';
    if (!env.isOnline()) return 'offline';
    return null;
  }

  // ── Poll ───────────────────────────────────────────────────────────────────

  function clearPoll(): void {
    if (pollTimer !== null) sched.clearTimeout(pollTimer);
    pollTimer = null;
  }

  function schedulePoll(): void {
    clearPoll();
    if (!running || suspended) return;
    pollTimer = sched.setTimeout(() => {
      pollTimer = null;
      fetchNow();
    }, pollMs);
  }

  function abortFetch(): void {
    inFlight?.ctl.abort();
    inFlight = null;
    refetchQueued = false;
  }

  /** Fetches the feed now. With a request already in flight, one more follows it. */
  function fetchNow(): void {
    if (!running || suspended) return;
    clearPoll();
    if (inFlight) {
      refetchQueued = true;
      return;
    }
    const s = session;
    const token = ++requestToken;
    const ctl = new AbortController();
    // Untrusted means we may have missed events: take the whole feed, not a 304.
    const conditional = trusted && etag !== undefined;
    const gen = openGen;
    const afterOpen = streamOpen;
    inFlight = { token, ctl };
    let request: Promise<FeedResponse>;
    try {
      request = transport.fetchFeed(conditional ? { etag: etag as string, signal: ctl.signal } : { signal: ctl.signal });
    } catch (err) {
      request = Promise.reject(err);
    }
    request.then(
      (res) => settled(s, token, res, conditional, gen, afterOpen),
      () => settled(s, token, undefined, conditional, gen, afterOpen),
    );
  }

  function settled(s: number, token: number, res: FeedResponse | undefined, conditional: boolean, gen: number, afterOpen: boolean): void {
    if (s !== session || inFlight?.token !== token) return;
    inFlight = null;
    feedError = res === undefined;

    if (res?.status === 'ok') {
      const unchanged = conditional && res.etag !== undefined && res.etag === etag;
      if (!unchanged) {
        if (!isPlainObject(res.body)) {
          // An error page or `null` must not read as "every match is gone".
          feedError = true;
        } else {
          etag = res.etag;
          handlers?.onFeed(readFeed(res.body));
          if (s !== session) return; // the handler stopped us
          if (!trusted && afterOpen && streamOpen && gen === openGen) {
            trusted = true;
            attempts = 0;
            flushHeld(s);
            if (s !== session) return;
          }
        }
      }
    }

    if (refetchQueued) {
      refetchQueued = false;
      fetchNow();
    } else {
      schedulePoll();
    }
    emitStatus();
  }

  function flushHeld(s: number): void {
    const queue = held;
    held = [];
    for (const ev of queue) {
      if (s !== session || !handlers) return;
      handlers.onEvent(ev);
    }
  }

  // ── Stream ─────────────────────────────────────────────────────────────────

  function clearReconnect(): void {
    if (reconnectTimer !== null) sched.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function closeStream(): void {
    streamToken += 1;
    const old = stream;
    stream = null;
    streamOpen = false;
    trusted = false;
    held = [];
    old?.close();
  }

  function connect(): void {
    if (!running || suspended || stream || reconnectTimer !== null) return;
    const s = session;
    const t = ++streamToken;
    const mine = () => s === session && t === streamToken;
    const handle = transport.openStream({
      ...(lastEventId !== undefined ? { lastEventId } : {}),
      onOpen() {
        if (!mine() || streamOpen) return;
        streamOpen = true;
        trusted = false;
        openGen += 1;
        fetchNow();
        emitStatus();
      },
      onMessage(data, id) {
        if (!mine()) return;
        if (id !== undefined) lastEventId = id;
        const ev = decodeEvent(data);
        if (!ev) return;
        if (trusted) {
          handlers?.onEvent(ev);
        } else {
          held.push(ev);
          if (held.length > maxHeld) held.shift();
        }
      },
      onError() {
        if (!mine()) return;
        closeStream();
        scheduleReconnect();
        emitStatus();
      },
    });
    // The transport may have failed synchronously and been replaced already.
    if (mine()) stream = handle;
    else handle.close();
  }

  function scheduleReconnect(): void {
    if (!running || suspended || stream || reconnectTimer !== null) return;
    const delay = backoffDelay(attempts, random, backoff);
    attempts += 1;
    reconnectTimer = sched.setTimeout(() => {
      reconnectTimer = null;
      connect();
      emitStatus();
    }, delay);
  }

  // ── Visibility and network ─────────────────────────────────────────────────

  function suspend(): void {
    clearPoll();
    abortFetch();
    clearReconnect();
    closeStream();
    attempts = 0;
  }

  function resume(): void {
    fetchNow();
    connect();
  }

  function onEnvironment(change: EnvironmentChange): void {
    if (!running) return;
    const next = suspendReason();
    if (next !== suspended) {
      suspended = next;
      if (next) suspend();
      else resume();
    } else if (!next && change === 'online') {
      // Back online without having been marked offline: don't wait out a poll or a backoff.
      fetchNow();
      if (reconnectTimer !== null) {
        clearReconnect();
        connect();
      }
    }
    emitStatus();
  }

  return {
    start(onFeed, onEvent, onStatus) {
      if (running) return;
      running = true;
      session += 1;
      readFeed = createFeedParser();
      handlers = { onFeed, onEvent, onStatus };
      lastStatus = IDLE_STATUS;
      feedError = false;
      unsubscribeEnv = env.subscribe(onEnvironment);
      suspended = suspendReason();
      if (!suspended) resume();
      emitStatus();
    },

    stop() {
      if (!running) return;
      running = false;
      session += 1;
      clearPoll();
      abortFetch();
      clearReconnect();
      closeStream();
      attempts = 0;
      unsubscribeEnv?.();
      unsubscribeEnv = null;
      suspended = null;
      emitStatus();
      handlers = null;
      readFeed = createFeedParser();
    },

    ensureMatchDetails(id) {
      // Contract v2 has no details endpoint: `/feed` already carries line-ups, stats, events and
      // player numbers for every match. Recorded so a later details endpoint (Part 22) fetches
      // each match once.
      requested.add(id);
    },
  };
}
