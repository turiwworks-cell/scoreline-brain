import { describe, expect, it } from 'vitest';
import { createWordClock } from './wordClock';

const clock = (rive = true, origin = 0) => {
  const c = createWordClock({ up: 2, full: 4, rive, grace: 0.3 });
  c.begin(origin);
  return c;
};

describe('Rive word handoff', () => {
  it('is real time when there is no Rive word', () => {
    const c = clock(false);
    expect(c.time(0.2, false)).toBe(0.2);
    expect(c.time(3, false)).toBe(3);
  });
  it('holds the story at 0 until the word is bound, then starts it from there', () => {
    const c = clock();
    expect(c.time(0.1, false)).toBe(0);
    c.bound(0.15);
    expect(c.time(0.15, false)).toBe(0);
    expect(c.time(0.65, false)).toBeCloseTo(0.5);
  });
  it('gives the headline to the DOM word at the grace deadline, from its start', () => {
    const c = clock();
    expect(c.time(0.29, false)).toBe(0);
    expect(c.time(0.3, false)).toBe(0);
    expect(c.time(0.8, false)).toBeCloseTo(0.5);
    // a word bound after that never takes over
    expect(c.late(0.9)).toBe(true);
    c.bound(0.9);
    expect(c.time(3, false)).toBeCloseTo(2.7);
  });
  it('an early landing keeps the hold: the rise comes at up, with no jump', () => {
    const c = clock();
    c.bound(0.1);
    c.phase(1, 1.0);
    expect(c.time(1.01, false)).toBeCloseTo(0.91);
    expect(c.time(2.1, false)).toBeCloseTo(2);
    expect(c.time(2.6, false)).toBeCloseTo(2.5);
  });
  it('a late landing holds the rise at up, then goes on from there', () => {
    const c = clock();
    c.bound(0);
    expect(c.time(2.5, false)).toBe(2);
    c.phase(1, 2.5);
    expect(c.time(2.5, false)).toBe(2);
    expect(c.time(3, false)).toBeCloseTo(2.5);
    c.phase(2, 3.5);
    expect(c.time(3.5, false)).toBeCloseTo(3);
  });
  it('a file that jumps straight to done releases the rise too', () => {
    const c = clock();
    c.bound(0);
    expect(c.time(2.4, false)).toBe(2);
    c.phase(2, 2.4);
    expect(c.time(2.9, false)).toBeCloseTo(2.5);
  });
  it('a failure while the rise waits lets it go on from up', () => {
    const c = clock();
    c.bound(0);
    expect(c.time(3, false)).toBe(2);
    c.fallback(3);
    expect(c.time(3.5, false)).toBeCloseTo(2.5);
  });
  it('stops waiting at the full deadline', () => {
    const c = clock();
    c.bound(0);
    expect(c.time(3.9, false)).toBe(2);
    expect(c.time(4.5, false)).toBeCloseTo(2.5);
  });
  it('starts the story at the scene\'s first frame, and counts the grace from there', () => {
    const late = clock(false, 0.5);
    expect(late.time(0.5, false)).toBe(0);
    expect(late.time(1, false)).toBeCloseTo(0.5);
    const c = clock(true, 0.5);
    expect(c.late(0.79)).toBe(false);
    expect(c.late(0.8)).toBe(true);
    expect(c.time(0.7, false)).toBe(0);
    c.bound(0.7);
    expect(c.late(5)).toBe(false);
    expect(c.time(1.2, false)).toBeCloseTo(0.5);
  });
  it('is at 0 before its first frame', () => {
    const c = createWordClock({ up: 2, full: 4, rive: true });
    expect(c.time(0.4, false)).toBe(0);
    expect(c.late(0.4)).toBe(false);
  });
  it('a first tap is real time', () => {
    const c = clock();
    expect(c.time(4.2, true)).toBe(4.2);
    c.bound(0.1);
    expect(c.time(4.5, true)).toBe(4.5);
  });
});
