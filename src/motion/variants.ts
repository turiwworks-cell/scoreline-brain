import type { TransformTemplate, Transition, Variants } from 'motion/react';
import { reduced, timing, type TimingKey } from './tokens';

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

/**
 * A Motion transition for one section of the tokens. Under reduced motion a slide (a `transform`,
 * which Motion's own rule, for x and y, doesn't cover) lands at once while the fade still plays.
 */
export function transition(key: TimingKey, { index = 0, withDelay = true, scale = 1 }: TransitionOptions = {}): Transition {
  const t = timing(key);
  const tr = { duration: t.duration * scale, delay: (withDelay ? t.delay : 0) + index * t.stagger, ease: t.ease };
  return reduced() ? { ...tr, transform: { duration: 0 } } : tr;
}

/*
 * Slides the compositor draws between pixels. A block moved by a plain translation is drawn on whole
 * device pixels, so the slow end of an eased slide stands on its last pixel for several frames and
 * then drops into place: a hold and a one-frame jump at the end of every entrance. A hair of rotation
 * (a thousandth of a degree, a hundredth of a pixel across the screen) makes the transform more than
 * a translation, and the compositor draws it where it is, a fraction of a pixel at a time. As a
 * `transform` keyframe, Motion runs it on the compositor, where the main thread's work can't stall it.
 *
 * A block keeps the hair when it lands. While a block has more than a translation the browser draws
 * its contents from a whole pixel; with no transform, from wherever its layout puts it, between two.
 * Dropping the hair at rest would move a line of text sitting near half a pixel by a whole one, the
 * jump at the end all over again. With the hair the text is drawn as crisply, from the same pixel it
 * moved on. The shell's layers, which sit on whole pixels and scroll, land on `none`.
 */
export const HAIR = 'rotate(0.001deg)';

/** A slide's offset, in px, as a compositor transform (the layers below spell out theirs in %). */
export const slide = (x: number, y: number): string => `translateX(${x}px) translateY(${y}px) ${HAIR}`;

/** Where a slide lands, and what a block keeps when it has (`transitionEnd`): the hair alone. */
export const AT_REST = slide(0, 0);
export const LANDED = { transform: HAIR } as const;
const OFF = { transform: 'none' } as const;

/**
 * For a block a motion value moves frame by frame (`style={{ y }}`), which Motion can't hand to the
 * compositor: the hair stays on it for as long as it lives, with its own layer (`will-change:
 * transform` in its CSS), so it is drawn between pixels and never has a landing to make.
 */
export const drawn: TransformTemplate = (_, generated) => `${generated} ${HAIR}`;

/** The labels a cascade item uses: it mounts `hidden` and animates to `shown`. Spread it on the item. */
export const CASCADE = { initial: 'hidden', animate: 'shown' } as const;

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
      hidden: { opacity: 0, transform: slide(0, lift) },
      shown: (i: number | undefined) => ({ opacity: 1, transform: AT_REST, transitionEnd: LANDED, transition: transition(key, { index: i ?? 0 }) }),
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
  out: () => ({ transform: `translateX(100%) translateY(0px) ${HAIR}`, transition: screenT() }),
  in: () => ({ transform: AT_REST, transitionEnd: OFF, transition: screenT() }),
};

/** ...while the list under it slides 22 % of the width to the left. Labels: `rest`, `covered`. */
export const pushBase: Variants = {
  rest: () => ({ transform: AT_REST, transitionEnd: OFF, transition: screenT() }),
  // aside, the match covers it whole: it can keep the hair there
  covered: () => ({ transform: `translateX(-22%) translateY(0px) ${HAIR}`, transition: screenT() }),
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
  out: () => ({ transform: `translateX(0px) translateY(100%) ${HAIR}`, transition: playerT(0.7) }),
  in: () => ({ transform: AT_REST, transitionEnd: OFF, transition: playerT() }),
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
