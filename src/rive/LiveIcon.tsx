import { lazy, Suspense, useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { feel, spotRadius } from '../ui/feel';
import { liveIconSource } from './assets';
import { useRiveStart } from './startGate';
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

/**
 * DOM owns the hit target, URL, accessibility and hover light. Rive owns the artwork. The DOM
 * button (`fallback`, `children`) is drawn only without the artwork, when there is no asset or it
 * failed: while the artwork is on its way the button keeps the art's box and shows nothing, so the
 * page never shows a second Live design before Rive's (index.html's first frame does the same).
 */
export function LiveIcon({ live, count, onChange, className, lightClassName, fallback, children }: LiveIconProps) {
  const [art, setArt] = useState<'coming' | 'shown' | 'failed'>('coming');
  const lightRef = useRef<HTMLSpanElement>(null);
  // the artwork is fetched and started only once the shell lets Rive start (startGate.ts)
  const start = useRiveStart();
  const ready = art === 'shown';
  const dom = !liveIconSource || art === 'failed';
  const artworkReady = useCallback((value: boolean) => setArt((a) => (a === 'failed' ? a : value ? 'shown' : 'coming')), []);
  const artworkFailed = useCallback(() => setArt('failed'), []);
  const staticButton = <>{fallback}{children}</>;
  // Rive draws its own glass pane
  const buttonClass = dom ? className : className?.split(/\s+/).filter((name) => name !== 'm-glass').join(' ');
  const style: CSSProperties = {
    position: 'relative',
    ...(dom ? {} : { width: px(LIVE_BUTTON_W), height: px(LIVE_CAPSULE_PX), padding: 0, background: 'transparent' }),
  };
  // The light reaches as far as on the round menu button beside it: a control the capsule's height,
  // not the whole button (feel.ts sizes it from the button, which lit the capsule's rim end to end).
  const light = { '--cap-on': px(LIVE_BUTTON_W), '--cap-off': px(LIVE_OFF_W), '--spot-r': px(spotRadius(LIVE_CAPSULE_PX, LIVE_CAPSULE_PX)) } as CSSProperties;
  return (
    <button type="button" className={`m-feel ${buttonClass ?? ''}`} data-rive-live={ready || undefined}
      style={style} aria-pressed={live} aria-label={`Live, ${count} in play`} onClick={() => onChange(!live)} {...feel}>
      {dom || !liveIconSource ? staticButton : start && (
        <Suspense fallback={null}>
          <Graphic source={liveIconSource} live={live} count={count} onReady={artworkReady} onFailed={artworkFailed} fallback={staticButton} light={lightClassName ? lightRef : undefined} />
        </Suspense>
      )}
      {ready && lightClassName && <span ref={lightRef} className={`m-light ${lightClassName}`} style={light} data-on={live || undefined} aria-hidden="true" />}
    </button>
  );
}
