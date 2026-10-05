// How a fresh goal looks in the list (celebrate and the card and row drawing, luau:3735–3924,
// 3925–4044): the card dips and floods with the scorer's colour, a light sweeps over it, the
// other cards go grey, the new number takes the spectrum and pops. The numbers are the Lua's;
// the three that are the user's tuning (goalFocus, goalMark and the follow timing) come from the
// motion tokens when a goal lands. Pure: no React, no DOM.

import { CURVES, holds, timing } from '../../motion';
import { bez, ease, env, prog } from './curve';

/** One goal as the list needs it: when it landed and for whom. `t` is seconds on the list's clock. */
export interface GoalMark {
  readonly t: number;
  readonly side: 'home' | 'away';
  /** The sequence of goals seen, so two goals in one match each restart the choreography. */
  readonly n: number;
}

/** The card dips 6 px: down in 0.09 s (GLIDE), back in 0.34 s (INOUT); luau:3750. */
export const DIP = { px: 6, down: 0.09, up: 0.34, life: 2.4 } as const;
/** The scorer's colour floods in over 0.35 s, holds 0.8 s, drains over 1.0 s; luau:3752. */
export const FLOOD = { inn: 0.35, hold: 0.8, out: 1.0 } as const;
/** The flood is drawn in twelfths (luau:3796), which keeps the gradient from re-rendering every frame. */
export const FLOOD_STEPS = 12;
/** A band of light, 110 px tall, crosses the card from the scorer's side; luau:3823. */
export const SWEEP = { delay: 0.04, dur: 1, life: 1.2, band: 110 } as const;
/** The score pops 1.28× on a card, 1.3× on a row, settling over 0.6 s; luau:3837, 3963. */
export const BUMP = { card: 0.28, row: 0.3, dur: 0.6 } as const;
/** The scoring card swells 3 % and the others shrink 3 %; luau:3883. */
export const STEP = { amp: 0.03, inn: 0.3, hold: 1.1, out: 0.7 } as const;
/** Cards that did not score step back into grey: in 0.45 s, hold goalFocus, out 0.9 s; luau:3893. */
export const FOCUS = { inn: 0.45, out: 0.9 } as const;
/** The new number keeps the spectrum: in 0.35 s, hold goalMark, out 1.2 s; luau:3739. */
export const MARK = { inn: 0.35, out: 1.2 } as const;
/** A row glows for 1.6 s after its match scored; luau:3925. */
export const ROW_FLASH = { dur: 1.6, amp: 0.07 } as const;

const at = (t: number, mark: GoalMark | undefined) => (mark ? t - mark.t : -1);

/** Seconds a mark stays visible in the longest of its effects, with the holds in force now. */
export function markLife(): number {
  const h = holds();
  return Math.max(DIP.life, MARK.inn + h.goalMark + MARK.out, FOCUS.inn + h.goalFocus + FOCUS.out, STEP.inn + STEP.hold + STEP.out, ROW_FLASH.dur);
}

export interface CardFeel {
  /** px the card sits lower */
  readonly dip: number;
  /** 0..1 the scorer's colour in the card, in twelfths */
  readonly flood: number;
  /** the same, unquantised, for the halo behind the card */
  readonly halo: number;
  /** 0..1 how far the light band has crossed, or -1 when it is not on the card */
  readonly sweep: number;
  /** the score's pop on each side, 1 at rest */
  readonly bump: readonly [number, number];
  /** 0..1 how much of the new number's spectrum chip shows, per side */
  readonly mark: readonly [number, number];
}

const REST: CardFeel = { dip: 0, flood: 0, halo: 0, sweep: -1, bump: [1, 1], mark: [0, 0] };

/** The scorer's own card at time `t` (seconds). */
export function cardFeel(t: number, mark: GoalMark | undefined): CardFeel {
  const gt = at(t, mark);
  if (!mark || gt < 0) return REST;
  const h = holds();
  let dip = 0;
  let halo = 0;
  if (gt < DIP.life) {
    dip = gt < DIP.down ? DIP.px * bez(CURVES.glide, gt / DIP.down) : DIP.px * (1 - ease(CURVES.inout, gt - DIP.down, 0, DIP.up));
    halo = env(gt, FLOOD.inn, FLOOD.hold, FLOOD.out);
  }
  const sweep = gt < SWEEP.life ? ease(CURVES.glide, gt, SWEEP.delay, SWEEP.dur) : -1;
  const bp = prog(gt, 0, BUMP.dur);
  const pop = bp < 1 ? 1 + BUMP.card * (1 - bez(CURVES.glide, bp)) : 1;
  const mk = env(gt, MARK.inn, h.goalMark, MARK.out);
  const home = mark.side === 'home';
  return {
    dip,
    flood: Math.round(halo * FLOOD_STEPS) / FLOOD_STEPS,
    halo,
    sweep,
    bump: home ? [pop, 1] : [1, pop],
    mark: home ? [mk, 0] : [0, mk],
  };
}

/** The scale of every card while the latest goal is fresh: the scorer swells, the rest shrink. */
export function stepScale(t: number, latest: GoalMark | undefined, scorer: boolean): number {
  if (!latest) return 1;
  const e = env(at(t, latest), STEP.inn, STEP.hold, STEP.out);
  return scorer ? 1 + STEP.amp * e : 1 - STEP.amp * e;
}

/** How much a card keeps its colour while its goal is fresh (focusOf, luau:3896). */
export function focusOf(t: number, mark: GoalMark | undefined): number {
  return env(at(t, mark), FOCUS.inn, holds().goalFocus, FOCUS.out);
}

/** The grey of one card given every card's marks: only the scorers keep their colour (luau:3897). */
export function greyOf(t: number, own: GoalMark | undefined, all: readonly (GoalMark | undefined)[]): number {
  let focus = 0;
  for (const m of all) focus = Math.max(focus, focusOf(t, m));
  return Math.max(focus - focusOf(t, own), 0);
}

export interface RowFeel {
  /** 0..1 of the white glow (before its 0.07 weight) */
  readonly flash: number;
  readonly bump: readonly [number, number];
  readonly mark: readonly [number, number];
}

const ROW_REST: RowFeel = { flash: 0, bump: [1, 1], mark: [0, 0] };

/** A row at time `t`: the flash, the number's pop and its spectrum. */
export function rowFeel(t: number, mark: GoalMark | undefined): RowFeel {
  const gt = at(t, mark);
  if (!mark || gt < 0) return ROW_REST;
  const fp = prog(gt, 0, ROW_FLASH.dur);
  const flash = fp > 0 && fp < 1 ? 1 - bez(CURVES.ease, fp) : 0;
  const bp = prog(gt, 0, BUMP.dur);
  const pop = bp < 1 ? 1 + BUMP.row * (1 - bez(CURVES.glide, bp)) : 1;
  const mk = env(gt, MARK.inn, holds().goalMark, MARK.out);
  const home = mark.side === 'home';
  return { flash, bump: home ? [pop, 1] : [1, pop], mark: home ? [mk, 0] : [0, mk] };
}

/** The followed player's card flood when he scores: env over the follow section's duration, 5.4 s hold, 0.9 s out; luau:4281. */
export const FOLLOW_GOAL = { life: 7.5, hold: 5.4, out: 0.9 } as const;

export function followGoal(gt: number): number {
  if (gt < 0 || gt >= FOLLOW_GOAL.life) return 0;
  return env(gt, timing('follow').duration, FOLLOW_GOAL.hold, FOLLOW_GOAL.out);
}

