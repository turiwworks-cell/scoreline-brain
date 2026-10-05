// What the Lineup tab knows about a side's evening: who scored, was booked, went off or came on,
// and who is best (applyEvent, luau:2433; the sort and counts in lineup, luau:5640-5655).
// Pure: no React, no DOM.

import type { Lineup, Match, MatchEvent, Player, Side } from '../../../domain';

/** What the events say about one player. */
export interface Marks {
  readonly goals: number;
  readonly assists: number;
  readonly yellow: boolean;
  readonly red: boolean;
  /** the minute he came on */
  readonly on?: number;
  /** the minute he went off */
  readonly off?: number;
  /** the shirt he came on for */
  readonly replaced?: number;
}

export const NO_MARKS: Marks = { goals: 0, assists: 0, yellow: false, red: false };

type Draft = { -readonly [K in keyof Marks]: Marks[K] };

/** Marks for every player the side's events mention. A goal VAR took back counts for nobody. */
export function sideMarks(events: readonly MatchEvent[], side: Side): ReadonlyMap<number, Marks> {
  const out = new Map<number, Draft>();
  const of = (n: number) => {
    let m = out.get(n);
    if (!m) out.set(n, (m = { ...NO_MARKS }));
    return m;
  };
  for (const e of events) {
    if (e.side !== side) continue;
    const pn = e.player ?? 0;
    const other = e.other ?? 0;
    if (e.kind === 'goal' && !e.cancelled) {
      if (pn > 0) of(pn).goals += 1;
      if (pn > 0 && other > 0) of(other).assists += 1;
    } else if (e.kind === 'yellow' && pn > 0) of(pn).yellow = true;
    else if (e.kind === 'red' && pn > 0) of(pn).red = true;
    else if (e.kind === 'sub') {
      // `player` comes on, `other` goes off
      if (pn > 0) {
        const m = of(pn);
        m.on = e.minute;
        if (other > 0) m.replaced = other;
      }
      if (other > 0) of(other).off = e.minute;
    }
  }
  return out;
}

export interface LineupLine {
  readonly rating: number;
  readonly played: boolean;
}

/** A player's rating from the provider's line, and whether he took part (the ratings tag, luau:5435). */
export function lineOf(match: Match, side: Side, n: number, starter: boolean, marks: Marks | undefined): LineupLine {
  const line = match.players?.[side]?.[String(n)];
  const minutes = line?.minutes;
  return { rating: line?.rating ?? 0, played: match.status !== 'scheduled' && (starter || marks?.on !== undefined || (minutes ?? 0) > 0) };
}

/** The first of the eleven with the highest rating, and only when someone has one (luau:5576). */
export function bestOf(match: Match, side: Side, xi: readonly number[]): number {
  let best = 0;
  let bestV = 0;
  for (const n of xi) {
    const v = match.players?.[side]?.[String(n)]?.rating ?? 0;
    if (v > bestV) {
      best = n;
      bestV = v;
    }
  }
  return best;
}

/** The substitutes, the ones who came on first, then by shirt (luau:5640). */
export function benchOrder(bench: readonly number[], marks: ReadonlyMap<number, Marks>): number[] {
  return [...bench].sort((a, b) => {
    const oa = marks.get(a)?.on;
    const ob = marks.get(b)?.on;
    if ((oa !== undefined) !== (ob !== undefined)) return oa !== undefined ? -1 : 1;
    if (oa !== undefined && ob !== undefined && oa !== ob) return oa - ob;
    return a - b;
  });
}

export const GROUPS = [
  ['GK', 'Goalkeepers'],
  ['DF', 'Defenders'],
  ['MF', 'Midfielders'],
  ['FW', 'Forwards'],
] as const;

const ROLES: Readonly<Record<string, string>> = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };

/** His role: the squad's own, else the one his line gives (luau:5530). */
export function roleOf(p: Player | undefined, fallbackLine = 'MF'): string {
  if (p && p.role !== '') return p.role;
  return ROLES[p ? p.pos : fallbackLine] ?? '';
}

/** Before kick-off the squad by line, each by shirt; players the squad doesn't know are left out (squadList, luau:5547). */
export function squadGroups(players: Readonly<Record<string, Player>>, team: string, lineup: Pick<Lineup, 'xi' | 'bench'>) {
  const all = [...lineup.xi, ...lineup.bench];
  return GROUPS.map(([pos, label]) => ({
    pos,
    label,
    ns: all.filter((n) => players[`${team}:${n}`]?.pos === pos).sort((a, b) => a - b),
  })).filter((g) => g.ns.length > 0);
}

/** First and last name as the player rows print them (fullName, luau:2300). */
export function fullName(p: Player | undefined, fallback: string): string {
  if (!p) return fallback;
  return p.first === '' ? p.last : `${p.first} ${p.last}`;
}

/** A coach's two initials, from the first and last of his words. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = Array.from(words[0]!)[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? '') : '';
  return first + last;
}
