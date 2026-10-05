import { timing, type TimingKey } from './tokens';

/*
 * A Lua-style timed animation: `bez(curve, prog(now - t0, delay + i × stagger, dur))` (anim,
 * luau:1101), played with the Web Animations API. Unlike a Motion variant it never starts from
 * wherever the element happens to be: every call plays the same keyframes from the start, so a
 * section toggled ten times in a row looks the same the tenth time as the first, and a new call
 * takes over at once (the Lua's agility).
 *
 * Timings come from src/motion/tokens.ts when the animation starts. fill: 'both' holds the first
 * frame through the delay and the last after the end, as the Lua's clamped progress does.
 */

export interface PlayOptions {
  /** item index: starts `index × stagger` after the first */
  index?: number;
  /** false leaves out the section's delay */
  withDelay?: boolean;
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Stops every animation `play` started on the element; it snaps back to its own styles. */
export function stop(el: Element | null | undefined): void {
  if (!el || typeof el.getAnimations !== 'function') return;
  for (const a of el.getAnimations()) if (a.id === PLAY_ID) a.cancel();
}

const PLAY_ID = 'scoreline-play';

/** Plays one section's timing on `el`, replacing whatever `play` was running on it. */
export function play(el: Element | null | undefined, key: TimingKey, keyframes: Keyframe[], { index = 0, withDelay = true }: PlayOptions = {}): Animation | undefined {
  if (!el || typeof el.animate !== 'function') return undefined;
  stop(el);
  const t = timing(key);
  const still = reduced();
  const a = el.animate(keyframes, {
    duration: still ? 0 : t.duration * 1000,
    delay: still ? 0 : ((withDelay ? t.delay : 0) + index * t.stagger) * 1000,
    easing: `cubic-bezier(${t.ease.join(', ')})`,
    fill: 'both',
  });
  a.id = PLAY_ID;
  return a;
}
