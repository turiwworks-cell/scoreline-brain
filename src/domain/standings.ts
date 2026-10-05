// A league's table: the one the feed sent, or one counted from earlier results plus every
// started match (`standings`, `luau:2923–2976`).

import type { DomainState, Match, Score } from './types';

export interface StandingRow {
  readonly team: string;
  readonly p: number;
  readonly w: number;
  readonly d: number;
  readonly l: number;
  readonly gf: number;
  readonly ga: number;
  readonly gd: number;
  readonly pts: number;
  /** The team is playing right now. */
  readonly live: boolean;
  /** 1-based place in the league's team list (or the sent table): the last tie-breaker. */
  readonly i: number;
}

/** An earlier result: home, away, `[home, away]` goals. */
export interface PriorResult {
  readonly home: string;
  readonly away: string;
  readonly score: Score;
}

/**
 * What a counted table starts from: the league's teams in order, and the results played before
 * this matchday. The feed carries neither (only a sent `table`), so a league counted from the
 * matches has to be given them. Without teams the table is empty, which is also how the Lua
 * shows friendlies.
 */
export interface LeagueBase {
  readonly teams: readonly string[];
  readonly prior: readonly PriorResult[];
}

const NO_BASE: LeagueBase = { teams: [], prior: [] };

interface Tally {
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  live: boolean;
  i: number;
}

export function standings(state: Pick<DomainState, 'leagues' | 'matches' | 'matchOrder'>, leagueId: string, base: LeagueBase = NO_BASE): StandingRow[] {
  const matches = state.matchOrder.map((id) => state.matches[id]).filter((m): m is Match => m !== undefined && m.league === leagueId);

  // A sent table is shown as sent, in its order; only `live` is worked out here.
  const given = state.leagues[leagueId]?.table;
  if (given) {
    return given.map((g, idx) => ({
      team: g.team,
      p: g.p,
      w: g.w,
      d: g.d,
      l: g.l,
      gf: g.gf,
      ga: g.ga,
      gd: g.gf - g.ga,
      pts: g.pts,
      live: matches.some((m) => m.status === 'live' && (m.home === g.team || m.away === g.team)),
      i: idx + 1,
    }));
  }

  const rows = new Map<string, Tally>();
  const list: Tally[] = [];
  base.teams.forEach((team, idx) => {
    const row: Tally = { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, live: false, i: idx + 1 };
    rows.set(team, row);
    list.push(row);
  });
  const add = (h: string, a: string, hs: number, as: number, live: boolean) => {
    const rh = rows.get(h);
    const ra = rows.get(a);
    // A result involving a team outside the league counts for neither side.
    if (!rh || !ra) return;
    rh.p += 1;
    ra.p += 1;
    rh.gf += hs;
    rh.ga += as;
    ra.gf += as;
    ra.ga += hs;
    if (hs > as) {
      rh.w += 1;
      ra.l += 1;
      rh.pts += 3;
    } else if (hs < as) {
      ra.w += 1;
      rh.l += 1;
      ra.pts += 3;
    } else {
      rh.d += 1;
      ra.d += 1;
      rh.pts += 1;
      ra.pts += 1;
    }
    rh.live = rh.live || live;
    ra.live = ra.live || live;
  };
  for (const r of base.prior) add(r.home, r.away, r.score[0], r.score[1], false);
  // Every started match counts, on any day, live ones with their score so far.
  for (const m of matches) {
    if (m.status !== 'scheduled') add(m.home, m.away, m.score[0], m.score[1], m.status === 'live');
  }
  for (const row of list) row.gd = row.gf - row.ga;
  list.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.i - b.i);
  return list;
}
