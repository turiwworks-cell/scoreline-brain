import { expect, it } from 'vitest';
import { cardColors } from './cardColors';

it('home colour on top, away colour at the bottom, the other two mixed toward warm white', () => {
  const c = cardColors({ colors: ['#0055A4', '#EF4135'] }, { colors: ['#74ACDF', '#F6B40E'] });
  expect(c.stops).toHaveLength(4);
  expect(c.stops[0]).not.toBe(c.stops[3]);
  expect(c.halo[0]).toBe(c.stops[0]);
  expect(c.halo[1]).toBe(c.stops[3]);
  expect(c.hot).toEqual(['#0055A4', '#74ACDF']);
  for (const s of c.stops) expect(s).toMatch(/^#[0-9a-f]{6}$/i);
});
