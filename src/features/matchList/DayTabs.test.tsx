import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DAY_PAD, DAY_TYPE } from './dayLayout';
import { DayTabs, type DayTab } from './DayTabs';

/*
 * The tab widths come from a canvas measure of the face, not from the DOM. jsdom has neither a
 * canvas nor document.fonts, so both are faked: a context whose glyphs are 8 px wide until the face
 * "loads" and 10 px after, and a document.fonts the test can fire loadingdone on.
 */

const LABELS: DayTab[] = [
  { id: '-2', label: 'Sat 19' },
  { id: '-1', label: 'Yesterday' },
  { id: '0', label: 'Today' },
  { id: '1', label: 'Tomorrow' },
  { id: '2', label: 'Wed 23' },
];

let glyph = 8;
const measured: Array<{ font: string; spacing: string; text: string }> = [];
const fonts = new EventTarget() as EventTarget & { ready: Promise<unknown> };
fonts.ready = Promise.resolve();

beforeAll(() => {
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const ctx = {
      font: '',
      letterSpacing: '',
      measureText(text: string) {
        measured.push({ font: ctx.font, spacing: ctx.letterSpacing, text });
        return { width: text.length * glyph };
      },
    };
    return ctx as unknown as CanvasRenderingContext2D;
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const strip = (container: HTMLElement) => container.querySelector<HTMLElement>('[role="tablist"] > div')!;

describe('DayTabs widths', () => {
  it('knows them in the first render, from the face and not from the DOM', () => {
    const layout = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    const { container } = render(<DayTabs items={LABELS} value="0" morph="0" live={false} onChange={() => {}} />);
    // the Today tab is as wide as its word plus 13 px a side; --wt / --wo carry the two words
    expect(strip(container).style.getPropertyValue('--wt')).toBe(String('Today'.length * glyph));
    expect(strip(container).style.getPropertyValue('--wo')).toBe(String('Ongoing'.length * glyph));
    // nothing read a layout: that read forced the whole new tree to lay out inside the commit
    expect(layout).not.toHaveBeenCalled();
    layout.mockRestore();
  });

  it('measures in the tab’s own type: weight 500, 15 px, −0.01 em', () => {
    measured.length = 0;
    render(<DayTabs items={LABELS} value="0" morph="0" live={false} onChange={() => {}} />);
    const today = measured.find((m) => m.text === 'Today')!;
    expect(today.font).toContain(`${DAY_TYPE.weight} ${DAY_TYPE.size}px`);
    expect(today.spacing).toBe(`${DAY_TYPE.track * DAY_TYPE.size}px`);
    // every word, and Ongoing, is measured
    expect(new Set(measured.map((m) => m.text))).toEqual(new Set([...LABELS.map((t) => t.label), 'Ongoing']));
  });

  it('centres the chosen tab from those widths, with the strip placed before anything paints', () => {
    const { container } = render(<DayTabs items={LABELS} value="0" morph="0" live={false} onChange={() => {}} />);
    const word = (s: string) => s.length * glyph;
    const w = LABELS.map((t) => word(t.label) + DAY_PAD * 2);
    const x = w[0]! + w[1]!;
    expect(strip(container).style.transform).toBe(`translateX(${Math.floor(354 / 2 - (x + w[2]! / 2) + 0.5)}px)`);
  });

  it('measures again when the face loads, and the strip follows', async () => {
    const { container } = render(<DayTabs items={LABELS} value="0" morph="0" live={false} onChange={() => {}} />);
    const before = strip(container).style.getPropertyValue('--wt');
    const shiftBefore = strip(container).style.transform;
    glyph = 10; // the face arrives and its glyphs are wider than the fallback's
    await act(async () => {
      fonts.dispatchEvent(new Event('loadingdone'));
    });
    expect(strip(container).style.getPropertyValue('--wt')).toBe(String('Today'.length * 10));
    expect(strip(container).style.getPropertyValue('--wt')).not.toBe(before);
    expect(strip(container).style.transform).not.toBe(shiftBefore);
    expect(strip(container).style.getPropertyValue('--wo')).toBe(String('Ongoing'.length * 10));
    glyph = 8;
  });

  it('measures again when the labels change (the first feed brings the real days)', () => {
    const fallback: DayTab[] = ['2 days ago', 'Yesterday', 'Today', 'Tomorrow', 'In 2 days'].map((label, i) => ({ id: String(i - 2), label }));
    const { container, rerender } = render(<DayTabs items={fallback} value="0" morph="0" live={false} onChange={() => {}} />);
    const before = strip(container).style.transform;
    rerender(<DayTabs items={LABELS} value="0" morph="0" live={false} onChange={() => {}} />);
    expect(strip(container).style.transform).not.toBe(before);
  });
});
