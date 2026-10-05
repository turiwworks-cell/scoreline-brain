import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { scorelineStore } from '../../store';
import { IconSprite } from '../../ui';
import { listGroups } from './groups';
import { MatchList, type MatchListProps } from './MatchList';
import { createFollowPref } from './follow/pref';

/*
 * A matchday of 60 matches in five leagues: the first feed mounts what fills the first screen,
 * then the rest in slices, in the list's order, each group's box as tall as it will be.
 */

const COUNT = 60;

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const raw = demoFeedJson();
  const originals = raw.matches as Array<Record<string, unknown>>;
  // every match on today's tab, in the leagues the demo has, ids in the order they appear
  const matches = Array.from({ length: COUNT }, (_, n) => ({ ...originals[n % originals.length]!, id: n + 1, day: 0 }));
  scorelineStore.getState().actions.applyFeed(parseFeed({ ...raw, matches }), Date.now());
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const memoryPref = () => {
  const store = new Map<string, string>();
  return createFollowPref({ team: 'arg', n: 10 }, { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
};

function setup(list: MatchListProps['list'] = { day: 0, live: false }) {
  const props = { onDay: vi.fn(), onLive: vi.fn(), onOpenMatch: vi.fn(), onOpenPlayer: vi.fn(), pref: memoryPref() };
  const ui = (l: MatchListProps['list']) => (
    <>
      <IconSprite />
      <MatchList list={l} {...props} />
    </>
  );
  const view = render(ui(list));
  return { ...view, show: (l: MatchListProps['list']) => view.rerender(ui(l)) };
}

const rowIds = () => Array.from(document.querySelectorAll('[data-focus-key^="match-"]'), (el) => Number(el.getAttribute('data-focus-key')!.slice(6)));
/** One slice: the task it is asked for in. */
const frame = () => act(() => void vi.advanceTimersToNextTimer());

describe('the first feed of a long matchday', () => {
  const state = () => scorelineStore.getState().domain;
  const order = (list: MatchListProps['list'] = { day: 0, live: false }) => listGroups(state(), list).flatMap((g) => g.ids);

  it('has more than a screen of it to mount, or the test proves nothing', () => {
    expect(order().length).toBe(COUNT);
  });

  it('commits the first screen only, with every group’s box already its full height', () => {
    setup();
    const mounted = rowIds();
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length).toBeLessThan(COUNT);
    const groups = listGroups(state(), { day: 0, live: false });
    const boxes = Array.from(document.querySelectorAll<HTMLElement>('[data-group]'));
    expect(boxes.map((b) => b.dataset.group)).toEqual(groups.map((g) => g.key));
    boxes.forEach((box, i) => expect(box.style.getPropertyValue('--full')).toBe(String(groups[i]!.ids.length * 76)));
    // the groups the slices have not reached are marked, and have no header or rows yet
    const pending = boxes.filter((b) => b.hasAttribute('data-pending'));
    expect(pending.length).toBeGreaterThan(0);
    pending.forEach((b) => expect(b.querySelector('button, [data-focus-key]')).toBeNull());
  });

  it('fills the rest a slice a task, always in the list’s order, until every match is there once', () => {
    setup();
    const all = order();
    let before = rowIds();
    expect(before).toEqual(all.slice(0, before.length));
    let frames = 0;
    while (before.length < COUNT && frames < 200) {
      frame();
      frames++;
      const now = rowIds();
      // never a gap, never out of order, never fewer
      expect(now).toEqual(all.slice(0, now.length));
      expect(now.length).toBeGreaterThanOrEqual(before.length);
      before = now;
    }
    expect(before).toEqual(all);
    expect(frames).toBeGreaterThan(1);
    expect(document.querySelectorAll('[data-pending]').length).toBe(0);
    expect(document.querySelectorAll('[data-group] button[aria-expanded]').length).toBe(listGroups(state(), { day: 0, live: false }).length);
  });

  it('does not move the boxes of the groups below as rows arrive', () => {
    setup();
    const heights = () => Array.from(document.querySelectorAll<HTMLElement>('[data-group]'), (b) => b.style.getPropertyValue('--full'));
    const first = heights();
    for (let i = 0; i < 30; i++) {
      frame();
      expect(heights()).toEqual(first);
    }
  });

  it('mounts the whole of the next day or Live at once, so the cascade finds all its blocks', () => {
    const { show } = setup();
    frame();
    expect(rowIds().length).toBeLessThan(COUNT);
    const live = { day: 0, live: true };
    show(live);
    // no frame has passed since the change
    expect(rowIds()).toEqual(order(live));
    expect(document.querySelectorAll('[data-pending]').length).toBe(0);
    show({ day: 0, live: false });
    expect(rowIds()).toEqual(order());
  });

  it('does not slice a small list, however many times it renders', () => {
    // the demo's own day: a handful of matches fills no more than the screen and its slack
    setup({ day: 1, live: false });
    const n = rowIds().length;
    expect(document.querySelectorAll('[data-pending]').length).toBe(0);
    frame();
    frame();
    expect(rowIds().length).toBe(n);
    expect(n).toBe(order({ day: 1, live: false }).length);
  });
});
