// The demo's match model: who is on the pitch, weighted picks, goals, commentary, the minute by
// minute simulation and player numbers. A port of `luau:2267–2923` that keeps the Lua's rules,
// weights, rates and its order of random draws. Nothing here knows about time or the wire.

import type { GoalStyle } from '../../domain';
import { COACHES, FIXTURES, LINES, LINEUPS, PAST, PLAN, PROFILE, SAY, SQUADS, TEAMS, type DemoTeam, type Fixture, type LuaStatus } from './data';
import { rng, streamSeed, type Rand } from './rng';

export type LSide = 'h' | 'a';
/** The Lua's event kinds. `foulx` is a foul nobody comments on: it only counts in the stats. */
export type SimKind = 'goal' | 'yc' | 'rc' | 'sub' | 'sot' | 'miss' | 'block' | 'big' | 'corner' | 'foul' | 'foulx' | 'offside';

export interface SimEvent {
  kind: SimKind;
  side: LSide;
  min: number;
  /** The player (for a sub: the one coming on). 0 = none. */
  pn: number;
  /** Same side for a goal (assist) or a sub (player off), the opponent otherwise. 0 = none. */
  on: number;
  gt: GoalStyle | '';
  /** Shirt names of `pn` and `on`, for commentary. */
  p: string;
  o: string;
  txt: string;
  xg: number;
  /** Set when the event goes out (or into a snapshot): its wire id, its `seq` and the score after it. */
  id: string;
  seq: number;
  score: [number, number];
}

export interface SimLineup {
  readonly team: string;
  readonly form: string;
  readonly xi: readonly number[];
  readonly bench: readonly number[];
  /** Minute a sub came on / a player went off, keyed by shirt. */
  readonly on: Map<number, number>;
  readonly off: Map<number, number>;
  /** Who a sub came on for. */
  readonly forr: Map<number, number>;
  readonly goals: Map<number, number>;
  readonly assists: Map<number, number>;
  readonly yc: Map<number, number>;
  readonly rc: Map<number, number>;
}

export type StatKey = 'xg' | 'shots' | 'onTarget' | 'bigChances' | 'corners' | 'passes' | 'fouls' | 'offsides';

export interface SimMatch {
  /** The fixture's place in `FIXTURES` (1-based): the Lua's match id, which seeds its streams. */
  readonly n: number;
  /** The wire id. */
  readonly id: number;
  /** Lua day: 0 yesterday, 1 today, 2 tomorrow. */
  readonly day: number;
  readonly lg: string;
  readonly h: string;
  readonly a: string;
  hs: number;
  as: number;
  status: LuaStatus;
  min: number;
  sec: number;
  readonly time: string;
  readonly feat: boolean;
  /** Every event so far, in the order it happened. */
  readonly events: SimEvent[];
  /** France – Argentina's planned events still to come. */
  plan: SimEvent[];
  /** Momentum after each minute: `mom[k]` is the Lua's `mom[k + 1]`. */
  readonly mom: number[];
  poss: number;
  stats: Record<StatKey, [number, number]>;
  readonly lu: { readonly h: SimLineup; readonly a: SimLineup };
  /** The followed player's own numbers: touches, passes, completed, key passes, dribbles. */
  readonly fx: Map<string, number[]>;
  /** The match's `seq`: the last one handed out. */
  seq: number;
}

// ── People ───────────────────────────────────────────────────────────────────

export interface Person {
  readonly n: number;
  readonly first: string;
  readonly last: string;
  readonly short: string;
  readonly pos: string;
  readonly role: string;
  readonly club: string;
  /** y, m, d; 0s when unknown. */
  readonly born: readonly [number, number, number];
  readonly h: number;
}

