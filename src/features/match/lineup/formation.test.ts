import { describe, expect, it } from 'vitest';
import { PITCH, formRows, pitchLayout, rowY, slotLine, slotRow, usableFormation } from './formation';

// every formation the demo's squads use (data.ts)
const DEMO = ['4-2-3-1', '4-3-3', '4-4-2', '3-4-2-1'];

describe('formRows', () => {
  it('puts the keeper first and reads each line from the defence up', () => {
    expect(formRows('4-2-3-1')).toEqual([1, 4, 2, 3, 1]);
    expect(formRows('3-4-2-1')).toEqual([1, 3, 4, 2, 1]);
    expect(formRows('4-4-2')).toEqual([1, 4, 4, 2]);
  });

  it('holds eleven players in every demo formation', () => {
    for (const f of DEMO) expect(formRows(f).reduce((a, b) => a + b, 0), f).toBe(11);
  });
});

describe('slotRow and slotLine', () => {
  it('walks the eleven in order: the keeper, then each row left to right', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => slotRow('4-2-3-1', s));
    expect(rows.map((r) => r.row)).toEqual([1, 2, 2, 2, 2, 3, 3, 4, 4, 4, 5]);
    expect(rows.map((r) => r.index)).toEqual([1, 1, 2, 3, 4, 1, 2, 1, 2, 3, 1]);
    expect(rows.map((r) => r.count)).toEqual([1, 4, 4, 4, 4, 2, 2, 3, 3, 3, 1]);
  });

  it('names the line a slot stands in', () => {
    const lines = Array.from({ length: 11 }, (_, i) => slotLine('4-4-2', i + 1));
    expect(lines).toEqual(['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW']);
  });
});

describe('rowY', () => {
  it('spaces the rows evenly from the keeper 34 above the bottom to the forwards 98 under the top', () => {
    expect([1, 2, 3, 4, 5].map((r) => rowY(5, r))).toEqual([506, 404, 302, 200, 98]);
    expect([1, 2, 3, 4].map((r) => rowY(4, r))).toEqual([506, 370, 234, 98]);
  });
});

describe('pitchLayout', () => {
  const xi = [16, 19, 17, 4, 5, 14, 8, 20, 7, 11, 10];

  it('places the eleven in slot order, every row centred and evenly spaced', () => {
    const { slots, rows } = pitchLayout('4-2-3-1', xi, 354);
    expect(rows).toEqual([1, 4, 2, 3, 1]);
    expect(slots.map((s) => s.n)).toEqual(xi);
    // the keeper on the middle, the back four 84.5 apart
    expect(slots[0]).toMatchObject({ n: 16, x: 177, y: 506, fromTop: 4 });
    expect(slots.slice(1, 5).map((s) => s.x)).toEqual([177 - 126.75, 177 - 42.25, 177 + 42.25, 177 + 126.75]);
    // the pair of the double pivot stands 116 apart (spacing is capped at 116)
    expect(slots.slice(5, 7).map((s) => s.x)).toEqual([177 - 58, 177 + 58]);
    expect(slots[10]).toMatchObject({ n: 10, x: 177, y: 98, fromTop: 0 });
  });

  it('caps a row’s spacing at 116 and its plates at 92', () => {
    const { slots } = pitchLayout('4-3-3', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 354);
    expect(slots[0]!.maxW).toBe(92); // a lone player: spacing 116, 110 → 92
    expect(slots[1]!.maxW).toBe(78.5); // four across: 84.5 - 6
    expect(slots[5]!.x - slots[6]!.x).toBe(-(354 - 16) / 3); // three across: 112.67 apart
  });

  it.each(DEMO)('lays %s out with eleven distinct places inside the pitch', (f) => {
    const { slots } = pitchLayout(f, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 354);
    expect(slots).toHaveLength(11);
    expect(new Set(slots.map((s) => `${s.x}|${s.y}`)).size).toBe(11);
    for (const s of slots) {
      expect(s.x - 38).toBeGreaterThanOrEqual(0);
      expect(s.x + 38).toBeLessThanOrEqual(354);
      expect(s.y - 65).toBeGreaterThanOrEqual(0);
      expect(s.y + 19).toBeLessThanOrEqual(PITCH.height);
    }
  });

  it('stripes one band per line of players, alternating shade, each centred on the line’s visual middle', () => {
    const { bands } = pitchLayout('4-2-3-1', xi, 354);
    expect(bands).toHaveLength(5);
    // from the forwards (row 5) down to the keeper; half = 102 / 2 = 51
    expect(bands.map((b) => b.shade)).toEqual([0.03, 0.008, 0.03, 0.008, 0.03]);
    expect(bands[0]).toEqual({ y: 98 - 26 - 51, h: 102, shade: 0.03 });
    expect(bands[4]).toEqual({ y: 506 - 26 - 51, h: 102, shade: 0.03 });
  });

  it('lays out at the pane’s own width', () => {
    const narrow = pitchLayout('4-4-2', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 300).slots;
    expect(narrow[1]!.x).toBeCloseTo(150 + (1 - 2.5) * 71, 6);
  });

  it('uses 4-3-3 when a formation does not hold the eleven it was sent with', () => {
    expect(usableFormation('4-4-3')).toBe('4-3-3');
    expect(usableFormation('4-4-2')).toBe('4-4-2');
    const { form, slots } = pitchLayout('9-9', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 354);
    expect(form).toBe('4-3-3');
    expect(slots).toHaveLength(11);
  });

  it('leaves out the places of a side with fewer than eleven named', () => {
    expect(pitchLayout('4-4-2', [1, 2, 3], 354).slots).toHaveLength(3);
  });
});
