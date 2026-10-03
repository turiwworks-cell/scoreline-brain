// A live card's colours (matchStops, luau:2495): the home team's colour at the top, the away team's
// at the bottom, each mixed toward warm white so black type reads on it.

import type { Team } from '../../domain';
import { mix, pastel } from '../../ui';

const WARM = '#F7F2EA'; // luau:1146

export interface CardColors {
  /** the four stops, top to bottom, at 0, 42, 62 and 100 % */
  readonly stops: readonly [string, string, string, string];
  /** the soft light behind the card when each side scores */
  readonly halo: readonly [string, string];
  /** the colour each side's goal floods the card with */
  readonly hot: readonly [string, string];
}

export function cardColors(home: Pick<Team, 'colors'>, away: Pick<Team, 'colors'>): CardColors {
  const [h1, h2] = home.colors;
  const [a1, a2] = away.colors;
  return {
    stops: [pastel(h1), pastel(mix(h2, WARM, 0.35)), pastel(mix(a2, WARM, 0.35)), pastel(a1)],
    halo: [pastel(h1), pastel(a1)],
    hot: [h1, a1],
  };
}
