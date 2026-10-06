import type { Transition, Variants } from 'motion/react';
import { snapPx } from './snap';
import { timing, type TimingKey } from './tokens';

/*
 * Variant helpers: every Motion animation in the app takes its timing from here, which reads
 * src/motion/tokens.ts when the animation starts. No durations inline anywhere else.
 *
 * Choreography tier (ARCHITECTURE §5): transform and opacity only.
 */

export interface TransitionOptions {
  /** item index: starts `index × stagger` after the first */
  index?: number;
  /** false leaves out the section's delay (a screen push starts at once) */
  withDelay?: boolean;
  /** duration × this (the player view closes in 0.7 of its time, luau:5928) */
  scale?: number;
}

/** A Motion transition for one section of the tokens. */
export function transition(key: TimingKey, { index = 0, withDelay = true, scale = 1 }: TransitionOptions = {}): Transition {
  const t = timing(key);
  return { duration: t.duration * scale, delay: (withDelay ? t.delay : 0) + index * t.stagger, ease: t.ease };
}

/**
 * The labels a cascade item uses: it mounts `hidden` and animates to `shown`, its lift on whole
 * device pixels (snap.ts) so it doesn't settle by a pixel when it lands. Spread it on the item.
 */
export const CASCADE = { initial: 'hidden', animate: 'shown', transformTemplate: snapPx } as const;

export interface CascadeOptions {
  /** px the block rises while it fades in (blockIn lifts 12, the player sheet 14) */
  lift?: number;
}

const cascades = new Map<string, Variants>();

/**
 * A staggered entrance (blockIn, luau:4710): each block fades in and rises `lift` px; block i
 * starts at the section's delay + i × stagger. Animates on mount only, so a data refresh never
 * replays it (key the item by entity id to replay it for a new entity).
 *
 *   const c = cascade('screen');
 *   <m.div variants={c} custom={0} {...CASCADE}>hero</m.div>
 *   <m.div variants={c} custom={1} {...CASCADE}>tabs</m.div>
 */
export function cascade(key: TimingKey, { lift = 12 }: CascadeOptions = {}): Variants {
  const id = `${key}:${lift}`;
  let v = cascades.get(id);
  if (!v) {
    v = {
      hidden: { opacity: 0, y: lift },
      shown: (i: number | undefined) => ({ opacity: 1, y: 0, transition: transition(key, { index: i ?? 0 }) }),
    };
    cascades.set(id, v);
  }
  return v;
}

/* ---------------------------------------------------------------------------------------------
 * The shell's layers. Labels: `out` (not on screen) and `in`; spread LAYER on the layer.
 * ------------------------------------------------------------------------------------------- */

export const LAYER = { initial: 'out', animate: 'in', exit: 'out' } as const;

const screenT = () => transition('screen', { withDelay: false });

/** Phone push (luau:8685-8694): the match screen comes in from the right edge. motion: screen */
export const pushLayer: Variants = {
  out: () => ({ x: '100%', transition: screenT() }),
  in: () => ({ x: 0, transition: screenT() }),
};

/** ...while the list under it slides 22 % of the width to the left. Labels: `rest`, `covered`. */
export const pushBase: Variants = {
  rest: () => ({ x: 0, transition: screenT() }),
  covered: () => ({ x: '-22%', transition: screenT() }),
};

/** ...under a black scrim at 70 %. Labels: `rest`, `covered`. */
export const scrim: Variants = {
  rest: () => ({ opacity: 0, transition: screenT() }),
  covered: () => ({ opacity: 0.7, transition: screenT() }),
};

const playerT = (scale = 1) => transition('player', { withDelay: false, scale });

/**
 * The player page (drawPlayerView, luau:5925-5931): it fades in while the face grows into the
 * bust and closes in 0.7 of the time. motion: player
 */
export const playerPage: Variants = {
  out: () => ({ opacity: 0, transition: playerT(0.7) }),
  in: () => ({ opacity: 1, transition: playerT() }),
};

/** Tablet: the player sheet rises over the match pane, timed like the player page. motion: player */
export const sheetRise: Variants = {
  out: () => ({ y: '100%', transition: playerT(0.7) }),
  in: () => ({ y: 0, transition: playerT() }),
};

/**
 * Tablet and desktop panes swap their content at once, as the Lua desktop does (openMatch,
 * luau:7139); the new screen's blocks cascade in and its shared elements fly. Mount it with
 * `initial={false}`.
 */
export const paneSwap: Variants = {
  out: { opacity: 0, transition: { duration: 0 } },
  in: { opacity: 1, transition: { duration: 0 } },
};
