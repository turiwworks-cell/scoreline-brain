import { describe, expect, it } from 'vitest';
import { standings, type Feed, type LiveEvent } from '../../domain';
import { createScorelineStore } from '../../store';
import type { SyncStatus } from '../source';
import { connectSource } from '../sync';
import { FakeScheduler } from '../testing/fakes';
import { createDemoSource, TICK_MS, type DemoSourceOptions } from './demoSource';
import { apiMode, demoMode, FAST_SPEED } from './mode';
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
    // a whole evening, minute by minute: about 5 s on a slow runner, over the 5 s default
  }, 20_000);

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
    // no source named: the demo plays (the site opens on the matchday)
    expect(demoMode('')).toEqual({ speed: 1 });
    expect(demoMode('?day=2')).toEqual({ speed: 1 });
    // ?api is the HTTP source; ?demo=off is no source at all
    expect(demoMode('?api')).toBeNull();
    expect(apiMode('?api')).toBe('/api');
    expect(apiMode('?demo')).toBeNull();
    expect(demoMode('?demo=off')).toBeNull();
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

describe('DemoSource follow', () => {
  const actors = (events: LiveEvent[]) => new Set(events.filter((e) => e.kind === 'action').map((e) => `${e.side}:${e.player}`));

  it("tells the acts of whoever is followed now, and of nobody once he is let go", () => {
    const { scheduler, source, events, start } = recorded({ speed: FAST_SPEED });
    start();
    scheduler.advance(20_000);
    // Argentina's 10 until someone else is chosen
    expect(actors(events)).toEqual(new Set(['away:10']));

    // another team's player: the old player's acts stop and are never labelled as his
    source.follow({ team: 'fra', n: 16 });
    events.length = 0;
    scheduler.advance(20_000);
    expect(actors(events)).toEqual(new Set(['home:16']));

    source.follow({ team: 'arg', n: 10 });
    events.length = 0;
    scheduler.advance(20_000);
    expect(actors(events)).toEqual(new Set(['away:10']));

    source.follow(null);
    events.length = 0;
    scheduler.advance(20_000);
    expect(actors(events)).toEqual(new Set());
  });

  it('the first act of a newly followed player comes a moment after the choice, not at once', () => {
    const { scheduler, source, events, start } = recorded({ speed: FAST_SPEED, follow: null });
    start();
    scheduler.advance(5_000);
    events.length = 0;
    source.follow({ team: 'eng', n: 9 });
    // 1.2 s of match time is 120 ms at 10×
    scheduler.advance(50);
    expect(events.some((e) => e.kind === 'action')).toBe(false);
    scheduler.advance(100);
    expect(events.find((e) => e.kind === 'action')).toMatchObject({ side: 'home', player: 9 });
  });

  it('a restart keeps whoever is followed and starts his numbers over', () => {
    const { scheduler, source, feeds, events, start } = recorded({ speed: FAST_SPEED, follow: { team: 'fra', n: 16 } });
    start();
    scheduler.advance(30_000);
    const line = () => feeds.at(-1)?.matches.find((m) => m.id === 1)?.players?.home['16'];
    const before = line();
    expect(feeds.at(-1)?.matches.find((m) => m.id === 1)?.minute).toBeGreaterThan(58);
    source.restart();
    // kick-off of the featured match again: the numbers are the evening's start, not what the old one reached
    expect(feeds.at(-1)?.matches.find((m) => m.id === 1)?.minute).toBe(58);
    expect(line()?.touches).toBeLessThanOrEqual(before?.touches ?? Infinity);
    expect(line()?.saves).toBeDefined();
    events.length = 0;
    scheduler.advance(5_000);
    expect(actors(events)).toEqual(new Set(['home:16']));
  });
});

