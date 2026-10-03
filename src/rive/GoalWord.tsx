import { lazy, Suspense, type ReactNode } from 'react';
import type { MotionValue } from 'motion/react';
import { momentsSource } from './assets';

const Graphic = lazy(() => import('./WordGraphic'));

export type GoalWordProps = {
  kind: 'goal' | 'red';
  /** Host font size; maps the fixed 390 x 340 word artboard uniformly. */
  size?: number;
  colors: readonly [string, string];
  time: MotionValue<number>;
  start: number;
  full: number;
  skipped: boolean;
  onWaiting(): void;
  onPhase(phase: number): void;
  onFallback(): void;
  fallback: ReactNode;
};

/** The existing DOM word remains usable while the small Part 20 asset or its runtime is unavailable. */
export function GoalWord(props: GoalWordProps) {
  return momentsSource && !props.skipped ? (
    <Suspense fallback={props.fallback}><Graphic {...props} source={momentsSource} /></Suspense>
  ) : props.fallback;
}


