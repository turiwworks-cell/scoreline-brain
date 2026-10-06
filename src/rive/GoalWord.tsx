import { lazy, Suspense, type ReactNode } from 'react';
import type { MotionValue } from 'motion/react';
import { momentsSource } from './assets';
import { loadWord } from './wordChunk';

const Graphic = lazy(loadWord);

export type GoalWordProps = {
  kind: 'goal' | 'red';
  /** Host font size; maps the fixed 390 × 340 word artboard uniformly. */
  size?: number;
  colors: readonly [string, string];
  /** the scene's story time (wordClock): `play` fires when it reaches `start` */
  time: MotionValue<number>;
  /** the scene's real seconds, for the deadlines */
  elapsed: MotionValue<number>;
  start: number;
  /** true once the DOM word has the headline (wordClock): a binding then would swap in mid-flight */
  late(elapsed: number): boolean;
  /** real seconds by which it must have landed */
  full: number;
  /** a first tap: a word that has not landed gives way to the DOM word, shown landed */
  skipped: boolean;
  /**
   * The headline's rise once it has landed: its offset from where it starts (0, then up to `top`,
   * px) and its size against the start. The Rive word draws it itself, while the host keeps its
   * box still: a canvas moved and scaled by CSS is resampled at a new sub-pixel offset every
   * frame, and the word shook as it settled at the top.
   */
  rise?: { y: MotionValue<number>; scale: MotionValue<number>; top: number };
  /** the Rive word is bound and plays this scene's headline */
  onBound(): void;
  onPhase(phase: number): void;
  onFallback(): void;
  fallback: ReactNode;
};

/**
 * The DOM word plays when the Moments asset or its runtime is unavailable, or late. The two never
 * swap once the letters have begun (wordClock.ts).
 */
export function GoalWord(props: GoalWordProps) {
  return momentsSource ? (
    <Suspense fallback={props.fallback}><Graphic {...props} source={momentsSource} /></Suspense>
  ) : props.fallback;
}

