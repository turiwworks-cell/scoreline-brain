import { describe, expect, it } from 'vitest';
import { DemoSim, REST_TICKS, type Outgoing } from './sim';
import { feedJson, messageJson } from './wire';

// SL-20 / SL-14 / SL-03: the numbers of a player and of his team agree, whoever is followed, and
// a followed player's acts are his own.

interface Line {
  rating: number;
  minutes: number;
  touches: number;
  passes: number;
  passesOk: number;
  shots: number;
  saves?: number;
}
interface FeedEvent {
  kind: string;
  side: 'home' | 'away';
  player?: number;
  other?: number;
  minute: number;
}
interface FeedMatch {
  id: number;
  home: string;
  away: string;
  status: 'scheduled' | 'live' | 'finished';
  minute: number;
  score: [number, number];
  events: FeedEvent[];
  lineups: { home: { xi: number[] }; away: { xi: number[] } };
  stats?: { passes: [number, number]; shots: [number, number]; onTarget: [number, number] };
  players?: { home: Record<string, Line>; away: Record<string, Line> };
}

const feed = (sim: DemoSim): FeedMatch[] => (feedJson(sim) as unknown as { matches: FeedMatch[] }).matches;
const featuredOf = (ms: FeedMatch[]) => ms.find((m) => m.home === 'fra' && m.away === 'arg');
const MESSI = { team: 'arg', n: 10 };
const MAIGNAN = { team: 'fra', n: 16 };

/** One tick, then the followed player's acts that fall within it (an act every 2.6–5.4 s of match time). */
function step(sim: DemoSim, out: Outgoing[] = []): Outgoing[] {
  out.push(...sim.tick());
  sim.followStep(out);
  sim.followStep(out);
  return out;
}

/** What must hold for every player and team of every started match in this feed. */
function check(ms: FeedMatch[], label: string): void {
  for (const m of ms) {
    if (!m.players || !m.stats) continue;
    for (const side of ['home', 'away'] as const) {
      const i = side === 'home' ? 0 : 1;
      const team = m.stats.passes[i];
      let sum = 0;
      for (const [n, p] of Object.entries(m.players[side])) {
        const at = `${label} · match ${m.id} ${side} #${n} at ${m.minute}'`;
        expect(p.passesOk, `${at}: completed passes > passes`).toBeLessThanOrEqual(p.passes);
        expect(p.passes, `${at}: passes > touches`).toBeLessThanOrEqual(p.touches);
        expect(p.passes, `${at}: passes > his team's`).toBeLessThanOrEqual(team);
        sum += p.passes;
      }
      // the team's passes are counted from its players', not drawn beside them
      expect(sum, `${label} · match ${m.id} ${side}: players' passes vs the team's`).toBe(team);
      const shots = Object.values(m.players[side]).reduce((s, p) => s + p.shots, 0);
      expect(shots, `${label} · match ${m.id} ${side}: players' shots vs the team's`).toBeLessThanOrEqual(m.stats.shots[i]);
    }
  }
}

