import { lazy, Suspense, type ReactNode } from 'react';
import { liveIconSource } from './assets';

const Graphic = lazy(() => import('./LiveGraphic'));

export type LiveIconProps = {
  live: boolean;
  count: number;
  onChange(live: boolean): void;
  className?: string;
  fallback: ReactNode;
  children?: ReactNode;
};

/** The DOM owns the hit target, URL state and accessibility; the Rive canvas is decorative. */
export function LiveIcon({ live, count, onChange, className, fallback, children }: LiveIconProps) {
  return (
    <button type="button" className={className} aria-pressed={live} aria-label={`Live, ${count} in play`} onClick={() => onChange(!live)}>
      {liveIconSource ? (
        <Suspense fallback={fallback}>
          <Graphic source={liveIconSource} live={live} onChange={onChange} fallback={fallback} />
        </Suspense>
      ) : fallback}
      {children}
    </button>
  );
}
