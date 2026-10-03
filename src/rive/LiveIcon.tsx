import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { liveIconSource } from './assets';

const Graphic = lazy(() => import('./LiveGraphic'));
const LIVE_ARTBOARD_WIDTH = 443;
const LIVE_ARTBOARD_HEIGHT = 152;
const LIVE_DISPLAY_HEIGHT = 38;

export type LiveIconProps = {
  live: boolean;
  count: number;
  onChange(live: boolean): void;
  className?: string;
  fallback: ReactNode;
  children?: ReactNode;
};

/** DOM owns the hit target, URL and accessibility. Rive owns the complete animated artwork. */
export function LiveIcon({ live, count, onChange, className, fallback, children }: LiveIconProps) {
  const [ready, setReady] = useState(false);
  const artworkReady = useCallback((value: boolean) => setReady(value), []);
  const staticButton = <>{fallback}{children}</>;
  // Suppress the DOM glass rim only after the whole Rive button is successfully bound.
  const buttonClass = ready ? className?.split(/\s+/).filter((name) => name !== 'm-glass').join(' ') : className;
  return (
    <button type="button" className={buttonClass} data-rive-live={ready || undefined}
      style={{ position: 'relative', ...(ready ? { width: LIVE_ARTBOARD_WIDTH / LIVE_ARTBOARD_HEIGHT * LIVE_DISPLAY_HEIGHT, height: LIVE_DISPLAY_HEIGHT, padding: 0, background: 'transparent' } : {}) }}
      aria-pressed={live} aria-label={`Live, ${count} in play`} onClick={() => onChange(!live)}>
      {liveIconSource ? (
        <Suspense fallback={staticButton}>
          <Graphic source={liveIconSource} live={live} count={count} onChange={onChange} onReady={artworkReady} fallback={staticButton} />
        </Suspense>
      ) : staticButton}
    </button>
  );
}
