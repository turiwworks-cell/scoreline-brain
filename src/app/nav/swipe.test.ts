import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachSwipes, SWIPE, swipeOf } from './swipe';

const at = (x: number, y: number, t = 0) => ({ x, y, t });

describe('what counts as a swipe', () => {
  it('is a deliberate, mostly horizontal move of enough distance', () => {
    expect(swipeOf(at(200, 400), at(80, 410, 300), 390)).toBe('left');
    expect(swipeOf(at(100, 400), at(220, 380, 300), 390)).toBe('right');
  });
  it('is nothing when short, slow or not clearly across', () => {
    expect(swipeOf(at(200, 400), at(200 - SWIPE.min + 1, 400, 100), 390)).toBeNull();
    expect(swipeOf(at(200, 400), at(80, 400, SWIPE.maxMs + 1), 390)).toBeNull();
    expect(swipeOf(at(200, 400), at(120, 520, 200), 390)).toBeNull();
    expect(swipeOf(at(200, 400), at(200, 560, 200), 390)).toBeNull();
  });
  it('is nothing from the screen edge, where the browser’s own back gesture starts', () => {
    expect(swipeOf(at(SWIPE.edge - 1, 400), at(200, 400, 200), 390)).toBeNull();
    expect(swipeOf(at(390 - SWIPE.edge + 1, 400), at(100, 400, 200), 390)).toBeNull();
    expect(swipeOf(at(SWIPE.edge, 400), at(200, 400, 200), 390)).toBe('right');
  });
});

/** A screen with the day tabs (Yesterday, Today, Tomorrow) and the page a touch lands on. */
function page(screen: 'list' | 'match', extra = '', back = true) {
  document.body.innerHTML = `
    <section data-screen="${screen}" data-present="true">${back ? '<button aria-label="Back" id="back">Back</button>' : ''}
      <div role="tablist" aria-label="Day">
        <button role="tab" aria-selected="false" id="d-1">Yesterday</button>
        <button role="tab" aria-selected="true" id="d0">Today</button>
        <button role="tab" aria-selected="false" id="d1">Tomorrow</button>
      </div>
      <div id="card">card</div>${extra}
    </section>`;
  const clicks: string[] = [];
  document.querySelectorAll('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => clicks.push(tab.id)));
  document.getElementById('back')?.addEventListener('click', back_);
  return { clicks, card: document.getElementById('card') as HTMLElement };
}

type Point = [number, number];
function touch(el: Element, type: string, points: Point[], changed: Point[] = points, time = 0) {
  const list = (ps: Point[]) => ps.map(([clientX, clientY]) => ({ clientX, clientY }));
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, { touches: { value: list(points) }, changedTouches: { value: list(changed) }, timeStamp: { value: time } });
  el.dispatchEvent(e);
}
/** One finger from `from` to `to` over `ms`. */
function drag(el: Element, from: Point, to: Point, ms = 200, via: Point[] = []) {
  touch(el, 'touchstart', [from], [from], 0);
  for (const p of via) touch(el, 'touchmove', [p], [p], ms / 2);
  touch(el, 'touchmove', [to], [to], ms - 1);
  touch(el, 'touchend', [], [to], ms);
}

const back_ = () => back();
const back = vi.fn();

