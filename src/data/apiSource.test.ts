import { describe, expect, it } from 'vitest';
import type { Feed, LiveEvent } from '../domain';
import { createApiSource, POLL_MS } from './apiSource';
import { backoffDelay } from './backoff';
import type { SyncPhase } from './source';
import { FakeEnvironment, FakeScheduler, FakeTransport, flush } from './testing/fakes';

const BACKOFF = { baseMs: 1000, maxMs: 30_000 };

function body(score: [number, number] = [0, 0], seq = 1) {
  return {
    version: 2,
    teams: [
      { id: 'ars', name: 'Arsenal', colors: ['#EF0107', '#FFFFFF'] },
      { id: 'che', name: 'Chelsea', colors: ['#034694', '#FFFFFF'] },
    ],
    matches: [{ id: 501, seq, league: 'epl', home: 'ars', away: 'che', status: 'live', minute: 60, score, events: [] }],
  };
}

const goal = (id: string, seq: number) => ({ id, seq, match: 501, kind: 'goal', side: 'home', minute: 61, score: [seq, 0] });

function setup(opts: { hidden?: boolean; online?: boolean } = {}) {
  const transport = new FakeTransport();
  const env = new FakeEnvironment();
  env.hidden = opts.hidden ?? false;
  env.online = opts.online ?? true;
  const sched = new FakeScheduler();
  const source = createApiSource({ transport, environment: env, scheduler: sched, random: () => 0.5, backoff: BACKOFF });
  const feeds: Feed[] = [];
  const events: LiveEvent[] = [];
  const phases: SyncPhase[] = [];
  const log: string[] = [];
  const start = () =>
    source.start(
      (f) => {
        feeds.push(f);
        log.push('feed');
      },
      (e) => {
        events.push(e);
        log.push(`event:${e.id ?? ''}`);
      },
      (s) => phases.push(s.phase),
    );
  return { transport, env, sched, source, feeds, events, phases, log, start };
}

/** Starts, answers the first poll, opens the stream and completes its resync: the stream is live. */
async function live(t: ReturnType<typeof setup>) {
  t.start();
  t.transport.lastRequest.ok(body(), '"v1"');
  await flush();
  t.transport.lastStream.open();
  t.transport.lastRequest.ok(body(), '"v1"');
  await flush();
  expect(t.phases.at(-1)).toBe('live');
}

describe('backoffDelay', () => {
  it('doubles up to the cap and keeps half the ceiling fixed', () => {
    expect(backoffDelay(0, () => 0, BACKOFF)).toBe(500);
    expect(backoffDelay(0, () => 0.999, BACKOFF)).toBe(1000);
    expect(backoffDelay(1, () => 0, BACKOFF)).toBe(1000);
    expect(backoffDelay(3, () => 0.5, BACKOFF)).toBe(6000);
    expect(backoffDelay(10, () => 0, BACKOFF)).toBe(15_000);
    expect(backoffDelay(10, () => 0.999, BACKOFF)).toBe(29_985);
    expect(backoffDelay(1000, () => 0, BACKOFF)).toBe(15_000);
  });
});

describe('ApiSource: start and polling', () => {
  it('fetches the feed and opens one stream on start', async () => {
    const t = setup();
    t.start();
    expect(t.transport.requests).toHaveLength(1);
    expect(t.transport.lastRequest.etag).toBeUndefined();
    expect(t.transport.openStreams).toHaveLength(1);
    expect(t.phases).toEqual(['connecting']);
    t.transport.lastRequest.ok(body([1, 0]), '"v1"');
    await flush();
    expect(t.feeds).toHaveLength(1);
    expect(t.feeds[0]?.matches[0]?.score).toEqual([1, 0]);
  });

  it('polls every 15 s, conditionally once the stream is live, and a 304 delivers nothing', async () => {
    const t = setup();
    await live(t);
    const before = t.transport.requests.length;
    expect(t.sched.delays).toEqual([POLL_MS]);
    t.sched.advance(POLL_MS - 1);
    expect(t.transport.requests).toHaveLength(before);
    t.sched.advance(1);
    expect(t.transport.requests).toHaveLength(before + 1);
    expect(t.transport.lastRequest.etag).toBe('"v1"');
    t.transport.lastRequest.notModified();
    await flush();
    expect(t.feeds).toHaveLength(2);
    expect(t.sched.delays).toEqual([POLL_MS]);
  });

  it('skips a 200 that repeats the ETag it was asked about', async () => {
    const t = setup();
    await live(t);
    t.sched.advance(POLL_MS);
    t.transport.lastRequest.ok(body(), '"v1"');
    await flush();
    expect(t.feeds).toHaveLength(2);
  });

  it('never overlaps two feed requests', async () => {
    const t = setup();
    t.start();
    // The first request hangs; nothing is scheduled behind it.
    expect(t.sched.pending).toBe(0);
    t.sched.advance(POLL_MS * 3);
    expect(t.transport.inFlight).toHaveLength(1);
    t.transport.lastRequest.ok(body());
    await flush();
    expect(t.sched.delays).toEqual([POLL_MS]);
  });

  it('treats a failed poll as a feed error, keeps state, and polls again on schedule', async () => {
    const t = setup();
    t.start();
    t.transport.lastRequest.fail();
    await flush();
    expect(t.feeds).toHaveLength(0);
    t.sched.advance(POLL_MS);
    expect(t.transport.requests).toHaveLength(2);
  });

  it('does not deliver a body that is not an object (an error page must not empty the feed)', async () => {
    const t = setup();
    const statuses: boolean[] = [];
    t.source.start(
      (f) => t.feeds.push(f),
      () => {},
      (s) => statuses.push(s.feedError),
    );
    t.transport.lastRequest.ok(null);
    await flush();
    t.sched.advance(POLL_MS);
    t.transport.lastRequest.ok('<html>');
    await flush();
    expect(t.feeds).toHaveLength(0);
    expect(statuses.at(-1)).toBe(true);
    t.sched.advance(POLL_MS);
    t.transport.lastRequest.ok(body());
    await flush();
    expect(t.feeds).toHaveLength(1);
    expect(statuses.at(-1)).toBe(false);
  });

  it('a second start while running does nothing', () => {
    const t = setup();
    t.start();
    t.start();
    expect(t.transport.requests).toHaveLength(1);
    expect(t.transport.streams).toHaveLength(1);
    expect(t.env.listenerCount).toBe(1);
  });
});