// `luau:2271–2296`
const PEOPLE = new Map<string, Map<number, Person>>();
const COACH = new Map<string, string>();
for (const [team, rows] of Object.entries(SQUADS)) {
  const people = new Map<number, Person>();
  for (const row of rows) {
    const [n, first, last, short, pos] = row;
    const full = row.length === 11;
    const p: Person = {
      n,
      first,
      last,
      short,
      pos,
      role: full ? row[5] : '',
      club: full ? row[6] : '',
      born: full ? [row[7], row[8], row[9]] : [0, 0, 0],
      h: full ? row[10] : 0,
    };
    if (pos === 'CO') COACH.set(team, first === '' ? last : `${first} ${last}`);
    else people.set(n, p);
  }
  PEOPLE.set(team, people);
}
for (const [team, [first, last]] of Object.entries(COACHES)) if (!COACH.has(team)) COACH.set(team, `${first} ${last}`);

export const TEAM_BY_ID = new Map<string, DemoTeam>(TEAMS.map((t) => [t.id, t]));

export const person = (team: string, n: number): Person | undefined => PEOPLE.get(team)?.get(n);
export const squadOf = (team: string): readonly Person[] => [...(PEOPLE.get(team)?.values() ?? [])];
export const coachOf = (team: string): string | undefined => COACH.get(team);

/** `luau:2312` */
export const nameOf = (team: string, n: number): string => person(team, n)?.short ?? `#${n}`;
const teamName = (team: string): string => TEAM_BY_ID.get(team)?.name ?? team;

// ── Formations (`luau:2321–2352`): only what picks a player's line ───────────

const formRows = (form: string): number[] => [1, ...(form.match(/\d+/g) ?? []).map((d) => Number(d) || 1)];

function slotRow(form: string, slot: number): number {
  const rows = formRows(form);
  let k = slot;
  for (let i = 0; i < rows.length; i++) {
    const n = rows[i] ?? 1;
    if (k <= n) return i + 1;
    k -= n;
  }
  return rows.length;
}

function slotLine(form: string, slot: number): string {
  const row = slotRow(form, slot);
  if (row === 1) return 'GK';
  if (row === 2) return 'DF';
  if (row === formRows(form).length) return 'FW';
  return 'MF';
}

/** `luau:2384` */
const lineOf = (team: string, n: number, form: string, slot: number): string => person(team, n)?.pos ?? slotLine(form, slot);

// ── Matches (`luau:2390–2437`) ───────────────────────────────────────────────

function newLineup(team: string): SimLineup {
  const src = LINEUPS[team];
  return {
    team,
    form: src?.[0] ?? '4-3-3',
    xi: src ? [...src[1]] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bench: src ? [...src[2]] : [],
    on: new Map(),
    off: new Map(),
    forr: new Map(),
    goals: new Map(),
    assists: new Map(),
    yc: new Map(),
    rc: new Map(),
  };
}

const zeroStats = (): Record<StatKey, [number, number]> => ({
  xg: [0, 0],
  shots: [0, 0],
  onTarget: [0, 0],
  bigChances: [0, 0],
  corners: [0, 0],
  passes: [0, 0],
  fouls: [0, 0],
  offsides: [0, 0],
});

function newMatch(n: number, id: number, f: Fixture, seed: number): SimMatch {
  const r = rng(streamSeed(seed, n * 7919));
  const [day, lg, h, a, hs, as, status, min, time] = f;
  return {
    n,
    id,
    day,
    lg,
    h,
    a,
    hs,
    as,
    status,
    min,
    sec: Math.floor(r() * 50),
    time: time ?? '',
    feat: h === 'fra' && a === 'arg',
    events: [],
    plan: [],
    mom: [],
    poss: 50,
    stats: zeroStats(),
    lu: { h: newLineup(h), a: newLineup(a) },
    fx: new Map(),
    seq: 0,
  };
}

/** An event's wire id: unique within its match, never re-used. */
export const eventId = (m: Pick<SimMatch, 'id'>, seq: number): string => `d${m.id}-${seq}`;

/**
 * The demo's matches, built up to their current minute. `idBase` is added to each Lua id. The
 * history is numbered from `seq` 1, in the order it happened; the match's `seq` is the last one.
 */
