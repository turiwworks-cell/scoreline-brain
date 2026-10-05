// How long a moment stays on stage, from the motion tokens when it starts. Copies the Lua's scene
// beats (beats / sceneEnd, luau:6297-6312), tapScene (luau:7328) and the auto-close rules in
// advance (luau:8608-8622). Seconds. Read when a presentation starts, so the dev panel's edits
// apply to the next one.

import { holds, timing } from '../tokens';

export type SceneKind = 'goal' | 'red';

/** The scene's beats, seconds from its start (beats, luau:6297). Part 18 times its DOM from these. */
export interface SceneBeats {
  /** the headline starts */
  readonly delay: number;
  /** the headline rises to the top (the goal word first holds its moment) */
  readonly up: number;
  /** the scorer comes up */
  readonly player: number;
  /** the commentary comes in */
  readonly commentary: number;
  /** everything has landed: a first tap jumps here (sceneEnd − 1.4) */
  readonly full: number;
  /** sceneEnd (luau:6308) */
  readonly end: number;
}

/** The goal word's letters land a tenth of Dur apart, each in 0.72 Dur (goalLetters, luau:6295). */
export function goalLetters(): { gap: number; land: number } {
  const T = timing('goal');
  return { gap: T.duration * 0.1, land: T.duration * 0.72 };
}

export function sceneBeats(kind: SceneKind): SceneBeats {
  const T = timing('goal');
  let up = T.delay + 5 * 0.06 + T.duration + 0.25;
  if (kind !== 'red') {
    const { gap, land } = goalLetters();
    up = T.delay + 5 * gap + land + T.duration * 1.2;
  }
  const player = up + T.duration * 0.45;
  const commentary = player + T.stagger;
  const end = commentary + T.duration + 1.4;
  return { delay: T.delay, up, player, commentary, full: end - 1.4, end };
}

/** A scene leaves over 0.45 s, a toast over 0.4 s (luau:8613, 8619). Real seconds, like the Lua. */
export const SCENE_OUT = 0.45;
export const TOAST_OUT = 0.4;

/** Seconds after its start that a scene closes on its own: goalHold, never before it has landed. */
export function sceneCloseAfter(kind: SceneKind): number {
  return Math.max(holds().goalHold, sceneBeats(kind).full);
}

/** Seconds after its start that a toast leaves on its own: its entrance, then toastHold. */
export function toastCloseAfter(): number {
  return timing('toast').duration + holds().toastHold;
}
