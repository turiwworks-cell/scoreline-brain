import { describe, expect, it } from 'vitest';
import { standings, type Feed, type LiveEvent } from '../../domain';
import { createScorelineStore } from '../../store';
import type { SyncStatus } from '../source';
import { connectSource } from '../sync';
import { FakeScheduler } from '../testing/fakes';
import { createDemoSource, TICK_MS, type DemoSourceOptions } from './demoSource';
import { demoMode, FAST_SPEED } from './mode';
import { LEAGUE_BASES } from './wire';

function recorded(options: DemoSourceOptions = {}) {
  const scheduler = new FakeScheduler();
  const source = createDemoSource({ scheduler, ...options });
  const feeds: Feed[] = [];
  const events: LiveEvent[] = [];
  const statuses: SyncStatus[] = [];
  const start = () =>
    source.start(
      (f) => feeds.push(f),
      (e) => events.push(e),
      (s) => statuses.push(s),
    );
  return { scheduler, source, feeds, events, statuses, start };
}

const minuteOf = (feeds: Feed[], id = 1) => feeds.at(-1)?.matches.find((m) => m.id === id)?.minute;

describe('DemoSource', () => {
  it('a complete matchday plays through the store with no backend', () => {
    const scheduler = new FakeScheduler();
    const store = createScorelineStore();
    const source = createDemoSource({ scheduler, speed: FAST_SPEED, loop: false, seed: 2026 });
    const conn = connectSource(source, store.getState().actions, () => scheduler.now());
    const at = (id: number) => store.getState().domain.matches[id];
    const seqAtStart = new Map([1, 2, 3, 4, 5].map((id) => [id, at(id)?.seq ?? 0]));
    expect(at(1)).toMatchObject({ status: 'live', score: [2, 1] });
    expect(store.getState().sync.phase).toBe('live');
    // The first feed sets the stage quietly.
    expect(store.getState().moments).toEqual([]);

    // Ninety match minutes at 10× is nine real minutes; the evening is done well within that.
    scheduler.advance(9 * 60_000);
    const state = store.getState().domain;
    const live = [1, 2, 3, 4, 5];
    for (const id of live) expect(at(id)?.status).toBe('finished');
    for (const id of [6, 7, 11, 12]) expect(at(id)?.status).toBe('scheduled');

    const moments = store.getState().actions.takeMoments();
    expect(moments.filter((m) => m.kind === 'fulltime').map((m) => m.matchId).sort()).toEqual(live);
    // Each goal plays once, and no score ever went back down.
    const goals = moments.filter((m) => m.kind === 'goal');
    expect(new Set(goals.map((m) => m.id)).size).toBe(goals.length);
    expect(moments.some((m) => m.kind === 'goalCancelled')).toBe(false);
    for (const id of live) {
      const m = at(id);
      const goalEvents = m?.events.filter((e) => e.kind === 'goal') ?? [];
      expect(goalEvents.at(-1)?.score).toEqual(m?.score);
      expect(m?.events.map((e) => e.seq)).toEqual(m?.events.map((_, i) => i + 1));
    }
    const liveGoals = live.flatMap((id) => at(id)?.events.filter((e) => e.kind === 'goal' && e.seq > (seqAtStart.get(id) ?? 0)) ?? []);
    expect(goals.map((m) => m.event?.id).sort()).toEqual(liveGoals.map((e) => e.id).sort());

    // The sent tables are the ones Part 4's standings count from the league bases.
    for (const lg of ['wns', 'nla', 'nlb', 'afq']) {
      const unsent = { ...state, leagues: { ...state.leagues, [lg]: { ...state.leagues[lg]!, table: undefined } } };
      // `i` aside: in a sent table it is the place in the table, in a counted one the place in the team list.
      const rows = (r: ReturnType<typeof standings>) => r.map((row) => ({ ...row, i: 0 }));
      expect(rows(standings(state, lg))).toEqual(rows(standings(unsent, lg, LEAGUE_BASES[lg])));
    }
    conn.disconnect();
    expect(scheduler.pending).toBe(0);
  });

  it('runs in real time by default: one tick of 6 match seconds every 6 s', () => {
    const { scheduler, feeds, start } = recorded({ follow: null });
    start();
    expect(scheduler.delays).toEqual([TICK_MS]);
    expect(TICK_MS).toBe(6000);
    scheduler.advance(60_000);
    // 10 ticks, two snapshots per minute: France – Argentina moved one minute (58' → 59').
    expect(minuteOf(feeds)).toBe(59);
  });

  it('?demo=fast runs the same simulation at 10×', () => {
    expect(demoMode('?demo=fast')).toEqual({ speed: FAST_SPEED });
    expect(FAST_SPEED).toBe(10);
    const fast = recorded({ follow: null, speed: FAST_SPEED });
    fast.start();
    expect(fast.scheduler.delays).toEqual([TICK_MS / 10]);
    fast.scheduler.advance(60_000);
    expect(minuteOf(fast.feeds)).toBe(68);

    // Same seed: fast plays exactly what real time plays, ten times sooner.
    const slow = recorded({ follow: null });
    slow.start();
    slow.scheduler.advance(600_000);
    expect(JSON.stringify(fast.events)).toBe(JSON.stringify(slow.events));
    expect(JSON.stringify(fast.feeds)).toBe(JSON.stringify(slow.feeds));
  });

  it('reads the mode from the URL', () => {
    expect(demoMode('')).toBeNull();
    expect(demoMode('?day=2')).toBeNull();
    expect(demoMode('?demo=0')).toBeNull();
    expect(demoMode('?demo')).toEqual({ speed: 1 });
    expect(demoMode('?demo=1&seed=42')).toEqual({ speed: 1, seed: 42 });
    expect(demoMode('?demo=fast&seed=x')).toEqual({ speed: 10 });
  });

  it('same seed through the source: identical feeds and events', () => {
    const a = recorded({ seed: 77, speed: FAST_SPEED });
    const b = recorded({ seed: 77, speed: FAST_SPEED });
    a.start();
    b.start();
    a.scheduler.advance(120_000);
    b.scheduler.advance(120_000);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(JSON.stringify(a.feeds)).toBe(JSON.stringify(b.feeds));
    expect(a.events.some((e) => e.kind === 'action')).toBe(true);
  });

  it('start and stop: one feed on start, nothing while stopped, idle after', () => {
    const { scheduler, source, feeds, events, statuses, start } = recorded();
    expect(source.running).toBe(false);
    start();
    start(); // already started: nothing
    expect(source.running).toBe(true);
    expect(feeds).toHaveLength(1);
    expect(statuses).toEqual([{ phase: 'live', feedError: false }]);
    expect(scheduler.pending).toBe(1);

    scheduler.advance(30_000);
    const sent = events.length + feeds.length;
    expect(sent).toBeGreaterThan(1);
    source.stop();
    source.stop();
    expect(source.running).toBe(false);
    expect(statuses.at(-1)).toEqual({ phase: 'idle', feedError: false });
    expect(scheduler.pending).toBe(0);
    scheduler.advance(600_000);
    expect(events.length + feeds.length).toBe(sent);
  });

  it('restarting leaves one timer and never sends an event twice', () => {
    const { scheduler, source, feeds, events, start } = recorded({ speed: FAST_SPEED });
    start();
    scheduler.advance(20_000);
    const minuteAtStop = minuteOf(feeds);
    for (let i = 0; i < 3; i++) {
      source.stop();
      start();
      expect(scheduler.pending).toBe(1);
    }
    // The evening paused while stopped, and the restart began with a full feed of where it was.
    expect(minuteOf(feeds)).toBe(minuteAtStop);
    scheduler.advance(60_000);
    const ids = events.flatMap((e) => (e.id !== undefined ? [`${e.match}:${e.id}`] : []));
    expect(new Set(ids).size).toBe(ids.length);
    const seqs = new Map<number, number>();
    for (const e of events) {
      if (e.seq === undefined) continue;
      expect(e.seq).toBeGreaterThan(seqs.get(e.match) ?? 0);
      seqs.set(e.match, e.seq);
    }
  });

  it('a handler that stops the source stops it at once', () => {
    const scheduler = new FakeScheduler();
    const source = createDemoSource({ scheduler, speed: FAST_SPEED });
    let sent = 0;
    let atStop = -1;
    source.start(
      () => (sent += 1),
      (e) => {
        sent += 1;
        if (e.kind === 'minute' && atStop < 0) {
          source.stop();
          atStop = sent;
        }
      },
    );
    scheduler.advance(60_000);
    expect(atStop).toBeGreaterThan(0);
    expect(sent).toBe(atStop);
    expect(source.running).toBe(false);
    expect(scheduler.pending).toBe(0);
  });

  it("the dev panel's triggers act on France – Argentina and the followed player", () => {
    const { source, feeds, events, start } = recorded();
    start();
    expect(source.trigger('goalHome')).toBe(true);
    const goal = events.at(-1);
    expect(goal).toMatchObject({ match: 1, kind: 'goal', side: 'home', score: [3, 1] });
    // A snapshot follows with the table moved: France had 1 goal before tonight.
    expect(feeds.at(-1)?.leagues.find((l) => l.id === 'wns')?.table?.[0]).toMatchObject({ team: 'fra', gf: 4, pts: 4 });

    // Following Messi (the Lua's default): his goal.
    expect(source.trigger('goalFavorite')).toBe(true);
    expect(events.at(-1)).toMatchObject({ match: 1, kind: 'goal', side: 'away', player: 10, score: [3, 2], seq: (goal?.seq ?? 0) + 1 });

    expect(source.trigger('redHome')).toBe(true);
    expect(events.at(-1)).toMatchObject({ match: 1, kind: 'red', side: 'home', seq: (goal?.seq ?? 0) + 2 });

    // The whistle in his match.
    expect(source.trigger('fullTime')).toBe(true);
    expect(events.at(-1)).toMatchObject({ match: 1, kind: 'fulltime', score: [3, 2] });
    expect(source.trigger('goalHome')).toBe(false);

    source.follow(null);
    expect(source.trigger('goalFavorite')).toBe(false);
  });
});