describe('ApiSource: stream, resync and reconnect', () => {
  it('holds events until a full feed requested after the stream opened has landed', async () => {
    const t = setup();
    t.start();
    const first = t.transport.lastRequest; // requested before the stream opened
    t.transport.lastStream.open();
    expect(t.phases.at(-1)).toBe('resyncing');
    t.transport.lastStream.send(goal('g1', 2), '2');
    t.transport.lastStream.send(goal('g2', 3), '3');
    first.ok(body(), '"v1"');
    await flush();
    // That feed predates the open, so it doesn't prove anything: events stay held.
    expect(t.events).toHaveLength(0);
    // The resync request was queued behind it and goes out now, unconditionally.
    const resync = t.transport.lastRequest;
    expect(resync).not.toBe(first);
    expect(resync.etag).toBeUndefined();
    resync.ok(body([1, 0], 2), '"v2"');
    await flush();
    expect(t.log).toEqual(['feed', 'feed', 'event:g1', 'event:g2']);
    expect(t.phases.at(-1)).toBe('live');
    // Trusted now: events pass straight through.
    t.transport.lastStream.send(goal('g3', 4), '4');
    expect(t.events.map((e) => e.id)).toEqual(['g1', 'g2', 'g3']);
  });

  it('reconnects after the connection drops, with backoff, resuming from the last event id', async () => {
    const t = setup();
    await live(t);
    t.transport.lastStream.send(goal('g1', 2), '41');
    t.transport.lastStream.send({ match: 501, kind: 'minute', minute: 62 }, '42');
    const dropped = t.transport.lastStream;
    dropped.error();
    expect(dropped.closed).toBe(true);
    expect(t.transport.openStreams).toHaveLength(0);
    expect(t.phases.at(-1)).toBe('reconnecting');
    // Poll timer plus one reconnect timer at 750 ms (attempt 0, jitter 0.5).
    expect(t.sched.delays).toEqual([750, POLL_MS]);
    t.sched.advance(750);
    expect(t.transport.streams).toHaveLength(2);
    expect(t.transport.lastStream.lastEventId).toBe('42');
    expect(t.phases.at(-1)).toBe('connecting');
  });

  it('runs a full resync after a reconnect gap before trusting events again', async () => {
    const t = setup();
    await live(t);
    t.transport.lastStream.error();
    t.sched.advance(750);
    const before = t.transport.requests.length;
    const s2 = t.transport.lastStream;
    s2.open();
    expect(t.phases.at(-1)).toBe('resyncing');
    // A resync request went out at once, without If-None-Match even though an ETag is known.
    expect(t.transport.requests).toHaveLength(before + 1);
    expect(t.transport.lastRequest.etag).toBeUndefined();
    s2.send(goal('g5', 5), '5');
    expect(t.events).toHaveLength(0);
    t.transport.lastRequest.ok(body([4, 0], 4), '"v4"');
    await flush();
    expect(t.log.slice(-2)).toEqual(['feed', 'event:g5']);
    expect(t.phases.at(-1)).toBe('live');
  });

  it('stays untrusted while the resync fetch fails, and retries it on the next poll', async () => {
    const t = setup();
    await live(t);
    t.transport.lastStream.error();
    t.sched.advance(750);
    t.transport.lastStream.open();
    t.transport.lastStream.send(goal('g5', 5), '5');
    t.transport.lastRequest.fail();
    await flush();
    expect(t.events).toHaveLength(0);
    t.sched.advance(POLL_MS);
    expect(t.transport.lastRequest.etag).toBeUndefined();
    t.transport.lastRequest.ok(body([4, 0], 4));
    await flush();
    expect(t.events.map((e) => e.id)).toEqual(['g5']);
  });

  it('drops events held from a connection that dropped (the next resync covers them)', async () => {
    const t = setup();
    t.start();
    t.transport.lastStream.open();
    t.transport.lastStream.send(goal('g1', 2), '2');
    t.transport.lastStream.error();
    t.sched.advance(750);
    t.transport.lastStream.open();
    t.transport.requests.filter((r) => !r.settled).forEach((r) => r.ok(body([1, 0], 2)));
    await flush();
    t.transport.requests.filter((r) => !r.settled).forEach((r) => r.ok(body([1, 0], 2)));
    await flush();
    expect(t.events).toHaveLength(0);
    expect(t.phases.at(-1)).toBe('live');
  });

  it('backs off exponentially while connections keep failing, one connection at a time', async () => {
    const t = setup();
    t.start();
    const delays: number[] = [];
    for (let i = 0; i < 5; i++) {
      t.transport.lastStream.error();
      // Repeated error callbacks from the same dead connection change nothing.
      t.transport.lastStream.error();
      const reconnects = t.sched.delays.filter((d) => d !== POLL_MS);
      expect(reconnects).toHaveLength(1);
      delays.push(reconnects[0] ?? -1);
      t.sched.advance(reconnects[0] ?? 0);
      expect(t.transport.openStreams).toHaveLength(1);
    }
    expect(delays).toEqual([750, 1500, 3000, 6000, 12_000]);
    expect(t.transport.streams).toHaveLength(6);
  });

  it('resets the backoff once a resync succeeds', async () => {
    const t = setup();
    t.start();
    t.transport.lastStream.error();
    t.sched.advance(750);
    t.transport.lastStream.error();
    t.sched.advance(1500);
    t.transport.lastStream.open();
    t.transport.requests.filter((r) => !r.settled).forEach((r) => r.ok(body()));
    await flush();
    t.transport.requests.filter((r) => !r.settled).forEach((r) => r.ok(body()));
    await flush();
    expect(t.phases.at(-1)).toBe('live');
    t.transport.lastStream.error();
    expect(t.sched.delays.filter((d) => d !== POLL_MS)).toEqual([750]);
  });

  it('ignores callbacks from a connection it already replaced', async () => {
    const t = setup();
    await live(t);
    const old = t.transport.lastStream;
    old.error();
    t.sched.advance(750);
    old.send(goal('ghost', 9), '9');
    old.open();
    old.error();
    expect(t.events).toHaveLength(0);
    expect(t.transport.openStreams).toHaveLength(1);
    // Only the poll timer: the old connection's error scheduled no second reconnect.
    expect(t.sched.delays).toEqual([POLL_MS - 750]);
  });

  it('skips stream messages that are not usable events, but still records their id', async () => {
    const t = setup();
    await live(t);
    t.transport.lastStream.send('not json', '7');
    t.transport.lastStream.send({ kind: 'goal' }, '8');
    expect(t.events).toHaveLength(0);
    t.transport.lastStream.error();
    t.sched.advance(750);
    expect(t.transport.lastStream.lastEventId).toBe('8');
  });
});

