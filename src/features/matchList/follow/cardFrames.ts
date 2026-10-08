// The two things on the follow card that are a function of time rather than a transition: the
// goal flood and the red card (drawFollow, luau:4281–4290 and 4470–4497). One frame loop writes
// their numbers straight to the card as custom properties, so nothing re-renders; it runs only
// while one of them is on.

import { useEffect, type RefObject } from 'react';
import { useReducedMotionPreference } from '../../../motion/useReducedMotionPreference';
import { CURVES } from '../../../motion';
import { ease } from '../curve';
import { startFrames } from '../frames';
import { followGoal } from '../goalFeel';
import { RED_SECONDS, type Phase } from './model';

/** The shake after a red card: 6 px at the start, gone in 0.6 s (luau:4279). */
export function shakeOf(rt: number): number {
  return rt >= 0 && rt < 0.6 ? 6 * Math.sin(rt * 70) * Math.exp(-rt * 6) : 0;
}

export interface RedLook {
  /** the red flood's opacity */
  readonly flood: number;
  /** the words' strength and the scale they settle from */
  readonly text: number;
}

/** The red card's flood and words `rt` seconds after the card (luau:4470). */
export function redLook(rt: number): RedLook {
  if (rt < 0 || rt >= RED_SECONDS) return { flood: 0, text: 0 };
  const base = rt < 0.12 ? rt / 0.12 : rt < 1.3 ? 0.9 + 0.1 * Math.cos((rt - 0.12) * 11) : 0.95;
  const flood = base * (1 - ease(CURVES.inout, rt, 2.6, 0.6));
  const text = ease(CURVES.glide, rt, 0.9, 0.45) * (1 - ease(CURVES.inout, rt, 2.6, 0.5));
  return { flood, text };
}

const NUMS = ['--gm', '--rf', '--rt', '--shake'] as const;

/**
 * Drives `--gm` (the goal flood, 0..1), `--rf` and `--rt` (the red flood and words) and `--shake`
 * (px) on `card` from the times the player last scored and was last sent off, in `now`'s seconds.
 */
export function useCardFrames(card: RefObject<HTMLElement | null>, goalAt: number, redAt: number, phase: Phase, now: () => number) {
  const still = useReducedMotionPreference();
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const clear = () => NUMS.forEach((p) => el.style.removeProperty(p));
    if (still) {
      el.style.setProperty('--gm', '0');
      el.style.setProperty('--rf', phase === 'red' ? '1' : '0');
      el.style.setProperty('--rt', phase === 'red' ? '1' : '0');
      el.style.setProperty('--shake', '0');
      return clear;
    }
    const stop = startFrames((t) => {
      const gm = phase === 'live' ? followGoal(t - goalAt) : 0;
      const rt = t - redAt;
      const red = phase === 'red' && redAt > 0 ? redLook(rt) : { flood: 0, text: 0 };
      const shake = phase === 'red' && redAt > 0 ? shakeOf(rt) : 0;
      el.style.setProperty('--gm', gm.toFixed(3));
      el.style.setProperty('--rf', red.flood.toFixed(3));
      el.style.setProperty('--rt', red.text.toFixed(3));
      el.style.setProperty('--shake', shake.toFixed(2));
      return gm > 0 || red.flood > 0 || red.text > 0 || (phase === 'red' && rt < RED_SECONDS);
    }, now);
    return () => {
      stop();
      clear();
    };
  }, [card, goalAt, redAt, phase, now, still]);
}
