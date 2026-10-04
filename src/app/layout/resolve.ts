import { DEFAULT_TAB, type ListState, type MatchRef, type Nav, type PlayerRef, type PlayerStep } from '../nav/url';
import type { LayoutMode } from './layoutMode';

/*
 * What is on screen, from the route and the width. Pure.
 *
 * phone   list at the base; a match layer when a match is open (or the player was opened from one);
 *         a player layer on top when a player is open
 * two     list · match pane; the player as a sheet over the match pane
 * three   list · match pane · third pane (the player, else insights)
 *
 * The match pane is never empty while there are matches: the open match, else the match the
 * player was opened from, else the player's team's match, else the featured one (on load the
 * desktop opens the featured match in pane 2, ARCHITECTURE §6).
 */

export interface Resolved {
  readonly layout: LayoutMode;
  readonly list: ListState;
  /** the match whose screen is up: the phone's match layer, the panes' match pane */
  readonly match: MatchRef | null;
  /** the player whose screen is up: phone layer, tablet sheet, desktop third pane */
  readonly player: PlayerRef | null;
  /** he was reached by an arrow: the way he slides in (his page glides, nothing flies) */
  readonly step?: PlayerStep;
}

export interface MatchLookup {
  /** the featured match, if any */
  readonly featured?: number;
  /** a match of the open player's team, if any */
  readonly teamMatch?: number;
}

export function resolve(nav: Nav, layout: LayoutMode, lookup: MatchLookup): Resolved {
  const player = nav.player ?? null;
  let match: MatchRef | null;
  if (layout === 'phone') {
    match = nav.match ?? (player ? (nav.under ?? null) : null);
  } else {
    const fallback = player ? lookup.teamMatch : undefined;
    const id = nav.match?.id ?? nav.under?.id ?? fallback ?? lookup.featured;
    match = nav.match ?? nav.under ?? (id !== undefined ? { id, tab: DEFAULT_TAB } : null);
  }
  return { layout, list: nav.list, match, player, ...(player && nav.step ? { step: nav.step } : {}) };
}

/** How many screens stack over the list (phone layers, the tablet sheet). Focus moves into a new one. */
export function stackDepth(r: Resolved): number {
  if (r.layout === 'phone') return (r.match ? 1 : 0) + (r.player ? 1 : 0);
  if (r.layout === 'two') return r.player ? 1 : 0;
  return 0;
}