describe('ApiSource: hidden tab and offline', () => {
  it('pauses all network activity while hidden', async () => {
    const t = setup();
    await live(t);
    const requests = t.transport.requests.length;
    t.env.setHidden(true);
    expect(t.phases.at(-1)).toBe('paused');
    expect(t.transport.openStreams).toHaveLength(0);
    expect(t.sched.pending).toBe(0);
    t.sched.advance(POLL_MS * 10);
    expect(t.transport.requests).toHaveLength(requests);
    expect(t.transport.streams).toHaveLength(1);
  });

  it('aborts the request in flight and cancels a pending reconnect when hidden', async () => {
    const t = setup();
    t.start();
    const req = t.transport.lastRequest;
    t.transport.lastStream.error();
    expect(t.sched.pending).toBe(1);
    t.env.setHidden(true);
    expect(req.signal.aborted).toBe(true);
    expect(t.sched.pending).toBe(0);
    req.ok(body());
    await flush();
    expect(t.feeds).toHaveLength(0);
  });

  it('refetches at once and reconnects (with a resync) when visible again', async () => {
    const t = setup();
    await live(t);
    t.transport.lastStream.send(goal('g1', 2), '12');
    t.env.setHidden(true);
    t.sched.advance(60_000);
    const requests = t.transport.requests.length;
    t.env.setHidden(false);
    expect(t.transport.requests).toHaveLength(requests + 1);
    expect(t.transport.lastRequest.etag).toBeUndefined();
    expect(t.transport.openStreams).toHaveLength(1);
    expect(t.transport.lastStream.lastEventId).toBe('12');
    expect(t.phases.at(-1)).toBe('connecting');
  });

  it('does not refetch on a visibility event that changes nothing', async () => {
    const t = setup();
    await live(t);
    const requests = t.transport.requests.length;
    t.env.setHidden(false);
    t.env.emit('visibility');
    expect(t.transport.requests).toHaveLength(requests);
    expect(t.transport.streams).toHaveLength(1);
  });

  it('starts paused when the tab starts hidden, and makes no request until visible', () => {
    const t = setup({ hidden: true });
    t.start();
    expect(t.transport.requests).toHaveLength(0);
    expect(t.transport.streams).toHaveLength(0);
    expect(t.phases).toEqual(['paused']);
    t.env.setHidden(false);
    expect(t.transport.requests).toHaveLength(1);
    expect(t.transport.streams).toHaveLength(1);
  });

  it('pauses while offline and refetches at once when back online', async () => {
    const t = setup();
    await live(t);
    t.env.setOnline(false);
    expect(t.phases.at(-1)).toBe('offline');
    expect(t.sched.pending).toBe(0);
    expect(t.transport.openStreams).toHaveLength(0);
    const requests = t.transport.requests.length;
    t.sched.advance(POLL_MS * 4);
    expect(t.transport.requests).toHaveLength(requests);
    t.env.setOnline(true);
    expect(t.transport.requests).toHaveLength(requests + 1);
    expect(t.transport.openStreams).toHaveLength(1);
  });

  it('an online event skips the wait on a pending poll and a pending reconnect', async () => {
    const t = setup();
    await live(t);
    t.transport.lastStream.error();
    t.transport.lastStream.error();
    // Never marked offline; the browser just says it's online again.
    const requests = t.transport.requests.length;
    t.env.emit('online');
    expect(t.transport.requests).toHaveLength(requests + 1);
    expect(t.transport.openStreams).toHaveLength(1);
    expect(t.sched.pending).toBe(0);
  });

  it('a hide/show burst leaves exactly one stream and one request', async () => {
    const t = setup();
    await live(t);
    for (let i = 0; i < 5; i++) {
      t.env.setHidden(true);
      t.env.setHidden(false);
    }
    expect(t.transport.openStreams).toHaveLength(1);
    expect(t.transport.inFlight).toHaveLength(1);
    expect(t.sched.pending).toBe(0);
  });
});

