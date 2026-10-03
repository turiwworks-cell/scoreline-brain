import { describe, expect, it } from 'vitest';
import { crossfade, fitInto, intersect, lerpBox, overlapRatio, insetOf, windowFade } from './geometry';

describe('geometry', () => {
  it('lerpBox runs from a to b', () => {
    const a = { x: 0, y: 0, w: 10, h: 20 };
    const b = { x: 100, y: 50, w: 30, h: 40 };
    expect(lerpBox(a, b, 0)).toEqual(a);
    expect(lerpBox(a, b, 1)).toEqual(b);
    expect(lerpBox(a, b, 0.5)).toEqual({ x: 50, y: 25, w: 20, h: 30 });
  });

  it('intersect and overlapRatio', () => {
    const view = { x: 0, y: 0, w: 100, h: 100 };
    expect(intersect(view, { x: 50, y: 50, w: 100, h: 100 })).toEqual({ x: 50, y: 50, w: 50, h: 50 });
    expect(intersect(view, { x: 200, y: 0, w: 10, h: 10 })).toMatchObject({ w: 0 });
    expect(overlapRatio({ x: 90, y: 0, w: 20, h: 10 }, view)).toBe(0.5);
    expect(overlapRatio({ x: 0, y: 0, w: 0, h: 10 }, view)).toBe(0);
  });

  it('fitInto scales uniformly by height and centres across', () => {
    // a 26 px score into an 82 × 60 box: scale 2, centred
    expect(fitInto({ w: 26, h: 30 }, { x: 10, y: 20, w: 82, h: 60 })).toEqual({ x: 10 + (82 - 52) / 2, y: 20, s: 2 });
    // no height: match the width
    expect(fitInto({ w: 10, h: 0 }, { x: 0, y: 0, w: 30, h: 0 })).toMatchObject({ s: 3 });
  });

  it('crossfade never shows less than one full copy and ends on the arriving one', () => {
    expect(crossfade(0)).toEqual({ from: 1, to: 0 });
    expect(crossfade(1)).toEqual({ from: 0, to: 1 });
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const f = crossfade(p);
      expect(Math.max(f.from, f.to)).toBe(1);
    }
    expect(crossfade(0.5).to).toBe(1);
    expect(crossfade(0.6).from).toBe(1);
    expect(crossfade(0.9).from).toBeCloseTo(0, 6);
  });
});

describe('window flight geometry', () => {
  it('insetOf cuts a drawn image down to its window in its own px', () => {
    // a 280 × 350 image drawn at half size, windowed to its top 100 px (viewport) of 175
    const i = insetOf({ x: 10, y: 20, w: 140, h: 175 }, { x: 10, y: 20, w: 140, h: 100 }, { w: 280, h: 350 });
    expect(i).toEqual({ top: 0, left: 0, right: 0, bottom: 150 });
  });
  it('windowFade: the bust is in by 40 %, the face goes late, and a close is the opening backwards', () => {
    expect(windowFade(0.4, true).moving).toBe(1);
    expect(windowFade(0.1, true).still).toBe(1);
    expect(windowFade(1, true).still).toBe(0);
    expect(windowFade(0.6, false)).toEqual(windowFade(0.4, true));
  });
});
