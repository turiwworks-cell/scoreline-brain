import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Group } from './groups';
import { useLayoutEffect, useRef } from 'react';
import { blockStarts, blocksIn, firstBlocks, GROUP_GAP_PX, HEAD_PX, MAX_SLICE, MIN_SLICE, mountedIn, ROW_PX, SLACK_BLOCKS, SLICE_MS, sliceSize, useProgressiveBlocks } from './progressive';

const group = (key: string, count: number, from = 1): Group => ({ key, ids: Array.from({ length: count }, (_, i) => from + i) });

describe('the blocks of a list', () => {
  const groups = [group('a', 3), group('b', 0), group('c', 5)];

  it('are each group’s header and its rows', () => {
    expect(blocksIn(groups)).toBe(4 + 1 + 6);
    expect(blocksIn([])).toBe(0);
  });

  it('start where the blocks before them end, the follow card (when shown) being block 0', () => {
    expect(blockStarts(groups, 0)).toEqual([0, 4, 5]);
    expect(blockStarts(groups, 1)).toEqual([1, 5, 6]);
  });

  it('are counted per group out of the first `budget` of them', () => {
    expect(mountedIn(groups, 0)).toEqual([0, 0, 0]);
    expect(mountedIn(groups, 1)).toEqual([1, 0, 0]);
    expect(mountedIn(groups, 3)).toEqual([3, 0, 0]);
    expect(mountedIn(groups, 5)).toEqual([4, 1, 0]);
    expect(mountedIn(groups, 8)).toEqual([4, 1, 3]);
    expect(mountedIn(groups, 99)).toEqual([4, 1, 6]);
  });

  it('keep their cascade index however much of the list is mounted', () => {
    // block (group g, row j) is always starts[g] + 1 + j, and the mounted ones are always the first `budget` indices
    const big = [group('a', 7), group('b', 1), group('c', 12), group('d', 4)];
    const starts = blockStarts(big, 1);
    for (let budget = 0; budget <= blocksIn(big) + 2; budget++) {
      const indices = mountedIn(big, budget).flatMap((n, g) => Array.from({ length: n }, (_, k) => starts[g]! + k));
      expect(indices).toEqual(Array.from({ length: Math.min(budget, blocksIn(big)) }, (_, k) => 1 + k));
    }
  });
});

describe('the first screen', () => {
  it('is as many blocks as it takes to reach the bottom of the viewport', () => {
    // 10 rows: the header (25 px) and 10 × 76 end at 785; the next header starts after a 28 px gap at 813; then one row more reaches 889
    const groups = [group('a', 10), group('b', 10)];
    expect(HEAD_PX + 10 * ROW_PX).toBe(785);
    expect(785 + GROUP_GAP_PX).toBe(813);
    expect(firstBlocks(groups, 844)).toBe(13);
    // a viewport that ends inside the first group takes the header and the rows up to the one that crosses it (25–101 px)
    expect(firstBlocks(groups, 100)).toBe(2);
  });

  it('is at least one block, and never more than there are', () => {
    expect(firstBlocks([group('a', 4)], 0)).toBe(1);
    expect(firstBlocks([], 800)).toBe(1);
    expect(firstBlocks([group('a', 2)], 5000)).toBe(3);
  });
});

describe('a slice', () => {
  it('holds what fits in its budget at the cost of the blocks so far, within bounds', () => {
    expect(sliceSize(2)).toBe(SLICE_MS / 2);
    expect(sliceSize(0.001)).toBe(MAX_SLICE);
    expect(sliceSize(SLICE_MS)).toBe(MIN_SLICE);
  });
});

// ---- the hook, on fake timers and a fake clock

let clock = 0;
/** What one block costs to render and commit, in fake ms: how long a slice appears to take. */
let blockCost = 0;

