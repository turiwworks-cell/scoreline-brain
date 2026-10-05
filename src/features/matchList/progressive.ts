import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Group } from './groups';

/*
 * The list is mounted in slices when the first feed brings more than a screen of it (Part 21, #5).
 *
 * The first feed of a real matchday (ARCHITECTURE §7: 300+ matches) rendered and committed every
 * row in one synchronous task: nothing could respond meanwhile, and the frame grew with the day.
 * Now the blocks that fill the first screen mount with the first data, and the rest follow, a
 * slice at a time. A "block" is a group's header or one of its rows, in the order the cascade
 * counts them (cascade.tsx), and each block keeps its index however much of the list is mounted.
 *
 * A slice is rendered and committed synchronously, in a task of its own, and sized from what the
 * blocks before it cost so that it takes about SLICE_MS; the next one is asked for as soon as it
 * has committed, so the browser paints and handles input between slices and the slices follow
 * each other as fast as that allows. (Transitions were tried first: React renders them in 5 ms
 * pieces with a frame between, and on 300 matches at 3.6× the list took 2.0–2.4 s to fill against
 * 1.2–1.4 s this way, for no shorter frames. reports/part21-startup-and-lcp.md has the runs.)
 *
 * Only the first population is sliced. A day or Live change mounts the whole new list in one go,
 * because the cascade is timed for that (a block that mounts while it plays starts late), and so
 * does a list that grows after it has been filled. A group's rows are laid out absolutely inside a
 * box of their full height (Groups.module.css `.rows`), and a group the slices have not reached is
 * an empty box of the same height (LeagueGroup's GroupShell), so the page is as long as it will be
 * from the first commit on and nothing moves as the rest arrives.
 */

/** Where the blocks sit, as an estimate for deciding what the first screen holds: a header, a row, the gap under a group. */
export const HEAD_PX = 25;
export const ROW_PX = 76;
export const GROUP_GAP_PX = 28;

/** A list that would only defer this many blocks or fewer is mounted whole: slicing it would cost more than it saves. */
export const SLACK_BLOCKS = 12;

/**
 * What one slice may cost to render and commit, in ms (measured, not CPU-scaled). The browser's
 * style, layout and paint of it follow in the same frame. 25, 40 and 60 were measured at 3.6× on
 * 300 matches: 40 fills the list in about the time 60 does, with frames as short as 25's.
 */
export const SLICE_MS = 40;
/** Bounds on a slice, in blocks: progress when blocks are dear, and a commit that stays small when they are cheap. */
export const MIN_SLICE = 4;
export const MAX_SLICE = 64;
/** The guess at a block's cost before one has been measured, in ms. */
const FIRST_GUESS_MS = 2;

/** How many blocks the next slice holds, given what a block has been costing. */
export const sliceSize = (perBlockMs: number): number => Math.max(MIN_SLICE, Math.min(MAX_SLICE, Math.floor(SLICE_MS / Math.max(perBlockMs, 0.05))));

/** The blocks of the list: each group's header, then its rows. */
export const blocksIn = (groups: readonly Group[]): number => groups.reduce((n, g) => n + 1 + g.ids.length, 0);

/** How many blocks it takes to fill `viewportPx` from the top of the list. At least one. */
export function firstBlocks(groups: readonly Group[], viewportPx: number): number {
  let y = 0;
  let n = 0;
  for (const g of groups) {
    for (let i = 0; i <= g.ids.length; i++) {
      if (y >= viewportPx) return Math.max(1, n);
      n += 1;
      y += i === 0 ? HEAD_PX : ROW_PX;
    }
    y += GROUP_GAP_PX;
  }
  return Math.max(1, n);
}

/** Each group's cascade index: where its header sits among the list's blocks, the rows following it. `start` is the first group's. */
export function blockStarts(groups: readonly Group[], start: number): number[] {
  let at = start;
  return groups.map((g) => {
    const index = at;
    at += 1 + g.ids.length;
    return index;
  });
}

/** Per group, how many of its blocks lie within the first `budget` blocks of the list: 0 is none, 1 the header alone, and so on. */
export function mountedIn(groups: readonly Group[], budget: number): number[] {
  let used = 0;
  return groups.map((g) => {
    const size = 1 + g.ids.length;
    const mounted = Math.max(0, Math.min(size, budget - used));
    used += size;
    return mounted;
  });
}

/**
 * How many of the list's `total` blocks to mount now. `first` is what fills the first screen;
 * `listKey` names the list (the day, or Live), and a different one mounts everything at once.
 */
export function useProgressiveBlocks(total: number, first: number, listKey: string): number {
  // 0 until a slice has been asked for, then the blocks mounted; Infinity once everything is.
  const [budget, setBudget] = useState(0);
  const [key, setKey] = useState(listKey);
  // A list that fits the first screen and its slack is mounted whole, and stays so if it grows later.
  const small = total > 0 && total <= first + SLACK_BLOCKS;
  // Adjusted during the render, so that the new day never commits with only its first screen
  // and a list that was whole never has blocks taken away.
  if (key !== listKey) setKey(listKey);
  if (budget !== Infinity && (key !== listKey || small)) setBudget(Infinity);
  const whole = budget === Infinity || key !== listKey || small;
  const mounted = whole ? total : Math.min(total, Math.max(first, budget));
  const pending = mounted < total;

  const perBlock = useRef(FIRST_GUESS_MS);
  useEffect(() => {
    if (!pending) return;
    // The slice before this one has been committed: the next, in a task of its own, not after a
    // frame or an idle moment, which a busy page may not have.
    const timer = setTimeout(() => {
      const add = sliceSize(perBlock.current);
      const next = mounted + add;
      const t0 = performance.now();
      // rendered and committed here, in this task, so what it cost is what is measured
      flushSync(() => setBudget(next >= total ? Infinity : next));
      perBlock.current = (perBlock.current + (performance.now() - t0) / add) / 2;
    });
    return () => clearTimeout(timer);
  }, [pending, mounted, total]);
  return mounted;
}
