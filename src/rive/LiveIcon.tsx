import { lazy, Suspense, useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';
import { feel, spotRadius } from '../ui/feel';
import { liveIconSource } from './assets';
import { useRiveStart } from './startGate';
import { LIVE_BUTTON_W, LIVE_CANVAS_STYLE, LIVE_CAPSULE_PX, LIVE_OFF_W, livePx as px } from './liveGeometry';
import { LIVE_DIGITS, LIVE_STILL_VIEWBOX, liveDigits } from './liveStill';

const Graphic = lazy(() => import('./LiveGraphic'));
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

/** Both exported states are in the HTML sprite, available before any renderer download. */
function LiveStill({ live, count }: { live: boolean; count: number }) {
  return (
    <svg viewBox={LIVE_STILL_VIEWBOX} style={{ ...LIVE_CANVAS_STYLE, pointerEvents: 'none' }} aria-hidden="true" focusable="false" data-live-still="" data-live-off={!live ? '' : undefined}>
      <use href={live ? '#live-still' : '#live-off-still'} />
      {!live && count === 0 ? <use href="#live-off-zero" /> : liveDigits(count).map(({ digit, x }, i) => <use key={i} href={`#ld${digit}`} x={x} y={LIVE_DIGITS.baseline} />)}
    </svg>
  );
}

/**
 * DOM owns the hit target, URL, accessibility and hover light. Rive owns the artwork. The DOM
 * button (`fallback`, `children`) is drawn only when there is no artwork asset. Until Rive is
 * ready, or if its renderer fails, the selected ON/OFF SVG stays in the same fixed box.
 * index.html's first frame uses these same stills. Rive takes their place in the same frame.
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
  const dom = !liveIconSource;
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
      {!dom && !ready && <LiveStill live={live} count={count} />}
      {dom ? staticButton : !reduce && art !== 'failed' && start && (
        <Suspense fallback={null}>
          <Graphic source={liveIconSource!} live={live} count={count} onReady={artworkReady} onFailed={artworkFailed} fallback={staticButton} light={lightClassName ? lightRef : undefined} />
        </Suspense>
      )}
      {ready && lightClassName && <span ref={lightRef} className={`m-light ${lightClassName}`} style={light} data-on={live || undefined} aria-hidden="true" />}
    </button>
  );
}
