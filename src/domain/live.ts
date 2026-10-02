// The live matches in list order: favourites first, then the rest, each in feed order
// (`liveMatches`, `luau:3694–3703`).

import type { DomainState, Match } from './types';

/**
 * Every live match, the favourites first. Within each group the feed's order is kept.
 * `isFavourite` defaults to the feed's `favourite` flag; pass the user's own choice when there is one.
 */
export function liveMatches(
  state: Pick<DomainState, 'matches' | 'matchOrder'>,
  isFavourite: (m: Match) => boolean = (m) => m.favourite,
): Match[] {
  const fav: Match[] = [];
  const rest: Match[] = [];
  for (const id of state.matchOrder) {
    const m = state.matches[id];
    if (m?.status === 'live') (isFavourite(m) ? fav : rest).push(m);
  }
  return fav.concat(rest);
}
