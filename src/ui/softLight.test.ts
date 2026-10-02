import { describe, expect, test } from 'vitest';
import { SOFT_LIGHT_STOPS, softLightGradient, softLightStops } from './softLight';

describe('softLight', () => {
  test('has 25 stops that fall off as (1 - t^2)^3 to zero', () => {
    const stops = softLightStops('#74acdf', 0.5);
    expect(stops).toHaveLength(SOFT_LIGHT_STOPS);
    const alpha = (s: string) => Number(/\/ ([\d.]+)\)/.exec(s)?.[1]);
    expect(alpha(stops[0]!)).toBe(0.5);
    expect(alpha(stops[12]!)).toBeCloseTo(0.5 * (1 - 0.25) ** 3, 4);
    expect(alpha(stops[24]!)).toBe(0);
    for (let i = 1; i < stops.length; i++) expect(alpha(stops[i]!)).toBeLessThanOrEqual(alpha(stops[i - 1]!));
  });

  test('the core is mixed 35 % toward white, the rim is the pure colour', () => {
    const stops = softLightStops('#000000', 1);
    expect(stops[0]).toMatch(/^rgb\(89 89 89 /);
    expect(stops[24]).toMatch(/^rgb\(0 0 0 \/ 0\) 100%$/);
  });

  test('builds an elliptical radial gradient at the centre', () => {
    const g = softLightGradient({ color: '#ffffff', alpha: 0.2, cx: 10, cy: '50%', rx: 30, ry: 20 });
    expect(g.startsWith('radial-gradient(30px 20px at 10px 50%, ')).toBe(true);
  });
});
