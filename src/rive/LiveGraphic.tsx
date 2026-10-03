import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { RiveCanvas } from './RiveCanvas';
import type { Property, RiveInstance } from './types';

export default function LiveGraphic({ source, live, onChange, fallback }: { source: string; live: boolean; onChange(live: boolean): void; fallback: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const property = useRef<Property<boolean> | null>(null);
  const latest = useRef({ live, onChange });
  useLayoutEffect(() => {
    latest.current = { live, onChange };
    if (property.current && property.current.value !== live) property.current.value = live;
  }, [live, onChange]);
  const bind = (instance: RiveInstance) => {
    const p = instance.viewModelInstance?.boolean('islive');
    if (!p) throw new Error('Live icon requires a bound Boolean islive');
    property.current = p;
    p.value = latest.current.live;
    const changed = () => {
      if (p.value !== latest.current.live) latest.current.onChange(p.value);
    };
    p.on(changed);
    return {
      resume() { if (p.value !== latest.current.live) p.value = latest.current.live; },
      cleanup() { p.off(changed); property.current = null; },
    };
  };
  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-grid', alignItems: 'center', height: 27 }}>
      <span style={{ gridArea: '1 / 1', visibility: ready && !failed ? 'hidden' : undefined }}>{fallback}</span>
      {!failed && <RiveCanvas source={source} bind={bind} onReady={() => setReady(true)} onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: ready ? 1 : 0 }} />}
    </span>
  );
}