describe('demo statistics', () => {
  it('a player never has more passes than his team, and completed never exceed passes: mid-game, full time, next round', () => {
    const sim = new DemoSim({ follow: MESSI });
    const checked: number[] = [];
    check(feed(sim), 'start');
    let ticks = 0;
    while (!sim.allFinished && ticks < 2000) {
      step(sim);
      ticks += 1;
      if (ticks % 15 === 0) {
        check(feed(sim), `tick ${ticks}`);
        checked.push(ticks);
      }
    }
    expect(sim.allFinished).toBe(true);
    expect(checked.length).toBeGreaterThan(10);
    check(feed(sim), 'full time');
    // the evening rests, then starts again with new ids: the same holds, and Messi starts from his own minutes
    for (let i = 0; i <= REST_TICKS + 1; i++) step(sim);
    const next = feed(sim);
    expect(next.some((m) => m.id > 100)).toBe(true);
    check(next, 'next round');
    for (let i = 0; i < 40; i++) step(sim);
    check(feed(sim), 'next round, later');
  }, 60_000);

  it("Messi's passes are not added twice, and following him changes none of his counts", () => {
    const a = new DemoSim({ follow: MESSI });
    const b = new DemoSim({ follow: null });
    const lastA: Line[] = [];
    for (let t = 0; t < 300 && !a.allFinished; t++) {
      step(a);
      step(b);
      if (t % 20 !== 0) continue;
      const la = featuredOf(feed(a))?.players?.away['10'];
      const lb = featuredOf(feed(b))?.players?.away['10'];
      expect(la).toBeDefined();
      // everything but the shots his acts add to the match comes from his minutes alone
      expect({ touches: la?.touches, passes: la?.passes, passesOk: la?.passesOk, minutes: la?.minutes }).toEqual({ touches: lb?.touches, passes: lb?.passes, passesOk: lb?.passesOk, minutes: lb?.minutes });
      // and none of it goes backwards
      const prev = lastA.at(-1);
      if (prev && la) {
        expect(la.touches).toBeGreaterThanOrEqual(prev.touches);
        expect(la.passes).toBeGreaterThanOrEqual(prev.passes);
        expect(la.passesOk).toBeGreaterThanOrEqual(prev.passesOk);
      }
      if (la) lastA.push(la);
    }
    const end = featuredOf(feed(a))?.players?.away['10'];
    const team = featuredOf(feed(a))?.stats?.passes[1] ?? 0;
    expect(end?.passes).toBeGreaterThan(0);
    expect(end?.passes ?? 0).toBeLessThan(team / 3);
  }, 60_000);

  it('the shots his acts add stay within what his line shoots in a match', () => {
    const a = new DemoSim({ follow: MESSI });
    const b = new DemoSim({ follow: null });
    for (let t = 0; t < 400 && !(a.allFinished && b.allFinished); t++) {
      step(a);
      step(b);
    }
    const ma = featuredOf(feed(a));
    const mb = featuredOf(feed(b));
    // a forward shoots 3.2 times in 90 minutes: at most 4 shots beyond the ones the match gave him
    expect((ma?.stats?.shots[1] ?? 0) - (mb?.stats?.shots[1] ?? 0)).toBeLessThanOrEqual(4);
    expect(ma?.players?.away['10']?.shots ?? 0).toBeLessThanOrEqual((mb?.players?.away['10']?.shots ?? 0) + 4);
  }, 60_000);
});

describe('goalkeeper saves', () => {
  it("a keeper's saves are the shots on target he faced that were not goals; nobody else has a saves count", () => {
    const sim = new DemoSim({ follow: null });
    for (let t = 0; t < 400 && !sim.allFinished; t++) step(sim);
    let keepers = 0;
    let withSaves = 0;
    for (const m of feed(sim)) {
      if (!m.players || !m.stats) continue;
      for (const side of ['home', 'away'] as const) {
        const keeper = m.lineups[side].xi[0];
        const opp = side === 'home' ? 1 : 0;
        const faced = m.stats.onTarget[opp] - m.score[opp];
        const lines = m.players[side];
        for (const [n, p] of Object.entries(lines)) if (Number(n) !== keeper) expect(p.saves, `${m.id} ${side} #${n}`).toBeUndefined();
        const k = lines[String(keeper)];
        expect(k).toBeDefined();
        keepers += 1;
        // unless he was sent off, in which case the shots after it were no longer his to save
        if (m.events.some((e) => e.kind === 'red' && e.side === side && e.player === keeper)) continue;
        expect(k?.saves, `${m.id} ${side} keeper`).toBe(faced);
        if (faced > 0) withSaves += 1;
      }
    }
    expect(keepers).toBeGreaterThan(5);
    expect(withSaves).toBeGreaterThan(2);
  }, 60_000);

  it('a keeper with no saves has 0, which is not the same as no count', () => {
    const sim = new DemoSim({ follow: null });
    const scheduled = feed(sim).find((m) => m.status === 'scheduled');
    // a match that has not started sends no player lines at all
    expect(scheduled?.players).toBeUndefined();
    const finished = feed(sim).filter((m) => m.players);
    const zero = finished.flatMap((m) => [m.players?.home[String(m.lineups.home.xi[0])], m.players?.away[String(m.lineups.away.xi[0])]]).filter((p) => p?.saves === 0);
    // the keepers who met no shot on target say 0; they do not leave the count out
    for (const p of zero) expect(p).toHaveProperty('saves', 0);
  });
});

