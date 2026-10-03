import { describe, expect, it } from 'vitest';
import { createWordClock } from './wordClock';

describe('Rive word handoff', () => {
  it('preserves the existing choreography before the runtime is bound', () => {
    const clock = createWordClock(2, 4);
    expect(clock.time(3, false)).toBe(3);
  });
  it('holds the rise until phase 1, then preserves the downstream offsets', () => {
    const clock = createWordClock(2, 4); clock.waiting();
    expect(clock.time(2.5, false)).toBe(2);
    clock.phase(1, 2.5);
    expect(clock.time(3, false)).toBe(2.5);
    clock.phase(1, 3); clock.phase(2, 3.5);
    expect(clock.time(3.5, false)).toBe(3);
  });
  it('also releases on phase 2 when a file jumps directly to done', () => {
    const clock = createWordClock(2, 4); clock.waiting(); clock.phase(2, 1);
    expect(clock.time(1.5, false)).toBe(2.5);
  });
  it('never delays the director first-tap jump or an exit', () => {
    const clock = createWordClock(2, 4); clock.waiting();
    expect(clock.time(4, true)).toBe(4);
    clock.phase(1, 1); expect(clock.time(4, true)).toBe(4);
  });
  it('has a token-derived deadline and returns to fallback timing on error', () => {
    const clock = createWordClock(2, 4); clock.waiting();
    expect(clock.time(4, false)).toBe(4);
    clock.fallback(); expect(clock.time(3, false)).toBe(3);
  });
});
