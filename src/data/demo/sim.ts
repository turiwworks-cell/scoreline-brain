// The demo evening as it runs: the Lua's SIMULATION section (`luau:7342–7642`) without the
// drawing. One `tick` is the Lua's tick: 6 seconds of match time. What it produces goes out as
// contract-shaped messages (./wire); nothing here knows about timers or handlers.
//
// Where it differs from the Lua, and why:
// - Every match is built up front. The Lua built a match's history the first time it was opened
//   and left unopened matches without minute-by-minute events; a source has no "opened", so all
//   of them play.
// - When the evening restarts after everything has finished, the new evening's matches get new
//   ids (`round * 100 + n`). Re-using the ids would send each score back down, which the contract
//   reads as goals taken back by VAR.
// - The followed player's actions draw from their own random stream, so following someone
//   doesn't change how the matches go. A player sent off stops acting. What he is told doing is
//   a running commentary: his touches and passes are counted once, from his minutes (./model), and
//   his shots stay within what his line shoots in a match, since they land in the match's events.

import { ACTS, KEEPER_ACTS, PROFILE } from './data';
import {
  applyToLineup,
  commentary,
  eventId,
  genMinute,
  isOnPitch,
  keeperOf,
  lineIn,
  makeGoal,
  makeMatches,
  mkEvent,
  nameOf,
  onPitch,
  otherSide,
  pickPlayer,
  refreshStats,
  sayLine,
  sideTeam,
  stepMomentum,
  type LSide,
  type SimEvent,
  type SimMatch,
} from './model';
import { LUA_SEED, rng, streamSeed, type Rand } from './rng';

/** Match seconds one tick moves every live clock on (`luau:7609`). */
export const TICK_SECONDS = 6;
/** Ticks between two full snapshots when nothing else asks for one: 30 s of match time. */
export const SNAPSHOT_TICKS = 5;
/** Ticks the evening rests after its last final whistle before starting again (`luau:7638`). */
export const REST_TICKS = 25;

/** The dev panel's triggers (`luau:38–45`). */
/** The Lua's seven triggers (`luau:38–45`), in its order. */
export const DEMO_TRIGGERS = ['goalHome', 'goalAway', 'goalFavorite', 'redHome', 'redAway', 'redFavorite', 'fullTime'] as const;
export type DemoTrigger = (typeof DEMO_TRIGGERS)[number];

export interface Followed {
  readonly team: string;
  readonly n: number;
}

/** What one step of the simulation sends. Events in order; the snapshot, if any, after them. */
export type Outgoing =
  | { readonly type: 'event'; readonly match: SimMatch; readonly event: SimEvent }
  | { readonly type: 'fulltime'; readonly match: SimMatch; readonly id: string; readonly seq: number; readonly score: readonly [number, number] }
  | { readonly type: 'minute'; readonly match: SimMatch }
  | { readonly type: 'action'; readonly match: SimMatch; readonly side: LSide; readonly player: number; readonly text: string; readonly act: string; readonly onBall: boolean }
  | { readonly type: 'snapshot' };

export interface DemoSimOptions {
  /** Same seed, same evening. Defaults to the Lua's. */
  readonly seed?: number;
  /** Start a new evening after everything has finished, as the Lua did. Default true. */
  readonly loop?: boolean;
  /** The followed player, whose actions are sent as `action` events. The Lua followed Messi. */
  readonly follow?: Followed | null;
  /** Random goals in the live matches (`self.auto`, `luau:7626`). Default true. */
  readonly autoGoals?: boolean;
}

// `luau:7562`: kinds during which the followed player has the ball.
const BALL_ON = new Set(['touch', 'drib', 'fouled', 'pass', 'long', 'key', 'cross', 'shot', 'miss', 'claim', 'save']);

export class DemoSim {
  readonly seed: number;
  private readonly loop: boolean;
  private readonly autoGoals: boolean;
  private readonly rand: Rand;
  private readonly followRand: Rand;
  private round = 0;
  private ticks = 0;
  private restTicks = -1;
  private lastAct = '';
  matches: SimMatch[];
  followed: Followed | null;
  /** Match seconds since the demo began, across evenings. */
  elapsed = 0;

