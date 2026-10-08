// The toast's and the scenes' geometry and the few fixed beats inside them, copied from the Lua
// (drawToast luau:6205-6283, goalScene / redScene luau:6536-6656, drawScene luau:6656). Section
// timings (dur, delay, stagger, curve) come from the motion tokens: timing('toast'), timing('goal')
// and the Presentation's beats. What is here is the choreography inside those beats.
// Lengths are design px on the 390 px phone; the scene's vertical "centre stage" positions scale
// with its floor (604 at 844 px tall).

import type { Bezier } from '../../motion';
import { textWidth } from '../../ui';

/** The notification (TOAST, luau:3016): 16 px in from the sides, 50 px down, 66 px tall. */
export const TOAST = { x: 16, y: 50, h: 66, radius: 22, maxW: 358 } as const;

/** The toast slides in from this far above its place (luau:6197). */
export const TOAST_RISE = 120;

/** The swipe (pointerMove / pointerUp, luau:8786-8846): a press that moves more than this is a drag. */
export const DRAG_SLOP = 6;
/** Pulled down, the toast follows a quarter of the way (luau:8799). */
export const PULL_DOWN = 0.25;
/** Released this far up, or flicked up this fast (px/s), it leaves (luau:8840). */
export const SWIPE_DY = -26;
export const SWIPE_VY = -380;
/**
 * Let go short of that, it springs back: dy *= exp(-16 dt) (luau:8611). A critically damped
 * spring with the same rate: stiffness 16², damping 2 × 16. No bounce (ARCHITECTURE §5).
 */
export const SPRING_BACK = { type: 'spring', stiffness: 256, damping: 32, mass: 1 } as const;

/** Leaving, it flies up past the top over 0.32 s of the 0.4 s TOAST_OUT on IN (toastRect, luau:6198). */
export const TOAST_LEAVE_SHARE = 0.8;

/** The scene's floor: the bust stands on it, the name and commentary sit under it (FLOOR, luau:6294). */
export const FLOOR_FROM_BOTTOM = 240;
export const DESIGN_FLOOR = 604;
/** The scene fades in over 0.2 s and out over 0.4 s (drawScene, luau:6662). */
export const SCENE_FADE_IN = 0.2;
export const SCENE_FADE_OUT = 0.4;
/** The team-colour flash on arrival (luau:6599). */
export const FLASH = { alpha: 0.85, dur: 0.55 } as const;

/** The scorer's bust: BUST_SRC of the 288 × 360 bust, drawn 1.05× (luau:6295). */
export const BUST_SRC = { x: 14, y: 8, w: 260, h: 268 } as const;
export const BUST_K = 1.05;
export const BUST_LIFT = 60;

/** The four cards of the wall behind him, as fractions of 320 px (luau:6553). */
export const WALL = { heights: [0.74, 0.94, 1, 0.84], tall: 320, gap: 6, side: 12, lead: 0.2, step: 0.11, rise: 0.75, flash: 0.16 } as const;

/**
 * The scene's top line, once the headline has risen: the flag (or the red card and crest), the
 * name over its label, the score strip and the close button, all centred on y 72 (the Lua's
 * strip, luau:6512). The Lua put the close button at 70 and landed the card 47 px tall and tilted,
 * taller than the text beside it; the review of 2026-10-04 asked for one clean line, so the card
 * lands level, as tall as the name and its label, with the crest and text 10 px after it.
 */
export const TOP = { mid: 72, card: { cx: 29, h: 32 }, crest: 50, text: 82, goalText: 68 } as const;

/**
 * The flag over the goal word, at centre stage: its bottom stands `gap` above the top of the
 * letters, 26 px, as the Lua draws it on the 390 × 844 phone (flag centre 318, caps from 376).
 * The Lua put the flag at 318 of a stage that shrinks with its floor while the word's size follows
 * the width, so on a shorter phone the flag came down onto the letters (375 × 667: overlapping).
 * `ink` is how far above the word's middle the Rive word's letters begin, in sizes.
 */
export const FLAG_OVER_WORD = { gap: 26, ink: 0.34, r: 32 } as const;
/** The flag's centre at centre stage, from the word's middle `mid` and its size (the headline's: mid0, size0). */
export const flagRest = (mid: number, size: number) => mid - FLAG_OVER_WORD.ink * size - FLAG_OVER_WORD.gap - FLAG_OVER_WORD.r;

/** The goal word lands on LAND (luau:6319). */
export const LAND: Bezier = [0.12, 1, 0.3, 1];

/** The red card: the hit lands at 0.3 s and shakes the stage (redScene, luau:6604). */
export const HIT = 0.3;
export const SHAKE = { amp: 11, decay: 7, len: 0.7, fx: 93, fy: 71 } as const;
/** The card slams in on its own curve (luau:6627). */
export const SLAM: Bezier = [0.5, 0, 0.9, 0.6];
/** RED CARD's letters start 0.12 s after the hit, 0.06 s apart (slamWord, luau:6370, 6636). */
export const SLAM_WORD = { after: 0.12, gap: 0.06 } as const;
/** Three slashes tear across on the hit (luau:6612). */
export const SLASHES = { n: 3, gap: 0.06, len: 0.38 } as const;

/** The commentary's words come in over 1.4 s, starting 0.1 s after it (luau:6482). */
export const WORDS = { after: 0.1, over: 1.4 } as const;
/** The name comes up 0.12 s after the bust (luau:6449). */
export const NAME_AFTER = 0.12;

/** The headline word's stand-in (Word.tsx): bold, its -0.02 tracking plus the 20 units each glyph gives back (luau:6332). */
export const WORD_TRACK = -0.04;
export const WORD_WEIGHT = 700;
/** Width of `word` at `size`, as the stand-in draws it. */
export const wordWidth = (word: string, size: number) => textWidth(WORD_WEIGHT, size, WORD_TRACK, word);
