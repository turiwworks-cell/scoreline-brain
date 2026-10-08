import { lazy, Suspense, useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';
import { feel, spotRadius } from '../ui/feel';
import { liveIconSource } from './assets';
import { useRiveStart } from './startGate';
import { LIVE_BUTTON_W, LIVE_CANVAS_STYLE, LIVE_CAPSULE_PX, LIVE_OFF_W, livePx as px } from './liveGeometry';
import { LIVE_DIGITS, LIVE_STILL_VIEWBOX, liveDigits } from './liveStill';

const Graphic = lazy(() => import('./LiveGraphic'));
const Off = lazy(() => import('./LiveOff'));
// The capsule uses the same fixed hover-light dimensions on every render.
const light = { '--cap-on': px(LIVE_BUTTON_W), '--cap-off': px(LIVE_OFF_W), '--spot-r': px(spotRadius(LIVE_CAPSULE_PX, LIVE_CAPSULE_PX)) } as CSSProperties;

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

/** The art as it stands with Live on, `count` in the calendar: Rive's own drawing until Rive draws (liveStill.ts). */
function LiveStill({ count }: { count: number }) {
  return (
    <svg viewBox={LIVE_STILL_VIEWBOX} style={LIVE_CANVAS_STYLE} aria-hidden="true" data-live-still="">
      <use href="#live-still" />
      {liveDigits(count).map(({ digit, x }, i) => <use key={i} href={`#ld${digit}`} x={x} y={LIVE_DIGITS.baseline} />)}
    </svg>
  );
}

/**
 * DOM owns the hit target, URL, accessibility and hover light. Rive owns the artwork. The DOM
 * button (`fallback`, `children`) is drawn only without the artwork, when there is no asset or it
 * failed. While the artwork is on its way the button keeps the art's box and shows the art's still
 * with Live on, nothing with it off, so the page never shows another Live design before Rive's
 * (index.html's first frame shows the same still). Rive takes its place in the same frame.
 * Reduced motion uses the same ON/OFF stills and count without mounting Rive or its hover light.
 */
export function LiveIcon({ live, count, onChange, className, lightClassName, fallback, children }: LiveIconProps) {
  const reduce = useReducedMotionPreference();
  // Unmounting the Graphic resets readiness through its binding cleanup.
  const [art, setArt] = useState<'coming' | 'shown' | 'failed'>('coming');
  const lightRef = useRef<HTMLSpanElement>(null);
  // the artwork is fetched and started only once the shell lets Rive start (startGate.ts)
  const start = useRiveStart();
  const ready = !reduce && art === 'shown';
  const dom = !liveIconSource || art === 'failed';
  const artworkReady = useCallback((value: boolean) => setArt((a) => (a === 'failed' ? a : value ? 'shown' : 'coming')), []);
  const artworkFailed = useCallback(() => setArt('failed'), []);
  const staticButton = <>{fallback}{children}</>;
  // Rive draws its own glass pane
  const buttonClass = dom ? className : className?.split(/\s+/).filter((name) => name !== 'm-glass').join(' ');
  const style: CSSProperties = {
    position: 'relative',
    ...(!dom && { width: px(LIVE_BUTTON_W), height: px(LIVE_CAPSULE_PX), padding: 0, background: 'transparent' }),
  };
  return (
    <button type="button" className={`m-feel ${buttonClass ?? ''}`} data-rive-live={ready || undefined}
      style={style} aria-pressed={live} aria-label={`Live, ${count} in play`} onClick={() => onChange(!live)} {...feel}>
      {!dom && !ready && live && <LiveStill count={count} />}
      {dom || !liveIconSource ? staticButton : reduce ? (
        !live && <Suspense fallback={null}><Off count={count} /></Suspense>
      ) : start && (
        <Suspense fallback={null}>
          <Graphic source={liveIconSource} live={live} count={count} onReady={artworkReady} onFailed={artworkFailed} fallback={staticButton} light={lightClassName ? lightRef : undefined} />
        </Suspense>
      )}
      {ready && lightClassName && <span ref={lightRef} className={`m-light ${lightClassName}`} style={light} data-on={live || undefined} aria-hidden="true" />}
    </button>
  );
}
