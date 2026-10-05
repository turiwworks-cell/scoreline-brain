/*
 * Motion tokens (ARCHITECTURE §5). Every JS animation reads its numbers from here; CSS reads the
 * same numbers from tokens.css (--t-<section>-*, the curves), and tokens.test.ts keeps the two
 * equal.
 *
 * TIMING_DEF copies TIMING_DEF from the Rive-era script verbatim (luau:366-381): per section, the
 * seconds one item takes (dur), the seconds before the first item (delay), the seconds between
 * items (stagger), and the cubic-bezier curve. MOTION_DEF holds the script's global inputs with
 * their defaults (luau:88-94, 8897-8901).
 *
 * Read the tokens when an animation starts, through timing(key) or holds(), never at module load:
 * the dev panel (Part 16) edits them live with tuneMotion() and the next animation picks them up.
 */

export const TIMING_KEYS = ['cards', 'live', 'list', 'screen', 'tabs', 'momentum', 'events', 'stats', 'lineup', 'squad', 'player', 'toast', 'goal', 'follow'] as const;
export type TimingKey = (typeof TIMING_KEYS)[number];

/** A cubic-bezier curve, [x1, y1, x2, y2], as CSS cubic-bezier() and Motion's `ease` take it. */
export type Bezier = readonly [number, number, number, number];

/** One section as the Lua defines it. Seconds. */
export interface TimingDef {
  readonly dur: number;
  readonly delay: number;
  readonly stagger: number;
  readonly ease: Bezier;
}

const def = (dur: number, delay: number, stagger: number, x1: number, y1: number, x2: number, y2: number): TimingDef => ({
  dur,
  delay,
  stagger,
  ease: [x1, y1, x2, y2],
});

// luau:367-380, in the Lua's own order: { dur, delay, stagger, x1, y1, x2, y2 }
export const TIMING_DEF: Readonly<Record<TimingKey, TimingDef>> = {
  cards: def(0.75, 0.1, 0.06, 0.16, 1, 0.3, 1), // live cards rising in
  live: def(0.6, 0, 0.04, 0.16, 1, 0.3, 1), // the live section opening / closing
  list: def(0.5, 0.05, 0.03, 0.2, 0.8, 0.2, 1), // day tabs indicator + the list after a day change
  screen: def(0.55, 0, 0.05, 0.16, 1, 0.3, 1), // opening / closing a match (push); card → hero
  tabs: def(0.45, 0, 0.06, 0.2, 0.8, 0.2, 1), // tab indicator and content slide
  momentum: def(0.9, 0.1, 0.06, 0.16, 1, 0.3, 1), // the momentum wave drawing on
  events: def(0.5, 0.15, 0.04, 0.16, 1, 0.3, 1), // event rows
  stats: def(0.9, 0.15, 0.06, 0.16, 1, 0.3, 1), // stat bars and table rows
  lineup: def(0.6, 0.1, 0.14, 0.16, 1, 0.3, 1), // players rising into place, line by line
  squad: def(0.5, 0.3, 0.03, 0.16, 1, 0.3, 1), // substitutes / squad rows
  player: def(0.72, 0.12, 0.05, 0.32, 0, 0.1, 1), // player view: face → bust zoom, then the sheet
  toast: def(0.6, 0.45, 0.2, 0.16, 1, 0.3, 1), // goal notification
  goal: def(0.7, 0.1, 0.55, 0.16, 1, 0.3, 1), // goal and red card scenes
  follow: def(0.5, 0, 0.06, 0.16, 1, 0.3, 1), // followed player card
};

/** The named curves (luau:1042-1047, ROLL luau:3399). None overshoots: movement settles. */
export const CURVES = {
  ease: [0.2, 0.8, 0.2, 1],
  glide: [0.16, 1, 0.3, 1],
  inout: [0.42, 0, 0.58, 1],
  in: [0.5, 0, 0.75, 0],
  linear: [0, 0, 1, 1],
  roll: [0.7, 0, 0.2, 1],
} as const satisfies Record<string, Bezier>;

/** The script's global motion inputs (luau:88-94), defaults from luau:8897-8901. Seconds. */
export interface MotionGlobals {
  /** 1 = as designed, 0.5 = everything twice as slow, 2 = twice as fast */
  readonly speed: number;
  /** the goal notification stays this long before it leaves on its own */
  readonly toastHold: number;
  /** the goal scene stays this long before it closes on its own */
  readonly goalHold: number;
  /** the other live cards stay grey this long after a goal */
  readonly goalFocus: number;
  /** the new score stays in the spectrum this long, on its card and its row */
  readonly goalMark: number;
}

export const MOTION_DEF: MotionGlobals = { speed: 1, toastHold: 4.5, goalHold: 7.5, goalFocus: 4, goalMark: 8 };

export interface MotionTokens extends MotionGlobals {
  readonly timing: Readonly<Record<TimingKey, TimingDef>>;
}

const DEFAULTS: MotionTokens = { ...MOTION_DEF, timing: TIMING_DEF };
let live: MotionTokens = DEFAULTS;

/** The tokens in force now (the defaults unless the dev panel tuned them). */
export function motionTokens(): MotionTokens {
  return live;
}

export type MotionPatch = Partial<MotionGlobals> & { timing?: Partial<Record<TimingKey, Partial<TimingDef>>> };

/** Live-edits the tokens (Part 16's tuning panel). Animations already running keep their numbers. */
export function tuneMotion(patch: MotionPatch): void {
  const { timing: tp, ...globals } = patch;
  const timing = { ...live.timing };
  if (tp) for (const k of TIMING_KEYS) if (tp[k]) timing[k] = { ...timing[k], ...tp[k] };
  live = { ...live, ...globals, timing };
}

/** Back to the approved values. */
export function resetMotion(): void {
  live = DEFAULTS;
}

/** A section ready to animate with: seconds, divided by `speed`, clamped like the Lua does. */
export interface Timing {
  readonly duration: number;
  readonly delay: number;
  readonly stagger: number;
  readonly ease: Bezier;
}

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/** One section's timing now (refreshTiming, luau:8273-8289). */
export function timing(key: TimingKey): Timing {
  const sp = Math.max(live.speed, 0.05);
  const d = live.timing[key];
  return {
    duration: Math.max(d.dur, 0.01) / sp,
    delay: Math.max(d.delay, 0) / sp,
    stagger: Math.max(d.stagger, 0) / sp,
    ease: [clamp01(d.ease[0]), d.ease[1], clamp01(d.ease[2]), d.ease[3]],
  };
}

/** The holds now, with the Lua's floors (luau:3739, 3894, 8612, 8618). Not scaled by speed. */
export function holds(): Pick<MotionGlobals, 'toastHold' | 'goalHold' | 'goalFocus' | 'goalMark'> {
  return {
    toastHold: Math.max(live.toastHold, 0.5),
    goalHold: Math.max(live.goalHold, 1),
    goalFocus: Math.max(live.goalFocus, 0.5),
    goalMark: Math.max(live.goalMark, 0.5),
  };
}
