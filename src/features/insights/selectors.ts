import {
  insightGoals,
  insightLeaders,
  insightTables,
  type InsightGoal,
  type InsightLeader,
  type InsightTable,
} from '../../domain/insights';
import type { DomainState } from '../../domain';
import type { ScorelineState } from '../../store';

type Selector<T> = (s: ScorelineState) => T;

function derived<T>(compute: (d: DomainState) => readonly T[], equal: (a: T, b: T) => boolean): Selector<readonly T[]> {
  let seen: Pick<DomainState, 'matches' | 'matchOrder' | 'leagues' | 'players'> | undefined;
  let last: readonly T[] = [];
  return ({ domain: d }) => {
    if (seen && d.matches === seen.matches && d.matchOrder === seen.matchOrder && d.leagues === seen.leagues && d.players === seen.players)
      return last;
    seen = d;
    const next = compute(d).map((v, i) => (last[i] && equal(last[i], v) ? last[i]! : v));
    if (next.length !== last.length || next.some((v, i) => v !== last[i])) last = next;
    return last;
  };
}

export const selectInsightLeaders = derived<InsightLeader>(
  (d) => insightLeaders(d, Date.now()),
  (a, b) =>
    a.matchId === b.matchId &&
    a.team === b.team &&
    a.opponent === b.opponent &&
    a.n === b.n &&
    a.rating === b.rating &&
    a.flags.goals === b.flags.goals &&
    a.flags.assists === b.flags.assists &&
    a.flags.yellow === b.flags.yellow &&
    a.flags.redAt === b.flags.redAt,
);

export const selectInsightGoals = derived<InsightGoal>(insightGoals, (a, b) => a.matchId === b.matchId && a.event === b.event);

const tables = new Map<number | undefined, Selector<readonly InsightTable[]>>();
export function selectInsightTables(matchId?: number): Selector<readonly InsightTable[]> {
  let sel = tables.get(matchId);
  if (!sel) {
    sel = derived(
      (d) => insightTables(d, matchId),
      (a, b) =>
        a.league === b.league &&
        a.rows.length === b.rows.length &&
        a.rows.every((r, i) => {
          const t = b.rows[i]!;
          return (
            r.team === t.team &&
            r.p === t.p &&
            r.w === t.w &&
            r.d === t.d &&
            r.l === t.l &&
            r.gd === t.gd &&
            r.pts === t.pts &&
            r.live === t.live
          );
        }),
    );
    tables.set(matchId, sel);
  }
  return sel;
}
