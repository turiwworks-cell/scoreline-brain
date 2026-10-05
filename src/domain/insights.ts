import { leaders } from './leaders';
import { playerFlags, type Flags } from './playerStats';
import { standings, type StandingRow } from './standings';
import type { DomainState, League, MatchEvent } from './types';

export interface InsightTable {
  readonly league: League;
  readonly rows: readonly StandingRow[];
}

/** Open match's league first, then the feed's league order; no empty friendly tables. */
export function insightTables(state: DomainState, matchId?: number): InsightTable[] {
  const first = matchId === undefined ? undefined : state.matches[matchId]?.league;
  const all = Object.values(state.leagues)
    .map((league) => ({ league, rows: standings(state, league.id) }))
    .filter((t) => t.rows.length > 0);
  return [...all.filter((t) => t.league.id === first), ...all.filter((t) => t.league.id !== first)];
}

export interface InsightLeader {
  readonly matchId: number;
  readonly team: string;
  readonly opponent: string;
  readonly n: number;
  readonly rating: number;
  readonly flags: Flags;
}

export function insightLeaders(state: DomainState, now: number): InsightLeader[] {
  return leaders(state, now)
    .slice(0, 8)
    .map(({ match, side, n, rating }) => ({
      matchId: match.id,
      team: side === 'home' ? match.home : match.away,
      opponent: side === 'home' ? match.away : match.home,
      n,
      rating,
      flags: playerFlags(state, match, side, n),
    }));
}

export interface InsightGoal {
  readonly matchId: number;
  readonly event: MatchEvent;
}

/** Contract v2 has no event timestamp: minute, then stream sequence, then feed order. */
export function insightGoals(state: DomainState): InsightGoal[] {
  const list: InsightGoal[] = [];
  for (const id of state.matchOrder) {
    const match = state.matches[id];
    if (!match || match.day !== 0 || match.status === 'scheduled') continue;
    for (const event of match.events) if (event.kind === 'goal' && !event.cancelled) list.push({ matchId: id, event });
  }
  return list.sort((a, b) => b.event.minute - a.event.minute || (a.matchId === b.matchId ? b.event.seq - a.event.seq : 0));
}
