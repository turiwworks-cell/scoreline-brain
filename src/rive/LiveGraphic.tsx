import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LIVE_CANVAS_STYLE } from './liveGeometry';
import { RiveCanvas } from './RiveCanvas';
import type { Property, RiveInstance } from './types';

export type LiveGraphicProps = {
  source: string;
  live: boolean;
  count: number;
  onReady?(ready: boolean): void;
  fallback: ReactNode;
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
export default function LiveGraphic({ source, live, count, onReady, fallback }: LiveGraphicProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const property = useRef<Property<boolean> | null>(null);
  const counter = useRef<Property<string> | null>(null);
  const latest = useRef({ live, count, onReady });
  useLayoutEffect(() => {
    latest.current = { live, count, onReady };
    if (property.current && property.current.value !== live) property.current.value = live;
    if (counter.current && counter.current.value !== String(count)) counter.current.value = String(count);
  }, [live, count, onReady]);
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
  const loaded = () => { setReady(true); latest.current.onReady?.(true); };
  const failedLoad = () => { setFailed(true); latest.current.onReady?.(false); };
  return (
    <span aria-hidden="true" style={{ display: 'contents' }}>
      {(!ready || failed) && fallback}
      {!failed && <RiveCanvas source={source} artboard="aniamtion" bind={bind} onReady={loaded} onError={failedLoad} style={{ ...LIVE_CANVAS_STYLE, opacity: ready ? 1 : 0 }} />}
    </span>
  );
}