  constructor(options: DemoSimOptions = {}) {
    this.seed = Math.floor(options.seed ?? LUA_SEED);
    this.loop = options.loop ?? true;
    this.autoGoals = options.autoGoals ?? true;
    this.rand = rng(this.seed);
    this.followRand = rng(streamSeed(this.seed, 7342));
    this.followed = options.follow === undefined ? { team: 'arg', n: 10 } : options.follow;
    this.matches = makeMatches(this.seed, 0);
  }

  /** France – Argentina: the match the Home / Away triggers act on (`featured`, `luau:7103`). */
  featured(): SimMatch | undefined {
    return this.matches.find((m) => m.feat);
  }

  /** Follows a player, or nobody. What the last one was told doing no longer counts as just said. */
  follow(player: Followed | null): void {
    this.followed = player;
    this.lastAct = '';
  }

  /** True once every match that was live has finished. */
  get allFinished(): boolean {
    return !this.matches.some((m) => m.status === 'live');
  }

  // ── Emitting ──────────────────────────────────────────────────────────────

  /** Records an event and sends it, with the match's next `seq` and the score after it. */
  private send(out: Outgoing[], m: SimMatch, e: SimEvent): void {
    e.score = [m.hs, m.as];
    m.events.push(e);
    // An unremarked foul only counts in the stats: it never goes out, so it takes no `seq`.
    if (e.kind === 'foulx') {
      e.seq = m.seq;
      return;
    }
    m.seq += 1;
    e.seq = m.seq;
    e.id = eventId(m, m.seq);
    out.push({ type: 'event', match: m, event: e });
  }

  // ── Goals, cards and the whistle (`luau:7379–7448`) ─────────────────────────

  private goal(out: Outgoing[], m: SimMatch, side: LSide, forced: number): boolean {
    if (m.status !== 'live') return false;
    const ev = makeGoal(m, side, forced, this.rand);
    if (side === 'h') m.hs += 1;
    else m.as += 1;
    ev.txt = commentary(m, ev);
    applyToLineup(m, ev);
    this.send(out, m, ev);
    m.mom[ev.min] = side === 'h' ? 1 : -1;
    refreshStats(m);
    return true;
  }

  private sendOff(out: Outgoing[], m: SimMatch, side: LSide, forced: number): boolean {
    if (m.status !== 'live') return false;
    const pn = onPitch(m, side).some((p) => p.n === forced) ? forced : pickPlayer(m, side, 'card', -1, this.rand);
    const e = mkEvent(m, 'rc', side, Math.min(m.min, 95), pn, pickPlayer(m, otherSide(side), 'any', -1, this.rand), '');
    e.txt = sayLine(m, e, this.rand);
    applyToLineup(m, e);
    this.send(out, m, e);
    refreshStats(m);
    return true;
  }

  private endMatch(out: Outgoing[], m: SimMatch): boolean {
    if (m.status !== 'live') return false;
    m.status = 'ft';
    m.seq += 1;
    out.push({ type: 'fulltime', match: m, id: eventId(m, m.seq), seq: m.seq, score: [m.hs, m.as] });
    return true;
  }

  /** France – Argentina's planned changes that are due (`applyPlan`, `luau:7451`). */
  private applyPlan(out: Outgoing[], m: SimMatch): void {
    const keep: SimEvent[] = [];
    for (const e of m.plan) {
      if (e.min > m.min) {
        keep.push(e);
        continue;
      }
      const lu = m.lu[e.side];
      // A planned change only happens if both players are still where the plan expects.
      if (e.kind !== 'sub' || (!lu.off.has(e.on) && !lu.on.has(e.pn))) {
        if (e.kind === 'yc') {
          e.on = pickPlayer(m, otherSide(e.side), 'any', -1, this.rand);
          e.o = nameOf(sideTeam(m, otherSide(e.side)), e.on);
        }
        e.txt = sayLine(m, e, this.rand);
        applyToLineup(m, e);
        this.send(out, m, e);
      }
    }
    m.plan = keep;
  }

