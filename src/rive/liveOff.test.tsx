import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveOff } from './LiveOff';
import { GLYPHS } from './liveOffArt';

// The OFF artwork exactly as supplied (Preset-1, 0.svg; SHA-256 8a050f3d…2677218 with its trailing newline).
const SUPPLIED = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 434 152" width="434" height="152">
<defs>
<linearGradient id="grad0" x1="-91.09" y1="68.5" x2="-119.2" y2="0.75" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="rgb(218,218,218)" stop-opacity="0.2"/>
<stop offset="1" stop-color="rgb(0,0,0)" stop-opacity="0.2"/>
</linearGradient>
<linearGradient id="grad1" x1="118.6" y1="0.75" x2="86.52" y2="-67" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="rgb(0,0,0)" stop-opacity="0.2"/>
<stop offset="1" stop-color="rgb(255,255,255)" stop-opacity="0.2"/>
</linearGradient>
</defs>
<path transform="matrix(1.002 0 0 1.002 405.9 75.25)" fill="#121212" d="M-262.5 0.75C-262.5 -36.67 -232.2 -67 -194.8 -67L-68.25 -67C-30.83 -67 -0.5 -36.67 -0.5 0.75C-0.5 38.17 -30.83 68.5 -68.25 68.5L-194.8 68.5C-232.2 68.5 -262.5 38.17 -262.5 0.75Z"/>
<path transform="matrix(1.002 0 0 1.002 405.9 75.25)" fill="none" stroke="url(#grad0)" stroke-width="2" stroke-linecap="round" d="M-262.5 0.75C-262.5 -36.67 -232.2 -67 -194.8 -67L-68.25 -67C-30.83 -67 -0.5 -36.67 -0.5 0.75C-0.5 38.17 -30.83 68.5 -68.25 68.5L-194.8 68.5C-232.2 68.5 -262.5 38.17 -262.5 0.75Z"/>
<path transform="matrix(1.002 0 0 1.002 405.9 75.25)" fill="none" stroke="url(#grad1)" stroke-width="2" d="M-262.5 0.75C-262.5 -36.67 -232.2 -67 -194.8 -67L-68.25 -67C-30.83 -67 -0.5 -36.67 -0.5 0.75C-0.5 38.17 -30.83 68.5 -68.25 68.5L-194.8 68.5C-232.2 68.5 -262.5 38.17 -262.5 0.75Z"/>
<path transform="matrix(1.002 0 0 1.002 256.6 76)" fill="#2a2a2a" d="M-76 0C-76 -20.99 -58.99 -38 -38 -38C-17.01 -38 0 -20.99 0 0C0 20.99 -17.01 38 -38 38C-58.99 38 -76 20.99 -76 0Z"/>
<path transform="matrix(1.002 0 0 1.002 220.5 76.25)" fill="#ffffff" d="M-0.25 -14C7.344 -14 13.5 -7.844 13.5 -0.25C13.5 7.344 7.344 13.5 -0.25 13.5C-7.844 13.5 -14 7.344 -14 -0.25C-14 -7.844 -7.844 -14 -0.25 -14Z"/>
<path transform="matrix(1.002 0 0 1.002 220.5 76.25)" fill="#83dc7b" fill-opacity="0.3098" d="M-0.25 -0.25Z"/>
<path transform="matrix(1.002 0 0 1.002 332.3 75.75)" fill="#ffffff" d="M-35 -21C-35 -27.08 -30.08 -32 -24 -32L24 -32C30.08 -32 35 -27.08 35 -21L35 21.5C35 27.58 30.08 32.5 24 32.5L-24 32.5C-30.08 32.5 -35 27.58 -35 21.5L-35 -21Z"/>
<path transform="matrix(1.002 0 0 1.002 332.3 80.26)" fill="#121212" d="M-28 -17C-28 -19.21 -26.21 -21 -24 -21L24 -21C26.21 -21 28 -19.21 28 -17L28 17C28 19.21 26.21 21 24 21L-24 21C-26.21 21 -28 19.21 -28 17L-28 -17Z"/>
<path transform="matrix(1.002 0 0 1.002 320.1 59.59)" fill="#ffffff" d="M11.19 32.13C9.17 32.13 7.436 31.65 5.986 30.67C4.537 29.7 3.423 28.34 2.644 26.6C1.866 24.86 1.477 22.85 1.477 20.55C1.477 18.25 1.866 16.24 2.644 14.5C3.423 12.76 4.535 11.4 5.982 10.43C7.429 9.454 9.163 8.966 11.19 8.966C13.2 8.966 14.93 9.454 16.37 10.43C17.81 11.4 18.92 12.76 19.69 14.5C20.47 16.24 20.86 18.25 20.86 20.55C20.86 22.85 20.47 24.86 19.69 26.6C18.92 28.34 17.81 29.7 16.37 30.67C14.93 31.65 13.2 32.13 11.19 32.13ZM11.18 28.69C12.31 28.69 13.31 28.37 14.17 27.71C15.04 27.05 15.72 26.12 16.21 24.9C16.7 23.68 16.94 22.23 16.94 20.55C16.94 18.86 16.7 17.4 16.21 16.19C15.72 14.98 15.04 14.05 14.17 13.4C13.31 12.75 12.31 12.43 11.18 12.43C10.05 12.43 9.049 12.75 8.175 13.4C7.3 14.06 6.618 14.99 6.129 16.2C5.639 17.41 5.394 18.86 5.394 20.56C5.394 22.24 5.639 23.68 6.129 24.9C6.618 26.12 7.3 27.05 8.175 27.71C9.049 28.37 10.05 28.69 11.18 28.69Z"/>
</svg>`;

afterEach(cleanup);

const parse = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
const attrs = (el: Element) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));

describe('the supplied OFF artwork', () => {
  const drawn = (el: Element) => [...el.querySelectorAll('path')];
  const supplied = parse(SUPPLIED);

  it('with a count of 0 is the supplied drawing, path for path: shapes, transforms, fills and strokes', () => {
    const view = render(<LiveOff count={0} />);
    const mine = drawn(view.container.querySelector('svg')!);
    const theirs = drawn(supplied);
    expect(theirs).toHaveLength(9);
    expect(mine).toHaveLength(9);
    // only the gradient ids differ: they carry a prefix
    const comparable = (el: Element) => {
      const a = attrs(el);
      return { ...a, stroke: a.stroke?.replace('sl-live-off-', '') };
    };
    theirs.forEach((p, i) => expect(comparable(mine[i]!), `path ${i}`).toEqual(comparable(p)));
  });

  it('has the supplied gradients, under ids of its own so the page sprite keeps #grad0 and #grad1', () => {
    const view = render(<LiveOff count={3} />);
    const svg = view.container.querySelector('svg')!;
    const grads = [...svg.querySelectorAll('linearGradient')];
    const suppliedGrads = [...supplied.querySelectorAll('linearGradient')];
    expect(grads).toHaveLength(2);
    grads.forEach((g, i) => {
      const want = suppliedGrads[i]!;
      expect(g.id).toBe(`sl-live-off-${want.id}`);
      for (const name of ['x1', 'y1', 'x2', 'y2', 'gradientUnits']) expect(g.getAttribute(name), name).toBe(want.getAttribute(name));
      expect([...g.querySelectorAll('stop')].map((s) => [s.getAttribute('offset'), s.getAttribute('stop-color'), s.getAttribute('stop-opacity')])).toEqual(
        [...want.querySelectorAll('stop')].map((s) => [s.getAttribute('offset'), s.getAttribute('stop-color'), s.getAttribute('stop-opacity')]),
      );
    });
    // every id it defines is its own
    expect([...svg.querySelectorAll('[id]')].every((e) => e.id.startsWith('sl-live-off-'))).toBe(true);
  });

  it('is the art in Rive\'s box: its artboard (434 × 152) centred in the canvas, not the full-bleed artboard', () => {
    const view = render(<LiveOff count={0} />);
    const svg = view.container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('-5.01 0 443.89 152.3');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(supplied.getAttribute('viewBox')).toBe('0 0 434 152');
  });

  it('shows the count in the calendar, centred where the supplied 0 stood, in the art\'s own glyphs', () => {
    const digits = (count: number) => {
      const view = render(<LiveOff count={count} />);
      const out = [...view.container.querySelectorAll('[data-digit]')].map((p) => ({ digit: p.getAttribute('data-digit'), at: p.getAttribute('transform'), d: p.getAttribute('d') }));
      view.unmount();
      return out;
    };
    expect(digits(0)).toEqual([]);
    const five = digits(5);
    expect(five.map((x) => x.digit)).toEqual(['5']);
    expect(five[0]!.d).toBe(GLYPHS[5]);
    expect(digits(12).map((x) => x.digit)).toEqual(['1', '2']);
    // two digits are centred on the same middle as one: the calendar's (331.29)
    const [a, b] = digits(12).map((x) => Number(/translate\(([\d.]+)/.exec(x.at ?? '')?.[1]));
    expect(Math.abs((a! + b! + 20.4) / 2 - 331.29)).toBeLessThan(12);
    expect(Number(/translate\(([\d.]+) ([\d.]+)\)/.exec(five[0]!.at ?? '')?.[2])).toBe(91.4);
  });

  it('holds the same glyphs as the page\'s sprite (index.html #ld0–#ld9), so the two never drift apart', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    for (let n = 0; n < 10; n++) {
      const sprite = new RegExp(`<path id="ld${n}" fill="#fff" d="([^"]+)"`).exec(html)?.[1];
      expect(GLYPHS[n], `#ld${n}`).toBe(sprite);
    }
  });
});
