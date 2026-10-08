import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { LIVE_CANVAS_STYLE } from './liveGeometry';
import { liveLightMotion, liveTimelineMs } from './liveLight';
import { LiveOff } from './LiveOff';
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
/*
 * With Live off, at rest, the artwork is the owner's supplied OFF art (LiveOff.tsx), not Rive's own
 * drawing of that state. Rive still draws every move: it plays the opening timeline (and the closing
 * one) in the same box, and the supplied art takes over the frame the closing timeline has finished,
 * and gives way the frame Live comes on, so the capsule never jumps nor waits for a swap.
 */

export default function LiveGraphic({ source, live, count, onReady, onFailed, fallback, light }: LiveGraphicProps) {
  const [drawn, setDrawn] = useState(false);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  // the supplied OFF art stands in for Rive's, Live off and the closing timeline played
  const [offArt, setOffArt] = useState(false);
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
   * closing). The art stays hidden through it, behind the host's still of the same art, and takes
   * its place settled, in one frame; a toggle meanwhile waits for its own timeline instead.
   */
  useEffect(() => {
    if (!drawn || shown) return;
    const timer = setTimeout(() => {
      setShown(true);
      setOffArt(!latest.current.live);
      latest.current.onReady?.(true);
    }, liveTimelineMs(live) + SETTLE_MS);
    return () => clearTimeout(timer);
  }, [drawn, shown, live]);
  /*
   * Any toggle gives the frame back to Rive's canvas before it is painted: it starts its opening (or
   * closing) timeline from the pose the OFF art stood in. The OFF art returns once the closing
   * timeline has played.
   */
  const [liveWas, setLiveWas] = useState(live);
  if (liveWas !== live) {
    setLiveWas(live);
    if (offArt) setOffArt(false);
  }
  useEffect(() => {
    if (!shown || live) return;
    const timer = setTimeout(() => setOffArt(true), liveTimelineMs(false) + SETTLE_MS);
    return () => clearTimeout(timer);
  }, [live, shown]);
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
      {!failed && <RiveCanvas source={source} artboard="aniamtion" oversample={2} bind={bind} onReady={() => setDrawn(true)} onError={failedLoad} style={{ ...LIVE_CANVAS_STYLE, opacity: shown && !offArt ? 1 : 0 }} />}
      {!failed && shown && offArt && <LiveOff count={count} />}
    </span>
  );
}