export function makeMatches(seed: number, idBase: number): SimMatch[] {
  return FIXTURES.map((f, i) => {
    const m = newMatch(i + 1, idBase + i + 1, f, seed);
    ensureEvents(m, seed);
    for (const e of m.events) {
      if (e.kind !== 'foulx') {
        m.seq += 1;
        e.id = eventId(m, m.seq);
      }
      e.seq = m.seq;
    }
    return m;
  });
}

export const sideTeam = (m: SimMatch, side: LSide): string => (side === 'h' ? m.h : m.a);
export const otherSide = (side: LSide): LSide => (side === 'h' ? 'a' : 'h');

const bump = (map: Map<number, number>, k: number) => map.set(k, (map.get(k) ?? 0) + 1);

/** Records a goal, card or substitution on the line-ups (`applyEvent`, `luau:2448`). */
export function applyToLineup(m: SimMatch, e: SimEvent): void {
  const lu = m.lu[e.side];
  if (e.kind === 'goal' && e.pn > 0) {
    bump(lu.goals, e.pn);
    if (e.on > 0) bump(lu.assists, e.on);
  } else if (e.kind === 'yc' && e.pn > 0) {
    lu.yc.set(e.pn, e.min);
  } else if (e.kind === 'rc' && e.pn > 0) {
    lu.rc.set(e.pn, e.min);
  } else if (e.kind === 'sub') {
    lu.on.set(e.pn, e.min);
    lu.off.set(e.on, e.min);
    lu.forr.set(e.pn, e.on);
  }
}

/** `mkEvent`, `luau:2467`. */
export function mkEvent(m: SimMatch, kind: SimKind, side: LSide, min: number, pn: number, on: number, gt: GoalStyle | ''): SimEvent {
  const team = sideTeam(m, side);
  const own = kind === 'goal' || kind === 'sub';
  const oteam = own ? team : sideTeam(m, otherSide(side));
  return { kind, side, min, pn, on, gt, p: nameOf(team, pn), o: on > 0 ? nameOf(oteam, on) : '', txt: '', xg: 0, id: '', seq: 0, score: [0, 0] };
}

// ── Who is on the pitch, weighted picks, goals and commentary (`luau:2521–2668`) ─────────────

const slotOf = (lu: SimLineup, n: number): number => lu.xi.indexOf(n) + 1;

interface OnPitch {
  readonly n: number;
  readonly line: string;
}

export function onPitch(m: SimMatch, side: LSide): OnPitch[] {
  const lu = m.lu[side];
  const out: OnPitch[] = [];
  lu.xi.forEach((n, i) => {
    if (!lu.off.has(n) && !lu.rc.has(n)) out.push({ n, line: lineOf(lu.team, n, lu.form, i + 1) });
  });
  for (const n of lu.on.keys()) {
    if (!lu.off.has(n) && !lu.rc.has(n)) {
      const sl = slotOf(lu, lu.forr.get(n) ?? 0);
      out.push({ n, line: lineOf(lu.team, n, lu.form, sl > 0 ? sl : 9) });
    }
  }
  return out;
}

/** Whether a shirt is on the pitch: started or came on, and hasn't gone off or been sent off. */
export function isOnPitch(m: SimMatch, side: LSide, n: number): boolean {
  const lu = m.lu[side];
  return (slotOf(lu, n) > 0 || lu.on.has(n)) && !lu.off.has(n) && !lu.rc.has(n);
}

export const keeperOf = (m: SimMatch, side: LSide): number => m.lu[side].xi[0] ?? 0;

