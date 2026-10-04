import { lazy, Suspense, useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { feel } from '../ui/feel';
import { liveIconSource } from './assets';
import { LIVE_BUTTON_W, LIVE_CAPSULE_PX, LIVE_OFF_W, livePx as px } from './liveGeometry';

const Graphic = lazy(() => import('./LiveGraphic'));

export type LiveIconProps = {
  live: boolean;
  count: number;
  onChange(live: boolean): void;
  className?: string;
  /** the class of the hover light laid over the artwork (Header.module.css .liveLight) */
  lightClassName?: string;
  fallback: ReactNode;
  children?: ReactNode;
};

/** DOM owns the hit target, URL, accessibility and hover light. Rive owns the animated artwork. */
export function LiveIcon({ live, count, onChange, className, lightClassName, fallback, children }: LiveIconProps) {
  const [ready, setReady] = useState(false);
  const artworkReady = useCallback((value: boolean) => setReady(value), []);
  const staticButton = <>{fallback}{children}</>;
  // Suppress the DOM glass pane only after the whole Rive button is bound: Rive draws its own.
  const buttonClass = ready ? className?.split(/\s+/).filter((name) => name !== 'm-glass').join(' ') : className;
  const style: CSSProperties = {
    position: 'relative',
    ...(ready ? { width: px(LIVE_BUTTON_W), height: px(LIVE_CAPSULE_PX), padding: 0, background: 'transparent' } : {}),
  };
  const light = { '--cap-on': px(LIVE_BUTTON_W), '--cap-off': px(LIVE_OFF_W) } as CSSProperties;
  return (
    <button type="button" className={`m-feel ${buttonClass ?? ''}`} data-rive-live={ready || undefined}
      style={style} aria-pressed={live} aria-label={`Live, ${count} in play`} onClick={() => onChange(!live)} {...feel}>
      {liveIconSource ? (
        <Suspense fallback={staticButton}>
          <Graphic source={liveIconSource} live={live} count={count} onReady={artworkReady} fallback={staticButton} />
        </Suspense>
      ) : staticButton}
      {ready && lightClassName && <span className={`m-light ${lightClassName}`} style={light} data-on={live || undefined} aria-hidden="true" />}
    </button>
  );
}
