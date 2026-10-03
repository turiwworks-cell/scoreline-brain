import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { RiveCanvas } from './RiveCanvas';
import type { Property, RiveInstance } from './types';

export type LiveGraphicProps = {
  source: string;
  live: boolean;
  count: number;
  onChange(live: boolean): void;
  onReady?(ready: boolean): void;
  fallback: ReactNode;
};

/** The exported artwork owns the complete button, including the moving counter. */
export default function LiveGraphic({ source, live, count, onChange, onReady, fallback }: LiveGraphicProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const property = useRef<Property<boolean> | null>(null);
  const counter = useRef<Property<string> | null>(null);
  const latest = useRef({ live, count, onChange, onReady });
  useLayoutEffect(() => {
    latest.current = { live, count, onChange, onReady };
    if (property.current && property.current.value !== live) property.current.value = live;
    if (counter.current && counter.current.value !== String(count)) counter.current.value = String(count);
  }, [live, count, onChange, onReady]);
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
    const changed = () => {
      if (p.value !== latest.current.live) latest.current.onChange(p.value);
    };
    p.on(changed);
    return {
      resume() {
        if (p.value !== latest.current.live) p.value = latest.current.live;
        if (text.value !== String(latest.current.count)) text.value = String(latest.current.count);
      },
      cleanup() {
        p.off(changed); property.current = null; counter.current = null;
        latest.current.onReady?.(false);
      },
    };
  };
  const loaded = () => { setReady(true); latest.current.onReady?.(true); };
  const failedLoad = () => { setFailed(true); latest.current.onReady?.(false); };
  return (
    <span aria-hidden="true" style={{ display: 'contents' }}>
      {(!ready || failed) && fallback}
      {!failed && <RiveCanvas source={source} bind={bind} onReady={loaded} onError={failedLoad} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: ready ? 1 : 0 }} />}
    </span>
  );
}
