import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { snapPx as SnapPx } from './snap';

// snap.ts asks the browser once whether it has CSS round(): each test loads it afresh
async function load(round: boolean, dpr = 2): Promise<typeof SnapPx> {
  vi.stubGlobal('devicePixelRatio', dpr);
  vi.stubGlobal('CSS', round ? { supports: (p: string, v: string) => p === 'top' && v.startsWith('round(') } : undefined);
  return (await import('./snap')).snapPx;
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('snapPx', () => {
  it('lands the tail of a slide at rest, not a hair away from it', async () => {
    const snap = await load(true);
    expect(snap({ y: '0px' }, '')).toBe('none');
    expect(snap({}, '')).toBe('none');
    // a hair away rounds to nothing; Motion's last frame then writes 'none'
    expect(snap({ y: '0.0001px' }, 'translateY(0.0001px)')).toBe('translate(round(0px,0.5px),round(0.0001px,0.5px))');
  });

  it('rounds each axis to whole device pixels, px or % of the element', async () => {
    const snap = await load(true, 2);
    expect(snap({ x: '-17.3px', y: '5.9px' }, 'translateX(-17.3px) translateY(5.9px)')).toBe('translate(round(-17.3px,0.5px),round(5.9px,0.5px))');
    expect(snap({ x: '76.9229%' }, 'translateX(76.9229%)')).toBe('translate(round(76.9229%,0.5px),round(0px,0.5px))');
  });

  it('follows the device pixel ratio', async () => {
    const snap = await load(true, 3);
    expect(snap({ y: '12px' }, 'translateY(12px)')).toBe(`translate(round(0px,${1 / 3}px),round(12px,${1 / 3}px))`);
  });

  it('keeps Motion’s transform where the browser has no round()', async () => {
    const snap = await load(false);
    expect(snap({ y: '6.7px' }, 'translateY(6.7px)')).toBe('translateY(6.7px)');
    expect(snap({ y: '0px' }, '')).toBe('none');
  });
});
