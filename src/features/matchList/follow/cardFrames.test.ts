import { describe, expect, it } from 'vitest';
import { RED_SECONDS } from './model';
import { redLook, shakeOf } from './cardFrames';

describe('the red card', () => {
  it('shakes at the start and is still after 0.6 s', () => {
    expect(shakeOf(-1)).toBe(0);
    expect(Math.abs(shakeOf(0.02))).toBeGreaterThan(0.5);
    expect(shakeOf(0.6)).toBe(0);
    expect(Math.abs(shakeOf(0.1))).toBeLessThanOrEqual(6);
  });

  it('floods red in 0.12 s, pulses, holds near 95 % and drains into the words', () => {
    expect(redLook(0).flood).toBe(0);
    expect(redLook(0.12).flood).toBeCloseTo(1, 5);
    // it pulses between 0.8 and 1 while it holds
    const held = [0.3, 0.6, 0.9, 1.2].map((t) => redLook(t).flood);
    expect(Math.min(...held)).toBeGreaterThanOrEqual(0.8);
    expect(Math.max(...held)).toBeGreaterThan(0.95);
    expect(redLook(2.3).flood).toBeGreaterThan(0.9);
    expect(redLook(RED_SECONDS - 0.01).flood).toBeLessThan(0.05);
    expect(redLook(RED_SECONDS)).toEqual({ flood: 0, text: 0 });
  });

  it('the words come in after the flood and leave with it', () => {
    expect(redLook(0.5).text).toBe(0);
    expect(redLook(1.5).text).toBeGreaterThan(0.9);
    expect(redLook(RED_SECONDS - 0.01).text).toBeLessThan(0.05);
  });
});