describe('the swipe gestures', () => {
  let off = () => {};
  beforeEach(() => {
    back.mockClear();
    window.innerWidth = 390;
    off = attachSwipes();
  });
  afterEach(() => {
    off();
    document.body.replaceChildren();
  });

  describe('on the match screen', () => {
    it('goes back once for one swipe to the right', () => {
      const { card } = page('match');
      drag(card, [120, 400], [260, 410]);
      expect(back).toHaveBeenCalledTimes(1);
    });
    it('does nothing for a swipe to the left, a short one, a vertical one or a cancelled one', () => {
      const { card } = page('match');
      drag(card, [260, 400], [120, 400]);
      drag(card, [120, 400], [150, 400]);
      drag(card, [120, 300], [160, 600]);
      touch(card, 'touchstart', [[120, 400]]);
      touch(card, 'touchcancel', []);
      touch(card, 'touchend', [], [[260, 400]], 100);
      expect(back).not.toHaveBeenCalled();
    });
    it('does nothing when the finger turns vertical on the way, and scrolls on', () => {
      const { card } = page('match');
      drag(card, [120, 400], [260, 410], 300, [[130, 560]]);
      expect(back).not.toHaveBeenCalled();
    });
    it('does nothing from the edge of the screen', () => {
      const { card } = page('match');
      drag(card, [10, 400], [200, 400]);
      drag(card, [380, 400], [200, 400]);
      expect(back).not.toHaveBeenCalled();
    });
    it('does nothing on a screen that is on its way out or covered, and with a second finger', () => {
      const { card } = page('match');
      const screen = card.closest<HTMLElement>('[data-screen]') as HTMLElement;
      screen.dataset.present = 'false';
      drag(card, [120, 400], [260, 400]);
      screen.dataset.present = 'true';
      screen.setAttribute('inert', '');
      drag(card, [120, 400], [260, 400]);
      screen.removeAttribute('inert');
      touch(card, 'touchstart', [[120, 400], [180, 400]], [[120, 400], [180, 400]]);
      touch(card, 'touchend', [], [[260, 400]], 100);
      expect(back).not.toHaveBeenCalled();
    });
    it('leaves a control that takes horizontal movement itself, and a scroller that scrolls across', () => {
      const { card } = page('match', '<input id="range" type="range"><div id="strip" style="overflow-x:auto"><i id="chip">x</i></div>');
      const range = document.getElementById('range') as HTMLElement;
      const strip = document.getElementById('strip') as HTMLElement;
      Object.defineProperties(strip, { scrollWidth: { value: 900 }, clientWidth: { value: 300 } });
      drag(range, [120, 400], [260, 400]);
      drag(document.getElementById('chip') as HTMLElement, [120, 400], [260, 400]);
      expect(back).not.toHaveBeenCalled();
      drag(card, [120, 400], [260, 400]);
      expect(back).toHaveBeenCalledTimes(1);
    });
    it('does not go back where the match has no Back button: a wide layout’s pane has nothing under it', () => {
      const { card } = page('match', '', false);
      drag(card, [200, 400], [400, 400]);
      expect(back).not.toHaveBeenCalled();
    });
  });

  describe('on the day list', () => {
    it('moves one day for one swipe: left to the next, right to the one before', () => {
      const { card, clicks } = page('list');
      drag(card, [260, 400], [120, 400]);
      expect(clicks).toEqual(['d1']);
      drag(card, [120, 400], [260, 400]);
      expect(clicks).toEqual(['d1', 'd-1']);
      expect(back).not.toHaveBeenCalled();
    });
    it('does nothing at the end of the strip, short, vertical or cancelled', () => {
      const { card, clicks } = page('list');
      document.getElementById('d0')?.setAttribute('aria-selected', 'false');
      document.getElementById('d1')?.setAttribute('aria-selected', 'true');
      drag(card, [260, 400], [120, 400]);
      document.getElementById('d1')?.setAttribute('aria-selected', 'false');
      document.getElementById('d-1')?.setAttribute('aria-selected', 'true');
      drag(card, [120, 400], [260, 400]);
      document.getElementById('d-1')?.setAttribute('aria-selected', 'false');
      document.getElementById('d0')?.setAttribute('aria-selected', 'true');
      drag(card, [200, 400], [160, 400]);
      drag(card, [200, 300], [150, 600]);
      touch(card, 'touchstart', [[260, 400]]);
      touch(card, 'touchcancel', []);
      expect(clicks).toEqual([]);
    });
    it('is exactly once whatever the finger does after it has lifted', () => {
      const { card, clicks } = page('list');
      drag(card, [260, 400], [120, 400]);
      touch(card, 'touchend', [], [[100, 400]], 400);
      touch(card, 'touchmove', [[100, 400]]);
      expect(clicks).toEqual(['d1']);
    });
  });

  it('is armed once: a second attach replaces the first, so a gesture is one action', () => {
    off = attachSwipes();
    const { card } = page('match');
    drag(card, [120, 400], [260, 400]);
    expect(back).toHaveBeenCalledTimes(1);
  });
  it('stops when told to', () => {
    off();
    const { card } = page('match');
    drag(card, [120, 400], [260, 400]);
    expect(back).not.toHaveBeenCalled();
  });
});
