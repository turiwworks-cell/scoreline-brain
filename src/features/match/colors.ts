// The two sides' colours on the match screen (sideColors, luau:2483): each side's own first
// colour; the away side takes its second when the two would read alike, and a light neutral when
// even that is too close. The event dots and the stat bars use them. Pure.

import type { Team } from '../../domain';

type RGB = readonly [number, number, number];

function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const dist = (a: string, b: string) => {
  const x = rgb(a);
  const y = rgb(b);
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
};

/** The light neutral the away side falls back to (0xE9E7E1, luau:2489). */
export const NEUTRAL = '#E9E7E1';

/** `[home, away]`. */
export function sideColors(home: Pick<Team, 'colors'>, away: Pick<Team, 'colors'>): readonly [string, string] {
  const a = home.colors[0];
  let b = away.colors[0];
  if (dist(a, b) < 150) b = away.colors[1];
  return [a, dist(a, b) < 90 ? NEUTRAL : b];
}
