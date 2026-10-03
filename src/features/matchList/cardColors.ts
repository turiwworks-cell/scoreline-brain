// A live card's colours (matchStops, luau:2495): the home team's colour at the top, the away team's
// at the bottom, each mixed toward warm white so black type reads on it.

import type { Team } from '../../domain';
import { matchStops } from '../../ui';

export interface CardColors {
  /** the four stops, top to bottom, at 0, 42, 62 and 100 % */
  readonly stops: readonly [string, string, string, string];
  /** the soft light behind the card when each side scores */
  readonly halo: readonly [string, string];
  /** the colour each side's goal floods the card with */
  readonly hot: readonly [string, string];
}

export function cardColors(home: Pick<Team, 'colors'>, away: Pick<Team, 'colors'>): CardColors {
  const stops = matchStops(home, away);
  return {
    stops,
    halo: [stops[0], stops[3]],
    hot: [home.colors[0], away.colors[0]],
  };
}
