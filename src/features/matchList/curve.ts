// The Lua's curve maths (luau:1049–1079), for the few places that need a value at a moment
// rather than a CSS transition: the goal choreography and the countdown. Pure.

import { CURVES, type Bezier } from '../../motion';

/** A cubic-bezier's output at progress x (0..1); luau:1049, 16 bisection steps. */
export function bez(c: Bezier, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const [x1, y1, x2, y2] = c;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 16; i++) {
    t = (lo + hi) * 0.5;
    const u = 1 - t;
    const cx = 3 * x1 * t * u * u + 3 * x2 * t * t * u + t * t * t;
    if (cx < x) lo = t;
    else hi = t;
  }
  const u = 1 - t;
  return 3 * y1 * t * u * u + 3 * y2 * t * t * u + t * t * t;
}

/** 0..1 progress of `t` through `dur` seconds that start after `delay` (luau:1062). */
export function prog(t: number, delay: number, dur: number): number {
  if (dur <= 0) return t >= delay ? 1 : 0;
  return Math.min(Math.max((t - delay) / dur, 0), 1);
}

/** `bez` of `prog` (luau:1066). */
export function ease(c: Bezier, t: number, delay: number, dur: number): number {
  return bez(c, prog(t, delay, dur));
}

/** Rises over `inn` seconds, holds, falls over `out` seconds: a 0..1 envelope (env, luau:1073). */
export function env(t: number, inn: number, hold: number, out: number): number {
  if (t <= 0 || t >= inn + hold + out) return 0;
  if (t < inn) return bez(CURVES.ease, t / inn);
  if (t < inn + hold) return 1;
  return 1 - bez(CURVES.inout, (t - inn - hold) / out);
}

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
