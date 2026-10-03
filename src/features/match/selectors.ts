// The match screen's selectors. They follow the conventions at the top of store/selectors.ts:
// module-level and cached per argument, and a derived list keeps its previous array while the
// contents are equal, so a poll that changes nothing on the screen re-renders nothing on it.

import { standings, type DomainState, type Player, type StandingRow, type Team } from '../../domain';
import type { ScorelineState } from '../../store';

type Selector<T> = (state: ScorelineState) => T;

/** The teams: one object, replaced only when a feed changes a team. */
export const selectTeams: Selector<Readonly<Record<string, Team>>> = (s) => s.domain.teams;
/** The squads: one object, replaced only when a feed changes a squad. */
export const selectPlayers: Selector<Readonly<Record<string, Player>>> = (s) => s.domain.players;

const sameRow = (a: StandingRow, b: StandingRow) =>
  a.team === b.team && a.p === b.p && a.w === b.w && a.d === b.d && a.l === b.l && a.gd === b.gd && a.pts === b.pts && a.live === b.live;

const tables = new Map<string, Selector<readonly StandingRow[]>>();

/** A league's table as the feed sent it, with who is playing now; empty when none was sent. */
export function selectTable(league: string): Selector<readonly StandingRow[]> {
  let sel = tables.get(league);
  if (!sel) {
    let last: readonly StandingRow[] = [];
    let seen: [unknown, unknown, unknown] = [undefined, undefined, undefined];
    sel = (s) => {
      const d: DomainState = s.domain;
      if (d.matches === seen[0] && d.matchOrder === seen[1] && d.leagues === seen[2]) return last;
      seen = [d.matches, d.matchOrder, d.leagues];
      const next = standings(d, league);
      if (next.length !== last.length || next.some((r, i) => !sameRow(r, last[i]!))) last = next;
      return last;
    };
    tables.set(league, sel);
  }
  return sel;
}
