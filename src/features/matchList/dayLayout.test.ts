import { describe, expect, it } from 'vitest';
import { DAY_PAD, dayLayout, dayPlace, type DayWidths } from './dayLayout';

const widths: DayWidths = { words: [40, 60, 40, 70, 50], morph: 2, today: 40, ongoing: 60 };

describe('day tabs layout', () => {
  it('each tab is its word plus 13 px each side, side by side', () => {
    const { xs, ws } = dayLayout(widths, 0);
    expect(ws).toEqual([66, 86, 66, 96, 76]);
    expect(xs).toEqual([0, 66, 152, 218, 314]);
  });

  it('the Today tab grows into Ongoing with Live and pushes its neighbours', () => {
    const half = dayLayout(widths, 0.5);
    expect(half.ws[2]).toBe(50 + DAY_PAD * 2);
    expect(half.xs[3]).toBe(152 + 76);
    expect(dayLayout(widths, 1).ws[2]).toBe(86);
  });

  it('the strip shifts to centre the chosen tab and the indicator sits under its word', () => {
    const b = dayLayout(widths, 0);
    const p = dayPlace(b, 2, 354);
    // tab 2: x 152, w 66 → centre 185 → shift 177 - 185 = -8
    expect(p.shift).toBe(-8);
    expect(p.indX).toBe(152 - 8 + DAY_PAD);
    expect(p.indW).toBe(40);
  });

  it('rounds the shift to whole pixels', () => {
    const p = dayPlace({ xs: [0], ws: [51] }, 0, 100);
    expect(Number.isInteger(p.shift)).toBe(true);
  });
});
