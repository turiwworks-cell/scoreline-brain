// Tonight's leaders: every player who has played in one of today's started matches and has a
// rating, best first (`leaders`, `luau:6887–6910`, with the player numbers of `playerStats`,
// `luau:2840–2919`).
//
// This is the Lua's live-data path: a rating comes only from the feed's `players` lines. The
// Lua's modelled ratings (its demo, `rng` per player) belong to the DemoSource, which sends them
// as `players` lines like any other source.

import { liveMinute } from './clock';
import type { DomainState, Lineup, Match, Side } from './types';

export interface Leader {
  readonly match: Match;
  readonly side: Side;
  readonly n: number;
  readonly rating: number;
}

/**
 * The side's line-up, or with no line-up of eleven, the squad in shirt order: eleven on, the
 * rest on the bench (shirts 1–11 when the squad has fewer than eleven) (`lineupOf`, `luau:7790`).
 */
export function lineupOf(state: Pick<DomainState, 'players'>, match: Pick<Match, 'home' | 'away' | 'lineups'>, side: Side): Lineup {
  const team = side === 'home' ? match.home : match.away;
  const src = match.lineups?.[side];
  if (src && src.xi.length >= 11) return src;
  let ns = Object.values(state.players)
    .filter((p) => p.team === team)
    .map((p) => p.n)
    .sort((a, b) => a - b);
  if (ns.length < 11) ns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return { formation: src?.formation ?? '4-3-3', xi: ns.slice(0, 11), bench: ns.slice(11) };
}

/** Whether a player took part, from the line-up, the subs and the red cards (`luau:2849–2856`). */
function played(match: Match, side: Side, xi: readonly number[], n: number, minute: number): boolean {
  if (match.status === 'scheduled') return false;
  const now = Math.min(minute, 90);
  let on: number | undefined;
  let off: number | undefined;
  let red: number | undefined;
  for (const e of match.events) {
    if (e.side !== side) continue;
    if (e.kind === 'sub') {
      if (e.player === n) on = e.minute;
      if (e.other === n) off = e.minute;
    } else if (e.kind === 'red' && e.player === n) {
      red = e.minute;
    }
  }
  const start = xi.includes(n) ? 0 : (on ?? -1);
  const stop = off ?? red ?? now;
  const mins = start < 0 ? 0 : Math.max(0, Math.min(stop, now) - start);
  return mins > 0 || start >= 0;
}

/** Today's best rated players, highest first; equal ratings keep match, side and line-up order. */
export function leaders(state: Pick<DomainState, 'matches' | 'matchOrder' | 'players'>, now: number): Leader[] {
  const list: Leader[] = [];
  for (const id of state.matchOrder) {
    const m = state.matches[id];
    if (!m || m.status === 'scheduled' || m.day !== 0) continue;
    const minute = liveMinute(m, now).minute;
    for (const side of ['home', 'away'] as const) {
      const lu = lineupOf(state, m, side);
      for (const n of [...lu.xi, ...lu.bench]) {
        const line = m.players?.[side][String(n)];
        // Without the provider's numbers there is no rating to rank.
        if (!line) continue;
        const rating = line.rating ?? 0;
        const mins = line.minutes;
        const didPlay = (mins !== undefined && mins > 0) || played(m, side, lu.xi, n, minute);
        if (didPlay && rating > 0) list.push({ match: m, side, n, rating });
      }
    }
  }
  // Array.prototype.sort is stable, so ties stay in the order above.
  return list.sort((a, b) => b.rating - a.rating);
}

