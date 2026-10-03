// The Stats tab's numbers (stats, luau:5327; STAT_KEYS, luau:7683; refreshStats, luau:2709). Pure.
// (Named apart from Stats.tsx: the two would clash as stats.ts / Stats.ts on a case-blind disk.)

import type { Match } from '../../domain';

export type StatFormat = 'int' | 'xg';

export interface StatLine {
  readonly key: string;
  readonly name: string;
  readonly home: number;
  readonly away: number;
  readonly fmt: StatFormat;
}

// luau:7683, in the Lua's order: the pair's key in the feed, its name, and how it is written
const STAT_KEYS: readonly (readonly [string, string, StatFormat])[] = [
  ['xg', 'xG', 'xg'],
  ['shots', 'Shots', 'int'],
  ['onTarget', 'On target', 'int'],
  ['bigChances', 'Big chances', 'int'],
  ['corners', 'Corners', 'int'],
  ['passes', 'Passes', 'int'],
  ['fouls', 'Fouls', 'int'],
  ['offsides', 'Offsides', 'int'],
];

/** `fmtNum` (luau:4697): whole numbers floored, xG to two places with trailing zeros dropped. */
export function fmtNum(v: number, fmt: StatFormat): string {
  if (fmt === 'int') return String(Math.floor(v));
  return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

const r2 = (x: number) => Math.floor(x * 100 + 0.5) / 100;

/**
 * The stat lines to show, in the Lua's order. The feed's pairs when it sent any (matchStats,
 * luau:7843); otherwise counted from the events the way refreshStats does (luau:2709). Passes are
 * left out of a count: the Lua made them up from possession, and the events don't carry them.
 */
export function statLines(match: Pick<Match, 'stats' | 'events'>): readonly StatLine[] {
  const pairs = match.stats?.pairs;
  const sent = pairs ? STAT_KEYS.filter(([k]) => pairs[k] !== undefined) : [];
  if (pairs && sent.length > 0) {
    return sent.map(([key, name, fmt]) => ({ key, name, fmt, home: pairs[key]![0], away: pairs[key]![1] }));
  }
  // xG, shots, on target, big chances, corners, fouls, offsides
  const c = { home: [0, 0, 0, 0, 0, 0, 0], away: [0, 0, 0, 0, 0, 0, 0] };
  for (const e of match.events) {
    const t = c[e.side];
    const k = e.kind;
    if (k === 'goal' && e.cancelled) continue;
    if (k === 'goal' || k === 'shot' || k === 'miss' || k === 'blocked' || k === 'bigChance') {
      const xg = e.xg ?? 0;
      t[0]! += xg;
      t[1]! += 1;
      if (k === 'goal' || k === 'shot' || k === 'bigChance') t[2]! += 1;
      if (k === 'bigChance' || (k === 'goal' && xg > 0.33)) t[3]! += 1;
    } else if (k === 'corner') t[4]! += 1;
    // a free kick is the other side's foul
    else if (k === 'foul') c[e.side === 'home' ? 'away' : 'home'][5]! += 1;
    else if (k === 'offside') t[6]! += 1;
  }
  const at = (i: number) => [c.home[i]!, c.away[i]!] as const;
  const counted: Record<string, readonly [number, number]> = {
    xg: [r2(c.home[0]!), r2(c.away[0]!)],
    shots: at(1),
    onTarget: at(2),
    bigChances: at(3),
    corners: at(4),
    fouls: at(5),
    offsides: at(6),
  };
  return STAT_KEYS.filter(([k]) => counted[k]).map(([key, name, fmt]) => ({ key, name, fmt, home: counted[key]![0], away: counted[key]![1] }));
}

/** Possession for the home side, 0–100: the feed's, else even (luau:7849). */
export const possessionOf = (match: Pick<Match, 'stats'>) => match.stats?.possession ?? 50;

/**
 * The share of a stat's bar that is the home side's (luau:5369): a side with nothing still keeps
 * a sliver, so two zeros split evenly.
 */
export function homeShare(home: number, away: number): number {
  const a = Math.max(home, 0.01);
  const b = Math.max(away, 0.01);
  return a / (a + b);
}
