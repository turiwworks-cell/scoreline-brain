import { afterEach, describe, expect, it, vi } from 'vitest';
import { flightCount, fly, landAll } from './flight';
import type { SharedEnd } from './sharedIds';

// jsdom has no layout: give each end a box
function end(id: string, side: SharedEnd, box: { x: number; y: number; w: number; h: number }, html = '') {
  const el = document.createElement('span');
  el.dataset.shared = id;
  el.dataset.sharedEnd = side;
  el.innerHTML = html;
  el.getBoundingClientRect = () => ({ ...box, left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h, width: box.w, height: box.h, toJSON: () => box }) as DOMRect;
  document.body.append(el);
  return el;
}

const CREST = '<svg><clipPath id="clip1"><circle r="15"/></clipPath><g clip-path="url(#clip1)"><use href="#clip1"/></g></svg>';

afterEach(() => {
  landAll();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('shared-element flights', () => {
  it('copies both ends into the overlay, hides the ends, and lands cleanly', () => {
    const card = end('match:1:home', 'card', { x: 20, y: 300, w: 30, h: 30 }, CREST);
    const hero = end('match:1:home', 'hero', { x: 40, y: 100, w: 64, h: 64 }, CREST);
    expect(fly({ group: 'match:1', from: 'card', to: 'hero', timing: 'screen' })).toBe(1);
    expect(flightCount()).toBe(1);
    expect(card.hasAttribute('data-shared-flying')).toBe(true);
    expect(hero.hasAttribute('data-shared-flying')).toBe(true);

    const copies = document.querySelectorAll<HTMLElement>('[data-shared-overlay] [data-shared-copy]');
    expect(copies).toHaveLength(2);
    for (const c of copies) {
      expect(c.getAttribute('aria-hidden')).toBe('true');
      expect(c.hasAttribute('data-shared')).toBe(false);
      // the copy's clip path is its own (the original's is hidden while it flies)
      const id = c.querySelector('clipPath')?.id ?? '';
      expect(id).not.toBe('clip1');
      expect(c.querySelector('g')?.getAttribute('clip-path')).toBe(`url(#${id})`);
      expect(c.querySelector('use')?.getAttribute('href')).toBe(`#${id}`);
    }

    landAll();
    expect(flightCount()).toBe(0);
    expect(document.querySelectorAll('[data-shared-copy]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-shared-flying]')).toHaveLength(0);
  });

  it('flies every element of the group, each from inside what was pressed when it can', () => {
    const other = document.createElement('div');
    const pressed = document.createElement('button');
    document.body.append(other, pressed);
    end('match:1:home', 'card', { x: 0, y: 600, w: 30, h: 30 });
    const inside = end('match:1:home', 'card', { x: 0, y: 300, w: 30, h: 30 });
    pressed.append(inside);
    end('match:1:score', 'card', { x: 50, y: 300, w: 26, h: 20 });
    end('match:1:home', 'hero', { x: 40, y: 100, w: 64, h: 64 });
    end('match:1:score', 'hero', { x: 120, y: 100, w: 80, h: 60 });
    end('match:2:home', 'hero', { x: 40, y: 100, w: 64, h: 64 });
    expect(fly({ group: 'match:1', from: 'card', to: 'hero', timing: 'screen', fromWithin: pressed })).toBe(2);
    expect(inside.hasAttribute('data-shared-flying')).toBe(true);
  });

  it('a second flight of the same element replaces the first: no duplicate copies', () => {
    end('player:fra:10:photo', 'face', { x: 20, y: 500, w: 40, h: 40 });
    end('player:fra:10:photo', 'bust', { x: 100, y: 80, w: 230, h: 288 });
    fly({ group: 'player:fra:10', from: 'face', to: 'bust', timing: 'player' });
    fly({ group: 'player:fra:10', from: 'bust', to: 'face', timing: 'player', durationScale: 0.7 });
    expect(flightCount()).toBe(1);
    expect(document.querySelectorAll('[data-shared-copy]')).toHaveLength(2);
  });

  it('ends off screen do not fly', () => {
    end('match:1:home', 'card', { x: 20, y: 2000, w: 30, h: 30 });
    end('match:1:home', 'hero', { x: 40, y: 100, w: 64, h: 64 });
    expect(fly({ group: 'match:1', from: 'card', to: 'hero', timing: 'screen' })).toBe(0);
    expect(document.querySelectorAll('[data-shared-flying]')).toHaveLength(0);
  });

  it('nothing flies with reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    end('match:1:home', 'card', { x: 20, y: 300, w: 30, h: 30 });
    end('match:1:home', 'hero', { x: 40, y: 100, w: 64, h: 64 });
    expect(fly({ group: 'match:1', from: 'card', to: 'hero', timing: 'screen' })).toBe(0);
  });

  it('a hidden tab lands everything', () => {
    end('match:1:home', 'card', { x: 20, y: 300, w: 30, h: 30 });
    end('match:1:home', 'hero', { x: 40, y: 100, w: 64, h: 64 });
    fly({ group: 'match:1', from: 'card', to: 'hero', timing: 'screen' });
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vis.mockRestore();
    expect(flightCount()).toBe(0);
  });
});