type Weights = Readonly<Record<string, number>>;
const W_BY: Readonly<Record<string, Weights>> = {
  score: { GK: 0, DF: 0.5, MF: 1.6, FW: 4.5 },
  assist: { GK: 0.05, DF: 1.1, MF: 2.6, FW: 1.8 },
  shot: { GK: 0, DF: 0.6, MF: 1.6, FW: 3.2 },
  corner: { GK: 0, DF: 0.4, MF: 2.4, FW: 1.6 },
  defend: { GK: 0, DF: 3, MF: 1.4, FW: 0.3 },
  foul: { GK: 0, DF: 1.4, MF: 1.6, FW: 1.8 },
  card: { GK: 0.1, DF: 2.2, MF: 2, FW: 0.8 },
  any: { GK: 0.3, DF: 1, MF: 1, FW: 1 },
};

export function pickPlayer(m: SimMatch, side: LSide, kind: string, skip: number, rnd: Rand): number {
  const list = onPitch(m, side);
  const weights = W_BY[kind] ?? W_BY.any ?? {};
  let total = 0;
  for (const p of list) if (p.n !== skip) total += weights[p.line] ?? 1;
  let x = rnd() * total;
  for (const p of list) {
    if (p.n !== skip) {
      x -= weights[p.line] ?? 1;
      if (x <= 0) return p.n;
    }
  }
  return list.at(-1)?.n ?? 0;
}

/** Builds a goal event; the score doesn't change yet (`makeGoal`). */
export function makeGoal(m: SimMatch, side: LSide, forced: number, rnd: Rand): SimEvent {
  const players = onPitch(m, side);
  const scorer = players.some((p) => p.n === forced) ? forced : pickPlayer(m, side, 'score', -1, rnd);
  const assist = rnd() < 0.18 ? 0 : pickPlayer(m, side, 'assist', scorer, rnd);
  let gt: GoalStyle = 'solo';
  if (assist > 0) {
    const aline = players.find((p) => p.n === assist)?.line ?? '';
    const roll = rnd();
    if (aline === 'DF') gt = roll < 0.6 ? 'header' : 'cutback';
    else if (aline === 'FW') gt = roll < 0.5 ? 'cutback' : 'through';
    else gt = roll < 0.65 ? 'through' : 'header';
  }
  const e = mkEvent(m, 'goal', side, Math.min(m.min, 95), scorer, assist, gt);
  e.xg = 0.12 + rnd() * 0.45;
  return e;
}

/** Replaces every `token`, taking `value` literally (like the Lua's names, never a pattern). */
const fill = (s: string, token: string, value: string) => s.split(token).join(value);

export function commentary(m: SimMatch, e: SimEvent): string {
  const set = LINES[e.gt === '' ? 'solo' : e.gt];
  let s = set[e.min % set.length] ?? '';
  const os = otherSide(e.side);
  s = fill(s, '{S}', e.p);
  s = fill(s, '{A}', e.o !== '' ? e.o : 'a team-mate');
  s = fill(s, '{K}', nameOf(sideTeam(m, os), keeperOf(m, os)));
  return s;
}

/** One line of commentary for any non-goal event (`sayLine`). */
export function sayLine(m: SimMatch, e: SimEvent, rnd: Rand): string {
  if (e.kind === 'foulx') return '';
  const set = SAY[e.kind];
  if (!set) return '';
  let s = set[Math.floor(rnd() * set.length)] ?? '';
  const team = sideTeam(m, e.side);
  const os = otherSide(e.side);
  const mate = pickPlayer(m, e.side, 'any', e.pn, rnd);
  const q = e.kind === 'sub' ? e.o : e.o !== '' ? e.o : nameOf(sideTeam(m, os), pickPlayer(m, os, 'defend', -1, rnd));
  s = fill(s, '{P}', e.p);
  s = fill(s, '{Q}', q);
  s = fill(s, '{K}', nameOf(sideTeam(m, os), keeperOf(m, os)));
  s = fill(s, '{M}', nameOf(team, mate));
  s = fill(s, '{T}', teamName(team));
  return s;
}

// ── The match, minute by minute (`luau:2670–2848`) ───────────────────────────

