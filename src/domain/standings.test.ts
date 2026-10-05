import { describe, expect, it } from 'vitest';
import { applyFeed, emptyState } from './apply';
import { parseFeed } from './schemas';
import { standings, type StandingRow } from './standings';
import { DEMO_BASES, DEMO_T0, demoFeedJson, demoState } from './testing/demo';

const state = demoState();

/** `team p w d l gf ga gd pts [live]`, one string per row, to read like the Lua's table. */
const rows = (list: readonly StandingRow[]) =>
  list.map((r) => `${r.team} ${r.p} ${r.w} ${r.d} ${r.l} ${r.gf} ${r.ga} ${r.gd} ${r.pts}${r.live ? ' live' : ''}`);

const table = (lg: string) => rows(standings(state, lg, DEMO_BASES[lg]));

describe('standings (luau:2929)', () => {
  it('counts the Nations Series from prior results and both live matches', () => {
    // arg and bra are level on points; goal difference puts arg ahead.
    expect(table('wns')).toEqual(['fra 2 1 1 0 3 2 1 4 live', 'arg 2 1 0 1 3 2 1 3 live', 'bra 2 1 0 1 1 2 -1 3 live', 'eng 2 0 1 1 1 2 -1 1 live']);
  });

  it('sorts on points, then goal difference', () => {
    expect(table('nla')).toEqual(['aut 2 1 1 0 2 0 2 4 live', 'ger 2 1 1 0 3 2 1 4 live', 'ned 2 0 2 0 1 1 0 2 live', 'bel 2 0 0 2 1 4 -3 0 live']);
  });

  it("counts yesterday's finished match, marking only teams playing now as live", () => {
    expect(table('nlb')).toEqual(['swe 2 1 1 0 3 2 1 4', 'irl 2 1 0 1 2 2 0 3 live', 'den 2 0 2 0 4 4 0 2', 'pol 2 0 1 1 3 4 -1 1 live']);
  });

  it('skips matches not yet started, and breaks a points and goal-difference tie on goals scored', () => {
    // sen and nga: 4 points, +2 each; sen scored 4 to nga's 3.
    expect(table('afq')).toEqual(['sen 2 1 1 0 4 2 2 4', 'nga 2 1 1 0 3 1 2 4', 'civ 2 0 2 0 2 2 0 2', 'mli 2 0 0 2 1 5 -4 0']);
  });

  it('breaks a full tie on the order of the league’s teams', () => {
    const base = { teams: ['nga', 'sen', 'civ', 'mli'], prior: [] };
    expect(standings(state, 'afq', base).map((r) => `${r.team}${r.i}`)).toEqual(['nga1', 'sen2', 'civ3', 'mli4']);
    const reversed = { teams: ['mli', 'civ', 'sen', 'nga'], prior: [] };
    expect(standings(state, 'afq', reversed).map((r) => `${r.team}${r.i}`)).toEqual(['mli1', 'civ2', 'sen3', 'nga4']);
  });

  it('has no table for friendlies, or for a league counted without its teams', () => {
    expect(table('fri')).toEqual([]);
    expect(standings(state, 'wns')).toEqual([]);
  });

  it('ignores a result against a team outside the league', () => {
    const base = { teams: ['fra', 'arg'], prior: [{ home: 'fra', away: 'xxx', score: [5, 0] as const }] };
    expect(rows(standings(state, 'wns', base))).toEqual(['fra 1 1 0 0 2 1 1 3 live', 'arg 1 0 0 1 1 2 -1 0 live']);
  });

  it('shows a sent table as sent, working out only gd and live', () => {
    const json = demoFeedJson();
    json.leagues[0] = {
      ...json.leagues[0]!,
      table: [
        { team: 'eng', p: 1, w: 0, d: 0, l: 1, gf: 9, ga: 1, pts: 0 },
        { team: 'fra', p: 1, w: 1, d: 0, l: 0, gf: 1, ga: 0, pts: 3 },
        { team: 'xxx', p: 1, w: 0, d: 0, l: 1, gf: 0, ga: 1, pts: 0 },
      ],
    } as (typeof json.leagues)[number];
    const s = applyFeed(emptyState(), parseFeed(json), DEMO_T0).state;
    // Not re-sorted, not re-counted, and the base is not used.
    const list = standings(s, 'wns', DEMO_BASES.wns);
    expect(rows(list)).toEqual(['eng 1 0 0 1 9 1 8 0 live', 'fra 1 1 0 0 1 0 1 3 live', 'xxx 1 0 0 1 0 1 -1 0']);
    expect(list.map((r) => r.i)).toEqual([1, 2, 3]);
  });
});
