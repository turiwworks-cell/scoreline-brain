import { describe, expect, it } from 'vitest';
import { LIVE_DIGITS, liveDigits } from './liveStill';

describe('the still’s count', () => {
  // where Rive's runtime draws the digits' ink, in artboard units (verification/rive, 4x): their
  // centre is the same whatever the count
  it('is centred in the calendar as Rive centres it, the digits spaced as Rive spaces them', () => {
    const centre = (count: number) => {
      const at = liveDigits(count);
      const last = at.at(-1)!;
      return (at[0]!.x + last.x + LIVE_DIGITS.advance[Number(last.digit)]!) / 2;
    };
    for (const count of [0, 1, 7, 12, 88, 99]) expect(centre(count)).toBeCloseTo(LIVE_DIGITS.centre, 1);
    expect(liveDigits(12).map((d) => d.digit)).toEqual(['1', '2']);
    expect(liveDigits(12)[1]!.x - liveDigits(12)[0]!.x).toBeCloseTo(LIVE_DIGITS.advance[1]! + LIVE_DIGITS.spacing, 2);
  });
  it('is a whole number of matches, never negative', () => {
    expect(liveDigits(-3).map((d) => d.digit)).toEqual(['0']);
    expect(liveDigits(4.7).map((d) => d.digit)).toEqual(['4']);
  });
});
