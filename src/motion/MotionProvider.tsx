import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';

/*
 * Motion for the whole app (ARCHITECTURE §5):
 * - LazyMotion with the domAnimation features, and `m` components everywhere (strict: a stray
 *   `motion.div` throws, so the full bundle never sneaks in). No `layout` features: shared
 *   elements fly through src/motion/flight.ts instead.
 * - reducedMotion="user": with the OS setting on, transforms jump to their end and only opacity
 *   animates. Shared-element flights are skipped as well (flight.ts reads the same setting).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
