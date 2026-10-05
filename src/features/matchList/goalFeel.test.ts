import { afterEach, describe, expect, it } from 'vitest';
import { resetMotion, tuneMotion } from '../../motion';
import { BUMP, cardFeel, DIP, followGoal, FOLLOW_GOAL, greyOf, markLife, rowFeel, stepScale, type GoalMark } from './goalFeel';

afterEach(resetMotion);

const home: GoalMark = { t: 10, side: 'home', n: 1 };
const away: GoalMark = { t: 10, side: 'away', n: 2 };

describe('the scorer’s card', () => {
  it('rests before there is a goal and before it lands', () => {
    expect(cardFeel(5, home)).toEqual(cardFeel(5, undefined));
    expect(cardFeel(10, undefined).bump).toEqual([1, 1]);
    expect(cardFeel(10, undefined).sweep).toBe(-1);
  });

  it('dips 6 px, floods in twelfths and pops the scorer’s side only', () => {
    const f = cardFeel(10 + DIP.down, home);
    expect(f.dip).toBeCloseTo(DIP.px, 1);
    const mid = cardFeel(10.5, home);
    expect(mid.flood * 12).toBeCloseTo(Math.round(mid.flood * 12), 9);
    expect(mid.halo).toBeGreaterThan(0.9);
    const pop = cardFeel(10, home);
    expect(pop.bump[0]).toBeCloseTo(1 + BUMP.card, 5);
    expect(pop.bump[1]).toBe(1);
    expect(cardFeel(10, away).bump[1]).toBeCloseTo(1 + BUMP.card, 5);
    expect(cardFeel(10, away).bump[0]).toBe(1);
    expect(cardFeel(10.6, home).bump[0]).toBeCloseTo(1, 9);
  });

  it('settles: no dip, no flood, no sweep, no pop after its life', () => {
    const f = cardFeel(10 + markLife() + 0.1, home);
    expect(f.dip).toBe(0);
    expect(f.flood).toBe(0);
    expect(f.sweep).toBe(-1);
    expect(f.bump).toEqual([1, 1]);
    expect(f.mark).toEqual([0, 0]);
  });

  it('the new number keeps the spectrum for the goalMark hold the user tuned', () => {
    expect(cardFeel(10 + 3, home).mark[0]).toBe(1);
    tuneMotion({ goalMark: 0.1 });
    expect(cardFeel(10 + 3, home).mark[0]).toBe(0);
  });
});

describe('the other cards', () => {
  it('the scorer swells 3 % and the rest shrink 3 %', () => {
    expect(stepScale(10.5, home, true)).toBeCloseTo(1.03, 3);
    expect(stepScale(10.5, home, false)).toBeCloseTo(0.97, 3);
    expect(stepScale(10.5, undefined, false)).toBe(1);
  });

  it('only the scorer keeps its colour while the goal is fresh', () => {
    const other = undefined;
    expect(greyOf(11, home, [home, other])).toBe(0);
    expect(greyOf(11, other, [home, other])).toBeGreaterThan(0.9);
    expect(greyOf(11, other, [other, other])).toBe(0);
  });

  it('two goals landing together keep both cards in colour', () => {
    const a: GoalMark = { t: 10, side: 'home', n: 1 };
    const b: GoalMark = { t: 10, side: 'home', n: 2 };
    expect(greyOf(11, a, [a, b])).toBe(0);
    expect(greyOf(11, b, [a, b])).toBe(0);
  });
});

describe('rows', () => {
  it('flash fades over 1.6 s and the pop is 1.3×', () => {
    expect(rowFeel(10.01, home).flash).toBeGreaterThan(0.9);
    expect(rowFeel(10.01, home).bump[0]).toBeCloseTo(1 + BUMP.row, 1);
    expect(rowFeel(12, home).flash).toBe(0);
    expect(rowFeel(5, home).flash).toBe(0);
  });
});

describe('the followed player’s goal', () => {
  it('floods in, holds, drains and is gone after 7.5 s', () => {
    expect(followGoal(-1)).toBe(0);
    expect(followGoal(0.1)).toBeGreaterThan(0);
    expect(followGoal(3)).toBe(1);
    expect(followGoal(FOLLOW_GOAL.life - 0.05)).toBeLessThan(0.1);
    expect(followGoal(FOLLOW_GOAL.life)).toBe(0);
  });
});
