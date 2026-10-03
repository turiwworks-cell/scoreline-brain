import { describe, expect, it } from 'vitest';
import { CURVES } from './tokens';
import { bez, clamp, ease, env, lerp, prog } from './curve';

describe('curves', () => {
  it('a curve starts at 0, ends at 1 and never goes backwards', () => {
    for (const c of [CURVES.ease, CURVES.glide, CURVES.inout]) {
      expect(bez(c, 0)).toBe(0);
      expect(bez(c, 1)).toBe(1);
      let last = 0;
      for (let i = 1; i <= 50; i++) {
        const v = bez(c, i / 50);
        expect(v).toBeGreaterThanOrEqual(last - 1e-9);
        last = v;
      }
    }
  });

  it('a linear curve is the identity', () => {
    expect(bez(CURVES.linear, 0.3)).toBeCloseTo(0.3, 4);
  });

  it('prog and ease wait out their delay and stop at the end', () => {
    expect(prog(0.5, 1, 2)).toBe(0);
    expect(prog(2, 1, 2)).toBe(0.5);
    expect(prog(9, 1, 2)).toBe(1);
    expect(prog(0.5, 1, 0)).toBe(0);
    expect(prog(1, 1, 0)).toBe(1);
    expect(ease(CURVES.inout, 2, 1, 2)).toBeCloseTo(0.5, 4);
  });

  it('an envelope rises, holds, falls and is gone', () => {
    expect(env(0, 0.5, 2, 1)).toBe(0);
    expect(env(0.25, 0.5, 2, 1)).toBeGreaterThan(0);
    expect(env(0.25, 0.5, 2, 1)).toBeLessThan(1);
    expect(env(1.5, 0.5, 2, 1)).toBe(1);
    expect(env(3, 0.5, 2, 1)).toBeGreaterThan(0);
    expect(env(3, 0.5, 2, 1)).toBeLessThan(1);
    expect(env(3.5, 0.5, 2, 1)).toBe(0);
  });

  it('lerp and clamp', () => {
    expect(lerp(8, 14, 0.5)).toBe(11);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
  });
});