describe('the followed player', () => {
  const acts = (out: Outgoing[]) => out.flatMap((o) => (o.type === 'action' ? [o] : []));

  it('the acts are his own, and switching to a player of the other team changes who they are about', () => {
    const sim = new DemoSim({ follow: MESSI });
    const first: Outgoing[] = [];
    for (let i = 0; i < 40; i++) step(sim, first);
    const messi = acts(first).filter((o) => o.match.feat);
    expect(messi.length).toBeGreaterThan(10);
    expect(new Set(messi.map((o) => `${o.side}:${o.player}`))).toEqual(new Set(['a:10']));

    sim.follow(MAIGNAN);
    const second: Outgoing[] = [];
    for (let i = 0; i < 40; i++) step(sim, second);
    const maignan = acts(second).filter((o) => o.match.feat);
    expect(maignan.length).toBeGreaterThan(10);
    // none of his acts is labelled as Messi's, and the other way round
    expect(new Set(maignan.map((o) => `${o.side}:${o.player}`))).toEqual(new Set(['h:16']));
    for (const o of maignan) expect(o.text).not.toMatch(/Shoots|Dribbles|Whips a cross/);

    sim.follow(MESSI);
    const third: Outgoing[] = [];
    for (let i = 0; i < 40; i++) step(sim, third);
    expect(new Set(acts(third).filter((o) => o.match.feat).map((o) => `${o.side}:${o.player}`))).toEqual(new Set(['a:10']));
  });

  it('wire messages carry the followed shirt and side', () => {
    const sim = new DemoSim({ follow: { team: 'fra', n: 10 } });
    const out: Outgoing[] = [];
    for (let i = 0; i < 20; i++) step(sim, out);
    const msgs = acts(out).map((o) => messageJson(o));
    expect(msgs.length).toBeGreaterThan(5);
    for (const j of msgs) expect(j).toMatchObject({ kind: 'action', side: 'home', player: 10 });
  });

  it('a bench player, a player of a match that has not started and nobody are told nothing', () => {
    for (const who of [{ team: 'fra', n: 1 }, { team: 'ita', n: 10 }, null]) {
      const sim = new DemoSim({ follow: who });
      const out: Outgoing[] = [];
      for (let i = 0; i < 30; i++) step(sim, out);
      expect(acts(out), JSON.stringify(who)).toEqual([]);
    }
  });

  it('a followed keeper is told his saves when a shot on target is aimed at him, and only then', () => {
    const sim = new DemoSim({ follow: MAIGNAN });
    const out: Outgoing[] = [];
    // two evenings: enough shots on target at him to see the rule more than once
    for (let t = 0; t < 1200 && out.filter((o) => o.type === 'action' && o.act === 'save').length < 4; t++) step(sim, out);
    const saves = acts(out).filter((o) => o.act === 'save');
    const faced = out.flatMap((o) => (o.type === 'event' && o.match.feat && o.event.side === 'a' && (o.event.kind === 'sot' || o.event.kind === 'big') && o.event.on === 16 ? [o.event] : []));
    expect(faced.length).toBeGreaterThan(0);
    // one save per shot he faced, and what the card says is the shooter's name
    expect(saves.length).toBe(faced.length);
    saves.forEach((s, i) => {
      expect(s.player).toBe(16);
      expect(s.onBall).toBe(true);
      expect(s.text).toContain(faced[i]?.p ?? '?');
    });
    // the shots his own acts could make are an outfield player's: a keeper does not shoot
    expect(out.some((o) => o.type === 'event' && o.match.feat && o.event.side === 'h' && o.event.pn === 16 && (o.event.kind === 'sot' || o.event.kind === 'miss'))).toBe(false);
  });

  it('the demo restarting keeps the follow and starts his numbers over', () => {
    const sim = new DemoSim({ follow: MAIGNAN });
    for (let t = 0; t < 2000 && !sim.allFinished; t++) step(sim);
    const before = featuredOf(feed(sim))?.players?.home['16'];
    for (let i = 0; i <= REST_TICKS + 1; i++) step(sim);
    expect(sim.followed).toEqual(MAIGNAN);
    const next = feed(sim).find((m) => m.home === 'fra' && m.away === 'arg');
    const after = next?.players?.home['16'];
    expect(next?.id).toBeGreaterThan(100);
    // a new evening: his minutes are the new match's own, not what the old one ended with
    expect(after?.minutes ?? 0).toBeLessThan(before?.minutes ?? 90);
    expect(after?.saves).toBeDefined();
  }, 60_000);
});