// Per team, per minute.
const RATE: readonly (readonly [SimKind, number])[] = [
  ['sot', 0.042],
  ['miss', 0.045],
  ['block', 0.028],
  ['big', 0.012],
  ['corner', 0.052],
  ['foul', 0.026],
  ['foulx', 0.085],
  ['offside', 0.02],
];
const XG: Partial<Record<SimKind, readonly [number, number]>> = { sot: [0.05, 0.16], miss: [0.03, 0.1], block: [0.03, 0.07], big: [0.35, 0.3] };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** The side ahead and the home side push a little more. */
function strength(m: SimMatch, side: LSide): number {
  const lead = side === 'h' ? m.hs - m.as : m.as - m.hs;
  return clamp(1 + (side === 'h' ? 0.08 : 0) - lead * 0.06, 0.7, 1.3);
}

export function genMinute(m: SimMatch, minute: number, rnd: Rand): SimEvent[] {
  const out: SimEvent[] = [];
  for (const side of ['h', 'a'] as const) {
    const k = strength(m, side);
    for (const [kind, rate] of RATE) {
      if (rnd() < rate * k) {
        const os = otherSide(side);
        const pk = kind === 'corner' ? 'corner' : kind === 'foul' || kind === 'foulx' || kind === 'offside' ? 'foul' : 'shot';
        const pn = pickPlayer(m, side, pk, -1, rnd);
        let on = 0;
        if (kind === 'sot' || kind === 'big') on = keeperOf(m, os);
        else if (kind === 'block' || kind === 'corner' || kind === 'foul' || kind === 'foulx') on = pickPlayer(m, os, 'defend', -1, rnd);
        const e = mkEvent(m, kind, side, minute, pn, on, '');
        const xr = XG[kind];
        if (xr) e.xg = xr[0] + rnd() * xr[1];
        e.txt = sayLine(m, e, rnd);
        out.push(e);
      }
    }
  }
  return out;
}

const MOM_W: Partial<Record<SimKind, number>> = { goal: 1.4, big: 0.9, sot: 0.6, miss: 0.4, block: 0.4, corner: 0.35 };

export function stepMomentum(m: SimMatch, minute: number, rnd: Rand): void {
  const prev = m.mom[minute - 1] ?? 0;
  let push = 0;
  for (const e of m.events) if (e.min === minute) push += (e.side === 'h' ? 1 : -1) * (MOM_W[e.kind] ?? 0);
  const v = prev * 0.55 + (rnd() - 0.5 + (m.hs - m.as) * 0.04) * 0.9 + push * 0.6;
  m.mom[minute] = clamp(v, -1, 1);
}

export function refreshStats(m: SimMatch): void {
  // xG, shots, on target, big chances, corners, fouls, offsides
  const c = { h: [0, 0, 0, 0, 0, 0, 0], a: [0, 0, 0, 0, 0, 0, 0] };
  const add = (side: LSide, i: number, x: number) => (c[side][i] = (c[side][i] ?? 0) + x);
  for (const e of m.events) {
    const k = e.kind;
    if (k === 'goal' || k === 'sot' || k === 'miss' || k === 'block' || k === 'big') {
      add(e.side, 0, e.xg);
      add(e.side, 1, 1);
      if (k === 'goal' || k === 'sot' || k === 'big') add(e.side, 2, 1);
      if (k === 'big' || (k === 'goal' && e.xg > 0.33)) add(e.side, 3, 1);
    } else if (k === 'corner') add(e.side, 4, 1);
    else if (k === 'foul' || k === 'foulx') add(otherSide(e.side), 5, 1);
    else if (k === 'offside') add(e.side, 6, 1);
  }
  const mins = Math.max(m.min, 1);
  const ph = Math.floor((m.poss * mins * 5.4) / 50 + 0.5);
  const pa = Math.floor(((100 - m.poss) * mins * 5.4) / 50 + 0.5);
  const r2 = (x: number) => Math.floor(x * 100 + 0.5) / 100;
  const pair = (i: number): [number, number] => [c.h[i] ?? 0, c.a[i] ?? 0];
  m.stats = {
    xg: [r2(c.h[0] ?? 0), r2(c.a[0] ?? 0)],
    shots: pair(1),
    onTarget: pair(2),
    bigChances: pair(3),
    corners: pair(4),
    passes: [ph, pa],
    fouls: pair(5),
    offsides: pair(6),
  };
}