  /** A new minute of a live match: its corners, shots, fouls and momentum (`stepMinute`). */
  private stepMinute(out: Outgoing[], m: SimMatch): void {
    for (const e of genMinute(m, m.min, this.rand)) {
      this.send(out, m, e);
      this.noteSave(out, m, e);
    }
    stepMomentum(m, m.min, this.rand);
    refreshStats(m);
  }

  /** A shot on target at the followed goalkeeper is a save, and the card tells it as it happens. */
  private noteSave(out: Outgoing[], m: SimMatch, e: SimEvent): void {
    const f = this.followed;
    if (!f || (e.kind !== 'sot' && e.kind !== 'big') || e.on !== f.n) return;
    const side = otherSide(e.side);
    if (sideTeam(m, side) !== f.team || !isOnPitch(m, side, f.n)) return;
    out.push({ type: 'action', match: m, side, player: f.n, text: `${e.kind === 'big' ? 'Big save' : 'Saves'} from ${e.p}`, act: 'save', onBall: true });
  }

  /** The followed player's match: live, then today, then tomorrow, then yesterday (`matchOf`). */
  private matchOf(team: string): [SimMatch, LSide] | undefined {
    let best: SimMatch | undefined;
    let bestScore = -1;
    for (const m of this.matches) {
      if (m.h === team || m.a === team) {
        const sc = m.status === 'live' ? 4 : m.day === 1 ? 3 : m.day === 2 ? 2 : 1;
        if (sc > bestScore) {
          best = m;
          bestScore = sc;
        }
      }
    }
    return best ? [best, best.h === team ? 'h' : 'a'] : undefined;
  }

  // ── Steps ─────────────────────────────────────────────────────────────────

  /** One tick: 6 match seconds (`tick`, `luau:7592`). */
  tick(): Outgoing[] {
    const out: Outgoing[] = [];
    this.ticks += 1;
    this.elapsed += TICK_SECONDS;
    let anyLive = false;
    let changed = false;
    for (const m of this.matches) {
      if (m.status !== 'live') continue;
      anyLive = true;
      m.sec += TICK_SECONDS;
      if (m.sec >= 60) {
        m.sec -= 60;
        m.min += 1;
        if (m.feat) this.applyPlan(out, m);
        this.stepMinute(out, m);
        out.push({ type: 'minute', match: m });
        if (m.min >= 90 + 2 + (m.n % 4)) changed = this.endMatch(out, m) || changed;
      }
    }
    if (this.autoGoals && this.rand() < 0.03) {
      // Live matches, the favourite (France – Argentina) first (`liveMatches`).
      const live = this.matches.filter((m) => m.status === 'live').sort((x, y) => Number(y.feat) - Number(x.feat));
      if (live.length > 0) {
        const f = this.featured();
        let m = live[Math.floor(this.rand() * live.length)];
        if (f && f.status === 'live' && this.rand() < 0.35) m = f;
        if (m) changed = this.goal(out, m, this.rand() < 0.5 ? 'h' : 'a', 0) || changed;
      }
    }
    // Everything finished: start the evening again after a rest.
    if (!anyLive && this.loop) {
      if (this.restTicks < 0) this.restTicks = 0;
      this.restTicks += 1;
      if (this.restTicks > REST_TICKS) {
        this.restart();
        out.push({ type: 'snapshot' });
        return out;
      }
    }
    // A snapshot carries the clocks, stats, momentum, ratings and tables. A goal moves a table
    // and a final whistle its live marks, so one follows at once.
    if (changed || this.ticks % SNAPSHOT_TICKS === 0) out.push({ type: 'snapshot' });
    return out;
  }

  /** A new evening (`resetSim`, `luau:7570`). The random stream carries on. */
  private restart(): void {
    this.round += 1;
    this.restTicks = -1;
    this.lastAct = '';
    this.matches = makeMatches(this.seed, this.round * 100);
  }

