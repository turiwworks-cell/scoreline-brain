// What the list shows and how it is grouped (drawFeed, luau:4529–4590): the matches of the chosen
// day, or only the live ones in Ongoing; a Favourites group first, then one group per league in the
// feed's league order. Pure: no React, no store.

import type { DomainState, Match } from '../../domain';

/** The group the favourite matches go in (key `fav` in the Lua's `collapsed` table). */
export const FAV = 'fav';

export interface Group {
  /** `FAV` or a league id: the key a group's collapsed state is kept under */
  readonly key: string;
  readonly ids: readonly number[];
}

export interface ListQuery {
  /** the day tab as an offset from today (-2 … 2) */
  readonly day: number;
  /** Ongoing: only the matches in play */
  readonly live: boolean;
}

type GroupInput = Pick<DomainState, 'matches' | 'matchOrder' | 'leagues'>;

/** Favourites (when any), then each league that has matches, in the feed's order; ids in feed order. */
export function listGroups(state: GroupInput, q: ListQuery): Group[] {
  const favs: number[] = [];
  const byLeague = new Map<string, number[]>();
  for (const id of state.matchOrder) {
    const m = state.matches[id];
    if (!m || (q.live ? m.status !== 'live' : m.day !== q.day)) continue;
    if (m.favourite) {
      favs.push(id);
      continue;
    }
    const g = byLeague.get(m.league);
    if (g) g.push(id);
    else byLeague.set(m.league, [id]);
  }
  const out: Group[] = [];
  if (favs.length > 0) out.push({ key: FAV, ids: favs });
  // the feed's league order (LEAGUE_ORDER, luau:1810); a league the feed doesn't list follows
  for (const league of Object.keys(state.leagues)) {
    const ids = byLeague.get(league);
    if (ids) {
      out.push({ key: league, ids });
      byLeague.delete(league);
    }
  }
  for (const [league, ids] of byLeague) out.push({ key: league, ids });
  return out;
}

/** True when two group lists say the same thing, so a selector can keep the old array. */
export function sameGroups(a: readonly Group[], b: readonly Group[]): boolean {
  return a.length === b.length && a.every((g, i) => g.key === b[i]!.key && g.ids.length === b[i]!.ids.length && g.ids.every((id, j) => id === b[i]!.ids[j]));
}

/**
 * The live cards, in the order drawCards sorts them (luau:3776): favourites first, then by id.
 * Matches that have just finished are the caller's to add: it knows how long ago they ended.
 */
export function cardOrder(matches: readonly Pick<Match, 'id' | 'favourite'>[]): number[] {
  return [...matches].sort((a, b) => (a.favourite === b.favourite ? a.id - b.id : a.favourite ? -1 : 1)).map((m) => m.id);
}
