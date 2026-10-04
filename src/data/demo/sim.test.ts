import { describe, expect, it } from 'vitest';
import { feedSchema, parseEvent, parseFeed, standings, type Feed } from '../../domain';
import { STORED_KINDS } from '../../domain/schemas';
import { DEMO_BASES, demoState } from '../../domain/testing/demo';
import { FIXTURES } from './data';
import { LUA_SEED, rng, streamSeed } from './rng';
import { DemoSim, REST_TICKS, type Outgoing } from './sim';
import { feedJson, LEAGUE_BASES, messageJson } from './wire';

type Json = Record<string, unknown>;

/** Runs a simulation to the end of its evening; every wire message, in order. */
function play(sim: DemoSim, maxTicks = 2000): { feeds: Json[]; events: Json[] } {
  const feeds: Json[] = [feedJson(sim)];
  const events: Json[] = [];
  for (let t = 0; t < maxTicks && !sim.allFinished; t++) {
    const out: Outgoing[] = sim.tick();
    sim.followStep(out);
    for (const o of out) {
      const j = messageJson(o);
      if (j) events.push(j);
      else feeds.push(feedJson(sim));
    }
  }
  return { feeds, events };
}

const CONTRACT_KINDS = new Set<string>([...STORED_KINDS, 'kickoff', 'fulltime', 'minute', 'action']);

describe('rng', () => {
  it('is the Lua Park-Miller generator: deterministic, in [0, 1)', () => {
    const a = rng(LUA_SEED);
    const b = rng(LUA_SEED);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(rng(1)()).not.toBe(rng(2)());
  });

  it("leaves the Lua's fixed streams as they were under the Lua's seed, and shifts them otherwise", () => {
    expect(streamSeed(LUA_SEED, 977)).toBe(977);
    expect(streamSeed(LUA_SEED + 1, 977)).not.toBe(977);
    expect(streamSeed(-5, 977)).toBeGreaterThanOrEqual(0);
  });
});

