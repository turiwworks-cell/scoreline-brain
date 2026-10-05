import type { Variant } from 'motion/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetMotion, tuneMotion } from './tokens';
import { cascade, paneSwap, playerPage, pushBase, pushLayer, scrim, sheetRise, transition } from './variants';

afterEach(resetMotion);

// a variant written as a resolver: call it like Motion does
const resolveV = (v: Variant | undefined, custom?: unknown) => (typeof v === 'function' ? v(custom, {}, {}) : v) as Record<string, unknown>;

describe('transition', () => {
  it('starts item i at delay + i × stagger, with the section curve', () => {
    expect(transition('lineup', { index: 3 })).toEqual({ duration: 0.6, delay: 0.1 + 3 * 0.14, ease: [0.16, 1, 0.3, 1] });
  });

  it('can drop the delay and scale the duration', () => {
    expect(transition('player', { withDelay: false, scale: 0.7 })).toMatchObject({ duration: 0.72 * 0.7, delay: 0 });
  });
});

describe('cascade', () => {
  it('fades and lifts in, staggered by custom index', () => {
    const c = cascade('screen');
    expect(c.hidden).toEqual({ opacity: 0, y: 12 });
    expect(resolveV(c.shown, 2)).toEqual({ opacity: 1, y: 0, transition: transition('screen', { index: 2 }) });
    expect(resolveV(c.shown, undefined)).toMatchObject({ transition: { delay: 0 } });
  });

  it('is one object per section and lift, so re-renders pass the same variants', () => {
    expect(cascade('stats')).toBe(cascade('stats'));
    expect(cascade('player', { lift: 14 })).not.toBe(cascade('player'));
    expect(cascade('player', { lift: 14 }).hidden).toEqual({ opacity: 0, y: 14 });
  });

  it('reads the tokens when it animates, not when it was made', () => {
    const c = cascade('events');
    tuneMotion({ speed: 2 });
    expect(resolveV(c.shown, 1)).toMatchObject({ transition: { duration: 0.25, delay: (0.15 + 0.04) / 2 } });
  });
});

describe('shell layers', () => {
  it('phone push: the layer slides in from the right, the list 22 % left under a 70 % scrim', () => {
    expect(resolveV(pushLayer.out)).toMatchObject({ x: '100%', transition: { duration: 0.55, delay: 0 } });
    expect(resolveV(pushLayer.in)).toMatchObject({ x: 0 });
    expect(resolveV(pushBase.covered)).toMatchObject({ x: '-22%' });
    expect(resolveV(pushBase.rest)).toMatchObject({ x: 0 });
    expect(resolveV(scrim.covered)).toMatchObject({ opacity: 0.7 });
  });

  it('player page and sheet open on player timing and close in 0.7 of it', () => {
    expect(resolveV(playerPage.in)).toMatchObject({ opacity: 1, transition: { duration: 0.72, delay: 0 } });
    expect(resolveV(playerPage.out)).toMatchObject({ opacity: 0, transition: { duration: 0.72 * 0.7 } });
    expect(resolveV(sheetRise.out)).toMatchObject({ y: '100%' });
  });

  it('panes swap at once', () => {
    expect(paneSwap.out).toMatchObject({ transition: { duration: 0 } });
    expect(paneSwap.in).toMatchObject({ transition: { duration: 0 } });
  });
});
