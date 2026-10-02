import { describe, expect, it, vi } from 'vitest';
import type { Feed, LiveEvent } from '../domain';
import { parseFeed } from '../domain';
import { createScorelineStore } from '../store';
import { createApiSource, POLL_MS } from './apiSource';
import type { Source, StatusHandler } from './source';
import { connectSource } from './sync';
import { FakeEnvironment, FakeScheduler, FakeTransport, flush } from './testing/fakes';

const body = (score: [number, number] = [0, 0]) => ({
  version: 2,
  teams: [
    { id: 'ars', name: 'Arsenal', colors: ['#EF0107', '#FFFFFF'] },
    { id: 'che', name: 'Chelsea', colors: ['#034694', '#FFFFFF'] },
  ],
  matches: [{ id: 501, seq: 1, league: 'epl', home: 'ars', away: 'che', status: 'live', minute: 60, second: 0, score, events: [] }],
});

/** A Source the test drives by hand. */
class FakeSource implements Source {
  onFeed: ((f: Feed) => void) | undefined;
  onEvent: ((e: LiveEvent) => void) | undefined;
  onStatus: StatusHandler | undefined;
  starts = 0;
  stops = 0;
  details: number[] = [];
  start(onFeed: (f: Feed) => void, onEvent: (e: LiveEvent) => void, onStatus?: StatusHandler) {
    this.starts += 1;
    this.onFeed = onFeed;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }
  stop() {
    this.stops += 1;
  }
  ensureMatchDetails(id: number) {
    this.details.push(id);
  }
}

describe('connectSource', () => {
  it('feeds the store through its actions and stops the source once', () => {
    const store = createScorelineStore();
    const source = new FakeSource();
    const conn = connectSource(source, store.getState().actions, () => 1_760_000_000_000);
    expect(source.starts).toBe(1);
    source.onFeed?.(parseFeed(body([2, 1])));
    expect(store.getState().domain.matches[501]?.score).toEqual([2, 1]);
    source.onStatus?.({ phase: 'live', feedError: false });
    expect(store.getState().sync.phase).toBe('live');
    conn.ensureMatchDetails(501);
    expect(source.details).toEqual([501]);
    conn.disconnect();
    conn.disconnect();
    conn.ensureMatchDetails(502);
    expect(source.stops).toBe(1);
    expect(source.details).toEqual([501]);
  });

  it('polls that bring no domain change cause no store update, end to end', async () => {
    const store = createScorelineStore();
    const transport = new FakeTransport();
    const sched = new FakeScheduler();
    const source = createApiSource({ transport, environment: new FakeEnvironment(), scheduler: sched, random: () => 0.5 });
    connectSource(source, store.getState().actions, () => sched.now());
    transport.lastRequest.ok(body(), '"a"');
    await flush();
    transport.lastStream.open();
    transport.lastRequest.ok(body(), '"a"');
    await flush();
    expect(store.getState().sync.phase).toBe('live');

    const listener = vi.fn();
    store.subscribe(listener);
    // A 304.
    sched.advance(POLL_MS);
    transport.lastRequest.notModified();
    await flush();
    // A 200 with a new ETag but the same content (the server re-rendered it).
    sched.advance(POLL_MS);
    transport.lastRequest.ok(body(), '"b"');
    await flush();
    // Another one, after the clock has run on: the match clock still agrees, so nothing moves.
    sched.advance(POLL_MS);
    transport.lastRequest.ok({ ...body(), matches: [{ ...body().matches[0], minute: 60, second: 45 }] }, '"c"');
    await flush();
    expect(listener).not.toHaveBeenCalled();

    // A real change does update.
    sched.advance(POLL_MS);
    transport.lastRequest.ok(body([1, 0]), '"d"');
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().domain.matches[501]?.score).toEqual([1, 0]);
  });
});
