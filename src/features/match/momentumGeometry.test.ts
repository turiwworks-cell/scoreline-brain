import { describe, expect, it } from 'vitest';
import type { MatchEvent, Team } from '../../domain';
import { derivedMomentum, minuteX, momentumColors, momentumGoals, momentumPaths, pressure } from './momentumGeometry';

const team = (colors: readonly [string, string]): Team => ({ id: 'test', name: 'Test', short: 'TST', colors });
const event = (patch: Partial<MatchEvent> = {}): MatchEvent => ({ id: 'g', seq: 1, kind: 'goal', side: 'home', minute: 2, ...patch });

describe('Lua momentum geometry', () => {
  it('uses the 322×156 chart, caps stoppage time and keeps an empty chart finite', () => {
    expect([minuteX(-2), minuteX(45), minuteX(95)]).toEqual([0, 161, 322]);
    expect(momentumPaths([])).toMatchObject({ line: 'M 0 78', ys: [78] });
    expect(momentumPaths([0, Number.NaN]).line).not.toMatch(/NaN|Infinity/);
  });
  it('matches the Lua triangular smoothing and 1.25× / 44% amplitude', () => {
    const result = momentumPaths([0, 1, -1, 0]);
    // Independently calculated weights: [0,1,2]=[3,2,1], then [0,1,2,3]=[2,3,2,1].
    expect(result.ys[0]).toBeCloseTo(78 - (1 / 6) * 1.25 * 0.44 * 156, 10);
    expect(result.ys[1]).toBeCloseTo(78 - (1 / 8) * 1.25 * 0.44 * 156, 10);
    expect(result.ys[2]).toBeCloseTo(78 + (1 / 8) * 1.25 * 0.44 * 156, 10);
    expect(result.ys[3]).toBeCloseTo(78 + (1 / 6) * 1.25 * 0.44 * 156, 10);
  });
  it('clamps both lobes and winds them in opposite traversal directions around the midline', () => {
    const home = momentumPaths([1, 1, 1]);
    expect(home.ys[0]).toBeCloseTo(9.36);
    expect(home.away).toBe('M 0 78 L 7.155555555555556 78 L 7.155555555555556 78 L 3.577777777777778 78 L 0 78 Z');
    expect(momentumPaths([-1, -1]).ys[0]).toBeCloseTo(146.64);
    expect(home.home.endsWith(' Z')).toBe(true);
  });
  it('does not compute past 90 minutes and caches by series identity only', () => {
    const values = Array.from({ length: 97 }, () => 0.5);
    const first = momentumPaths(values);
    expect(first.ys).toHaveLength(91);
    expect(momentumPaths(values)).toBe(first);
    expect(momentumPaths([...values])).not.toBe(first);
  });
  it('counts the previous ten minutes, excluding the current in-progress minute', () => {
    expect(pressure([0, 1, 1, -1], 3)).toEqual({ share: 100, lead: 'home' });
    expect(pressure(Array(20).fill(-1) as number[], 20)).toEqual({ share: 0, lead: 'away' });
    expect(pressure([], 0)).toEqual({ share: 50, lead: null });
    expect(pressure(Array(107).fill(1) as number[], 107)).toEqual({ share: 50, lead: null });
  });
  it('uses the Lua inclusive 58 / 42 leadership thresholds', () => {
    expect(pressure([0.58, -0.42], 2).lead).toBe('home');
    expect(pressure([0.42, -0.58], 2).lead).toBe('away');
    expect(pressure([0.57, -0.43], 2).lead).toBeNull();
  });
  it('uses the away secondary colour, then neutral, only when colours are too close', () => {
    expect(momentumColors(team(['#0055A4', '#FFFFFF']), team(['#74ACDF', '#F6B40E']))).toEqual(['#0055A4', '#74ACDF']);
    expect(momentumColors(team(['#0055A4', '#FFFFFF']), team(['#0056A4', '#F6B40E']))[1]).toBe('#F6B40E');
    expect(momentumColors(team(['#000000', '#FFFFFF']), team(['#010101', '#020202']))[1]).toBe('#E9E7E1');
    expect(momentumColors(team(['#000000', '#FFFFFF']), team(['#FF0000', '#FFFFFF']))[1]).toBe('#FF0000');
  });
  it('derives provider-missing data with Lua event weights and decay; ignores cancelled goals', () => {
    const events = [event(), event({ id: 'c', minute: 3, kind: 'corner', side: 'away' }), event({ id: 'var', minute: 4, cancelled: true })];
    const values = derivedMomentum(events);
    expect(values.slice(0, 3)).toEqual([0, 0, 0.63]);
    expect(values[3]).toBeCloseTo(0.63 * 0.82 - 0.35 * 0.45);
    expect(values[4]).toBeCloseTo(values[3]! * 0.82);
    expect(derivedMomentum(events)).toBe(values);
    expect(derivedMomentum(events, 2)).toEqual([0, 0, 0.63]);
    expect(derivedMomentum(events, 2)).toBe(derivedMomentum(events, 2));
  });
  it('orders valid goal markers chronologically without mutating the event stream', () => {
    const events = [event({ id: 'late', minute: 80 }), event({ id: 'early', minute: 10 }), event({ id: 'cancel', cancelled: true }), event({ id: 'shot', kind: 'shot' })];
    expect(momentumGoals(events).map((e) => e.id)).toEqual(['early', 'late']);
    expect(events[0]!.id).toBe('late');
  });
});
