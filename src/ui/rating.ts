// Rating colours (ratingInk, luau:3538).

export type RatingTone = { bg: string | null; fg: string };

/** The fill and text colour for a rating (ratingInk, luau:3538). `bg` null = the spectrum. */
export function ratingTone(v: number): RatingTone {
  if (v >= 8) return { bg: null, fg: 'rgb(0 0 0 / 0.86)' };
  if (v >= 7) return { bg: '#34E39A', fg: '#03261A' };
  if (v >= 6.5) return { bg: '#F5C542', fg: '#2A1F00' };
  if (v >= 6) return { bg: '#F28C3A', fg: '#2A1100' };
  return { bg: '#FF4D4D', fg: '#FFFFFF' };
}
