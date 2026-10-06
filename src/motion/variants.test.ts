import type { Variant } from 'motion/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetMotion, tuneMotion } from './tokens';
import { AT_REST, cascade, drawn, LANDED, paneSwap, playerPage, pushBase, pushLayer, scrim, sheetRise, slide, transition } from './variants';

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
  it('fades and lifts in, staggered by custom index, and keeps only the hair when it lands', () => {
    const c = cascade('screen');
    expect(c.hidden).toEqual({ opacity: 0, transform: slide(0, 12) });
    expect(resolveV(c.shown, 2)).toEqual({ opacity: 1, transform: AT_REST, transitionEnd: LANDED, transition: transition('screen', { index: 2 }) });
    expect(resolveV(c.shown, undefined)).toMatchObject({ transition: { delay: 0 } });
  });

  it('is one object per section and lift, so re-renders pass the same variants', () => {
    expect(cascade('stats')).toBe(cascade('stats'));
    expect(cascade('player', { lift: 14 })).not.toBe(cascade('player'));
    expect(cascade('player', { lift: 14 }).hidden).toEqual({ opacity: 0, transform: slide(0, 14) });
  });

  it('reads the tokens when it animates, not when it was made', () => {
    const c = cascade('events');
    tuneMotion({ speed: 2 });
    expect(resolveV(c.shown, 1)).toMatchObject({ transition: { duration: 0.25, delay: (0.15 + 0.04) / 2 } });
  });
});

describe('shell layers', () => {
  it('phone push: the layer slides in from the right, the list 22 % left under a 70 % scrim', () => {
    expect(resolveV(pushLayer.out)).toMatchObject({ transform: 'translateX(100%) translateY(0px) rotate(0.001deg)', transition: { duration: 0.55, delay: 0 } });
    expect(resolveV(pushLayer.in)).toMatchObject({ transform: AT_REST, transitionEnd: { transform: 'none' } });
    expect(resolveV(pushBase.covered)).toMatchObject({ transform: 'translateX(-22%) translateY(0px) rotate(0.001deg)' });
    expect(resolveV(pushBase.rest)).toMatchObject({ transform: AT_REST, transitionEnd: { transform: 'none' } });
    expect(resolveV(scrim.covered)).toMatchObject({ opacity: 0.7 });
  });

  it('player page and sheet open on player timing and close in 0.7 of it', () => {
    expect(resolveV(playerPage.in)).toMatchObject({ opacity: 1, transition: { duration: 0.72, delay: 0 } });
    expect(resolveV(playerPage.out)).toMatchObject({ opacity: 0, transition: { duration: 0.72 * 0.7 } });
    expect(resolveV(sheetRise.out)).toMatchObject({ transform: 'translateX(0px) translateY(100%) rotate(0.001deg)' });
    expect(resolveV(sheetRise.in)).toMatchObject({ transform: AT_REST, transitionEnd: { transform: 'none' } });
  });

  it('panes swap at once', () => {
    expect(paneSwap.out).toMatchObject({ transition: { duration: 0 } });
    expect(paneSwap.in).toMatchObject({ transition: { duration: 0 } });
  });
});

describe('slides between pixels', () => {
  it('a slide is a compositor transform with a hair of rotation; a block keeps the hair at rest', () => {
    expect(slide(0, 12)).toBe('translateX(0px) translateY(12px) rotate(0.001deg)');
    expect(AT_REST).toBe(slide(0, 0));
    expect(LANDED).toEqual({ transform: 'rotate(0.001deg)' });
  });

  it('a block a motion value moves keeps the hair, whatever Motion writes', () => {
    expect(drawn({}, 'translateY(3px)')).toBe('translateY(3px) rotate(0.001deg)');
    expect(drawn({}, '').trim()).toBe('rotate(0.001deg)');
  });
});
