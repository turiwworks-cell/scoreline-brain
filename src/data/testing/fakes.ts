// Deterministic stand-ins for the network, the clock and the page, for sync tests. Nothing here
// waits on real time: timers fire only when a test advances the fake clock, and every feed
// request stays pending until the test answers it.

import type { EnvironmentChange, Scheduler, SyncEnvironment, TimerHandle } from '../environment';
import type { FeedRequest, FeedResponse, StreamCallbacks, StreamHandle, Transport } from '../transport';

// ── Clock ────────────────────────────────────────────────────────────────────

interface Timer {
  readonly id: number;
  readonly at: number;
  readonly fn: () => void;
}

export class FakeScheduler implements Scheduler {
  private time: number;
  private nextId = 1;
  private timers: Timer[] = [];

  constructor(start = 1_760_000_000_000) {
    this.time = start;
  }

  setTimeout(fn: () => void, ms: number): TimerHandle {
    const id = this.nextId++;
    this.timers.push({ id, at: this.time + Math.max(0, ms), fn });
    return id;
  }

  clearTimeout(handle: TimerHandle): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }

  now(): number {
    return this.time;
  }

  /** Timers waiting to fire. */
  get pending(): number {
    return this.timers.length;
  }

  /** Delays (ms from now) of the waiting timers, soonest first. */
  get delays(): number[] {
    return this.timers.map((t) => t.at - this.time).sort((a, b) => a - b);
  }

  /** Moves the clock forward, firing each timer that comes due, in order. */
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.time = due.at;
      due.fn();
    }
    this.time = end;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export class FakeEnvironment implements SyncEnvironment {
  hidden = false;
  online = true;
  private listeners = new Set<(change: EnvironmentChange) => void>();

  isHidden(): boolean {
    return this.hidden;
  }

  isOnline(): boolean {
    return this.online;
  }

  subscribe(listener: (change: EnvironmentChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.emit('visibility');
  }

  setOnline(online: boolean): void {
    this.online = online;
    this.emit(online ? 'online' : 'offline');
  }

  emit(change: EnvironmentChange): void {
    for (const l of [...this.listeners]) l(change);
  }
}

// ── Network ──────────────────────────────────────────────────────────────────

export interface PendingFeed {
  readonly etag: string | undefined;
  readonly signal: AbortSignal;
  /** Answers with a body (200). */
  ok(body: unknown, etag?: string): void;
  notModified(): void;
  fail(error?: Error): void;
  readonly settled: boolean;
}

export class FakeStream implements StreamHandle {
  closed = false;
  opened = false;

  constructor(
    readonly lastEventId: string | undefined,
    private readonly callbacks: StreamCallbacks,
  ) {}

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.opened = true;
    this.callbacks.onOpen();
  }

  /** Sends one SSE message: `data` is JSON-encoded unless it's already a string. */
  send(data: unknown, id?: string): void {
    this.callbacks.onMessage(typeof data === 'string' ? data : JSON.stringify(data), id);
  }

  /** The connection drops. */
  error(): void {
    this.callbacks.onError();
  }
}

export class FakeTransport implements Transport {
  readonly requests: PendingFeed[] = [];
  readonly streams: FakeStream[] = [];

  fetchFeed({ etag, signal }: FeedRequest): Promise<FeedResponse> {
    return new Promise<FeedResponse>((resolve, reject) => {
      let settled = false;
      const once = (fn: () => void) => {
        if (settled) throw new Error('feed request already answered');
        settled = true;
        fn();
      };
      this.requests.push({
        etag,
        signal,
        ok: (body, tag) => once(() => resolve(tag === undefined ? { status: 'ok', body } : { status: 'ok', body, etag: tag })),
        notModified: () => once(() => resolve({ status: 'not-modified' })),
        fail: (error = new Error('network')) => once(() => reject(error)),
        get settled() {
          return settled;
        },
      });
    });
  }

  openStream(callbacks: StreamCallbacks): StreamHandle {
    const s = new FakeStream(callbacks.lastEventId, callbacks);
    this.streams.push(s);
    return s;
  }

  /** The most recent feed request. */
  get lastRequest(): PendingFeed {
    const r = this.requests.at(-1);
    if (!r) throw new Error('no feed request yet');
    return r;
  }

  /** The most recent stream. */
  get lastStream(): FakeStream {
    const s = this.streams.at(-1);
    if (!s) throw new Error('no stream yet');
    return s;
  }

  /** Requests not yet answered and not aborted. */
  get inFlight(): PendingFeed[] {
    return this.requests.filter((r) => !r.settled && !r.signal.aborted);
  }

  /** Streams not closed by the source. */
  get openStreams(): FakeStream[] {
    return this.streams.filter((s) => !s.closed);
  }
}

/** Lets pending promise callbacks run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