describe('ApiSource: stop', () => {
  it('cleans up timers, the stream, the request in flight and the listeners', async () => {
    const t = setup();
    await live(t);
    t.sched.advance(POLL_MS);
    const req = t.transport.lastRequest;
    t.transport.lastStream.error();
    expect(t.sched.pending).toBeGreaterThan(0);
    t.source.stop();
    expect(t.sched.pending).toBe(0);
    expect(t.transport.openStreams).toHaveLength(0);
    expect(req.signal.aborted).toBe(true);
    expect(t.env.listenerCount).toBe(0);
    expect(t.phases.at(-1)).toBe('idle');
  });

  it('ignores anything that arrives after stop', async () => {
    const t = setup();
    t.start();
    const req = t.transport.lastRequest;
    const stream = t.transport.lastStream;
    stream.open();
    t.source.stop();
    req.ok(body());
    stream.send(goal('late', 2), '2');
    stream.error();
    t.env.setHidden(true);
    t.env.setHidden(false);
    await flush();
    t.sched.advance(POLL_MS * 4);
    expect(t.feeds).toHaveLength(0);
    expect(t.events).toHaveLength(0);
    expect(t.transport.requests).toHaveLength(1);
    expect(t.transport.streams).toHaveLength(1);
    expect(t.sched.pending).toBe(0);
  });

  it('stop is idempotent, and start after stop runs one fresh set of everything', async () => {
    const t = setup();
    await live(t);
    t.source.stop();
    t.source.stop();
    t.start();
    expect(t.env.listenerCount).toBe(1);
    expect(t.transport.openStreams).toHaveLength(1);
    expect(t.transport.inFlight).toHaveLength(1);
    expect(t.transport.lastRequest.etag).toBeUndefined();
  });

  it('can be stopped from inside its own feed handler', async () => {
    const t = setup();
    t.source.start(
      () => t.source.stop(),
      () => {},
    );
    t.transport.lastRequest.ok(body());
    await flush();
    expect(t.sched.pending).toBe(0);
    expect(t.transport.openStreams).toHaveLength(0);
    expect(t.env.listenerCount).toBe(0);
  });
});