type MajorRow = readonly [kind: 'goal' | 'yc' | 'sub', side: LSide, minute: number, player: number, other: number, style: GoalStyle | ''];

/** Builds the whole match up to its current minute (`ensureEvents`, `luau:2775–2848`). */
function ensureEvents(m: SimMatch, seed: number): void {
  const r = rng(streamSeed(seed, m.n * 977));
  m.poss = 42 + Math.floor(r() * 18);
  if (m.status === 'ns') {
    refreshStats(m);
    return;
  }
  // The big moments, by minute.
  const majors: MajorRow[] = [];
  if (m.feat) {
    majors.push(...PAST);
    m.plan = PLAN.map(([kind, side, min, pn, on, gt]) => mkEvent(m, kind, side, min, pn, on, gt));
  } else {
    const top = Math.max(m.min, 10);
    for (const side of ['h', 'a'] as const) {
      for (let i = 0; i < (side === 'h' ? m.hs : m.as); i++) majors.push(['goal', side, Math.max(3, Math.floor(r() * top)), 0, 0, '']);
    }
    const cards = 1 + Math.floor(r() * 3);
    for (let i = 0; i < cards; i++) {
      const side: LSide = r() < 0.5 ? 'h' : 'a';
      majors.push(['yc', side, 5 + Math.floor(r() * Math.max(top - 5, 5)), 0, 0, '']);
    }
    if (m.min > 56) {
      for (const side of ['h', 'a'] as const) {
        const subs = 1 + Math.floor(r() * 2);
        for (let i = 0; i < subs; i++) majors.push(['sub', side, 56 + Math.floor(r() * Math.min(m.min - 56, 25)), 0, 0, '']);
      }
    }
  }
  // The Lua's table.sort isn't stable; this one is, so equal minutes keep the order they were made in.
  majors.sort((x, y) => x[2] - y[2]);
  let hs = 0;
  let as = 0;
  let mi = 0;
  m.mom[0] = 0;
  const last = Math.min(m.min, 95);
  for (let minute = 1; minute <= last; minute++) {
    for (let f = majors[mi]; f !== undefined && f[2] <= minute; f = majors[mi]) {
      mi += 1;
      const [kind, side, fmin, fp, fo, fgt] = f;
      let e: SimEvent | undefined;
      if (kind === 'goal') {
        const ge = m.feat ? mkEvent(m, 'goal', side, fmin, fp, fo, fgt) : makeGoal(m, side, 0, r);
        ge.min = fmin;
        if (ge.xg <= 0) ge.xg = 0.15 + r() * 0.4;
        if (side === 'h') hs += 1;
        else as += 1;
        ge.txt = commentary(m, ge);
        e = ge;
      } else if (kind === 'yc') {
        const pn = fp > 0 ? fp : pickPlayer(m, side, 'card', -1, r);
        const ye = mkEvent(m, 'yc', side, fmin, pn, pickPlayer(m, otherSide(side), 'any', -1, r), '');
        ye.txt = sayLine(m, ye, r);
        e = ye;
      } else {
        const lu = m.lu[side];
        let onN = fp;
        let offN = fo;
        if (onN <= 0) {
          // An outfield starter still on, replaced by an unused outfield sub.
          const starters = lu.xi.filter((x, si) => si > 0 && !lu.off.has(x));
          offN = starters.length > 0 ? (starters[Math.floor(r() * starters.length)] ?? 0) : 0;
          const pool = lu.bench.filter((b) => !lu.on.has(b) && person(lu.team, b)?.pos !== 'GK');
          onN = pool.length > 0 ? (pool[Math.floor(r() * pool.length)] ?? 0) : 0;
        }
        if (onN > 0 && offN > 0 && !lu.off.has(offN)) {
          const se = mkEvent(m, 'sub', side, fmin, onN, offN, '');
          se.txt = sayLine(m, se, r);
          e = se;
        }
      }
      if (e) {
        e.score = [hs, as];
        applyToLineup(m, e);
        m.events.push(e);
      }
    }
    for (const e of genMinute(m, minute, r)) {
      e.score = [hs, as];
      m.events.push(e);
    }
    stepMomentum(m, minute, r);
  }
  refreshStats(m);
}