describe('DemoSim', () => {
  it('same seed, same evening: every feed and event identical', () => {
    const a = play(new DemoSim({ seed: 42 }));
    const b = play(new DemoSim({ seed: 42 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.events.length).toBeGreaterThan(100);
    // a whole evening, minute by minute: about 5 s on a slow runner, over the 5 s default
  }, 20_000);

  it('the default seed is the Lua seed', () => {
    expect(JSON.stringify(play(new DemoSim()))).toBe(JSON.stringify(play(new DemoSim({ seed: LUA_SEED }))));
  });

  it('different seeds play different evenings on the same fixtures', () => {
    const a = new DemoSim({ seed: 1 });
    const b = new DemoSim({ seed: 2 });
    const fa = feedJson(a) as { matches: Json[] };
    const fb = feedJson(b) as { matches: Json[] };
    // The fixtures, scores and clocks at the start are the Lua's whatever the seed.
    const shape = (f: { matches: Json[] }) => f.matches.map((m) => [m.id, m.home, m.away, m.score, m.status, m.minute]);
    expect(shape(fa)).toEqual(shape(fb));
    // How they got there, and what happens next, differs.
    expect(JSON.stringify(fa.matches.map((m) => m.events))).not.toBe(JSON.stringify(fb.matches.map((m) => m.events)));
    expect(JSON.stringify(play(a).events)).not.toBe(JSON.stringify(play(b).events));
  });

  it("France – Argentina's history is the Lua's DATA.past, with the plan still to come", () => {
    const f = feedJson(new DemoSim()) as { matches: { events: Json[] }[] };
    const goals = f.matches[0]?.events.filter((e) => e.kind === 'goal').map((e) => [e.side, e.minute, e.player, e.other ?? 0, e.style, e.score]);
    expect(goals).toEqual([
      ['home', 23, 10, 11, 'through', [1, 0]],
      ['away', 39, 10, 0, 'solo', [1, 1]],
      ['home', 52, 10, 20, 'cutback', [2, 1]],
    ]);
    const others = f.matches[0]?.events.filter((e) => e.kind === 'yellow' || e.kind === 'sub').map((e) => [e.kind, e.side, e.minute, e.player]);
    expect(others).toEqual([
      ['yellow', 'away', 12, 13],
      ['sub', 'away', 55, 18],
      ['yellow', 'home', 57, 8],
    ]);
  });

  it('every history ends on the fixture score, and each event carries the score after it', () => {
    const f = feedJson(new DemoSim({ seed: 7 })) as { matches: { score: number[]; events: { score: number[]; kind: string }[] }[] };
    f.matches.forEach((m, i) => {
      const fx = FIXTURES[i];
      expect(m.score).toEqual([fx?.[4], fx?.[5]]);
      const goals = m.events.filter((e) => e.kind === 'goal');
      expect(goals.length).toBe((fx?.[4] ?? 0) + (fx?.[5] ?? 0));
      expect(m.events.at(-1)?.score ?? [0, 0]).toEqual(m.score);
    });
  });

  it('plays the whole evening: every live match reaches full time, scheduled ones wait', () => {
    const sim = new DemoSim({ seed: 3, loop: false });
    const { events } = play(sim);
    expect(sim.allFinished).toBe(true);
    const live = FIXTURES.flatMap((f, i) => (f[6] === 'live' ? [i + 1] : []));
    expect(events.filter((e) => e.kind === 'fulltime').map((e) => e.match)).toEqual(expect.arrayContaining(live));
    for (const m of sim.matches) {
      if (FIXTURES[m.n - 1]?.[6] === 'live') {
        expect(m.status).toBe('ft');
        expect(m.min).toBe(92 + (m.n % 4));
      }
      if (FIXTURES[m.n - 1]?.[6] === 'ns') expect(m.status).toBe('ns');
    }
  });
});

describe('the wire', () => {
  it('feeds conform to the v2 feed schema and lose nothing in parsing', () => {
    const { feeds } = play(new DemoSim({ seed: 11, loop: false }));
    for (const raw of feeds) {
      expect(feedSchema.safeParse(raw).success).toBe(true);
      const f: Feed = parseFeed(raw);
      const r = raw as { teams: unknown[]; leagues: Json[]; matches: { id: number; events: Json[]; stats?: unknown; players?: unknown }[]; squads: Json };
      expect(f.version).toBe(2);
      expect(f.teams.length).toBe(r.teams.length);
      expect(f.leagues.map((l) => l.table?.length ?? 0)).toEqual(r.leagues.map((l) => (l.table as unknown[] | undefined)?.length ?? 0));
      expect(Object.keys(f.squads)).toEqual(Object.keys(r.squads));
      expect(f.matches.map((m) => m.id)).toEqual(r.matches.map((m) => m.id));
      f.matches.forEach((m, i) => {
        const rm = r.matches[i];
        expect(m.events.map((e) => e.id)).toEqual(rm?.events.map((e) => e.id));
        expect(m.lineups?.home?.xi.length).toBe(11);
        expect(m.stats !== undefined).toBe(rm?.stats !== undefined);
        for (const e of rm?.events ?? []) expect(STORED_KINDS).toContain(e.kind);
      });
    }
  });

  it('events conform to the event schema and parse to exactly what was sent', () => {
    const { events } = play(new DemoSim({ seed: 11, loop: false }));
    const kinds = new Set<unknown>();
    for (const raw of events) {
      kinds.add(raw.kind);
      expect(CONTRACT_KINDS.has(raw.kind as string)).toBe(true);
      const ev = parseEvent(raw);
      expect(ev).toBeDefined();
      expect(ev).toMatchObject(raw);
      // Everything that changes the match carries seq and the score after it (DATA-CONTRACT §3).
      if (raw.kind !== 'minute' && raw.kind !== 'action') {
        expect(Number.isInteger(raw.seq)).toBe(true);
        expect(Array.isArray(raw.score)).toBe(true);
        expect(typeof raw.id).toBe('string');
      }
    }
    for (const k of ['goal', 'shot', 'corner', 'fulltime', 'minute', 'action']) expect(kinds).toContain(k);
  });

  it('seq: history numbered from 1, each event the next, each snapshot at the last sent', () => {
    const sim = new DemoSim({ seed: 5, loop: false });
    const { feeds, events } = play(sim);
    const first = feeds[0] as { matches: { id: number; seq: number; events: { seq: number }[] }[] };
    const seqs = new Map<number, number>();
    for (const m of first.matches) {
      expect(m.events.map((e) => e.seq)).toEqual(m.events.map((_, i) => i + 1));
      expect(m.seq).toBe(m.events.length);
      seqs.set(m.id, m.seq);
    }
    const ids = new Set<unknown>();
    for (const e of events) {
      if (e.seq === undefined) continue;
      const match = e.match as number;
      expect(e.seq).toBe((seqs.get(match) ?? 0) + 1);
      seqs.set(match, e.seq as number);
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
    }
    const last = feeds.at(-1) as { matches: { id: number; seq: number }[] };
    for (const m of last.matches) expect(m.seq).toBe(seqs.get(m.id));
  });

  it("tables: counted from the Lua's league teams and earlier results, as Part 4's standings do", () => {
    expect(LEAGUE_BASES).toEqual(DEMO_BASES);
    const feed = parseFeed(feedJson(new DemoSim()));
    const fromFixture = demoState();
    for (const l of feed.leagues) {
      const counted = standings(fromFixture, l.id, DEMO_BASES[l.id]).map(({ team, p, w, d, l: lost, gf, ga, pts }) => ({ team, p, w, d, l: lost, gf, ga, pts }));
      if (l.id === 'fri') expect(l.table).toBeUndefined();
      else expect(l.table).toEqual(counted);
    }
  });

  it('a new evening after the rest gets new match ids, so no score ever goes back down', () => {
    const sim = new DemoSim({ seed: 9 });
    let ticks = 0;
    while (!sim.allFinished) {
      sim.tick();
      ticks += 1;
    }
    for (let i = 0; i < REST_TICKS; i++) expect(sim.tick().filter((o) => o.type !== 'snapshot')).toEqual([]);
    expect(sim.matches[0]?.id).toBe(1);
    expect(sim.tick()).toEqual([{ type: 'snapshot' }]);
    expect(ticks).toBeGreaterThan(0);
    const f = feedJson(sim) as { matches: { id: number; score: number[]; status: string }[] };
    expect(f.matches.map((m) => m.id)).toEqual(FIXTURES.map((_, i) => 101 + i));
    expect(f.matches[0]).toMatchObject({ score: [2, 1], status: 'live' });
  });

  it('next fixtures count down from 21:58 on Monday 21 September', () => {
    const sim = new DemoSim();
    expect((feedJson(sim).next as Json).fra).toEqual({ opponent: 'bra', date: 'Thu 24 Sep', time: '20:45', in: 3 * 86400 - 73 * 60 });
    sim.tick();
    expect(((feedJson(sim).next as Json).fra as Json).in).toBe(3 * 86400 - 73 * 60 - 6);
  });
});
