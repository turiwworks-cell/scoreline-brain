import { useLayoutEffect, useRef } from 'react';
import { useAnimationFrame, useMotionValue, type MotionValue } from 'motion/react';
import type { DirectorClock, Presentation } from '../../motion';

/**
 * Seconds since the presentation started, and since it started leaving (-1 while it plays), on
 * the director's clock. Read every frame from the latest Presentation, so a first tap on a scene
 * (which moves `startedAt` back) jumps the choreography to its end, as tapScene does (luau:7330).
 */
export function useStageTime(p: Presentation, clock: DirectorClock): { t: MotionValue<number>; out: MotionValue<number> } {
  const latest = useRef(p);
  const t = useMotionValue(clock.now() - p.startedAt);
  const out = useMotionValue(p.phase === 'out' && p.outAt !== undefined ? clock.now() - p.outAt : -1);
  const step = () => {
    const q = latest.current;
    const now = clock.now();
    t.set(now - q.startedAt);
    out.set(q.phase === 'out' && q.outAt !== undefined ? now - q.outAt : -1);
  };
  useLayoutEffect(() => {
    latest.current = p;
    step();
  });
  useAnimationFrame(step);
  return { t, out };
}
