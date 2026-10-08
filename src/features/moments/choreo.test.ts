import { describe, expect, it } from 'vitest';
import { DESIGN_FLOOR, FLAG_OVER_WORD, FLOOR_FROM_BOTTOM, flagRest } from './choreo';

// GOAAAL is 3.734 sizes wide in the app's font (measured in a browser: 87.3 px on a 390 px stage; jsdom
// has no canvas to measure with, so the number is given).
const W100 = 3.734;

// The goal scene's headline at centre stage, as Scene.tsx lays it out (GoalArt): the word's middle
// is `436 ky - 0.35 size`, its size follows the width, and the flag stands over it.
const stage = (W: number, H: number) => {
  const floor = Math.max(H - FLOOR_FROM_BOTTOM, 320);
  const ky = floor / DESIGN_FLOOR;
  const size = Math.min(104, (W - 64) / W100);
  const mid = 436 * ky - size * 0.35;
  const flagCentre = flagRest(mid, size);
  // the letters begin FLAG_OVER_WORD.ink sizes above the word's middle
  const lettersTop = mid - FLAG_OVER_WORD.ink * size;
  return { flagCentre, gap: lettersTop - (flagCentre + FLAG_OVER_WORD.r) };
};

describe('the flag over the goal word', () => {
  it('stands the same distance above the letters on every phone, not closer on a shorter one', () => {
    const phones: [number, number][] = [[390, 844], [393, 852], [412, 915], [360, 780], [375, 667], [360, 640], [320, 568], [430, 932]];
    for (const [W, H] of phones) expect(stage(W, H).gap, `${W}×${H}`).toBeCloseTo(FLAG_OVER_WORD.gap, 6);
  });

  it("keeps the Lua's place on the 390 × 844 phone it was drawn for: the flag's centre at 318", () => {
    expect(stage(390, 844).flagCentre).toBeCloseTo(318, 0);
  });

  it('does not come down onto the word on a short stage, where the old place (318 of the floor) did', () => {
    for (const [W, H] of [[375, 667], [360, 640]] as const) {
      const floor = Math.max(H - FLOOR_FROM_BOTTOM, 320);
      const old = (318 * floor) / DESIGN_FLOOR;
      const size = Math.min(104, (W - 64) / W100);
      const lettersTop = 436 * (floor / DESIGN_FLOOR) - size * 0.35 - FLAG_OVER_WORD.ink * size;
      // before: its bottom was within a few px of the letters, or on them
      expect(lettersTop - (old + FLAG_OVER_WORD.r)).toBeLessThan(FLAG_OVER_WORD.gap / 2);
      expect(stage(W, H).gap).toBeGreaterThanOrEqual(FLAG_OVER_WORD.gap);
    }
  });
});
