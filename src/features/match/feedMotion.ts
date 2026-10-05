// How the commentary moves when live events arrive (eventsFeed, luau:5048–5150). New rows open at
// the top and the rows under them slide down into place; each row follows the one above a frame
// late (follow-through), rows that arrive together start two frames apart, and the rows pushed
// past the first ten fold away meanwhile. The numbers are the Lua's; the section is `events`.
// Pure: the feed (EventsFeed.tsx) measures the rows and writes what this returns.

/** Each row below lags the one above by a frame, up to six (LAG, luau:5050). */
export const LAG = 1 / 60;
/** Rows that arrive together start two frames apart (PAIR, luau:5050). */
export const PAIR = 2 / 60;
/** A new row counts as opening for the section's duration and 0.3 s more (busy, luau:5070). */
export const BUSY_EXTRA = 0.3;
/** ...and the rows under it keep following it 0.2 s after that (luau:5112). */
export const LINGER = 0.2;
/** The new row's words come in 0.04 s after its space starts to open, from 14 px above (luau:5168). */
export const ARRIVE = { delay: 0.04, lift: 14 } as const;
/** A row leaving past the feed's bottom edge fades over the last 10 px (keep, luau:5150). */
export const KEEP_PX = 10;
/** A row's deficit sums at most this many rows above it (luau:5108). */
const LOOKBACK = 40;
/** The born time of a row that was there before the feed opened (the Lua's -100). */
export const OLD = -1e6;

/** The section's timing as the feed needs it: seconds, and the curve as a function. */
export interface FeedTiming {
  readonly duration: number;
  readonly delay: number;
  readonly curve: (x: number) => number;
}

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/** When each row starts opening, from when each was first seen (newest first, luau:5074). */
export function startsOf(born: readonly number[]): number[] {
  let prev = Number.NaN;
  let rank = 0;
  return born.map((t) => {
    rank = Math.abs(t - prev) < 0.001 ? rank + 1 : 0;
    prev = t;
    return t + rank * PAIR;
  });
}

export interface Growth {
  /** rows within the first ten still opening */
  readonly growing: number;
  /** the first row still opening, 0-based; -1 when none */
  readonly newest: number;
  /** when the rows past the first ten start folding away */
  readonly foldT: number;
  /** when the last motion ends (seconds), or -Infinity when nothing moves */
  readonly until: number;
}

export function growth(starts: readonly number[], now: number, t: FeedTiming, limit: number): Growth {
  const busy = t.duration + BUSY_EXTRA;
  let growing = 0;
  let newest = -1;
  let until = -Infinity;
  starts.forEach((s, i) => {
    if (now - s >= busy) return;
    if (growing === 0) newest = i;
    if (i < limit) growing += 1;
    until = Math.max(until, s + busy + LINGER);
  });
  return { growing, newest, foldT: growing > 0 ? starts[newest]! : OLD, until };
}

/** One row as the frame sees it. */
export interface FrameRow {
  /** natural height, px */
  readonly h: number;
  /** when it starts opening; OLD for a row that didn't arrive live (markers too) */
  readonly start: number;
  /** 1-based place among the events; 0 for a marker */
  readonly index: number;
}

export interface Frame {
  /** px each row sits above its place in the flow (what is still opening above it) */
  readonly lift: readonly number[];
  /** each row's opacity from arriving, folding away and leaving past the edge */
  readonly alpha: readonly number[];
  /** px the feed's end (and everything under it) sits above its place in the flow */
  readonly end: number;
}

export interface FrameOptions {
  readonly now: number;
  readonly evAll: boolean;
  readonly growing: number;
  readonly foldT: number;
  readonly limit: number;
  readonly t: FeedTiming;
}

export function feedFrame(rows: readonly FrameRow[], o: FrameOptions): Frame {
  const { now, evAll, limit, t } = o;
  const busy = t.duration + BUSY_EXTRA;
  const animAt = (at: number, t0: number) => t.curve(clamp01((at - t0) / t.duration));
  const folding = (r: FrameRow) => !evAll && r.index > limit;
  // how far a row has opened at `at` (grow, luau:5099)
  const grow = (r: FrameRow, at: number) => {
    if (folding(r)) return 1 - animAt(at, o.foldT);
    if (at - r.start >= busy) return 1;
    return animAt(at, r.start);
  };
  const moving = (r: FrameRow) => now - r.start < busy + LINGER || folding(r);

  // each row's top: the full heights above it, minus what is still opening, a frame late per row
  const n = rows.length;
  const deficit: number[] = [];
  const base: number[] = [];
  let acc = 0;
  for (let j = 0; j <= n; j++) {
    let d = 0;
    for (let i = Math.max(0, j - LOOKBACK); i < j; i++) {
      const r = rows[i]!;
      if (!moving(r)) continue;
      // the feed's end moves without lag, so the rows folding below and the new ones above balance
      const lag = j === n ? 0 : LAG * Math.min(j - i, 6);
      d += r.h * (1 - grow(r, now - lag));
    }
    deficit.push(d);
    base.push(acc);
    if (j < n) acc += rows[j]!.h;
  }
  const end = deficit[n]!;
  const edge = acc - end;
  const fold = o.growing > 0 && !evAll ? 1 - t.curve(clamp01((now - o.foldT - t.delay) / t.duration)) : 0;

  const lift: number[] = [];
  const alpha: number[] = [];
  rows.forEach((r, j) => {
    const top = base[j]! - deficit[j]!;
    const keep = clamp01(1 - (top + r.h - edge) / KEEP_PX);
    const arrive = now - r.start < busy ? animAt(now, r.start + ARRIVE.delay) : 1;
    let a = keep;
    if (r.index > 0) {
      a *= arrive;
      if (folding(r)) a *= fold;
    }
    lift.push(deficit[j]! + ARRIVE.lift * (1 - arrive));
    alpha.push(a);
  });
  return { lift, alpha, end };
}