describe('DemoSource dev controls', () => {
  it('restart resets the connected store quietly and new goals are accepted afterwards', () => {
    const scheduler = new FakeScheduler();
    const store = createScorelineStore();
    const source = createDemoSource({ scheduler, seed: 2026, autoGoals: false });
    const connection = connectSource(source, store.getState().actions, () => scheduler.now());
    const initial = store.getState().domain.matches[1]!;
    source.pause();
    expect(source.trigger('goalHome')).toBe(true);
    expect(source.trigger('fullTime')).toBe(true);
    expect(store.getState().domain.matches[1]!.status).toBe('finished');
    expect(store.getState().moments.length).toBeGreaterThan(0);

    source.restart();
    const restarted = store.getState();
    expect(restarted.domain.matches[1]).toMatchObject({
      score: initial.score,
      status: initial.status,
      seq: initial.seq,
      events: initial.events,
      players: initial.players,
      stats: initial.stats,
      lineups: initial.lineups,
    });
    expect(restarted.moments).toEqual([]);
    expect(restarted.sync.phase).toBe('live');
    expect(source.paused).toBe(true);
    expect(scheduler.pending).toBe(0);
    expect(source.trigger('goalHome')).toBe(true);
    expect(store.getState().domain.matches[1]!.score).toEqual([3, 1]);
    expect(store.getState().moments.map((m) => m.kind)).toEqual(['goal']);
    connection.disconnect();
  });

  it('fires each of the seven triggers as demo events, the Lua’s names in the Lua’s order', async () => {
    const { DEMO_TRIGGERS } = await import('./sim');
    expect([...DEMO_TRIGGERS]).toEqual(['goalHome', 'goalAway', 'goalFavorite', 'redHome', 'redAway', 'redFavorite', 'fullTime']);
    const r = recorded({ seed: 2026, autoGoals: false });
    r.start();
    const kindsFor = (name: (typeof DEMO_TRIGGERS)[number]) => {
      const before = r.events.length;
      expect(r.source.trigger(name), name).toBe(true);
      return r.events.slice(before).map((e) => e.kind);
    };
    expect(kindsFor('goalHome')).toContain('goal');
    expect(kindsFor('goalAway')).toContain('goal');
    expect(kindsFor('goalFavorite')).toContain('goal');
    expect(kindsFor('redHome')).toContain('red');
    expect(kindsFor('redAway')).toContain('red');
    expect(kindsFor('redFavorite')).toContain('red');
    expect(kindsFor('fullTime')).toContain('fulltime');
  });

  it('pause holds the evening with no timer; resume carries on with one timer and a fresh feed', () => {
    const r = recorded();
    r.start();
    expect(r.scheduler.pending).toBe(1);
    r.scheduler.advance(TICK_MS * 3);
    const minute = minuteOf(r.feeds);
    r.source.pause();
    r.source.pause();
    expect(r.source.paused).toBe(true);
    expect(r.scheduler.pending).toBe(0);
    const feeds = r.feeds.length;
    r.scheduler.advance(TICK_MS * 20);
    expect(r.feeds.length).toBe(feeds);
    r.source.resume();
    r.source.resume();
    expect(r.source.paused).toBe(false);
    expect(r.scheduler.pending).toBe(1);
    expect(r.feeds.length).toBe(feeds + 1);
    expect(minuteOf(r.feeds)).toBe(minute);
    r.source.stop();
    expect(r.scheduler.pending).toBe(0);
  });

  it('a trigger works while paused and never wakes a timer', () => {
    const r = recorded({ autoGoals: false });
    r.start();
    r.source.pause();
    expect(r.source.trigger('goalHome')).toBe(true);
    expect(r.scheduler.pending).toBe(0);
  });

  it('restart begins the evening again on the same connection with one timer', () => {
    const r = recorded({ seed: 2026 });
    r.start();
    const first = minuteOf(r.feeds);
    r.scheduler.advance(TICK_MS * 30);
    expect(minuteOf(r.feeds)).not.toBe(first);
    r.source.restart();
    expect(minuteOf(r.feeds)).toBe(first);
    expect(r.scheduler.pending).toBe(1);
    expect(r.source.running).toBe(true);
    // restarting while paused stays paused
    r.source.pause();
    r.source.restart();
    expect(r.source.paused).toBe(true);
    expect(r.scheduler.pending).toBe(0);
  });

  it('notifies subscribers of pause, resume and stop, and not after unsubscribing', () => {
    const r = recorded();
    let n = 0;
    const off = r.source.subscribe(() => n++);
    r.start();
    r.source.pause();
    r.source.resume();
    r.source.stop();
    expect(n).toBe(4);
    off();
    r.start();
    expect(n).toBe(4);
  });

  it('registers as the active source while started and leaves when stopped', async () => {
    const { activeDemoSource } = await import('./active');
    const a = recorded();
    const b = recorded();
    a.start();
    expect(activeDemoSource()).toBe(a.source);
    b.start();
    a.source.stop();
    expect(activeDemoSource()).toBe(b.source);
    b.source.stop();
    expect(activeDemoSource()).toBeNull();
  });
});
