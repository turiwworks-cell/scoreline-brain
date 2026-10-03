import { describe, expect, it } from 'vitest';
import { insightGoals, insightLeaders, insightTables } from './insights';
import { demoState, DEMO_T0 } from './testing/demo';
import type { DomainState, TableRow } from './types';

const row = (team: string): TableRow => ({ team, p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, pts: 3 });
function tables(): DomainState {
  const d = demoState();
  return {
    ...d,
    leagues: {
      ...d.leagues,
      wns: { ...d.leagues.wns!, table: [row('fra'), row('arg')] },
      nla: { ...d.leagues.nla!, table: [row('ger'), row('ned')] },
    },
  };
}

describe('desktop insights data', () => {
  it('puts the open league first while preserving feed order for the others', () => {
    expect(insightTables(tables(), 3).map((t) => t.league.id)).toEqual(['nla', 'wns']);
    expect(insightTables(tables(), 1).map((t) => t.league.id)).toEqual(['wns', 'nla']);
  });
  it('skips friendlies without a table, including when the open match is a friendly', () => {
    expect(insightTables(tables(), 11).map((t) => t.league.id)).toEqual(['wns', 'nla']);
    expect(insightTables(demoState())).toEqual([]);
  });
  it('preserves live flags from the shared standings rule', () => {
    expect(insightTables(tables(), 1)[0]!.rows.map((r) => r.live)).toEqual([true, true]);
  });
  it('ranks at most eight actual participants using provider ratings', () => {
    const rows = insightLeaders(demoState(), DEMO_T0);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ team: 'fra', n: 10, rating: 8.4, flags: { goals: 1 } });
    expect(rows.some((r) => r.team === 'bra' && r.n === 30)).toBe(false);
    expect(rows.every((r, i) => i === 0 || rows[i - 1]!.rating >= r.rating)).toBe(true);
  });
  it('excludes yesterday and not-started matches from leaders and goals', () => {
    const d = demoState();
    const other = {
      ...d,
      matches: { ...d.matches, 1: { ...d.matches[1]!, day: -1 }, 2: { ...d.matches[2]!, status: 'scheduled' as const } },
    };
    expect(insightLeaders(other, DEMO_T0)).toEqual([]);
    expect(insightGoals(other)).toEqual([]);
  });
  it('uses each goal’s historical score and omits a VAR-cancelled goal', () => {
    const d = demoState();
    const goals = insightGoals(d);
    expect(goals.map((g) => g.event.id)).toEqual(['e6', 'e3', 'e1']);
    expect(goals[2]!.event.score).toEqual([1, 0]);
    const changed = {
      ...d,
      matches: {
        ...d.matches,
        1: { ...d.matches[1]!, events: d.matches[1]!.events.map((e) => (e.id === 'e6' ? { ...e, cancelled: true } : e)) },
      },
    };
    expect(insightGoals(changed).map((g) => g.event.id)).toEqual(['e3', 'e1']);
  });
});
