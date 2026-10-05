import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DAY_PAD, DAY_TYPE, dayLayout, dayPlace, type DayWidths } from './dayLayout';

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

describe('the type the tab words are measured in', () => {
  const css = (...path: string[]) => readFileSync(join(__dirname, ...path), 'utf8');
  const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css('..', '..', 'styles', 'tokens.css'))?.[1]?.trim();
  const tab = /\.tab\s*\{([^}]*)\}/.exec(css('DayTabs.module.css'))?.[1] ?? '';

  it('is what .tab sets: --type-row with --track-1', () => {
    expect(tab).toMatch(/font:\s*var\(--type-row\)/);
    expect(tab).toMatch(/letter-spacing:\s*var\(--track-1\)/);
  });

  it('is what the tokens say: weight 500, 15 px, −0.01 em', () => {
    expect(token('--type-row')).toMatch(/^var\(--fw-m\) var\(--fs-15\) \//);
    expect(Number(token('--fw-m'))).toBe(DAY_TYPE.weight);
    expect(token('--fs-15')).toBe(`${DAY_TYPE.size}px`);
    expect(token('--track-1')).toBe(`${DAY_TYPE.track}em`);
  });
});
