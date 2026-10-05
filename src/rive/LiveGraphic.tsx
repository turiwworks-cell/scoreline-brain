import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { LIVE_CANVAS_STYLE } from './liveGeometry';
import { liveLightMotion, liveTimelineMs } from './liveLight';
import { RiveCanvas } from './RiveCanvas';
import type { Property, RiveInstance } from './types';

export type LiveGraphicProps = {
  source: string;
  live: boolean;
  count: number;
  /** true once the art is on screen, settled; false when it goes */
  onReady?(ready: boolean): void;
  /** the art could not be drawn: the host shows its own button */
  onFailed?(): void;
  fallback: ReactNode;
  /** the host's hover light over the art (LiveIcon), whose capsule moves with the art's */
  light?: RefObject<HTMLElement | null>;
};

/*
 * The exported artwork owns the complete button, including the moving counter. The signed export
 * also contains a font helper, so the full button is selected by its authored artboard name.
 *
 * One way only: the app (the URL's `live`) sets `islive`, Rive never sets the app. Rive's own
 * listeners are off (the DOM button is the hit target), so the only changes Rive could report are
 * echoes of our own writes, and an echo that arrives a frame late, after a second quick tap,
 * switched Live back off by itself.
 */
/** A frame or two past the timeline, so the art is still when it appears. */
const SETTLE_MS = 50;

export default function LiveGraphic({ source, live, count, onReady, onFailed, fallback, light }: LiveGraphicProps) {
  const [drawn, setDrawn] = useState(false);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const property = useRef<Property<boolean> | null>(null);
  const counter = useRef<Property<string> | null>(null);
  const latest = useRef({ live, count, onReady, onFailed });
  useLayoutEffect(() => {
    latest.current = { live, count, onReady, onFailed };
    if (property.current && property.current.value !== live) property.current.value = live;
    if (counter.current && counter.current.value !== String(count)) counter.current.value = String(count);
  }, [live, count, onReady, onFailed]);
  /*
   * Rive's first frame plays the timeline of the state it starts in (the capsule opening, or
   * closing). The art stays hidden through it and appears settled, so the page opens on the button
   * as it is; a toggle meanwhile waits for its own timeline instead.
   */
  useEffect(() => {
    if (!drawn || shown) return;
    const timer = setTimeout(() => {
      setShown(true);
      latest.current.onReady?.(true);
    }, liveTimelineMs(live) + SETTLE_MS);
    return () => clearTimeout(timer);
  }, [drawn, shown, live]);
  /*
   * The light's capsule moves with the art's: after each islive write it plays the timeline Rive
   * plays (liveLight.ts), not a transition of its own beside it. Rive starts that timeline on its
   * first frame after the write, so the light's clock starts on the same frame; left to itself it
   * would start a frame later, or after whatever long task the toggle sets off, and trail the art
   * by that much. The art appears settled, so there is nothing to play until the first toggle.
   */
  const litFor = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!shown || !light) return;
    if (litFor.current === null || litFor.current === live) {
      litFor.current = live;
      return;
    }
    litFor.current = live;
    let motion: Animation | undefined;
    const frame = requestAnimationFrame(() => {
      const el = light.current;
      if (!el || typeof el.animate !== 'function') return;
      const { keyframes, duration } = liveLightMotion(live);
      motion = el.animate(keyframes, { duration, easing: 'linear' });
      motion.startTime = document.timeline.currentTime;
    });
    return () => {
      cancelAnimationFrame(frame);
      motion?.cancel();
    };
  }, [live, shown, light]);
  const bind = (instance: RiveInstance) => {
    const vm = instance.viewModelInstance;
    const p = vm?.boolean('islive');
    const text = vm?.string('count');
    if (!p) throw new Error('Live icon requires a bound Boolean islive');
    if (!text) throw new Error('Full Live button requires a bound String count');
    property.current = p;
    counter.current = text;
    p.value = latest.current.live;
    text.value = String(latest.current.count);
    return {
      resume() {
        if (p.value !== latest.current.live) p.value = latest.current.live;
        if (text.value !== String(latest.current.count)) text.value = String(latest.current.count);
      },
      cleanup() {
        property.current = null; counter.current = null;
        latest.current.onReady?.(false);
      },
    };
  };
  const failedLoad = () => {
    setFailed(true);
    latest.current.onReady?.(false);
    latest.current.onFailed?.();
  };
  return (
    <span aria-hidden="true" style={{ display: 'contents' }}>
      {failed && fallback}
      {!failed && <RiveCanvas source={source} artboard="aniamtion" oversample={2} bind={bind} onReady={() => setDrawn(true)} onError={failedLoad} style={{ ...LIVE_CANVAS_STYLE, opacity: shown ? 1 : 0, transition: 'opacity 160ms ease-out' }} />}
    </span>
  );
}