// ── Player numbers (`playerStats`, `luau:2850–2919`) ─────────────────────────

export interface PlayerNumbers {
  readonly rating: number;
  readonly minutes: number;
  readonly played: boolean;
  readonly touches: number;
  readonly passes: number;
  readonly passesOk: number;
  readonly shots: number;
}

export function playerStats(m: SimMatch, side: LSide, n: number, seed: number): PlayerNumbers {
  const lu = m.lu[side];
  const team = lu.team;
  const slot = slotOf(lu, n);
  const line = lineOf(team, n, lu.form, slot > 0 ? slot : 6);
  const ns = m.status === 'ns';
  const now = ns ? 0 : Math.min(m.min, 90);
  const start = slot > 0 ? 0 : (lu.on.get(n) ?? -1);
  const stop = lu.off.get(n) ?? lu.rc.get(n) ?? now;
  const mins = start < 0 || ns ? 0 : Math.max(0, Math.min(stop, now) - start);
  const played = mins > 0 || (start >= 0 && !ns);
  const r = rng(streamSeed(seed, n * 131 + team.charCodeAt(0) * 7 + team.charCodeAt(1)));
  const f = mins / 90;
  const pr = PROFILE[line] ?? PROFILE.MF ?? [0, 0, 0, 0, 0, 0];
  const g = lu.goals.get(n) ?? 0;
  const a = lu.assists.get(n) ?? 0;
  const y = lu.yc.has(n) ? 1 : 0;
  const red = lu.rc.has(n) ? 1 : 0;
  let shots = 0;
  let sot = 0;
  for (const e of m.events) {
    if (e.side === side && e.pn === n) {
      const k = e.kind;
      if (k === 'goal' || k === 'sot' || k === 'miss' || k === 'block' || k === 'big') shots += 1;
      if (k === 'goal' || k === 'sot' || k === 'big') sot += 1;
    }
  }
  const fx = m.fx.get(side + n) ?? [0, 0, 0, 0, 0];
  const touches = Math.floor(pr[0] * (0.8 + r() * 0.45) * f + 0.5) + (fx[0] ?? 0);
  let passes = Math.floor(touches * (0.62 + r() * 0.12) + 0.5) + (fx[1] ?? 0);
  const acc = clamp(pr[1] + (r() - 0.5) * 12, 55, 98);
  const passesOk = Math.floor((passes * acc) / 100 + 0.5) + (fx[2] ?? 0);
  passes = Math.max(passes, passesOk);
  r(); // duels won: drawn to keep the Lua's order, shown by the player page later
  const keyp = Math.floor(pr[4] * (0.6 + r() * 0.8) * f + 0.5) + a + (fx[3] ?? 0);
  const saves = Math.floor(pr[5] * (0.6 + r() * 0.8) * f + 0.5);
  const conceded = side === 'h' ? m.as : m.hs;
  let rating = 6.2 + r() * 0.8 + g * 1.1 + a * 0.7 - y * 0.35 - red * 1.4 + (keyp - a) * 0.08 + sot * 0.12;
  if (line === 'GK') rating += saves * 0.18 - conceded * 0.3;
  if (!played) rating = 0;
  return { rating: clamp(Math.floor(rating * 10 + 0.5) / 10, 0, 10), minutes: mins, played, touches, passes, passesOk, shots };
}