  /**
   * What the followed player just did (`followAct`, `luau:7508`). Returns the match seconds until
   * the next one is due.
   */
  followStep(out: Outgoing[]): number {
    const next = 2.6 + this.followRand() * 2.8;
    const f = this.followed;
    if (!f) return next;
    const found = this.matchOf(f.team);
    if (!found) return next;
    const [m, side] = found;
    if (m.status !== 'live' || !isOnPitch(m, side, f.n)) return next;
    const rnd = this.followRand;
    const line = lineIn(m, side, f.n);
    const acts = line === 'GK' ? KEEPER_ACTS : ACTS;
    const total = acts.reduce((s, a) => s + a[1], 0);
    let x = rnd() * total;
    let pick = acts[0];
    for (const a of acts) {
      x -= a[1];
      if (x <= 0) {
        pick = a;
        break;
      }
    }
    if (!pick) return next;
    // A shot lands in the match's events and its team stats, so it only happens while he is
    // within what his line shoots in a match; otherwise he just keeps the ball.
    const budget = Math.ceil(((PROFILE[line] ?? PROFILE.MF)?.[3] ?? 0) * Math.min(m.min, 90) / 90);
    const had = m.events.filter((e) => e.side === side && e.pn === f.n && (e.kind === 'goal' || e.kind === 'sot' || e.kind === 'miss' || e.kind === 'block' || e.kind === 'big')).length;
    if ((pick[0] === 'shot' || pick[0] === 'miss') && had >= budget) pick = acts[0] ?? pick;
    const [kind, , template] = pick;
    const os = otherSide(side);
    const team = sideTeam(m, side);
    const oteam = sideTeam(m, os);
    let s = template;
    s = s.split('{M}').join(nameOf(team, pickPlayer(m, side, 'any', f.n, rnd)));
    s = s.split('{Q}').join(nameOf(oteam, pickPlayer(m, os, 'defend', -1, rnd)));
    s = s.split('{K}').join(nameOf(oteam, keeperOf(m, os)));
    if (kind === 'shot' || kind === 'miss') {
      const e = mkEvent(m, kind === 'shot' ? 'sot' : 'miss', side, m.min, f.n, kind === 'shot' ? keeperOf(m, os) : 0, '');
      e.xg = kind === 'shot' ? 0.06 + rnd() * 0.12 : 0.03 + rnd() * 0.08;
      e.txt = sayLine(m, e, rnd);
      this.send(out, m, e);
      refreshStats(m);
    }
    const onBall = BALL_ON.has(kind);
    // Still off the ball, doing the same thing: nothing new to say.
    if (s === this.lastAct && !onBall) return next;
    this.lastAct = s;
    out.push({ type: 'action', match: m, side, player: f.n, text: s, act: kind, onBall });
    return next;
  }

  /** Fires one of the dev panel's triggers (`luau:8209–8268`). False when it had nothing to act on. */
  trigger(name: DemoTrigger, out: Outgoing[]): boolean {
    const f = this.featured();
    const fol = this.followed;
    const folMatch = fol ? this.matchOf(fol.team) : undefined;
    let done = false;
    switch (name) {
      case 'goalHome':
      case 'goalAway':
        done = f ? this.goal(out, f, name === 'goalHome' ? 'h' : 'a', 0) : false;
        break;
      case 'redHome':
      case 'redAway':
        done = f ? this.sendOff(out, f, name === 'redHome' ? 'h' : 'a', 0) : false;
        break;
      case 'goalFavorite':
      case 'redFavorite': {
        if (!fol || !folMatch) break;
        const [m, side] = folMatch;
        if (m.status !== 'live' || !isOnPitch(m, side, fol.n)) break;
        done = name === 'goalFavorite' ? this.goal(out, m, side, fol.n) : this.sendOff(out, m, side, fol.n);
        break;
      }
      case 'fullTime': {
        // The followed player's match, or France – Argentina when his isn't live.
        const m = folMatch && folMatch[0].status === 'live' ? folMatch[0] : f;
        done = m ? this.endMatch(out, m) : false;
        break;
      }
    }
    if (done) out.push({ type: 'snapshot' });
    return done;
  }
}