function Probe({ total, first, listKey }: { total: number; first: number; listKey: string }) {
  const mounted = useProgressiveBlocks(total, first, listKey);
  // in the commit, which a slice measures: the blocks it added cost blockCost each
  const last = useRef(0);
  useLayoutEffect(() => {
    clock += Math.max(0, mounted - last.current) * blockCost;
    last.current = mounted;
  });
  return <output data-testid="n">{mounted}</output>;
}

const mountedNow = () => Number(document.querySelector('[data-testid="n"]')!.textContent);
/** The task a slice is asked for in. */
const frame = () => act(() => void vi.advanceTimersToNextTimer());

describe('useProgressiveBlocks', () => {
  beforeEach(() => {
    clock = 0;
    blockCost = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mounts the first screen at once and nothing more in the same task', () => {
    render(<Probe total={200} first={10} listKey="0" />);
    expect(mountedNow()).toBe(10);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('then one slice a task, in order, until it is all there, and stops', () => {
    blockCost = 1;
    render(<Probe total={200} first={10} listKey="0" />);
    const seen = [mountedNow()];
    for (let i = 0; i < 40 && mountedNow() < 200; i++) {
      frame();
      seen.push(mountedNow());
    }
    // the first slice is sized from the first guess (2 ms a block), the next from what it measured
    expect(seen.slice(0, 3)).toEqual([10, 10 + sliceSize(2), 10 + sliceSize(2) + sliceSize(1.5)]);
    expect(seen.at(-1)).toBe(200);
    // every slice adds, none takes away, and none adds more than a slice may
    seen.slice(1).forEach((n, i) => expect(n - seen[i]!).toBeGreaterThan(0));
    seen.slice(1).forEach((n, i) => expect(n - seen[i]!).toBeLessThanOrEqual(MAX_SLICE));
    // nothing is left scheduled once the list is whole
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sizes the slices to their budget: dear blocks make small slices, cheap ones big', () => {
    blockCost = 10;
    render(<Probe total={1000} first={10} listKey="0" />);
    for (let i = 0; i < 6; i++) frame();
    const before = mountedNow();
    frame();
    // at 10 ms a block a 40 ms slice holds 4 (MIN_SLICE)
    expect(mountedNow() - before).toBe(sliceSize(10));
    blockCost = 0.01;
    for (let i = 0; i < 8; i++) frame();
    const later = mountedNow();
    frame();
    expect(mountedNow() - later).toBe(MAX_SLICE);
  });

  it('mounts a list that fits the first screen and its slack whole, and keeps it whole as it grows', () => {
    const view = render(<Probe total={10 + SLACK_BLOCKS} first={10} listKey="0" />);
    expect(mountedNow()).toBe(10 + SLACK_BLOCKS);
    view.rerender(<Probe total={300} first={10} listKey="0" />);
    expect(mountedNow()).toBe(300);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mounts another day (or Live) whole, in the render that shows it', () => {
    const view = render(<Probe total={200} first={10} listKey="0" />);
    frame();
    expect(mountedNow()).toBeLessThan(200);
    view.rerender(<Probe total={150} first={10} listKey="1" />);
    expect(mountedNow()).toBe(150);
    // and back: a list once shown whole is never sliced again
    view.rerender(<Probe total={200} first={10} listKey="0" />);
    expect(mountedNow()).toBe(200);
  });

  it('a list that is finished and grows later mounts the new blocks at once', () => {
    const view = render(<Probe total={60} first={10} listKey="0" />);
    for (let i = 0; i < 5; i++) frame();
    expect(mountedNow()).toBe(60);
    view.rerender(<Probe total={90} first={10} listKey="0" />);
    expect(mountedNow()).toBe(90);
  });

  it('nothing until there is a list, then the first screen', () => {
    const view = render(<Probe total={0} first={1} listKey="0" />);
    expect(mountedNow()).toBe(0);
    frame();
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(<Probe total={200} first={10} listKey="0" />);
    expect(mountedNow()).toBe(10);
  });

  it('leaves nothing scheduled when the list goes away mid-way', () => {
    const view = render(<Probe total={200} first={10} listKey="0" />);
    frame();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
